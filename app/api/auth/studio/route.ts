import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { clearStudioSession, setStudioSession } from "../../../../lib/studio-auth";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const { isStudioAuthenticated } = await import("../../../../lib/studio-auth");
  return NextResponse.json({ authenticated: isStudioAuthenticated(request) });
}
export async function POST(request: NextRequest) {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return NextResponse.json({ error: "STUDIO_PASSWORD belum dikonfigurasi." }, { status: 503 });
  try {
    const body = await request.json();
    const supplied = typeof body.password === "string" ? body.password : "";
    const a = Buffer.from(supplied); const b = Buffer.from(password);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Password tidak cocok." }, { status: 401 });
    return setStudioSession(NextResponse.json({ authenticated: true }));
  } catch {
    return NextResponse.json({ error: "Login gagal." }, { status: 400 });
  }
}
export async function DELETE() {
  return clearStudioSession(NextResponse.json({ authenticated: false }));
}
