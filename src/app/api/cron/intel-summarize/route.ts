/**
 * GET /api/cron/intel-summarize
 * Vercel cron — every 30 min. Enriches pending intel items with a short
 * 2-3 bullet French summary via the central llm.service.
 * Auth: Bearer ${CRON_SECRET}.
 * Cap: 10 items per run, 3 attempts per item (burn-prevention).
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { llmComplete } from "@/lib/llm/llm.service";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH = 10;
const MAX_ATTEMPTS = 5;

const SYSTEM_PROMPT =
  "Tu es un assistant de veille crypto pour un founder. Résume en exactement 2-3 bullet points en français, ultra-concis. Chaque bullet commence par '• '. Aucun titre, aucune intro. Max 150 caractères par bullet.";

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
  const blockedByProdGuard = prodWriteGuardResponse("/api/cron/intel-summarize");
  if (blockedByProdGuard) return blockedByProdGuard;

  const items = await prisma.founderIntelItem.findMany({
    where: {
      summaryDone: false,
      summaryAttempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: [{ starRating: "desc" }, { publishedAt: "desc" }],
    take: BATCH,
  });

  let succeeded = 0;
  let failed = 0;
  // Cause dominante de l'échec, pour que la réponse dise POURQUOI et pas
  // seulement COMBIEN. Un MODEL_NOT_FOUND se corrige en changeant un
  // identifiant ; un RATE_LIMIT se corrige en attendant. La distinction n'a de
  // valeur que si elle sort de la route.
  const errorKinds: Record<string, number> = {};

  for (const item of items) {
    const userContent =
      `Titre: ${item.title}\n` +
      `Source: ${item.source}` +
      (item.excerpt ? `\nExtrait: ${item.excerpt}` : "");

    const res = await llmComplete({
      useCase: "entity_enrichment",
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 400,
      temperature: 0.2,
    });

    if (!res.fallbackUsed && res.content.trim()) {
      await prisma.founderIntelItem.update({
        where: { id: item.id },
        data: {
          summary: res.content.trim(),
          summaryDone: true,
          summaryAttempts: { increment: 1 },
          lastSummaryError: null,
        },
      });
      succeeded++;
    } else {
      const kind = res.errorKind ?? "UPSTREAM_ERROR";
      errorKinds[kind] = (errorKinds[kind] ?? 0) + 1;
      await prisma.founderIntelItem.update({
        where: { id: item.id },
        data: {
          summaryAttempts: { increment: 1 },
          lastSummaryError: `${kind}: ${res.error?.slice(0, 180) ?? "unknown"}`,
        },
      });
      failed++;
    }
  }

  // ─── Doctrine C4 — ne jamais affirmer une propriété autre que la mesurée ──
  // Cette route répondait `{ok: true}` quels que soient les compteurs. Pendant
  // deux mois, le modèle épinglé était retiré : zéro résumé produit, et une
  // supervision branchée sur `ok` n'a rien vu. Le verdict se déduit désormais
  // du résultat, jamais de l'achèvement de la boucle.
  //
  //   rien à faire ou tout réussi → ok:true   · status "ok"      · HTTP 200
  //   succès partiel             → ok:false  · status "partial" · HTTP 200
  //   échec total                → ok:false  · status "failed"  · HTTP 500
  //
  // Le 500 sur échec total est délibéré : c'est le seul signal que le tableau
  // de bord Vercel affiche en rouge. Un `ok:false` en 200 reste invisible pour
  // qui ne lit pas le corps — c'est exactement ce qui a permis l'incident.
  const status: "ok" | "partial" | "failed" =
    failed === 0 ? "ok" : succeeded > 0 ? "partial" : "failed";
  const totalFailure = status === "failed" && items.length > 0;

  return NextResponse.json(
    {
      ok: status === "ok",
      status,
      processed: items.length,
      succeeded,
      failed,
      ...(failed > 0 ? { errorKinds } : {}),
    },
    { status: totalFailure ? 500 : 200 },
  );
}
