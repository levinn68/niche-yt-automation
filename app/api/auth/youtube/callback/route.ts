import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { saveYouTubeConnection } from "../../../../../lib/youtube-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = process.env.APP_URL || request.nextUrl.origin;
  const fail = (message: string) => NextResponse.redirect(new URL("/?youtube_error=" + encodeURIComponent(message), origin));
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state") || "";
    const cookieState = request.cookies.get("yt_oauth_state")?.value || "";
    const secret = process.env.APP_ENCRYPTION_KEY;
    const parts = state.split(".");
    if (!code || !secret || parts.length !== 2 || !cookieState || cookieState !== state) return fail("Verifikasi OAuth gagal. Coba hubungkan ulang.");
    const expected = createHmac("sha256", secret).update(parts[0]).digest("hex");
    const a = Buffer.from(expected); const b = Buffer.from(parts[1]);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("State OAuth tidak valid.");

    const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI } = process.env;
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REDIRECT_URI) return fail("Konfigurasi OAuth belum lengkap.");
    const oauth = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI);
    const { tokens } = await oauth.getToken(code);
    if (!tokens.access_token) return fail("Google tidak mengembalikan access token.");
    oauth.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: oauth });
    const [channelResponse, userResponse] = await Promise.all([
      youtube.channels.list({ part: ["snippet"], mine: true, maxResults: 50 }),
      google.oauth2("v2").userinfo.get({ auth: oauth })
    ]);
    const channels = (channelResponse.data.items || []).flatMap(item => item.id && item.snippet?.title ? [{
      id: item.id, title: item.snippet.title, thumbnail: item.snippet.thumbnails?.default?.url || null
    }] : []);
    if (!channels.length) return fail("Akun Google ini belum memiliki channel YouTube.");
    await saveYouTubeConnection({
      email: userResponse.data.email,
      refreshToken: tokens.refresh_token || null,
      accessToken: tokens.access_token,
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
      channels
    });
    const response = NextResponse.redirect(new URL("/?youtube_connected=1", origin));
    response.cookies.delete("yt_oauth_state");
    return response;
  } catch (error) {
    console.error("YouTube OAuth callback failed:", error);
    return fail(error instanceof Error ? error.message : "Gagal menghubungkan akun YouTube.");
  }
}
