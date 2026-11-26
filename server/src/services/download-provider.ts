/**
 * Interface commune à tous les fournisseurs d'extraction.
 * Remplacer yt-dlp par une API tierce = créer une nouvelle classe
 * implémentant DownloadProvider et l'enregistrer dans provider.ts.
 */

import type { Platform } from "../lib/urls.js";

export type FormatId = "1080" | "720" | "360" | "mp3";

export interface VideoFormat {
  id: FormatId;
  kind: "video" | "audio";
  ext: "mp4" | "mp3";
  quality: string;
  label: string;
}

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  platform: Platform;
  formats: VideoFormat[];
}

export interface DownloadProvider {
  /** Analyse un lien déjà validé et renvoie les métadonnées + formats disponibles. */
  analyze(url: string): Promise<VideoInfo>;

  /** Télécharge la vidéo dans outputBase (sans extension) et signale la progression en %. */
  download(url: string, formatId: FormatId, outputBase: string, onProgress: (percent: number) => void): Promise<{ filePath: string; ext: string }>;
}
