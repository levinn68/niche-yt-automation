import { NextRequest, NextResponse } from "next/server";
import { unzipSync, strFromU8 } from "fflate";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 100 * 1024 * 1024;
const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

function inspectSource(source: string) {
  const widthMatch = source.match(/\bwidth\s*[:=]\s*(\d{2,5})/);
  const heightMatch = source.match(/\bheight\s*[:=]\s*(\d{2,5})/);
  const width = widthMatch ? Number(widthMatch[1]) : null;
  const height = heightMatch ? Number(heightMatch[1]) : null;
  const ratio = width && height ? width / height < 0.8 ? "9:16" : width / height > 1.2 ? "16:9" : "custom" : "unknown";
  return { width, height, ratio, hasComposition: /<Composition\b|registerRoot\s*\(/.test(source), hasRemotionImport: /from\s+["']remotion["']/.test(source), hasAudioReference: /<Audio\b|staticFile\s*\(/.test(source) };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const code = form.get("code");
    const file = form.get("file");

    if (typeof code === "string" && code.trim()) {
      if (code.length > 2_000_000) return NextResponse.json({ error: "Kode maksimum 2 MB." }, { status: 413 });
      return NextResponse.json({ source: "code", filename: "pasted-project.tsx", entryFile: "src/index.tsx", ...inspectSource(code), note: "Source mandiri diperiksa tanpa dieksekusi." });
    }

    if (!(file instanceof File)) return NextResponse.json({ error: "Upload file .tsx atau project .zip." }, { status: 400 });
    if (file.name.toLowerCase().endsWith(".tsx")) {
      if (file.size > 2_000_000) return NextResponse.json({ error: "File TSX maksimum 2 MB." }, { status: 413 });
      const source = await file.text();
      return NextResponse.json({ source: "tsx", filename: file.name, entryFile: "src/index.tsx", ...inspectSource(source), note: "File TSX mandiri diperiksa tanpa dieksekusi. Import asset atau module eksternal tetap memerlukan project ZIP." });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) return NextResponse.json({ error: "Format upload hanya .tsx atau .zip." }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Ukuran ZIP maksimum 100 MB." }, { status: 413 });

    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => !entry.name.startsWith("__MACOSX/") });
    const names = Object.keys(entries);
    if (names.length > 1000) return NextResponse.json({ error: "ZIP maksimum 1.000 file." }, { status: 413 });
    const sourceFiles = names.filter((name) => SOURCE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)));
    if (!sourceFiles.length) return NextResponse.json({ error: "ZIP tidak berisi source .tsx, .ts, .jsx, atau .js." }, { status: 422 });
    const candidates = [...sourceFiles].sort((a,b) => Number(/(^|\/)(src\/)?(root|index|video|remotion|main)\.(tsx|ts|jsx|js)$/i.test(b)) - Number(/(^|\/)(src\/)?(root|index|video|remotion|main)\.(tsx|ts|jsx|js)$/i.test(a)));
    let details: ReturnType<typeof inspectSource> | null = null;
    let entryFile: string | null = null;
    for (const name of candidates) {
      const data = entries[name];
      if (!data || data.length > 2_000_000) continue;
      const result = inspectSource(strFromU8(data));
      if (result.hasComposition || result.hasRemotionImport) { details = result; entryFile = name; break; }
    }
    return NextResponse.json({ source: "zip", filename: file.name, filesFound: names.length, sourceFiles, entryFile, ...(details || { width: null, height: null, ratio: "unknown", hasComposition: false, hasRemotionImport: false, hasAudioReference: false }), note: "ZIP diperiksa tanpa menjalankan source." });
  } catch {
    return NextResponse.json({ error: "ZIP tidak valid atau gagal dibaca." }, { status: 400 });
  }
}