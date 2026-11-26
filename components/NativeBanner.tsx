"use client";

import { useEffect } from "react";

/**
 * Native Banner Adsterra : un conteneur <div id="container-KEY"> rempli par un
 * script asynchrone. L'URL du script vient de NEXT_PUBLIC_ADSTERRA_NATIVE_SRC
 * (ex : https://bellnewyork.org/21/68facc31adf1bf0509424094944fe952) et
 * l'identifiant du conteneur se derive du dernier segment de l'URL.
 * Rien ne s'affiche tant que la variable n'est pas definie.
 */
export default function NativeBanner() {
  const src = process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC;

  useEffect(() => {
    if (!src) return;
    const key = src.split("/").filter(Boolean).pop();
    if (!key) return;
    // (re)initialise le conteneur puis injecte le script une seule fois
    const host = document.getElementById("smartdownload-native-ad");
    if (!host) return;
    const container = document.createElement("div");
    container.id = `container-${key}`;
    host.innerHTML = "";
    host.appendChild(container);
    const s = document.createElement("script");
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    s.src = src;
    host.appendChild(s);
  }, [src]);

  if (!src) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8" aria-label="Publicité">
      <div id="smartdownload-native-ad" className="overflow-hidden rounded-2xl border border-line" />
    </div>
  );
}
