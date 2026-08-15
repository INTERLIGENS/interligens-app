/**
 * src/app/api/cron/onchain/sync/route.ts
 * Endpoint public appelé par Vercel Cron
 * Protégé par CRON_SECRET (pas par x-admin-token)
 */
import { NextRequest, NextResponse } from "next/server";
import { incrementalSync } from "@/lib/surveillance/onchain/ingest";
import { timingSafeEqual } from "crypto";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";

export const runtime = "nodejs";
export const maxDuration = 300; // SEC-010
export const dynamic = "force-dynamic";


function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret") ?? "";
  try {
    const a = Buffer.from(secret, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrière d'écriture production. Un Preview porte le même CRON_SECRET et
  // la même DATABASE_URL que la Production : l'authentification ci-dessus ne
  // distingue pas les deux. Voir docs/PREVIEW_PROD_ISOLATION.md.
  const blockedByProdGuard = prodWriteGuardResponse("/api/cron/onchain/sync");
  if (blockedByProdGuard) return blockedByProdGuard;
  const result = await incrementalSync();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return POST(req);
}
