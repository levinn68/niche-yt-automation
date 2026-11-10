import { NextRequest, NextResponse } from "next/server";
import { isStudioAuthenticated } from "../../../lib/studio-auth";
import { randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";

export const runtime = "nodejs";
export const maxDuration = 60;

function safePath(name: string) {
  const normalized = name.replace(/\\/g, "/").replace(/^\.\//, "");
  return Boolean(normalized) && !normalized.startsWith("/") && !normalized.split("/").some((part) => part === ".." || part === ".");
}

export async function POST(request: NextRequest) {
  if (!isStudioAuthenticated(request)) return NextResponse.json({ error: "Unauthorized. Studio access token required." }, { status: 401 });
  const workerUrl = process.env.RENDER_WORKER_URL;
  const workerToken = process.env.WORKER_API_TOKEN;
  if (!workerUrl || !workerToken) return NextResponse.json({ error: "Render worker belum dikonfigurasi." }, { status: 503 });

  try {
    const form = await request.formData();
    const zip = form.get("file");
    const code = form.get("code");
    const uploaded = form.getAll("projectFiles").filter((item): item is File => item instanceof File && item.size > 0);
    const entryPoint = String(form.get("entryPoint") || "src/index.tsx");
    const compositionId = String(form.get("compositionId") || "");
    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    const fps = Number(form.get("fps"));
    const durationInFrames = Number(form.get("durationInFrames"));
    const inputPropsRaw = String(form.get("inputProps") || "{}");

    if (!compositionId || ![width, height, fps, durationInFrames].every((n) => Number.isFinite(n) && n > 0)) return NextResponse.json({ error: "Composition ID, dimensions, FPS, and duration are required." }, { status: 400 });

    let archive: Uint8Array;
    if (zip instanceof File) {
      if (zip.size > 100 * 1024 * 1024 || !zip.name.toLowerCase().endsWith(".zip")) return NextResponse.json({ error: "ZIP project maksimum 100 MB." }, { status: 413 });
      archive = new Uint8Array(await zip.arrayBuffer());
    } else if (uploaded.length) {
      const total = uploaded.reduce((sum, file) => sum + file.size, 0);
      if (total > 100 * 1024 * 1024 || uploaded.length > 1000) return NextResponse.json({ error: "Project maksimum 100 MB dan 1.000 file." }, { status: 413 });
      const entries: Record<string, Uint8Array> = {};
      for (const file of uploaded) {
        const path = file.webkitRelativePath || file.name;
        if (!safePath(path)) return NextResponse.json({ error: "Path file project tidak valid." }, { status: 400 });
        entries[path] = new Uint8Array(await file.arrayBuffer());
      }
      if (!Object.keys(entries).some((path) => /\.(tsx|ts|jsx|js)$/i.test(path))) return NextResponse.json({ error: "Project harus memiliki minimal satu source .tsx, .ts, .jsx, atau .js." }, { status: 422 });
      if (!entries["package.json"]) entries["package.json"] = strToU8(JSON.stringify({ name: "remotion-uploaded-project", private: true, dependencies: { remotion: "^4.0.279", react: "^18.3.1", "react-dom": "^18.3.1" } }));
      archive = zipSync(entries, { level: 1 });
    } else if (typeof code === "string" && code.trim()) {
      if (code.length > 2_000_000) return NextResponse.json({ error: "Source maksimum 2 MB." }, { status: 413 });
      const path = safePath(entryPoint) ? entryPoint : "src/index.tsx";
      archive = zipSync({ [path]: strToU8(code), "package.json": strToU8(JSON.stringify({ name: "user-remotion-project", private: true, dependencies: { remotion: "^4.0.279", react: "^18.3.1", "react-dom": "^18.3.1" } })) });
    } else {
      return NextResponse.json({ error: "Pilih file source, folder project, ZIP, atau paste kode." }, { status: 400 });
    }

    let inputProps: Record<string, unknown>;
    try { inputProps = JSON.parse(inputPropsRaw); } catch { return NextResponse.json({ error: "inputProps harus JSON valid." }, { status: 400 }); }
    const jobId = randomUUID();
    const payload = { jobId, zipBase64: Buffer.from(archive).toString("base64"), entryPoint, compositionId, inputProps, width, height, fps, durationInFrames, outputKey: "renders/" + jobId + ".mp4" };
    const response = await fetch(new URL("/jobs/render", workerUrl), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + workerToken }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: result.error || "Worker gagal menerima render." }, { status: response.status });
    return NextResponse.json({ ...result, outputKey: payload.outputKey }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render request gagal." }, { status: 500 });
  }
}