import { NextRequest, NextResponse } from "next/server";
import { isStudioAuthenticated } from "../../../../lib/studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isStudioAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const workerUrl = process.env.RENDER_WORKER_URL;
  const workerToken = process.env.WORKER_API_TOKEN;

  if (!workerUrl || !workerToken) {
    return NextResponse.json({
      ok: false,
      connected: false,
      authenticated: false,
      error: "RENDER_WORKER_URL atau WORKER_API_TOKEN belum dikonfigurasi di Vercel."
    }, { status: 503 });
  }

  try {
    const healthResponse = await fetch(new URL("/health", workerUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!healthResponse.ok) {
      return NextResponse.json({
        ok: false, connected: false, authenticated: false,
        error: `Worker health check mengembalikan HTTP ${healthResponse.status}.`
      }, { status: 502 });
    }

    const health = await healthResponse.json();
    const authResponse = await fetch(new URL("/server-info", workerUrl), {
      headers: { Authorization: `Bearer ${workerToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });

    if (authResponse.status === 401) {
      return NextResponse.json({
        ok: false, connected: true, authenticated: false,
        worker: { service: health.service, instanceId: health.instanceId },
        error: "Worker dapat dijangkau, tetapi WORKER_API_TOKEN Vercel tidak cocok dengan token Worker."
      }, { status: 502 });
    }
    if (!authResponse.ok) {
      return NextResponse.json({
        ok: false, connected: true, authenticated: false,
        worker: { service: health.service, instanceId: health.instanceId },
        error: `Worker menerima koneksi tetapi pemeriksaan autentikasi gagal (HTTP ${authResponse.status}).`
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      authenticated: true,
      worker: {
        service: health.service,
        instanceId: health.instanceId,
        activeJobId: health.activeJobId ?? null
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      connected: false,
      authenticated: false,
      error: error instanceof Error ? error.message : "Worker tidak dapat dijangkau."
    }, { status: 502 });
  }
}