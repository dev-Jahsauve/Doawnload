"use client";

import { useEffect, useState } from "react";

export interface AdConfig {
  bannerKey: string;
  invokeUrl: string;
  globalSrc: string[];
  nativeSrc: string;
}

const EMPTY: AdConfig = { bannerKey: "", invokeUrl: "", globalSrc: [], nativeSrc: "" };

/**
 * Configuration publicitaire cote client.
 *
 * Etat initial : valeurs NEXT_PUBLIC_* inlinées au build (fallback instantane,
 * utile en local). Puis surcharge par /api/adconfig qui lit les variables
 * A L'EXECUTION cote serveur — un changement de variable dans Vercel devient
 * effectif apres n'importe quel Redeploy, meme avec Build Cache.
 */
export function useAdConfig(): AdConfig {
  const [config, setConfig] = useState<AdConfig>(() => ({
    ...EMPTY,
    bannerKey: process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY ?? "",
    invokeUrl: process.env.NEXT_PUBLIC_ADSTERRA_INVOKE_URL ?? "",
    nativeSrc: process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC ?? "",
    globalSrc: (process.env.NEXT_PUBLIC_ADSTERRA_GLOBAL_SRC ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/adconfig")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setConfig({
          bannerKey: data.bannerKey ?? "",
          invokeUrl: data.invokeUrl ?? "",
          nativeSrc: data.nativeSrc ?? "",
          globalSrc: Array.isArray(data.globalSrc) ? data.globalSrc : [],
        });
      })
      .catch(() => {
        /* fallback : on garde les valeurs build-time */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
