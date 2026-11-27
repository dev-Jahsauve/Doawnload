/**
 * Extracteur HTTP du mode serverless (deploiement Vercel).
 * Deux fournisseurs supportes :
 *  - "cobalt"   : instance compatible Cobalt (POST JSON, reponse tunnel/redirect/picker)
 *  - "rapidapi" : endpoint RapidAPI ou equivalent (GET ?url=..., reponse JSON a analyser)
 * La reponse est une URL de media directe livree au navigateur (aucun stockage).
 */

export interface ExtractOptions {
  kind: "video" | "audio";
  quality?: "1080" | "720" | "360";
}

export interface ExtractResult {
  url: string;
}

export function extractorConfigured(): boolean {
  return Boolean(process.env.EXTRACT_PROVIDER && process.env.EXTRACT_API_URL);
}

class ExtractError extends Error {}

function apiHeaders(extraAccept?: string): Record<string, string> {
  const key = process.env.EXTRACT_API_KEY;
  const headerName = process.env.EXTRACT_API_HEADER;
  const headers: Record<string, string> = { Accept: extraAccept ?? "application/json" };
  if (!key) return headers;

  if (headerName) {
    headers[headerName] = key;
  } else if (process.env.EXTRACT_PROVIDER === "rapidapi") {
    headers["x-rapidapi-key"] = key;
    const host = new URL(process.env.EXTRACT_API_URL ?? "https://rapidapi.com").hostname;
    headers["x-rapidapi-host"] = host;
  } else {
    headers.Authorization = `Api-Key ${key}`;
  }
  return headers;
}

async function extractViaCobalt(base: string, url: string, options: ExtractOptions): Promise<ExtractResult> {
  const body: Record<string, unknown> = {
    url,
    downloadMode: options.kind === "audio" ? "audio" : "auto",
    audioFormat: "mp3",
    filenameStyle: "basic",
  };
  if (options.kind === "video" && options.quality) {
    body.videoQuality = options.quality;
  }

  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...apiHeaders() },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    url?: string;
    text?: string;
    picker?: { url?: string }[];
  };

  if (!res.ok || data.status === "error") {
    throw new ExtractError(data.text || "Le service d'extraction a refuse ce lien.");
  }
  if ((data.status === "tunnel" || data.status === "redirect") && data.url) {
    return { url: data.url };
  }
  if (data.status === "picker" && data.picker?.[0]?.url) {
    return { url: data.picker[0].url };
  }
  throw new ExtractError("Reponse inattendue du service d'extraction.");
}

function looksLikeMediaUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function collectStrings(value: unknown, keyName: string, out: { key: string; value: string }[]) {
  if (typeof value === "string") {
    if (looksLikeMediaUrl(value)) out.push({ key: keyName, value });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, keyName, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectStrings(v, k, out);
    }
  }
}

async function extractViaRapidApi(url: string, options: ExtractOptions): Promise<ExtractResult> {
  const endpoint = new URL(process.env.EXTRACT_API_URL as string);
  endpoint.searchParams.set("url", url);

  const res = await fetch(endpoint, { headers: apiHeaders(), cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new ExtractError("Le service d'extraction a refuse ce lien.");
  }

  const found: { key: string; value: string }[] = [];
  collectStrings(data, "root", found);
  if (found.length === 0) {
    throw new ExtractError("Aucun media exploitable renvoye par l'extracteur.");
  }

  if (options.kind === "audio") {
    const audio =
      found.find((f) => /mp3|audio/i.test(f.key) || /\.mp3(\?|$)/i.test(f.value)) ?? null;
    return { url: (audio ?? found[0]).value };
  }

  const quality = options.quality ?? "720";
  const byQuality = found.find((f) => f.key.includes(quality));
  const mp4 = found.find((f) => /\.(mp4|mov)(\?|$)/i.test(f.value));
  return { url: (byQuality ?? mp4 ?? found[0]).value };
}

export function fallbackConfigured(): boolean {
  return Boolean(process.env.EXTRACT_FALLBACK_URL);
}

export async function fetchFallbackInfo(
  pageUrl: string,
): Promise<{ title: string; duration: number; thumbnail: string } | null> {
  if (!fallbackConfigured()) return null;
  try {
    const endpoint = new URL("info", process.env.EXTRACT_FALLBACK_URL as string);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url: pageUrl }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; duration?: number; thumbnail?: string };
    if (!data.title) return null;
    return { title: data.title, duration: data.duration ?? 0, thumbnail: data.thumbnail ?? "" };
  } catch {
    return null;
  }
}

export async function extractMediaUrl(pageUrl: string, options: ExtractOptions): Promise<ExtractResult> {
  if (!extractorConfigured()) {
    throw new ExtractError("Extracteur non configure.");
  }
  let primaryError: unknown = null;
  let fallbackError: unknown = null;
  try {
    if (process.env.EXTRACT_PROVIDER === "cobalt") {
      return await extractViaCobalt(process.env.EXTRACT_API_URL as string, pageUrl, options);
    }
    return await extractViaRapidApi(pageUrl, options);
  } catch (err) {
    primaryError = err;
  }
  // Repli : service yt-dlp compatible Cobalt (ex. Facebook, qui exige une
  // session pour etre accessible depuis une IP de datacenter).
  if (fallbackConfigured()) {
    try {
      return await extractViaCobalt(process.env.EXTRACT_FALLBACK_URL as string, pageUrl, options);
    } catch (err) {
      fallbackError = err;
    }
  }
  if (fallbackError) {
    const describe = (e: unknown) => (e instanceof Error ? e.message : "erreur inconnue");
    throw new ExtractError(
      `Le service d'extraction a refuse ce lien (principal : ${describe(primaryError)} ; repli : ${describe(fallbackError)}).`,
    );
  }
  throw primaryError;
}
