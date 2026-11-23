import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import { downloadQueue } from "../queues.js";
import { openFileStream } from "../lib/storage.js";
import { redis } from "../lib/redis.js";

export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/jobs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await downloadQueue.getJob(id);
    if (!job) {
      return reply.code(404).send({ error: "Tâche introuvable ou expirée." });
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: typeof job.progress === "number" ? job.progress : 0,
      title: job.data.title ?? null,
      result: state === "completed" ? job.returnvalue : null,
      failedReason: state === "failed" ? job.failedReason : null,
    };
  });

  app.get("/api/jobs/:id/file", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await downloadQueue.getJob(id);
    if (!job || (await job.getState()) !== "completed") {
      return reply.code(404).send({ error: "Fichier introuvable ou tâche non terminée." });
    }

    const fileId = (job.returnvalue as { fileId?: string } | undefined)?.fileId;
    if (!fileId) {
      return reply.code(410).send({ error: "Fichier expiré (durée de conservation : 30 min)." });
    }

    const record = await redis.hgetall(`smartdownload:file:${fileId}`);
    if (!record.filePath) {
      return reply.code(410).send({ error: "Fichier expiré (durée de conservation : 30 min)." });
    }

    // Sécurité : le chemin renvoyé doit rester dans le dossier de téléchargements.
    if (path.resolve(record.filePath).startsWith(path.resolve(process.cwd())) === false) {
      return reply.code(400).send({ error: "Chemin invalide." });
    }

    reply.header("Content-Type", "application/octet-stream");
    reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(record.filename ?? "video.mp4")}`);
    return reply.send(openFileStream(record.filePath));
  });
};
