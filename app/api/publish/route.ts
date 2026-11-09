import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const expected = process.env.STUDIO_ACCESS_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") || "";
  if (!expected || supplied !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workerUrl = process.env.RENDER_WORKER_URL;
  const workerToken = process.env.WORKER_API_TOKEN;
  if (!workerUrl || !workerToken) return NextResponse.json({ error: "Publishing worker belum dikonfigurasi." }, { status: 503 });
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description : "";
    const objectKey = typeof body.objectKey === "string" ? body.objectKey : "";
    const channelId = typeof body.channelId === "string" ? body.channelId : "";
    const privacyStatus = ["private","unlisted","public"].includes(body.privacyStatus) ? body.privacyStatus : "private";
    const publishAt = body.publishAt ? new Date(body.publishAt).toISOString() : undefined;
    if (!title || !objectKey || !channelId) return NextResponse.json({ error: "Title, objectKey, and channelId are required." }, { status: 400 });
    if (title.length > 100 || description.length > 5000) return NextResponse.json({ error: "Title max 100 and description max 5000 characters." }, { status: 400 });
    const jobId = randomUUID();
    const response = await fetch(new URL("/jobs/publish", workerUrl), {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({ jobId, objectKey, title, description, tags: Array.isArray(body.tags) ? body.tags.filter((x: unknown) => typeof x === "string").slice(0, 30) : [], privacyStatus, publishAt, channelId }),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publish request failed." }, { status: 400 });
  }
}
