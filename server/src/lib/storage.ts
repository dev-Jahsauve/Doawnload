import { createReadStream } from "node:fs";
import type { ReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

/**
 * Purge automatique : aucun fichier n'est conservé plus de 30 minutes.
 * Un intervalle scanne le dossier de téléchargements et supprime tout
 * fichier (ou fragment .part/.ytdl) dont la dernière modification date
 * de plus de fileTypeTtlMinutes.
 */
export async function purgeExpiredFiles(): Promise<number> {
  const dir = config.downloadsDir;
  const ttlMs = config.fileTypeTtlMinutes * 60 * 1000;
  let removed = 0;

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }

  const now = Date.now();
  for (const entry of entries) {
    try {
      const filePath = path.join(dir, entry);
      const stats = await stat(filePath);
      if (!stats.isFile()) continue;
      if (now - stats.mtimeMs > ttlMs) {
        await unlink(filePath);
        removed += 1;
      }
    } catch {
      // fichier déjà supprimé ou verrouillé : on ignore
    }
  }

  return removed;
}

export async function ensureDownloadsDir(): Promise<void> {
  await mkdir(config.downloadsDir, { recursive: true });
}

export function openFileStream(filePath: string): ReadStream {
  return createReadStream(filePath);
}
