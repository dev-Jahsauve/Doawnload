import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { downloadQueue } from "../queues.js";
import { parseAndValidateUrl, detectPlatform } from "../lib/urls.js";
import { rateLimitHook, clientIp } from "./analyze.js";
import { recordUsage } from "./admin.js";

const downloadSchema = z.object({
  url: z.string().min(1),
  formatId: z.enum(["1080", "720", "360", "mp3"]),
  priority: z.boolean().optional().default(false),
  title: z.string().max(200).optional(),
});

export const downloadRoute: FastifyPluginAsync = async (app) => {
  app.post("/api/download", { preHandler: rateLimitHook }, async (req, reply) => {
    const parsed = downloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Requête invalide." });
    }

    try {
      const validated = parseAndValidateUrl(parsed.data.url); // rejet immédiat si domaine non autorisé
      await recordUsage("download", detectPlatform(validated.hostname), clientIp(req));
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Lien invalide." });
    }

    // BullMQ : priorité faible = traité en premier. La pub donne la priorité 1.
    const job = await downloadQueue.add(
      "download",
      {
        url: parsed.data.url,
        formatId: parsed.data.formatId,
        priority: parsed.data.priority,
        title: parsed.data.title,
      },
      { priority: parsed.data.priority ? 1 : 10 },
    );

    return reply.send({ jobId: job.id });
  });
};
