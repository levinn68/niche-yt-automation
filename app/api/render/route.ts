import { NextRequest, NextResponse } from "next/server";
import { isStudioAuthenticated } from "../../../lib/studio-auth";
import { randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isStudioAuthenticated(request)) return NextResponse.json({ error: "Unauthorized. Studio access token required." }, { status: 401 });
  const workerUrl = process.env.RENDER_WORKER_URL;
  const workerToken = process.env.WORKER_API_TOKEN;
  if (!workerUrl || !workerToken) return NextResponse.json({ error: "Render worker belum dikonfigurasi." }, { status: 503 });

  try {
    const form = await request.formData();
    const zip = form.get("file");
    const code = form.get("code");
    const entryPoint = String(form.get("entryPoint") || "src/index.tsx");
    const compositionId = String(form.get("compositionId") || "");
    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    const inputPropsRaw = String(form.get("inputProps") || "{}");
    if (!compositionId || ![width, height].every((n) => Number.isFinite(n) && n > 0)) return NextResponse.json({ error: "Composition ID, dimensions, FPS, and duration are required." }, { status: 400 });

    let archive: Uint8Array;
    if (zip instanceof File && zip.name.toLowerCase().endsWith(".zip")) {
      if (zip.size > 100 * 1024 * 1024) return NextResponse.json({ error: "ZIP maksimum 100 MB." }, { status: 413 });
      archive = new Uint8Array(await zip.arrayBuffer());
    } else {
      let sourceCode = typeof code === "string" ? code : "";
      if (zip instanceof File && (zip.name.toLowerCase().endsWith(".tsx") || zip.name.toLowerCase().endsWith(".txt"))) {
        if (zip.size > 2_000_000) return NextResponse.json({ error: "File TSX/TXT maksimum 2 MB." }, { status: 413 });
        sourceCode = await zip.text();
      } else if (zip instanceof File) {
        return NextResponse.json({ error: "Format upload hanya .tsx, .txt, atau .zip." }, { status: 415 });
      }
      if (!sourceCode.trim()) return NextResponse.json({ error: "Upload project ZIP, file TSX/TXT, atau paste source mandiri." }, { status: 400 });
      if (sourceCode.length > 2_000_000) return NextResponse.json({ error: "Source maksimum 2 MB." }, { status: 413 });
      archive = zipSync({ [entryPoint]: strToU8(sourceCode), "package.json": strToU8(JSON.stringify({ name: "user-remotion-project", private: true, dependencies: { remotion: "^4.0.279", react: "^18.3.1", "react-dom": "^18.3.1" } })) });
    }

    let inputProps: Record<string, unknown>;
    try { inputProps = JSON.parse(inputPropsRaw); } catch { return NextResponse.json({ error: "inputProps harus JSON valid." }, { status: 400 }); }
    const requestedJobId = String(form.get("clientJobId") || "");
    const jobId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedJobId) ? requestedJobId : randomUUID();
    const payload = { jobId, zipBase64: Buffer.from(archive).toString("base64"), entryPoint, compositionId, inputProps, width, height, outputKey: "renders/" + jobId + ".mp4" };
    const response = await fetch(new URL("/jobs/render", workerUrl), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + workerToken }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: result.error || "Worker gagal menerima render." }, { status: response.status });
    return NextResponse.json({ ...result, outputKey: payload.outputKey }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render request gagal." }, { status: 500 });
  }
}