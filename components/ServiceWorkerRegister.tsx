"use client";

import { useEffect } from "react";

/**
 * Enregistrement silencieux du Service Worker (public/sw.js).
 *
 * - Monté une seule fois depuis le layout racine.
 * - Aucun impact visuel ; ne bloque jamais le rendu.
 * - Le SW gère lui-même ses mises à jour (skipWaiting + purge des caches),
 *   donc pas de rechargement forcé : les nouvelles versions passent
 *   naturellement grâce à la stratégie "réseau d'abord" sur les pages.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // pas de SW en dev

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("[SmartDownload] SW non enregistré :", err));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
