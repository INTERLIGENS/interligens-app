/**
 * GET /api/cron/weekly-digest
 *
 * Vercel cron — Mondays at 08:00 UTC. Fires sendUnifiedDigest() :
 * le rapport hebdomadaire unifié FR (Security + Weekly + Intelligence)
 * envoyé depuis alerts@interligens.com vers admin@interligens.com.
 * Auth: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendUnifiedDigest } from "@/lib/email/unifiedDigest";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrière d'écriture production. Un Preview porte le même CRON_SECRET et
  // la même DATABASE_URL que la Production : l'authentification ci-dessus ne
  // distingue pas les deux. Voir docs/PREVIEW_PROD_ISOLATION.md.
  const blockedByProdGuard = prodWriteGuardResponse("/api/cron/weekly-digest");
  if (blockedByProdGuard) return blockedByProdGuard;

  try {
    const result = await sendUnifiedDigest();
    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      skipped: result.skipped,
      error: result.error,
      stats: result.stats,
    });
  } catch (err) {
    console.error("[cron/weekly-digest] failed", err);
    return NextResponse.json(
      { ok: false, error: "digest_failed" },
      { status: 500 },
    );
  }
}
