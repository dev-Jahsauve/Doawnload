import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  downloadsDir: process.env.DOWNLOADS_DIR ?? "./downloads",
  fileTypeTtlMinutes: 30,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 10),
  rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 3600),
  provider: process.env.DOWNLOAD_PROVIDER ?? "ytdlp",
  ytDlpBin: process.env.YTDLP_PATH ?? "yt-dlp",
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
};
