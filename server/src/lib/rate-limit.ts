import { config } from "../config.js";
import { redis } from "./redis.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Limiteur de débit par IP, stocké dans Redis (sliding window fixe).
 * Exemple : 10 téléchargements par heure pour éviter les abus et les coûts.
 */
export async function consumeDownloadSlot(ip: string): Promise<RateLimitResult> {
  const key = `smartdownload:ratelimit:${ip}`;
  const pipeline = redis.multi();
  pipeline.incr(key);
  pipeline.ttl(key);
  const results = await pipeline.exec();
  const count = Number(results?.[0]?.[1] ?? 1);
  let ttl = Number(results?.[1]?.[1] ?? -1);

  if (ttl < 0) {
    await redis.expire(key, config.rateLimitWindowSeconds);
    ttl = config.rateLimitWindowSeconds;
  }

  return {
    allowed: count <= config.rateLimitMax,
    remaining: Math.max(0, config.rateLimitMax - count),
    resetInSeconds: ttl,
  };
}
