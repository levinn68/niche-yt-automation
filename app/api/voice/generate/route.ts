import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY belum diatur di environment server." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : process.env.ELEVENLABS_DEFAULT_VOICE_ID;
    const modelId = typeof body.modelId === "string" ? body.modelId : "eleven_multilingual_v2";

    if (!text) return NextResponse.json({ error: "Narasi tidak boleh kosong." }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Narasi maksimum 5.000 karakter per permintaan." }, { status: 413 });
    if (!voiceId) return NextResponse.json({ error: "Pilih Voice ID ElevenLabs atau atur ELEVENLABS_DEFAULT_VOICE_ID." }, { status: 400 });

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: typeof body.stability === "number" ? Math.min(1, Math.max(0, body.stability)) : 0.5,
          similarity_boost: typeof body.similarityBoost === "number" ? Math.min(1, Math.max(0, body.similarityBoost)) : 0.75
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({
        error: response.status === 401 ? "API key ElevenLabs tidak valid." :
          response.status === 429 ? "Kuota atau rate limit ElevenLabs tercapai." :
          "ElevenLabs gagal membuat audio.",
        providerStatus: response.status,
        detail: detail.slice(0, 500)
      }, { status: response.status === 429 ? 429 : 502 });
    }

    const audio = await response.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="niche-yt-narration.mp3"',
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Permintaan voice generation tidak dapat diproses." }, { status: 500 });
  }
}