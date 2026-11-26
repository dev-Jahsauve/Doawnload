import { NextRequest, NextResponse } from "next/server";
import { extractorConfigured } from "@/lib/server/extractor";
import { fetchMetadata } from "@/lib/server/metadata";
import { parseAndValidateUrl } from "@/lib/server/validators";
import { clientIpFromHeaders, recordUsage } from "@/lib/server/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzedFormat {
  id: string;
  kind: "video" | "audio";
  ext: string;
  quality: string;
  label: string;
}

const STATIC_FORMATS: AnalyzedFormat[] = [
  { id: "1080", kind: "video", ext: "mp4", quality: "1080p", label: "MP4 · 1080p" },
  { id: "720", kind: "video", ext: "mp4", quality: "720p", label: "MP4 · 720p" },
  { id: "360", kind: "video", ext: "mp4", quality: "360p", label: "MP4 · 360p" },
  { id: "mp3", kind: "audio", ext: "mp3", quality: "audio", label: "MP3 · audio seul" },
];

async function proxyToBackend(request: NextRequest): Promise<NextResponse> {
  const origin = process.env.API_ORIGIN ?? "http://localhost:4000";
  const res = await fetch(`${origin}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const raw = body.url?.trim();
  if (!raw) return NextResponse.json({ error: "Merci de coller un lien." }, { status: 400 });

  if (!extractorConfigured()) return proxyToBackend(request);

  try {
    const url = parseAndValidateUrl(raw);
    const meta = await fetchMetadata(url);
    await recordUsage("analyze", meta.platform, clientIpFromHeaders(request.headers));
    return NextResponse.json({ info: { ...meta, formats: STATIC_FORMATS } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analyse impossible." },
      { status: 400 },
    );
  }
}
