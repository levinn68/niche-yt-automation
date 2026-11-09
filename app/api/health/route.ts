import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    app: "niche-yt-studio",
    phase: 1,
    integrations: {
      elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_DEFAULT_VOICE_ID),
      youtubeOAuthConfigured: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REDIRECT_URI),
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      renderWorkerConfigured: Boolean(process.env.RENDER_WORKER_URL)
    },
    note: "Health check reports configuration presence only; it does not verify provider connectivity."
  });
}