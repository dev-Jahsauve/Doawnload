import { NextRequest, NextResponse } from "next/server";
import { readAdminStats } from "@/lib/server/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats — statistiques d'usage (reserve a l'administrateur).
 * Authentification : en-tete `x-admin-password` = ADMIN_PASSWORD defini dans
 * les variables d'environnement. Sans ADMIN_PASSWORD configure, la route
 * repond 503 et n'expose jamais les donnees.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Tableau de bord desactive : ADMIN_PASSWORD non configure." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-admin-password");
  if (provided !== expected) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const stats = await readAdminStats();
  return NextResponse.json({ stats });
}
