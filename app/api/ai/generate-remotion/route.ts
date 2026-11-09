import { NextRequest, NextResponse } from "next/server";
import { isStudioAuthenticated } from "../../../../lib/studio-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY belum dikonfigurasi." }, { status: 503 });
  if (!isStudioAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const format = body.format === "16:9" ? "16:9" : "9:16";
    const style = typeof body.style === "string" ? body.style.slice(0, 80) : "clean motion graphics";
    if (!prompt || prompt.length > 8000) return NextResponse.json({ error: "Prompt wajib diisi, maksimum 8.000 karakter." }, { status: 400 });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are an expert Remotion video engineer. Return only valid JSON with keys entryPoint, compositionId, width, height, fps, durationInFrames, code. code must be a complete TSX file exporting a Remotion composition registered with registerRoot. Do not use external network resources. Keep code self-contained and use only remotion and React imports." }] },
        contents: [{ role: "user", parts: [{ text: `Create a Remotion video. Format ${format}, visual style: ${style}. Brief: ${prompt}. Use 30 fps and a 30 second duration unless the brief specifies another duration.` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
      }),
      signal: AbortSignal.timeout(50000)
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "Gemini request failed." }, { status: 502 });
    const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    const result = JSON.parse(text);
    if (typeof result.code !== "string" || !result.code.includes("registerRoot") || !result.code.includes("Composition")) {
      return NextResponse.json({ error: "Gemini returned invalid Remotion source. Regenerate with a clearer prompt." }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI code generation failed." }, { status: 500 });
  }
}
