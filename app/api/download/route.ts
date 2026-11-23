import { NextRequest, NextResponse } from "next/server";
import { extractorConfigured, extractMediaUrl } from "@/lib/server/extractor";
import { consumeDownloadSlot } from "@/lib/server/rate-limit";
import { parseAndValidateUrl } from "@/lib/server/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUALITY_IDS = new Set(["1080", "720", "360"]);

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

async function proxyToBackend(request: NextRequest): Promise<NextResponse> {
  const origin = process.env.API_ORIGIN ?? "http://localhost:4000";
  const res = await fetch(`${origin}/api/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    formatId?: string;
    priority?: boolean;
  };
  const raw = body.url?.trim();
  const formatId = body.formatId ?? "720";

  if (!raw || !(QUALITY_IDS.has(formatId) || formatId === "mp3")) {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  if (!extractorConfigured()) return proxyToBackend(request);

  const limit = await consumeDownloadSlot(clientIp(request));
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.resetInSeconds / 60));
    return NextResponse.json(
      {
        error: `Limite de ${process.env.RATE_LIMIT_MAX ?? 10} telechargements par heure atteinte. Reessaie dans ${minutes} min.`,
      },
      { status: 429 },
    );
  }

  try {
    const url = parseAndValidateUrl(raw);
    const result = await extractMediaUrl(url.toString(), {
      kind: formatId === "mp3" ? "audio" : "video",
      quality: QUALITY_IDS.has(formatId) ? (formatId as "1080" | "720" | "360") : undefined,
    });
    return NextResponse.json({ direct: true, url: result.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction impossible." },
      { status: 400 },
    );
  }
}
