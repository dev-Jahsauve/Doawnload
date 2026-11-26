"use client";

import { useEffect, useRef } from "react";

interface BannerAdProps {
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Banniere Adsterra (regie compatible : Adsterra, PropellerAds / Monetag).
 * Active uniquement si une cle est fournie via NEXT_PUBLIC_ADSTERRA_BANNER_KEY.
 */
export function BannerAd({ width = 728, height = 90, className = "" }: BannerAdProps) {
  const key = process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY;
  // Adsterra livre parfois l'invoke sur un domaine specifique au compte ;
  // NEXT_PUBLIC_ADSTERRA_INVOKE_URL permet de fournir l'URL de l'extrait "Get Code".
  const invokeUrl =
    process.env.NEXT_PUBLIC_ADSTERRA_INVOKE_URL ??
    `https://www.highperformanceformat.com/${key}/invoke.js`;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!key || !host) return;

    host.innerHTML = "";

    const atOptions = document.createElement("script");
    atOptions.type = "text/javascript";
    atOptions.text = `atOptions = { key: '${key}', format: 'iframe', height: ${height}, width: ${width}, params: {} };`;

    const invoke = document.createElement("script");
    invoke.type = "text/javascript";
    invoke.src = invokeUrl;
    invoke.async = true;

    host.append(atOptions, invoke);
  }, [key, invokeUrl, width, height]);

  if (!key) return null;

  return <div ref={hostRef} className={className} style={{ minHeight: height }} aria-label="Publicité" />;
}
