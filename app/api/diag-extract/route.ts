import { NextResponse } from "next/server";
import { extractorConfigured } from "@/lib/server/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Diagnostic GET de la chaine d'extraction (temporaire, reserver au debug).
 * Interroge le fournisseur principal puis le repli avec une URL YouTube
 * figee, et renvoie les reponses brutes sans jamais exposer de secret.
 */

const TEST_URL = "https://youtu.be/GwWZ0qIIsCc";

function describeEnv() {
  const env = process.env as Record<string, string | undefined>;
  return {
    provider: env.EXTRACT_PROVIDER ?? null,
    primaryConfigured: extractorConfigured(),
    primaryHost: env.EXTRACT_API_URL ? safeHost(env.EXTRACT_API_URL) : null,
    hasApiKey: Boolean(env.EXTRACT_API_KEY),
    fallbackConfigured: Boolean(env.EXTRACT_FALLBACK_URL),
    fallbackHost: env.EXTRACT_FALLBACK_URL ? safeHost(env.EXTRACT_FALLBACK_URL) : null,
  };
}

function safeHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

async function probe(base: string): Promise<Record<string, unknown>> {
  const started = Date.now();
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: TEST_URL,
        downloadMode: "auto",
        videoQuality: "720",
        audioFormat: "mp3",
        filenameStyle: "basic",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, httpStatus: res.status, latencyMs: Date.now() - started, response: data };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

export async function GET() {
  const env = process.env as Record<string, string | undefined>;
  return NextResponse.json(
    {
      testedUrl: TEST_URL,
      env: describeEnv(),
      primary: extractorConfigured() && env.EXTRACT_API_URL ? await probe(env.EXTRACT_API_URL) : null,
      fallback: env.EXTRACT_FALLBACK_URL ? await probe(env.EXTRACT_FALLBACK_URL) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
