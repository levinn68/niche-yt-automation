import { Queue } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required");
export const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
export const renderQueue = new Queue("niche-render", { connection });
export const publishQueue = new Queue("niche-publish", { connection });

export type RenderPayload = {
  jobId: string; zipBase64: string; entryPoint: string; compositionId: string;
  inputProps?: Record<string, unknown>; width: number; height: number; outputKey: string;
};
export type PublishPayload = {
  jobId: string; objectKey: string; title: string; description: string; tags?: string[];
  privacyStatus: "private" | "unlisted" | "public"; publishAt?: string; channelId: string;
};
