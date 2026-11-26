import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Configuration publicitaire lue A L'EXECUTION (runtime) et non au build.
 *
 * Pourquoi : les variables NEXT_PUBLIC_* sont inlinées dans le bundle au build.
 * Un changement de valeur dans Vercel exigeait donc un Redeploy SANS cache pour
 * etre pris en compte. Cette route contourne le probleme : elle lit process.env
 * au moment de la requete (acces dynamique, jamais remplace par le compilateur),
 * ce qui rend la config pub modifiable par un simple Redeploy — cache ou non.
 *
 * Les deux familles de noms sont supportees :
 *  - NEXT_PUBLIC_ADSTERRA_*  (deja configurees dans Vercel)
 *  - ADSTERRA_*              (variante strictement serveur, recommandee a terme)
 */
export async function GET() {
  const env = process.env as Record<string, string | undefined>;

  const bannerKey = env["NEXT_PUBLIC_ADSTERRA_BANNER_KEY"] ?? env["ADSTERRA_BANNER_KEY"] ?? "";
  const invokeUrl = env["NEXT_PUBLIC_ADSTERRA_INVOKE_URL"] ?? env["ADSTERRA_INVOKE_URL"] ?? "";
  const globalRaw = env["NEXT_PUBLIC_ADSTERRA_GLOBAL_SRC"] ?? env["ADSTERRA_GLOBAL_SRC"] ?? "";
  const nativeSrc = env["NEXT_PUBLIC_ADSTERRA_NATIVE_SRC"] ?? env["ADSTERRA_NATIVE_SRC"] ?? "";

  return NextResponse.json(
    {
      bannerKey,
      invokeUrl,
      globalSrc: globalRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      nativeSrc,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
