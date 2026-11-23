import { startWorker } from "./jobs/worker.js";
import "./jobs/purge.js";

const worker = startWorker();

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
