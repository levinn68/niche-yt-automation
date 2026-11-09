import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Pool } from "pg";

declare global { var __nichePgPool: Pool | undefined; }

const DB_SCHEMA = "niche_yt";

function pool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum dikonfigurasi.");
  if (!global.__nichePgPool) global.__nichePgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
    application_name: "niche-yt-studio"
  });
  return global.__nichePgPool;
}

function encryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY belum dikonfigurasi.");
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY harus 32 byte dalam format hex atau base64.");
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(value: string) {
  const [iv, tag, data] = value.split(".");
  if (!iv || !tag || !data) throw new Error("Format kredensial terenkripsi tidak valid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export async function saveYouTubeConnection(input: {
  email?: string | null;
  refreshToken: string | null;
  accessToken: string;
  expiresAt: Date;
  channels: Array<{ id: string; title: string; thumbnail?: string | null }>;
}) {
  const db = pool();
  const workspaceId = process.env.YOUTUBE_WORKSPACE_ID || "default";
  const encryptedRefresh = input.refreshToken ? encryptSecret(input.refreshToken) : null;
  const encryptedAccess = encryptSecret(input.accessToken);
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const saved = await client.query(
      `INSERT INTO ${DB_SCHEMA}.youtube_accounts
        (workspace_id, google_email, refresh_token_enc, access_token_enc, access_token_expires_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (workspace_id) DO UPDATE SET
         google_email=EXCLUDED.google_email,
         refresh_token_enc=COALESCE(EXCLUDED.refresh_token_enc, ${DB_SCHEMA}.youtube_accounts.refresh_token_enc),
         access_token_enc=EXCLUDED.access_token_enc,
         access_token_expires_at=EXCLUDED.access_token_expires_at,
         updated_at=NOW()
       RETURNING id`,
      [workspaceId, input.email ?? null, encryptedRefresh, encryptedAccess, input.expiresAt]
    );

    const accountId = saved.rows[0].id as string;
    await client.query(`DELETE FROM ${DB_SCHEMA}.youtube_channels WHERE account_id=$1`, [accountId]);
    for (const channel of input.channels) {
      await client.query(
        `INSERT INTO ${DB_SCHEMA}.youtube_channels
          (account_id, channel_id, channel_title, thumbnail_url)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (account_id, channel_id) DO UPDATE SET
           channel_title=EXCLUDED.channel_title,
           thumbnail_url=EXCLUDED.thumbnail_url`,
        [accountId, channel.id, channel.title, channel.thumbnail ?? null]
      );
    }
    await client.query(
      `UPDATE ${DB_SCHEMA}.youtube_accounts
       SET selected_channel_id = CASE
         WHEN selected_channel_id IN (SELECT channel_id FROM ${DB_SCHEMA}.youtube_channels WHERE account_id=$1)
         THEN selected_channel_id ELSE NULL END
       WHERE id=$1`,
      [accountId]
    );
    await client.query("COMMIT");
    return { accountId, channelCount: input.channels.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getYouTubeChannels() {
  const result = await pool().query(
    `SELECT c.channel_id AS id, c.channel_title AS title, c.thumbnail_url AS thumbnail,
            (a.selected_channel_id = c.channel_id) AS selected
     FROM ${DB_SCHEMA}.youtube_channels c
     JOIN ${DB_SCHEMA}.youtube_accounts a ON a.id=c.account_id
     WHERE a.workspace_id=$1
     ORDER BY c.channel_title`,
    [process.env.YOUTUBE_WORKSPACE_ID || "default"]
  );
  return result.rows;
}

export async function selectYouTubeChannel(channelId: string) {
  const result = await pool().query(
    `UPDATE ${DB_SCHEMA}.youtube_accounts a
     SET selected_channel_id=$2, updated_at=NOW()
     WHERE a.workspace_id=$1
       AND EXISTS (
         SELECT 1 FROM ${DB_SCHEMA}.youtube_channels c
         WHERE c.account_id=a.id AND c.channel_id=$2
       )
     RETURNING a.selected_channel_id`,
    [process.env.YOUTUBE_WORKSPACE_ID || "default", channelId]
  );
  if (!result.rowCount) throw new Error("Channel tidak ditemukan di akun yang terhubung.");
  return { selectedChannelId: result.rows[0].selected_channel_id as string };
}
