import { NextRequest, NextResponse } from "next/server";
import { unzipSync, strFromU8 } from "fflate";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 50 * 1024 * 1024;
const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

function inspectSource(source: string) {
  const widthMatch = source.match(/\bwidth\s*[:=]\s*(\d{2,5})/);
  const heightMatch = source.match(/\bheight\s*[:=]\s*(\d{2,5})/);
  const width = widthMatch ? Number(widthMatch[1]) : null;
  const height = heightMatch ? Number(heightMatch[1]) : null;
  const ratio = width && height
    ? width / height < 0.8 ? "9:16" : width / height > 1.2 ? "16:9" : "custom"
    : "unknown";

  return {
    width,
    height,
    ratio,
    hasComposition: /<Composition\b|registerRoot\s*\(/.test(source),
    hasRemotionImport: /from\s+["']remotion["']/.test(source),
    hasAudioReference: /<Audio\b|staticFile\s*\(/.test(source)
  };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const code = form.get("code");
    const file = form.get("file");

    if (typeof code === "string" && code.trim()) {
      if (code.length > 1_000_000) {
        return NextResponse.json({ error: "Kode terlalu besar (maksimum 1 MB)." }, { status: 413 });
      }
      return NextResponse.json({
        source: "code",
        filename: "pasted-project.tsx",
        ...inspectSource(code),
        note: "Deteksi awal berbasis source code. Validasi bundling Remotion dilakukan oleh render worker."
      });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Masukkan kode Remotion atau upload file ZIP." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Project harus berupa file .zip." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Ukuran ZIP maksimum 50 MB untuk inspeksi awal." }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(bytes, { filter: (entry) => !entry.name.startsWith("__MACOSX/") });
    const names = Object.keys(entries);
    if (names.length > 1000) {
      return NextResponse.json({ error: "ZIP berisi terlalu banyak file (maksimum 1.000)." }, { status: 413 });
    }

    const sourceFiles = names.filter((name) => SOURCE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)));
    const candidates = sourceFiles
      .filter((name) => /(^|\/)(src\/)?(root|index|video|remotion|main)\.(tsx|ts|jsx|js)$/i.test(name))
      .concat(sourceFiles)
      .filter((name, index, all) => all.indexOf(name) === index);

    let inspected: ReturnType<typeof inspectSource> | null = null;
    let entryFile: string | null = null;
    for (const name of candidates) {
      const data = entries[name];
      if (!data || data.length > 1_000_000) continue;
      const result = inspectSource(strFromU8(data));
      if (result.hasComposition || result.hasRemotionImport) {
        inspected = result;
        entryFile = name;
        break;
      }
    }

    if (!sourceFiles.length) {
      return NextResponse.json({ error: "Tidak ditemukan file TSX, TS, JSX, atau JS di dalam ZIP." }, { status: 422 });
    }

    return NextResponse.json({
      source: "zip",
      filename: file.name,
      filesFound: names.length,
      sourceFiles,
      entryFile,
      ...(inspected ?? { width: null, height: null, ratio: "unknown", hasComposition: false, hasRemotionImport: false, hasAudioReference: false }),
      note: "ZIP hanya diperiksa di memori. Kode belum dieksekusi dan belum dirender."
    });
  } catch {
    return NextResponse.json({ error: "ZIP tidak valid atau gagal dibaca." }, { status: 400 });
  }
}