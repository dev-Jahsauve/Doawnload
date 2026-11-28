"use client";

import { useEffect, useRef } from "react";
import { useAdConfig } from "../lib/useAdConfig";

interface BannerAdProps {
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Banniere Adsterra (300x250 / 728x90, regie compatible Adsterra / PropellerAds).
 *
 * Le script invoke.js d'Adsterra ecrit la creation via document.write : ajoute
 * au document principal APRES le chargement de la page, il ne rend rien. On
 * l'injecte donc dans une iframe isolee (document.write y reste valide), et on
 * met l'iframe a l'echelle du conteneur pour les petits ecrans.
 * Active uniquement si une cle est fournie (NEXT_PUBLIC_ADSTERRA_BANNER_KEY
 * ou ADSTERRA_BANNER_KEY, servie par /api/adconfig).
 */
export function BannerAd({ width = 728, height = 90, className = "" }: BannerAdProps) {
  const { bannerKey: key, invokeUrl: invokeFromEnv } = useAdConfig();
  // Adsterra livre parfois l'invoke sur un domaine specifique au compte ;
  // sinon on retombe sur le domaine public par defaut.
  const invokeUrl = invokeFromEnv || `https://www.highperformanceformat.com/${key}/invoke.js`;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!key || !host) return;

    host.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.width = String(width);
    iframe.height = String(height);
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("title", "Publicite");
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.transformOrigin = "top left";
    host.appendChild(iframe);

    const fit = () => {
      const scale = Math.min(1, host.clientWidth / width);
      iframe.style.transform = scale < 1 ? `scale(${scale})` : "";
      iframe.style.marginBottom = scale < 1 ? `${-(1 - scale) * height}px` : "0";
    };
    fit();
    window.addEventListener("resize", fit);

    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(
        `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head>` +
          `<body style="margin:0;padding:0">` +
          `<script type="text/javascript">atOptions = { key: '${key}', format: 'iframe', height: ${height}, width: ${width}, params: {} };</` +
          `script>` +
          `<script type="text/javascript" src="${invokeUrl}"></` +
          `script>` +
          `</body></html>`,
      );
      doc.close();
    }

    return () => window.removeEventListener("resize", fit);
  }, [key, invokeUrl, width, height]);

  if (!key) return null;

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ minHeight: height, overflow: "hidden" }}
      aria-label="Publicité"
    />
  );
}
