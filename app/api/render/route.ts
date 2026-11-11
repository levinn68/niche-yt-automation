import { NextRequest, NextResponse } from "next/server";
import { isStudioAuthenticated } from "../../../lib/studio-auth";
import { randomUUID } from "node:crypto";
import { unzipSync, zipSync, strToU8 } from "fflate";

export const runtime = "nodejs";
export const maxDuration = 60;

const REMOTION_PACKAGE = {
  name: "user-remotion-project",
  private: true,
  dependencies: { remotion: "^4.0.279", react: "^18.3.1", "react-dom": "^18.3.1" }
};

function findRegisterRootEntry(archive: Uint8Array): string | null {
  const files = unzipSync(archive);
  const candidates = Object.keys(files).filter((name) => /\.(tsx?|jsx?)$/i.test(name));
  for (const name of candidates) {
    const source = files[name];
    if (source && /registerRoot\s*\(/.test(new TextDecoder().decode(source))) return name;
  }
  return null;
}

function buildSingleFileProject(sourceCode: string): { archive: Uint8Array; entryPoint: string } {
  // A standalone Remotion root can be used directly. Otherwise, wrap an exported
  // component in a minimal registerRoot entry so Remotion receives a valid entry point.
  if (/registerRoot\s*\(/.test(sourceCode)) {
    return {
      archive: zipSync({
        "src/index.tsx": strToU8(sourceCode),
        "package.json": strToU8(JSON.stringify(REMOTION_PACKAGE))
      }),
      entryPoint: "src/index.tsx"
    };
  }

  const defaultExport = /export\s+default\s+(?:function\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))/;
  const namedExport = /export\s+(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)/;
  const defaultMatch = sourceCode.match(defaultExport);
  const namedMatch = sourceCode.match(namedExport);
  let importLine: string;

  if (defaultMatch) {
    importLine = 'import UserRoot from "./UserProject";';
  } else if (namedMatch) {
    importLine = `import { ${namedMatch[1]} as UserRoot } from "./UserProject";`;
  } else {
    throw new Error("File TSX harus mengekspor komponen Remotion (export default atau named export). Untuk project multi-file atau asset, upload ZIP project lengkap.");
  }

  const entrySource = `import React from "react";
import { registerRoot } from "remotion";
${importLine}

registerRoot(UserRoot);
`;

  return {
    archive: zipSync({
      "src/UserProject.tsx": strToU8(sourceCode),
      "src/index.tsx": strToU8(entrySource),
      "package.json": strToU8(JSON.stringify(REMOTION_PACKAGE))
    }),
    entryPoint: "src/index.tsx"
  };
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
    let entryPoint = String(form.get("entryPoint") || "src/index.tsx");
    const compositionId = String(form.get("compositionId") || "");
    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    const inputPropsRaw = String(form.get("inputProps") || "{}");
    if (!compositionId || ![width, height].every((n) => Number.isFinite(n) && n > 0)) return NextResponse.json({ error: "Composition ID dan dimensi output wajib valid." }, { status: 400 });

    let archive: Uint8Array;
    if (zip instanceof File && zip.name.toLowerCase().endsWith(".zip")) {
      if (zip.size > 100 * 1024 * 1024) return NextResponse.json({ error: "ZIP maksimum 100 MB." }, { status: 413 });
      archive = new Uint8Array(await zip.arrayBuffer());
      const detectedEntry = findRegisterRootEntry(archive);
      if (!detectedEntry) {
        return NextResponse.json({ error: "Project ZIP tidak memiliki file entry point yang memanggil registerRoot(). Tambahkan src/index.tsx yang memanggil registerRoot(Root), lalu upload ulang." }, { status: 422 });
      }
      entryPoint = detectedEntry;
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
      try {
        const single = buildSingleFileProject(sourceCode);
        archive = single.archive;
        entryPoint = single.entryPoint;
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Source TSX tidak dapat disiapkan." }, { status: 422 });
      }
    }

    let inputProps: Record<string, unknown>;
    try { inputProps = JSON.parse(inputPropsRaw); } catch { return NextResponse.json({ error: "inputProps harus JSON valid." }, { status: 400 }); }
    const requestedJobId = String(form.get("clientJobId") || "");
    const jobId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedJobId) ? requestedJobId : randomUUID();
    const payload = { jobId, zipBase64: Buffer.from(archive).toString("base64"), entryPoint, compositionId, inputProps, width, height, outputKey: "renders/" + jobId + ".mp4" };
    const response = await fetch(new URL("/jobs/render", workerUrl), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + workerToken }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: result.error || "Worker gagal menerima render." }, { status: response.status });
    return NextResponse.json({ ...result, outputKey: payload.outputKey, entryPoint }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render request gagal." }, { status: 500 });
  }
}