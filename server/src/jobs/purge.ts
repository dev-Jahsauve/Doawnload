import { config } from "../config.js";
import { purgeExpiredFiles } from "../lib/storage.js";

const PURGE_INTERVAL_MS = 5 * 60 * 1000;

async function runPurgeLoop() {
  const removed = await purgeExpiredFiles();
  if (removed > 0) {
    console.log(`[purge] ${removed} fichier(s) supprimé(s) (> ${config.fileTypeTtlMinutes} min).`);
  }
}

// Purge au démarrage puis toutes les 5 minutes.
void runPurgeLoop();
const timer = setInterval(() => void runPurgeLoop(), PURGE_INTERVAL_MS);
timer.unref();
