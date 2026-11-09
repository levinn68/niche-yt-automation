import { NextRequest, NextResponse } from "next/server";
import { getYouTubeChannels, selectYouTubeChannel } from "../../../../lib/youtube-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {\n  if (!isStudioAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const channels = await getYouTubeChannels();
    return NextResponse.json({
      connected: channels.length > 0,
      selectedChannelId: channels.find((channel) => channel.selected)?.id ?? null,
      channels
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tidak dapat mengambil daftar channel." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {\n  if (!isStudioAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
    if (!channelId || channelId.length > 128) {
      return NextResponse.json({ error: "channelId tidak valid." }, { status: 400 });
    }
    const result = await selectYouTubeChannel(channelId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tidak dapat memilih channel." },
      { status: 400 }
    );
  }
}
