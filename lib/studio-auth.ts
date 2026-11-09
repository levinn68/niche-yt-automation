import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "niche_studio_session";
function secret() {
  const value = process.env.STUDIO_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("STUDIO_SESSION_SECRET must be at least 32 characters.");
  return value;
}
function signature(expires: string) {
  return createHmac("sha256", secret()).update(expires).digest("hex");
}
export function isStudioAuthenticated(request: NextRequest) {
  try {
    const value = request.cookies.get(COOKIE)?.value || "";
    const [expires, sig] = value.split(".");
    if (!expires || !sig || Number(expires) < Date.now()) return false;
    const expected = Buffer.from(signature(expires));
    const actual = Buffer.from(sig);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}
export function setStudioSession(response: NextResponse) {
  const expires = String(Date.now() + 1000 * 60 * 60 * 24 * 7);
  response.cookies.set(COOKIE, expires + "." + signature(expires), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
export function clearStudioSession(response: NextResponse) {
  response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
