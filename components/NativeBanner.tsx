"use client";

import { useEffect, useRef } from "react";
import { useAdConfig } from "../lib/useAdConfig";

/**
 * Native Banner Adsterra : emplacement publicitaire principal, discret, sous la
 * zone de travail. L'URL du script vient de NEXT_PUBLIC_ADSTERRA_NATIVE_SRC
 * (ex : https://bellnewyork.org/21/68facc31adf1bf0509424094944fe952) et
 * l'identifiant du conteneur se derive du dernier segment de l'URL.
 *
 * - Hauteur minimale reservee pour eviter tout deplacement de la page (CLS).
 * - Une seule charge par session : le script n'est jamais re-injecte, le
 *   masquage apres la fin d'un telechargement se fait par attribut hidden.
 * - Rien ne s'affiche tant que la variable n'est pas definie.
 */
interface NativeBannerProps {
  hidden?: boolean;
}

export default function NativeBanner({ hidden = false }: NativeBannerProps) {
  const { nativeSrc: src } = useAdConfig();
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!src || injectedRef.current) return;
    const key = src.split("/").filter(Boolean).pop();
    if (!key) return;
    const host = document.getElementById("smartdownload-native-ad");
    if (!host) return;
    injectedRef.current = true;
    const container = document.createElement("div");
    container.id = `container-${key}`;
    host.appendChild(container);
    const s = document.createElement("script");
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    s.src = src;
    host.appendChild(s);
  }, [src]);

  if (!src) return null;

  return (
    <aside hidden={hidden} aria-label="Publicité" className="mx-auto w-full max-w-2xl">
      <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Publicité</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div id="smartdownload-native-ad" className="min-h-[220px] sm:min-h-[190px]" />
      </div>
    </aside>
  );
}
