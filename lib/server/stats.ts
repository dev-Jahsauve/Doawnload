/**
 * Statistiques d'usage (tableau de bord admin).
 * Stockage prioritaire : Upstash Redis REST (partage entre instances serverless).
 * Repli : compteurs en memoire de l'instance (perdus au redemarrage / par lambda).
 *
 * Cles Redis (partagees avec le mode VPS) :
 *   smartdownload:stats:total:{analyze|download}   compteur global
 *   smartdownload:stats:day:{date}:{type}          compteur par jour (YYYY-MM-DD)
 *   smartdownload:stats:platforms (hash)           compteur par plateforme
 *   smartdownload:stats:uv:{date} + :all           HyperLogLog visiteurs uniques
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface DayPoint {
  date: string;
  analyzes: number;
  downloads: number;
}

export interface AdminStats {
  source: "upstash" | "memoire";
  totals: { analyzes: number; downloads: number };
  today: { date: string; analyzes: number; downloads: number; uniqueUsers: number };
  uniqueUsersAll: number;
  platforms: Record<string, number>;
  last14Days: DayPoint[];
}

const REST_URL = () => process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashPipeline(commands: (string | number)[][]): Promise<unknown[] | null> {
  const base = REST_URL();
  const token = REST_TOKEN();
  if (!base || !token) return null;
  try {
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands.map(([cmd, ...args]) => [String(cmd).toLowerCase(), ...args])),
      cache: "no-store",
    });
    const data = (await res.json()) as { result?: unknown }[];
    if (!Array.isArray(data)) return null;
    return data.map((d) => d?.result);
  } catch {
    return null;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "inconnu";
}

/* ---------------------- repli fichier (dev/local uniquement) ---------------------- */
/*
 * Sur Vercel (multi-instances, FS read-only), le repli memoire est ineliminable :
 * les stats y sont relatives a l'instance et le tableau de bord l'indique.
 * En local (next dev/start), on persiste dans un fichier JSON pour que toutes
 * les routes partagent les memes compteurs.
 */
const VERCEL = Boolean(process.env.VERCEL);
const STORE_FILE = process.env.STATS_FILE
  ?? (!VERCEL ? path.join(os.tmpdir(), "smartdownload-stats.json") : null);

interface FileStore {
  totals: { analyzes: number; downloads: number };
  days: Record<string, { analyzes: number; downloads: number }>;
  platforms: Record<string, number>;
  uniqueByDay: Record<string, string[]>;
  uniqueAll: string[];
}

const EMPTY_STORE: FileStore = {
  totals: { analyzes: 0, downloads: 0 },
  days: {},
  platforms: {},
  uniqueByDay: {},
  uniqueAll: [],
};

