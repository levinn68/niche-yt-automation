import { google } from "googleapis";
import { Pool } from "pg";
import { createDecipheriv } from "node:crypto";
import { createReadStream, writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { getObject } from "./storage.js";
import type { PublishPayload } from "./queue.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined, max: 2 });
function decrypt(value: string) {
  const [iv, tag, data] = value.split(".");
  const raw = process.env.APP_ENCRYPTION_KEY || "";
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32 || !iv || !tag || !data) throw new Error("Invalid encryption configuration");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export async function publishJob(payload: PublishPayload) {
  const result = await pool.query(
    `SELECT a.refresh_token_enc, a.access_token_enc, c.channel_id
     FROM niche_yt.youtube_accounts a
     JOIN niche_yt.youtube_channels c ON c.account_id=a.id
     WHERE a.workspace_id=$1 AND c.channel_id=$2 AND a.selected_channel_id=$2 LIMIT 1`,
    [process.env.YOUTUBE_WORKSPACE_ID || "default", payload.channelId]
  );
  const account = result.rows[0];
  if (!account) throw new Error("Target channel is not the selected connected channel");
  if (!account.refresh_token_enc) throw new Error("Missing refresh token. Reconnect YouTube with offline access.");
  const oauth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.YOUTUBE_REDIRECT_URI);
  oauth.setCredentials({
    refresh_token: decrypt(account.refresh_token_enc),
    access_token: decrypt(account.access_token_enc)
  });
  const youtube = google.youtube({ version: "v3", auth: oauth });
  const mp4 = await getObject(payload.objectKey);
  const dir = await mkdtemp(path.join(tmpdir(), "niche-upload-"));
  const filePath = path.join(dir, "video.mp4");
  try {
    await writeFile(filePath, mp4);
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: payload.title.slice(0, 100), description: payload.description.slice(0, 5000), tags: (payload.tags || []).slice(0, 500) },
        status: {
          privacyStatus: payload.publishAt ? "private" : payload.privacyStatus,
          ...(payload.publishAt ? { publishAt: new Date(payload.publishAt).toISOString() } : {})
        }
      },
      media: { body: createReadStream(filePath) }
    });
    return { videoId: response.data.id, channelId: payload.channelId, status: response.data.status?.privacyStatus };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
