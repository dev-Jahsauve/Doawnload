import { config } from "../config.js";
import type { DownloadProvider } from "./download-provider.js";
import { YtDlpProvider } from "./yt-dlp-provider.js";

let current: DownloadProvider | null = null;

/** Point d'injection unique : change DOWNLOAD_PROVIDER pour brancher une autre source. */
export function getProvider(): DownloadProvider {
  if (current) return current;
  switch (config.provider) {
    case "ytdlp":
    default:
      current = new YtDlpProvider();
  }
  return current;
}
