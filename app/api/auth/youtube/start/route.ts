import { createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { isStudioAuthenticated } from "../../../../../lib/studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function config() {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REDIRECT_URI) throw new Error("Konfigurasi YouTube OAuth belum lengkap.");
  return { clientId: YOUTUBE_CLIENT_ID, clientSecret: YOUTUBE_CLIENT_SECRET, redirectUri: YOUTUBE_REDIRECT_URI };
}

export async function GET(request: NextRequest) {
  if (!isStudioAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const cfg = config();
    const state = randomBytes(32).toString("hex");
    const secret = process.env.APP_ENCRYPTION_KEY;
    if (!secret) throw new Error("APP_ENCRYPTION_KEY belum dikonfigurasi.");
    const signature = createHmac("sha256", secret).update(state).digest("hex");
    const oauth = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
    const url = oauth.generateAuthUrl({
      access_type: "offline", prompt: "select_account consent", include_granted_scopes: true,
      scope: ["openid", "email", "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"],
      state: state + "." + signature
    });
    const response = NextResponse.redirect(url);
    response.cookies.set("yt_oauth_state", state + "." + signature, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/api/auth/youtube", maxAge: 600
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "OAuth tidak dapat dimulai." }, { status: 500 });
  }
}
