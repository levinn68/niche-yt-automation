import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { unzipSync } from "fflate";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { putObject } from "./storage.js";
import type { RenderPayload } from "./queue.js";

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 300 * 1024 * 1024;
const MAX_FILES = 1500;

function safePath(root: string, name: string) {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.split("/").some((part) => part === "..")) {
    throw new Error("Unsafe path in ZIP archive");
  }
  const target = path.resolve(root, normalized);
  if (!target.startsWith(root + path.sep)) throw new Error("ZIP path escaped workspace");
  return target;
}

export async function renderJob(payload: RenderPayload, progress: (value: number) => Promise<void>) {
  const archive = Buffer.from(payload.zipBase64, "base64");
  if (archive.length > MAX_ARCHIVE_BYTES) throw new Error("ZIP max size is 100 MB");
  const work = await mkdtemp(path.join(tmpdir(), "niche-render-"));
  const projectDir = path.join(work, "project");
  const outputDir = path.join(work, "output");
  await mkdir(projectDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  try {
    const entries = unzipSync(new Uint8Array(archive));
    const names = Object.keys(entries);
    if (names.length > MAX_FILES) throw new Error("ZIP contains too many files");
    let extractedBytes = 0;
    for (const name of names) {
      const data = entries[name];
      extractedBytes += data.byteLength;
      if (extractedBytes > MAX_EXTRACTED_BYTES) throw new Error("Expanded ZIP exceeds 300 MB");
      const target = safePath(projectDir, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
    }

    const entry = safePath(projectDir, payload.entryPoint);
    const entryExists = names.some((name) => path.resolve(projectDir, name) === entry);
    if (!entryExists) throw new Error("entryPoint not found in ZIP");

    await progress(5);
    // User-supplied Remotion code executes in this worker. Deploy this worker as an
    // isolated container with no privileged mounts and restricted network egress.
    const serveUrl = await bundle({ entryPoint: entry, onProgress: (p) => void progress(Math.min(25, 5 + Math.round(p * 0.2))) });
    await progress(30);
    const composition = await selectComposition({
      serveUrl,
      id: payload.compositionId,
      inputProps: payload.inputProps ?? {},
      chromiumOptions: { enableMultiProcessOnLinux: true }
    });
    if (composition.width !== payload.width || composition.height !== payload.height) {
      throw new Error("Composition dimensions do not match requested output dimensions");
    }
    if (composition.fps !== payload.fps || composition.durationInFrames !== payload.durationInFrames) {
      throw new Error("Composition fps/duration do not match the submitted render settings");
    }
    const outputPath = path.join(outputDir, `${randomUUID()}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: payload.inputProps ?? {},
      chromiumOptions: { enableMultiProcessOnLinux: true },
      concurrency: 2,
      onProgress: ({ progress: p }) => void progress(30 + Math.round(p * 65))
    });
    const mp4 = await readFile(outputPath);
    await putObject(payload.outputKey, mp4, "video/mp4");
    await progress(100);
    return { objectKey: payload.outputKey, bytes: mp4.byteLength };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
