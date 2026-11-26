"use client";

import Script from "next/script";
import { useAdConfig } from "../lib/useAdConfig";

/**
 * Script publicitaire global Adsterra (Social Bar / Popunder).
 *
 * Adsterra fournit pour ces formats un simple <script src="..."> : on le charge
 * a l'echelle du site via une variable d'environnement NEXT_PUBLIC_ADSTERRA_GLOBAL_SRC.
 * La valeur colle dans Vercel est l'URL complete du script, par exemple :
 *   https://accountut.com/1/5bf074568032f6e048bab3cc9c5cd087
 * (copiee depuis "Get Code" de l'unite Social Bar ou Popunder).
 *
 * Rien ne se charge tant que la variable n'est pas definie — le site reste propre
 * en local et en pre-production.
 */
export default function GlobalAdsterra() {
  const { globalSrc: sources } = useAdConfig();
  if (!sources.length) return null;

  return (
    <>
      {sources.map((src) => (
        <Script key={src} data-cfasync="false" src={src} strategy="afterInteractive" />
      ))}
    </>
  );
}
