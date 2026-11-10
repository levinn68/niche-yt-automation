import { NextRequest, NextResponse } from "next/server";
import { unzipSync, strFromU8 } from "fflate";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 100 * 1024 * 1024;
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const isSource = (name: string) => EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

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
    const uploaded = form.getAll("projectFiles").filter((item): item is File => item instanceof File && item.size > 0);
    const file = form.get("file");

    if (typeof code === "string" && code.trim()) {
      if (code.length > 2_000_000) return NextResponse.json({ error: "Kode maksimum 2 MB." }, { status: 413 });
      return NextResponse.json({ source: "code", filename: "pasted-project.tsx", entryFile: "src/index.tsx", ...inspectSource(code), note: "Source diperiksa tanpa dieksekusi. Jika ada import lokal atau asset, upload folder project lengkap." });
    }

    if (uploaded.length) {
      const total = uploaded.reduce((sum, item) => sum + item.size, 0);
      if (total > MAX_BYTES || uploaded.length > 1000) return NextResponse.json({ error: "Project maksimum 100 MB dan 1.000 file." }, { status: 413 });
      const sources = uploaded.filter((item) => isSource(item.name));
      if (!sources.length) return NextResponse.json({ error: "Tidak ditemukan file .tsx, .ts, .jsx, atau .js." }, { status: 422 });
      const priority = (f: File) => /(^|\/)(src\/)?(root|index|video|remotion|main)\.(tsx|ts|jsx|js)$/i.test(f.webkitRelativePath || f.name) ? 1 : 0;
      sources.sort((a, b) => priority(b) - priority(a));
      let details: ReturnType<typeof inspectSource> | null = null;
      let entryFile: string | null = null;
      for (const sourceFile of sources) {
        if (sourceFile.size > 2_000_000) continue;
        const result = inspectSource(await sourceFile.text());
        if (result.hasComposition || result.hasRemotionImport) { details = result; entryFile = sourceFile.webkitRelativePath || sourceFile.name; break; }
      }
      return NextResponse.json({ source: "files", filename: uploaded[0].webkitRelativePath?.split("/")[0] || uploaded[0].name, filesFound: uploaded.length, sourceFiles: sources.map((f) => f.webkitRelativePath || f.name), entryFile, ...(details || { width: null, height: null, ratio: "unknown", hasComposition: false, hasRemotionImport: false, hasAudioReference: false }), note: "File project diperiksa tanpa dieksekusi." });
    }

    if (!(file instanceof File)) return NextResponse.json({ error: "Pilih file source, folder project, atau ZIP." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Ukuran file maksimum 100 MB." }, { status: 413 });

    if (file.name.toLowerCase().endsWith(".zip")) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => !entry.name.startsWith("__MACOSX/") });
      const names = Object.keys(entries);
      if (names.length > 1000) return NextResponse.json({ error: "ZIP maksimum 1.000 file." }, { status: 413 });
      const sources = names.filter(isSource);
      if (!sources.length) return NextResponse.json({ error: "ZIP tidak berisi source .tsx, .ts, .jsx, atau .js." }, { status: 422 });
      const candidates = [...sources].sort((a, b) => Number(/(^|\/)(src\/)?(root|index|video|remotion|main)\.(tsx|ts|jsx|js)$/i.test(b)) - Number(/(^|\/)(src\/)?(root|index|video|remotion|main)\.(tsx|ts|jsx|js)$/i.test(a)));
      let details: ReturnType<typeof inspectSource> | null = null;
      let entryFile: string | null = null;
      for (const name of candidates) {
        const data = entries[name];
        if (!data || data.length > 2_000_000) continue;
        const result = inspectSource(strFromU8(data));
        if (result.hasComposition || result.hasRemotionImport) { details = result; entryFile = name; break; }
      }
      return NextResponse.json({ source: "zip", filename: file.name, filesFound: names.length, sourceFiles: sources, entryFile, ...(details || { width: null, height: null, ratio: "unknown", hasComposition: false, hasRemotionImport: false, hasAudioReference: false }), note: "ZIP diperiksa tanpa menjalankan source." });
    }

    if (!isSource(file.name)) return NextResponse.json({ error: "Format tidak didukung. Gunakan .tsx, .ts, .jsx, .js, atau ZIP." }, { status: 415 });
    const source = await file.text();
    if (source.length > 2_000_000) return NextResponse.json({ error: "File source maksimum 2 MB." }, { status: 413 });
    return NextResponse.json({ source: "file", filename: file.name, entryFile: file.name, ...inspectSource(source), note: "File tunggal cocok untuk komposisi mandiri. Jika memakai import lokal atau asset, upload folder project." });
  } catch {
    return NextResponse.json({ error: "File tidak valid atau gagal dibaca." }, { status: 400 });
  }
}