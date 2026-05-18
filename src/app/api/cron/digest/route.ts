// src/app/api/cron/digest/route.ts
//
// DÉPRÉCIÉ — l'« Intelligence Digest » est désormais fusionné dans le
// rapport hebdomadaire unifié FR envoyé par /api/cron/weekly-digest
// (voir src/lib/email/unifiedDigest.ts).
//
// Cette route n'envoie plus d'email. L'entrée cron correspondante a été
// retirée de vercel.json. Le handler est conservé en no-op pour qu'un
// appel résiduel renvoie une réponse propre plutôt qu'un 404.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEPRECATION = {
  ok: true,
  deprecated: true,
  message:
    "Intelligence Digest fusionné dans le rapport hebdomadaire unifié — voir /api/cron/weekly-digest",
} as const;

export async function GET() {
  return NextResponse.json(DEPRECATION);
}

export async function POST() {
  return NextResponse.json(DEPRECATION);
}
