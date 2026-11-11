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
const MEDIA_CACHE_BYTES = 64 * 1024 * 1024;
const OFFTHREAD_VIDEO_CACHE_BYTES = 64 * 1024 * 1024;

function safePath(root: string, name: string) {
  const normalized = name.replace(/\\\\/g, "/");
  if (normalized.startsWith("/") || normalized.split("/").some((part) => part === "..")) {
    throw new Error("Unsafe path in ZIP archive");
  }
  const target = path.resolve(root, normalized);
  if (!target.startsWith(root + path.sep)) throw new Error("ZIP path escaped workspace");
  return target;
}

function memorySnapshot(stage: string, jobId: string) {
  const usage = process.memoryUsage();
  const toMb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  console.info("Render memory", {
    jobId,
    stage,
    rssMB: toMb(usage.rss),
    heapUsedMB: toMb(usage.heapUsed),
    externalMB: toMb(usage.external),
    arrayBuffersMB: toMb(usage.arrayBuffers),
  });
}

export async function renderJob(payload: RenderPayload, progress: (value: number, message?: string) => Promise<void>) {
  let archive: Buffer | null = Buffer.from(payload.zipBase64, "base64");
  if (archive.length > MAX_ARCHIVE_BYTES) throw new Error("ZIP max size is 100 MB");
  const work = await mkdtemp(path.join(tmpdir(), "niche-render-"));
  const projectDir = path.join(work, "project");
  const outputDir = path.join(work, "output");
  await mkdir(projectDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  try {
    let entries: Record<string, Uint8Array> | null = unzipSync(new Uint8Array(archive));
    let names: string[] | null = Object.keys(entries);
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

    // Drop the in-memory ZIP and decompressed entries before launching Chromium.
    // Keeping both alive during a 1080x1920 render needlessly multiplies peak RSS.
    entries = null;
    names = null;
    archive = null;
    await new Promise<void>((resolve) => setImmediate(resolve));
    memorySnapshot("after-archive-release", payload.jobId);

    let lastProgress = 0;
    const reportProgress = async (value: number, message?: string) => {
      const next = Math.max(lastProgress, Math.min(100, Math.round(value)));
      if (next < lastProgress) return;
      if (next === lastProgress && !message) return;
      lastProgress = next;
      await progress(next, message);
    };

    await progress(2, "Archive berhasil diekstrak. Memori arsip dilepas sebelum render.");
    await reportProgress(5);
    // User-supplied Remotion code executes in this worker. Deploy this worker as an
    // isolated container with no privileged mounts and restricted network egress.
    memorySnapshot("before-bundle", payload.jobId);
    const serveUrl = await bundle({
      entryPoint: entry,
      onProgress: (p) => { void reportProgress(Math.min(25, 5 + Math.round(p * 0.2))); }
    });
    await progress(26, "Bundle selesai. Menjalankan Chromium untuk memuat composition.");
    await reportProgress(28);
    memorySnapshot("before-composition", payload.jobId);
    console.info("Render stage: loading composition", { jobId: payload.jobId, compositionId: payload.compositionId });
    const composition = await selectComposition({
      serveUrl,
      id: payload.compositionId,
      inputProps: payload.inputProps ?? {},
      timeoutInMilliseconds: 45000,
      mediaCacheSizeInBytes: MEDIA_CACHE_BYTES,
      offthreadVideoCacheSizeInBytes: OFFTHREAD_VIDEO_CACHE_BYTES,
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
    await progress(35, `Composition siap: ${composition.width}×${composition.height} · ${composition.fps} FPS · ${composition.durationInFrames} frames.`);
    await reportProgress(35);
    memorySnapshot("composition-loaded", payload.jobId);
    if (composition.width !== payload.width || composition.height !== payload.height) {
      throw new Error("Composition dimensions do not match requested output dimensions");
    }
    const outputPath = path.join(outputDir, `${randomUUID()}.mp4`);
    console.info("Render stage: rendering frames", { jobId: payload.jobId, concurrency: 1, mediaCacheMB: 64, offthreadVideoCacheMB: 64 });
    await progress(35, "Render dimulai. Chromium menggunakan cache media terbatas 64 MB.");
    let lastRenderPercent = -1;
    let progressWrites = Promise.resolve();
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: payload.inputProps ?? {},
      chromiumOptions: { enableMultiProcessOnLinux: true },
      concurrency: 1,
      mediaCacheSizeInBytes: MEDIA_CACHE_BYTES,
      offthreadVideoCacheSizeInBytes: OFFTHREAD_VIDEO_CACHE_BYTES,
      timeoutInMilliseconds: 120000,
      onProgress: ({ progress: p, renderedFrames, encodedFrames, stitchStage }) => {
        const renderPercent = Math.round(p * 100);
        if (renderPercent === lastRenderPercent) return;
        lastRenderPercent = renderPercent;
        const overall = 35 + Math.round(p * 60);
        const message = stitchStage === "muxing"
          ? "Menggabungkan audio dan video (muxing)."
          : `Render frame: ${renderedFrames}/${composition.durationInFrames} dibuat · ${encodedFrames} dikodekan · ${renderPercent}%.`;
        progressWrites = progressWrites.then(() => progress(overall, message));
      }
    });
    await progressWrites;
    memorySnapshot("frames-rendered", payload.jobId);
    await progress(96, "Semua frame selesai. Membaca file MP4 hasil render.");
    const mp4 = await readFile(outputPath);
    await progress(98, "Mengunggah MP4 ke storage.");
    await putObject(payload.outputKey, mp4, "video/mp4");
    await progress(100, "Render selesai. MP4 berhasil disimpan.");
    await reportProgress(100);
    return { objectKey: payload.outputKey, bytes: mp4.byteLength };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
