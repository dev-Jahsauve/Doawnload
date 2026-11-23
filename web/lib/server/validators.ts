/**
 * Validation des liens cote serveur (mode serverless).
 * Meme whitelist stricte que le mode VPS : aucune requete sortante
 * vers un domaine non liste via l'extracteur.
 */

export type Platform = "youtube" | "facebook" | "tiktok" | "unknown";

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.watch",
  "fb.me",
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

export function detectPlatform(hostname: string): Platform {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  if (host.endsWith("facebook.com") || host === "fb.watch" || host === "fb.me") return "facebook";
  if (host.endsWith("tiktok.com")) return "tiktok";
  return "unknown";
}

export function parseAndValidateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Lien invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Seuls les liens http(s) sont acceptes.");
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Plateforme non supportee pour le moment.");
  }
  return url;
}
