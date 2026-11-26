/**
 * Metadonnees best-effort du mode serverless : oEmbed public (titre + miniature)
 * quand la plateforme le propose, sinon valeurs par defaut discretes.
 */

import { detectPlatform, type Platform } from "./validators";
import { fetchFallbackInfo } from "./extractor";

export interface MetadataResult {
  title: string;
  thumbnail: string;
  duration: number;
  platform: Platform;
}

function oembedEndpoint(platform: Platform, url: string): string | null {
  const encoded = encodeURIComponent(url);
  if (platform === "youtube") return `https://www.youtube.com/oembed?url=${encoded}&format=json`;
  if (platform === "tiktok") return `https://www.tiktok.com/oembed?url=${encoded}`;
  return null;
}

export async function fetchMetadata(url: URL): Promise<MetadataResult> {
  const platform = detectPlatform(url.hostname);
  const endpoint = oembedEndpoint(platform, url.toString());

  let title = "Video partagee";
  let thumbnail = "";
  let duration = 0;

  if (endpoint) {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { title?: string; thumbnail_url?: string };
        if (data.title) title = data.title;
        if (data.thumbnail_url) thumbnail = data.thumbnail_url;
      }
    } catch {
      // oEmbed indisponible : on reste sur les valeurs par defaut
    }
  }

  // Facebook n'a pas d'oEmbed public : on interroge le service yt-dlp de
  // secours pour un vrai titre / une vraie duree (best-effort, jamais bloquant).
  if (platform === "facebook") {
    const info = await fetchFallbackInfo(url.toString());
    if (info) {
      title = info.title;
      thumbnail = info.thumbnail || thumbnail;
      duration = info.duration;
    }
  }

  return { title, thumbnail, duration, platform };
}
