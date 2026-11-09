import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const expected = process.env.STUDIO_ACCESS_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") || "";
  if (!expected || supplied !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workerUrl = process.env.RENDER_WORKER_URL;
  const workerToken = process.env.WORKER_API_TOKEN;
  if (!workerUrl || !workerToken) return NextResponse.json({ error: "Render worker belum dikonfigurasi." }, { status: 503 });
  try {
    const response = await fetch(new URL(`/jobs/${encodeURIComponent(context.params.id)}`, workerUrl), {
      headers: { Authorization: `Bearer ${workerToken}` }, cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "Worker tidak dapat dijangkau." }, { status: 502 });
  }
}
