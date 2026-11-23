import { spawn } from "node:child_process";
import { config } from "../config.js";
import type { DownloadProvider, FormatId, VideoFormat, VideoInfo } from "./download-provider.js";
import { detectPlatform } from "../lib/urls.js";

interface RawFormat {
  height?: number | null;
  vcodec?: string | null;
}

interface RawInfo {
  title?: string;
  duration?: number | null;
  thumbnail?: string | null;
  height?: number | null;
  formats?: RawFormat[];
}

/** Sélecteurs yt-dlp : vidéo fusionnée en MP4 compatible, ou MP3 pur. */
const FORMAT_SELECTORS: Record<"1080" | "720" | "360", string> = {
  "1080": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
  "720": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
  "360": "bestvideo[height<=360]+bestaudio/best[height<=360]/best",
};

const QUALITY_LABELS: Record<"1080" | "720" | "360", string> = {
  "1080": "1080p",
  "720": "720p",
  "360": "360p",
};

function run(bin: string, args: string[], onStdoutLine?: (line: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let buffer = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (!onStdoutLine) return;
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) onStdoutLine(line);
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (err) => reject(new Error(`Impossible de lancer ${bin} : ${err.message}`)));

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const tail = stderr.trim().split("\n").slice(-3).join(" ");
        reject(new Error(tail || `Le fournisseur d'extraction a échoué (code ${code}).`));
      }
    });
  });
}

export class YtDlpProvider implements DownloadProvider {
  private readonly bin: string;

  constructor(bin: string = config.ytDlpBin) {
    this.bin = bin;
  }

  async analyze(url: string): Promise<VideoInfo> {
    const raw = await run(this.bin, ["-J", "--no-playlist", "--no-warnings", url]);
    let meta: RawInfo;
    try {
      meta = JSON.parse(raw) as RawInfo;
    } catch {
      throw new Error("Réponse illisible du fournisseur d'extraction.");
    }

    const availableHeights = new Set(
      (meta.formats ?? [])
        .filter((f) => f.vcodec && f.vcodec !== "none")
        .map((f) => f.height)
        .filter((h): h is number => typeof h === "number"),
    );

    const maxHeight = meta.height ?? (availableHeights.size > 0 ? Math.max(...availableHeights) : 720);
    const formats: VideoFormat[] = [];

    for (const height of [1080, 720, 360] as const) {
      if (height <= maxHeight) {
        formats.push({
          id: String(height) as FormatId,
          kind: "video",
          ext: "mp4",
          quality: QUALITY_LABELS[height],
          label: `MP4 · ${QUALITY_LABELS[height]}`,
        });
      }
    }

    formats.push({ id: "mp3", kind: "audio", ext: "mp3", quality: "audio", label: "MP3 · audio seul" });

    return {
      title: meta.title?.trim() || "Vidéo sans titre",
      duration: Math.round(meta.duration ?? 0),
      thumbnail: meta.thumbnail ?? "",
      platform: detectPlatform(new URL(url).hostname),
      formats,
    };
  }

  async download(
    url: string,
    formatId: FormatId,
    outputBase: string,
    onProgress: (percent: number) => void,
  ): Promise<{ filePath: string; ext: string }> {
    const args = ["--newline", "--no-playlist", "--no-warnings", "-o", `${outputBase}.%(ext)s`];

    if (formatId === "mp3") {
      args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
    } else {
      args.push("-f", FORMAT_SELECTORS[formatId], "--merge-output-format", "mp4");
    }
    args.push(url);

    await run(this.bin, args, (line) => {
      const match = /\[download\]\s+([\d.]+)%/.exec(line);
      if (match) {
        onProgress(Math.min(100, Math.round(Number(match[1]))));
      }
    });

    return {
      filePath: formatId === "mp3" ? `${outputBase}.mp3` : `${outputBase}.mp4`,
      ext: formatId === "mp3" ? "mp3" : "mp4",
    };
  }
}
