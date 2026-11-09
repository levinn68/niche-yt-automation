import express from "express";
import { timingSafeEqual } from "node:crypto";
import { Worker } from "bullmq";
import { connection, renderQueue, publishQueue, type RenderPayload, type PublishPayload } from "./queue.js";
import { renderJob } from "./render.js";
import { publishJob } from "./publish.js";

const app = express();
app.use(express.json({ limit: "140mb" }));
const port = Number(process.env.PORT || 8080);
const token = process.env.WORKER_API_TOKEN;
if (!token || token.length < 32) throw new Error("WORKER_API_TOKEN must be configured with at least 32 characters");

function authorized(req: express.Request, res: express.Response, next: express.NextFunction) {
  const supplied = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
  const a = Buffer.from(supplied); const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

const renderWorker = new Worker<RenderPayload>("niche-render", async (job) => {
  await job.updateProgress(0);
  return renderJob(job.data, (value) => job.updateProgress(value));
}, { connection, concurrency: Number(process.env.RENDER_CONCURRENCY || 1) });

const publishWorker = new Worker<PublishPayload>("niche-publish", async (job) => {
  await job.updateProgress(5);
  const result = await publishJob(job.data);
  await job.updateProgress(100);
  return result;
}, { connection, concurrency: 1 });

for (const worker of [renderWorker, publishWorker]) {
  worker.on("failed", (job, error) => console.error("Queue job failed", job?.id, error));
  worker.on("completed", (job) => console.info("Queue job completed", job.id));
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "niche-yt-worker", queues: ["niche-render", "niche-publish"] }));
app.post("/jobs/render", authorized, async (req, res) => {
  try {
    const body = req.body as RenderPayload;
    if (!body.jobId || !body.zipBase64 || !body.entryPoint || !body.compositionId || !body.outputKey) return res.status(400).json({ error: "Missing render job fields" });
    if (![body.width, body.height, body.fps, body.durationInFrames].every((v) => Number.isFinite(v) && v > 0)) return res.status(400).json({ error: "Invalid composition settings" });
    const job = await renderQueue.add("render", body, {
      jobId: body.jobId, attempts: 3, backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400, count: 500 }, removeOnFail: { age: 604800, count: 1000 }
    });
    res.status(202).json({ jobId: job.id, state: "queued" });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Queue error" }); }
});
app.post("/jobs/publish", authorized, async (req, res) => {
  try {
    const body = req.body as PublishPayload;
    if (!body.jobId || !body.objectKey || !body.title || !body.channelId) return res.status(400).json({ error: "Missing publish job fields" });
    if (body.publishAt && Number.isNaN(Date.parse(body.publishAt))) return res.status(400).json({ error: "Invalid publishAt" });
    const job = await publishQueue.add("publish", body, {
      jobId: body.jobId,
      attempts: 5, backoff: { type: "exponential", delay: 10000 },
      removeOnComplete: { age: 604800, count: 1000 }, removeOnFail: { age: 1209600, count: 2000 }
    });
    res.status(202).json({ jobId: job.id, state: body.publishAt ? "scheduled" : "queued" });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Queue error" }); }
});
app.get("/jobs/:id", authorized, async (req, res) => {
  const job = await renderQueue.getJob(req.params.id) || await publishQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ id: job.id, name: job.name, state: await job.getState(), progress: job.progress, result: job.returnvalue, failedReason: job.failedReason });
});

app.listen(port, () => console.info(`NICHE YT worker listening on :${port}`));
process.on("SIGTERM", async () => { await Promise.all([renderWorker.close(), publishWorker.close(), renderQueue.close(), publishQueue.close(), connection.quit()]); process.exit(0); });
