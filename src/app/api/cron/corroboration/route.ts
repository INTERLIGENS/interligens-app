import { NextRequest, NextResponse } from "next/server";
import { applyCorroborationToLabels, computeCorroboration } from "@/lib/intake/corroboration";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300; // SEC-010
export const dynamic = "force-dynamic";


// Gate cron FAIL-CLOSED, aligné sur les 18 autres crons du repo
// (cron/intel-summarize, cron/weekly-digest, cron/mm-batch-scan...).
//
// AVANT : `if (auth !== `Bearer ${process.env.CRON_SECRET}`)`, sans aucun
// `if (!secret)`. CRON_SECRET absente rendait le secret attendu égal à la
// chaîne CONSTANTE "Bearer undefined" ; posée à vide, à "Bearer ". Dans les
// deux cas la route s'ouvrait à qui envoie cet en-tête — une protection qui
// se retourne en porte d'entrée exactement quand la config manque.
//
// La comparaison passe aussi en temps constant, comme les autres.
function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Chaîne vide = absente : sans ça, `Bearer ` deviendrait un secret valide.
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

// Vercel Cron: runs every 24 hours
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results  = await computeCorroboration();
  const updated  = await applyCorroborationToLabels();

  return NextResponse.json({
    ok: true,
    corroboratedAddresses: results.length,
    labelsElevated:        updated,
    top10: results.slice(0, 10).map(r => ({
      address:       r.address,
      chain:         r.chain,
      evidenceCount: r.evidenceCount,
      confidence:    r.confidence,
    })),
  });
}
