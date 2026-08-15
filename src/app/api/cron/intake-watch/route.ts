import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSource } from "@/lib/intake/watcher";
import { timingSafeEqual } from "crypto";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";

export const runtime = "nodejs";
export const maxDuration = 300; // SEC-010
export const dynamic = "force-dynamic";


// Vercel Cron: runs every 6 hours
// vercel.json: { "crons": [{ "path": "/api/cron/intake-watch", "schedule": "0 */6 * * *" }] }

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

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrière d'écriture production. Un Preview porte le même CRON_SECRET et
  // la même DATABASE_URL que la Production : l'authentification ci-dessus ne
  // distingue pas les deux. Voir docs/PREVIEW_PROD_ISOLATION.md.
  const blockedByProdGuard = prodWriteGuardResponse("/api/cron/intake-watch");
  if (blockedByProdGuard) return blockedByProdGuard;

  const sources = await prisma.watchSource.findMany({ where: { active: true } });
  const results: { id: string; name: string; intakeId: string | null; status: string }[] = [];

  for (const source of sources) {
    try {
      const intakeId = await checkSource({
        id:          source.id,
        name:        source.name,
        url:         source.url,
        investigator: source.investigator,
        tags:        JSON.parse(source.tags || "[]"),
        lastHash:    source.lastHash ?? undefined,
      });

      await prisma.watchSource.update({
        where: { id: source.id },
        data: {
          lastChecked:  new Date(),
          lastHash:     intakeId ? undefined : source.lastHash,
          lastIntakeId: intakeId ?? source.lastIntakeId,
          errorCount:   0,
        },
      });

      results.push({ id: source.id, name: source.name, intakeId, status: intakeId ? "new_content" : "unchanged" });
    } catch (e) {
      await prisma.watchSource.update({
        where: { id: source.id },
        data:  { errorCount: { increment: 1 } },
      });
      results.push({ id: source.id, name: source.name, intakeId: null, status: "error" });
    }
  }

  return NextResponse.json({ ok: true, checked: sources.length, results });
}
