import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { redis } from "../lib/redis.js";

const PREFIX = "smartdownload:stats:";

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Incrémente les compteurs d'usage (ignore silencieusement toute erreur Redis). */
export async function recordUsage(
  type: "analyze" | "download",
  platform?: string,
  ip?: string,
): Promise<void> {
  try {
    const day = todayKey();
    await redis.incr(`${PREFIX}total:${type}`);
    const dayKey = `${PREFIX}day:${day}:${type}`;
    await redis.incr(dayKey);
    await redis.expire(dayKey, 90 * 86_400);
    if (platform) await redis.hincrby(`${PREFIX}platforms`, platform, 1);
    if (ip) {
      await redis.pfadd(`${PREFIX}uv:${day}`, ip);
      await redis.pfadd(`${PREFIX}uv:all`, ip);
    }
  } catch {
    // Les stats ne doivent jamais casser un telechargement.
  }
}

function checkAdmin(request: FastifyRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return request.headers["x-admin-password"] === expected;
}

export const adminRoute: FastifyPluginAsync = async (app) => {
  app.get("/api/admin/stats", async (_req, reply) => {
    void _req;
    if (!process.env.ADMIN_PASSWORD) {
      void reply.code(503).send({ error: "Tableau de bord desactive : ADMIN_PASSWORD non configure." });
      return;
    }
    if (!checkAdmin(_req)) {
      void reply.code(401).send({ error: "Mot de passe incorrect." });
      return;
    }

    const day = todayKey();
    const days: string[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }
    const num = (v: string | null): number => (v ? Number(v) || 0 : 0);

    const [totA, totD, dayA, dayD, platforms, uniqueToday, uniqueAll, ...dayValues] = await Promise.all([
      redis.get(`${PREFIX}total:analyze`),
      redis.get(`${PREFIX}total:download`),
      redis.get(`${PREFIX}day:${day}:analyze`),
      redis.get(`${PREFIX}day:${day}:download`),
      redis.hgetall(`${PREFIX}platforms`),
      redis.pfcount(`${PREFIX}uv:${day}`),
      redis.pfcount(`${PREFIX}uv:all`),
      ...days.flatMap((d) => [
        redis.get(`${PREFIX}day:${d}:analyze`),
        redis.get(`${PREFIX}day:${d}:download`),
      ]),
    ]);

    await reply.send({
      stats: {
        source: "redis",
        totals: { analyzes: num(totA), downloads: num(totD) },
        today: {
          date: day,
          analyzes: num(dayA),
          downloads: num(dayD),
          uniqueUsers: Math.max(uniqueToday, 0),
        },
        uniqueUsersAll: Math.max(uniqueAll, 0),
        platforms,
        last14Days: days.map((d, i) => ({
          date: d,
          analyzes: num(dayValues[i * 2]),
          downloads: num(dayValues[i * 2 + 1]),
        })),
      },
    });
  });
};