async function readStore(): Promise<FileStore> {
  if (!STORE_FILE) return { ...EMPTY_STORE };
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    return { ...EMPTY_STORE, ...(JSON.parse(raw) as FileStore) };
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function writeStore(store: FileStore): Promise<void> {
  if (!STORE_FILE) return;
  try {
    await mkdir(path.dirname(STORE_FILE), { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify(store), "utf8");
  } catch {
    // lecture seule (ex. Vercel) : on ignore, le repli memoire reste affiche.
  }
}

/* ------------------------------ repli memoire ------------------------------ */

const memory = {
  totals: { analyzes: 0, downloads: 0 },
  days: new Map<string, { analyzes: number; downloads: number }>(),
  platforms: new Map<string, number>(),
  uniqueByDay: new Map<string, Set<string>>(),
  uniqueAll: new Set<string>(),
};

/* --------------------------------- ecriture -------------------------------- */

export async function recordUsage(
  type: "analyze" | "download",
  platform?: string,
  ip?: string,
): Promise<void> {
  const day = today();

  const commands: (string | number)[][] = [
    ["incr", `smartdownload:stats:total:${type}`],
    ["incr", `smartdownload:stats:day:${day}:${type}`],
    ...(platform ? [["hincrby", "smartdownload:stats:platforms", platform, 1]] : []),
    ...(ip
      ? [
          ["pfadd", `smartdownload:stats:uv:${day}`, ip],
          ["pfadd", "smartdownload:stats:uv:all", ip],
        ]
      : []),
  ];

  const results = await upstashPipeline(commands);
  if (results) return;

  const key = type === "analyze" ? ("analyzes" as const) : ("downloads" as const);
  if (STORE_FILE) {
    const store = await readStore();
    store.totals[key] += 1;
    const fday = store.days[day] ?? { analyzes: 0, downloads: 0 };
    fday[key] += 1;
    store.days[day] = fday;
    if (platform) store.platforms[platform] = (store.platforms[platform] ?? 0) + 1;
    if (ip) {
      store.uniqueByDay[day] = Array.from(new Set([...(store.uniqueByDay[day] ?? []), ip]));
      store.uniqueAll = Array.from(new Set([...store.uniqueAll, ip]));
    }
    await writeStore(store);
    return;
  }

  // Repli memoire (Vercel sans Upstash)
  memory.totals[key] += 1;
  const d = memory.days.get(day) ?? { analyzes: 0, downloads: 0 };
  d[key] += 1;
  memory.days.set(day, d);
  if (platform) memory.platforms.set(platform, (memory.platforms.get(platform) ?? 0) + 1);
  if (ip) {
    let set = memory.uniqueByDay.get(day);
    if (!set) {
      set = new Set();
      memory.uniqueByDay.set(day, set);
    }
    set.add(ip);
    memory.uniqueAll.add(ip);
  }
}

/* --------------------------------- lecture --------------------------------- */

async function pfCount(keys: string[]): Promise<number> {
  const base = REST_URL();
  const token = REST_TOKEN();
  if (!base || !token || keys.length === 0) return 0;
  try {
    const res = await fetch(`${base}/pfcount/${keys.map(encodeURIComponent).join("/")}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = (await res.json()) as { result?: number };
    return typeof data.result === "number" ? data.result : 0;
  } catch {
    return 0;
  }
}

async function readStatsFromRedis(): Promise<AdminStats | null> {
  if (!REST_URL() || !REST_TOKEN()) return null;
  const day = today();

  const days: string[] = [];
  const dayKeys: (string | number)[][] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days.push(d);
    dayKeys.push(["get", `smartdownload:stats:day:${d}:analyze`]);
    dayKeys.push(["get", `smartdownload:stats:day:${d}:download`]);
  }

  const results = await upstashPipeline([
    ["get", "smartdownload:stats:total:analyze"],
    ["get", "smartdownload:stats:total:download"],
    ["get", `smartdownload:stats:day:${day}:analyze`],
    ["get", `smartdownload:stats:day:${day}:download`],
    ["hgetall", "smartdownload:stats:platforms"],
    ...dayKeys,
  ]);
  if (!results) return null;

  const num = (v: unknown): number => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  const platforms: Record<string, number> = {};
  const rawPlatforms = results[4];
  if (Array.isArray(rawPlatforms)) {
    for (let i = 0; i < rawPlatforms.length; i += 2) {
      platforms[String(rawPlatforms[i])] = num(rawPlatforms[i + 1]);
    }
  } else if (rawPlatforms && typeof rawPlatforms === "object") {
    for (const [k, v] of Object.entries(rawPlatforms as Record<string, unknown>)) {
      platforms[k] = num(v);
    }
  }

  const last14Days: DayPoint[] = days.map((d, i) => ({
    date: d,
    analyzes: num(results[5 + i * 2]),
    downloads: num(results[6 + i * 2]),
  }));

  const [uniqueToday, uniqueAll] = await Promise.all([
    pfCount([`smartdownload:stats:uv:${day}`]),
    pfCount(["smartdownload:stats:uv:all"]),
  ]);

  return {
    source: "upstash",
    totals: { analyzes: num(results[0]), downloads: num(results[1]) },
    today: {
      date: day,
      analyzes: num(results[2]),
      downloads: num(results[3]),
      uniqueUsers: Math.max(uniqueToday, 0),
    },
    uniqueUsersAll: Math.max(uniqueAll, 0),
    platforms,
    last14Days,
  };
}

function readStatsFromMemory(): AdminStats {
  const day = today();
  const days: DayPoint[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const entry = memory.days.get(d) ?? { analyzes: 0, downloads: 0 };
    days.push({ date: d, ...entry });
  }
  return {
    source: "memoire",
    totals: { ...memory.totals },
    today: {
      date: day,
      analyzes: memory.days.get(day)?.analyzes ?? 0,
      downloads: memory.days.get(day)?.downloads ?? 0,
      uniqueUsers: memory.uniqueByDay.get(day)?.size ?? 0,
    },
    uniqueUsersAll: memory.uniqueAll.size,
    platforms: Object.fromEntries(memory.platforms),
    last14Days: days,
  };
}

async function empty14Days(): Promise<{ date: string; analyzes: number; downloads: number }[]> {
  const days: { date: string; analyzes: number; downloads: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    days.push({ date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), analyzes: 0, downloads: 0 });
  }
  return days;
}

/**
 * Lecture depuis le fichier local (dev) — precedence sur la memoire
 * (les routes Next etant bundlees separement, leurs memoires sont distinctes),
 * mais jamais avant Upstash.
 */
async function readStatsFromFile(): Promise<AdminStats | null> {
  if (!STORE_FILE) return null;
  try {
    const store = await readStore();
    if (store.totals.analyzes === 0 && store.totals.downloads === 0 && Object.keys(store.days).length === 0) return null;
    const day = today();
    return {
      source: "memoire",
      totals: { ...store.totals },
      today: {
        date: day,
        analyzes: store.days[day]?.analyzes ?? 0,
        downloads: store.days[day]?.downloads ?? 0,
        uniqueUsers: store.uniqueByDay[day]?.length ?? 0,
      },
      uniqueUsersAll: store.uniqueAll.length,
      platforms: { ...store.platforms },
      last14Days: (await empty14Days()).map((d) => ({
        date: d.date,
        analyzes: store.days[d.date]?.analyzes ?? 0,
        downloads: store.days[d.date]?.downloads ?? 0,
      })),
    };
  } catch {
    return null;
  }
}

export async function readAdminStats(): Promise<AdminStats> {
  return (await readStatsFromRedis()) ?? (await readStatsFromFile()) ?? readStatsFromMemory();
}
