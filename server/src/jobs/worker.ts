import { randomUUID } from "node:crypto";
import path from "node:path";
import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { config } from "../config.js";
import type { DownloadJobData } from "../queues.js";
import { connection } from "../queues.js";
import { getProvider } from "../services/provider.js";
import type { FormatId } from "../services/download-provider.js";
import { parseAndValidateUrl } from "../lib/urls.js";
import { ensureDownloadsDir } from "../lib/storage.js";
import { redis } from "../lib/redis.js";

const FORMAT_IDS = new Set(["1080", "720", "360", "mp3"]);

function sanitizeFilename(title: string): string {
  const clean = title
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number} _-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return clean || "smartdownload";
}

async function processDownload(job: Job<DownloadJobData>): Promise<{ fileId: string; filename: string }> {
  const { url, formatId } = job.data;

  // Seconde validation dans le worker : la file peut contenir un job ancien.
  const parsed = parseAndValidateUrl(url);
  if (!FORMAT_IDS.has(formatId)) {
    throw new Error("Format inconnu.");
  }

  await job.updateProgress(1);

  const provider = getProvider();
  const info = await provider.analyze(parsed.toString());
  if (!info.formats.some((f) => f.id === formatId)) {
    throw new Error("Ce format n'est pas disponible pour cette vidéo.");
  }

  await ensureDownloadsDir();
  await job.updateProgress(5);

  const outputBase = path.join(config.downloadsDir, job.id ?? randomUUID());
  const { filePath, ext } = await provider.download(
    parsed.toString(),
    formatId as FormatId,
    outputBase,
    (percent) => {
      void job.updateProgress(percent);
    },
  );

  const fileId = randomUUID();
  // Signature de marque dans le nom du fichier livre (discret, prefixe standard).
  const brand = "Eddition Smartebooks";
  const filename = `${brand} - ${sanitizeFilename(info.title || job.data.title || "video")}.${ext}`;
  const ttl = (config.fileTypeTtlMinutes + 1) * 60;

  await redis
    .multi()
    .hset(`smartdownload:file:${fileId}`, { filePath, filename, jobId: job.id ?? "" })
    .expire(`smartdownload:file:${fileId}`, ttl)
    .exec();

  await job.updateProgress(100);
  return { fileId, filename };
}

export function startWorker(): Worker {
  const worker = new Worker<DownloadJobData>("downloads", processDownload, {
    connection,
    concurrency: config.workerConcurrency,
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id ?? "?"} échoué : ${err.message}`);
  });

  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} terminé, fichier disponible 30 min.`);
  });

  return worker;
}
