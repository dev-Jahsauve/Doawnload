export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function send<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError((data.error as string) ?? "Erreur inattendue.", res.status);
  }
  return data as unknown as T;
}

export interface VideoFormat {
  id: string;
  kind: "video" | "audio";
  ext: string;
  quality: string;
  label: string;
}

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  platform: string;
  formats: VideoFormat[];
}

export interface JobState {
  id: string;
  state: string;
  progress: number;
  result: { fileId: string; filename: string } | null;
  failedReason: string | null;
}

export interface DirectDownload {
  direct: true;
  url: string;
}

export const api = {
  analyze: (url: string) => send<{ info: VideoInfo }>("/api/analyze", { url }),
  requestDownload: (payload: { url: string; formatId: string; title?: string }) =>
    send<{ jobId: string } | DirectDownload>("/api/download", payload),
  async job(jobId: string): Promise<JobState> {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError((data.error as string) ?? "Tâche introuvable.", res.status);
    }
    return data as unknown as JobState;
  },
};
