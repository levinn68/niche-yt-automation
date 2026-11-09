import { NextResponse } from "next/server";
import { getYouTubeChannels } from "../../../../lib/youtube-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const channels = await getYouTubeChannels();
    return NextResponse.json({ connected: channels.length > 0, channels });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tidak dapat mengambil daftar channel." }, { status: 500 });
  }
}
