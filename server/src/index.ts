import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { analyzeRoute } from "./routes/analyze.js";
import { downloadRoute } from "./routes/download.js";
import { adminRoute } from "./routes/admin.js";
import { jobRoutes } from "./routes/jobs.js";
import { ensureDownloadsDir } from "./lib/storage.js";

const app = Fastify({
  logger: { transport: undefined, level: process.env.LOG_LEVEL ?? "info" },
  bodyLimit: 64 * 1024,
});

await app.register(cors, { origin: config.corsOrigin });

app.get("/api/health", async () => ({ status: "ok", service: "smartdownload" }));

await app.register(analyzeRoute);
await app.register(downloadRoute);
await app.register(jobRoutes);
await app.register(adminRoute);

await ensureDownloadsDir();

const start = async () => {
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`[api] SmartDownload API prête sur le port ${config.port}.`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
