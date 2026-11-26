import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { consumeDownloadSlot } from "../lib/rate-limit.js";
import { recordUsage } from "./admin.js";

const analyzeSchema = z.object({ url: z.string().min(1) });

export interface AnalyzeApi {
  Reply: { info: unknown } | { error: string };
}

export function errorToMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Une erreur est survenue.";
}

export function clientIp(req: FastifyRequest): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
}

export const rateLimitHook = async (req: FastifyRequest, reply: any) => {
  const limit = await consumeDownloadSlot(clientIp(req));
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.resetInSeconds / 60));
    void reply.code(429).send({
      error: `Limite de ${config.rateLimitMax} téléchargements par heure atteinte. Réessaie dans ${minutes} min.`,
    });
  }
};

export const analyzeRoute: FastifyPluginAsync = async (app) => {
  app.post("/api/analyze", async (req, reply) => {
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Merci de coller un lien." });
    }

    const { analyze } = await import("../routes/helpers.js");
    try {
      const info = await analyze(parsed.data.url);
      await recordUsage("analyze", info.platform, clientIp(req));
      return reply.send({ info });
    } catch (err) {
      return reply.code(400).send({ error: errorToMessage(err) });
    }
  });
};
