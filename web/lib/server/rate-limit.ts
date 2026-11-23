/**
 * Rate limiting du mode serverless.
 * Priorite : Upstash Redis REST (partage entre les instances serverless).
 * Repli : compteur en memoire (limite par instance, suffisant en dev).
 */

const MAX = Number(process.env.RATE_LIMIT_MAX ?? 10);
const WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 3600);
const memory = new Map<string, { count: number; reset: number }>();

async function upstashFetch(path: string): Promise<number | null> {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  try {
    const res = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = (await res.json()) as { result?: number };
    return typeof data.result === "number" ? data.result : null;
  } catch {
    return null;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  resetInSeconds: number;
}

export async function consumeDownloadSlot(ip: string): Promise<RateLimitResult> {
  const key = `smartdownload:ratelimit:${ip}`;
  const count = await upstashFetch(`incr/${key}`);
  if (count !== null) {
    if (count === 1) await upstashFetch(`expire/${key}/${WINDOW_SECONDS}`);
    const ttl = (await upstashFetch(`ttl/${key}`)) ?? WINDOW_SECONDS;
    return { allowed: count <= MAX, resetInSeconds: ttl };
  }

  const now = Date.now();
  const entry = memory.get(ip);
  if (!entry || now > entry.reset) {
    memory.set(ip, { count: 1, reset: now + WINDOW_SECONDS * 1000 });
    return { allowed: true, resetInSeconds: WINDOW_SECONDS };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= MAX,
    resetInSeconds: Math.max(1, Math.round((entry.reset - now) / 1000)),
  };
}
