// src/app/api/cron/security-weekly-digest/route.ts
//
// DÉPRÉCIÉ — le Security Digest standalone est supprimé. Tout son contenu
// (incidents critiques, nouveaux incidents, actions ouvertes, expositions)
// est désormais intégré dans le rapport hebdomadaire unifié FR envoyé par
// /api/cron/weekly-digest (voir src/lib/email/unifiedDigest.ts).
//
// Un seul email par semaine. Cette route n'envoie plus rien et l'entrée
// cron correspondante a été retirée de vercel.json. Le handler est
// conservé en no-op pour qu'un appel résiduel renvoie une réponse propre.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEPRECATION = {
  ok: true,
  deprecated: true,
  message:
    "Security Digest fusionné dans le rapport hebdomadaire unifié — voir /api/cron/weekly-digest",
} as const;

export async function GET() {
  return NextResponse.json(DEPRECATION);
}

export async function POST() {
  return NextResponse.json(DEPRECATION);
}
