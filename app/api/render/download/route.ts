import { NextRequest, NextResponse } from "next/server";
import { isStudioAuthenticated } from "../../../../lib/studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isStudioAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = request.nextUrl.searchParams.get("key") || "";
  if (!key || key.startsWith("/") || key.split("/").some((part) => part === "..")) {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
  }
  const workerUrl = process.env.RENDER_WORKER_URL;
  const workerToken = process.env.WORKER_API_TOKEN;
  if (!workerUrl || !workerToken) return NextResponse.json({ error: "Render worker belum dikonfigurasi." }, { status: 503 });
  try {
    const upstream = await fetch(new URL("/files?key=" + encodeURIComponent(key), workerUrl), {
      headers: { Authorization: `Bearer ${workerToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(55000)
    });
    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json({ error: data.error || "Download video gagal." }, { status: upstream.status });
    }
    return new NextResponse(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="rendered-video.mp4"',
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Worker tidak dapat mengirim file video." }, { status: 502 });
  }
}
