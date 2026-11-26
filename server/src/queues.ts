import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";

export const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export interface DownloadJobData {
  url: string;
  formatId: string;
  priority: boolean;
  title?: string;
}

export const downloadQueue = new Queue<DownloadJobData>("downloads", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 200,
    removeOnFail: 200,
  },
});
