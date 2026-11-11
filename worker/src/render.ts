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

    let lastProgress = 0;
    const reportProgress = async (value: number) => {
      const next = Math.max(lastProgress, Math.min(100, Math.round(value)));
      if (next <= lastProgress) return;
      lastProgress = next;
      await progress(next);
    };

    await reportProgress(5);
    // User-supplied Remotion code executes in this worker. Deploy this worker as an
    // isolated container with no privileged mounts and restricted network egress.
    const serveUrl = await bundle({
      entryPoint: entry,
      onProgress: (p) => { void reportProgress(Math.min(25, 5 + Math.round(p * 0.2))); }
    });
    await reportProgress(28);
    console.info("Render stage: loading composition", { jobId: payload.jobId, compositionId: payload.compositionId });
    // A stalled delayRender() must fail clearly instead of holding the queue indefinitely.
    const composition = await selectComposition({
      serveUrl,
      id: payload.compositionId,
      inputProps: payload.inputProps ?? {},
      timeoutInMilliseconds: 45000,
      chromiumOptions: { enableMultiProcessOnLinux: true }
    }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("Composition loading failed", { jobId: payload.jobId, compositionId: payload.compositionId, detail });
      const likelyCause = /delayRender|Loading root component/i.test(detail)
        ? "A delayRender() handle was not cleared. Check every delayRender() call and ensure continueRender(handle) runs on both success and error paths. Also verify remote fonts, images, and audio URLs load inside Chromium."
        : "Verify the Composition ID, root registration, external assets, and browser console errors.";
      throw new Error(`Composition failed to load within 45 seconds. ${likelyCause} Details: ${detail}`);
    });
    console.info("Render stage: composition loaded", { jobId: payload.jobId, width: composition.width, height: composition.height, fps: composition.fps, durationInFrames: composition.durationInFrames });
    await reportProgress(35);
    if (composition.width !== payload.width || composition.height !== payload.height) {
      throw new Error("Composition dimensions do not match requested output dimensions");
    }
    const outputPath = path.join(outputDir, `${randomUUID()}.mp4`);
    console.info("Render stage: rendering frames", { jobId: payload.jobId, concurrency: 2 });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: payload.inputProps ?? {},
      chromiumOptions: { enableMultiProcessOnLinux: true },
      concurrency: 2,
      timeoutInMilliseconds: 120000,
      onProgress: ({ progress: p }) => { void reportProgress(35 + Math.round(p * 60)); }
    });
    const mp4 = await readFile(outputPath);
    await putObject(payload.outputKey, mp4, "video/mp4");
    await reportProgress(100);
    return { objectKey: payload.outputKey, bytes: mp4.byteLength };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
