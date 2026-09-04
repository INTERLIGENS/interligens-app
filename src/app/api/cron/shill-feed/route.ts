// src/app/api/cron/shill-feed/route.ts
//
// --- B7 — CRON FEED : hourly, HELIUS-FREE --------------------------------
//
// social_post_candidates → qualifyPromotion → resolveTokenIdentity → ShillEvent
//
// ██ AUCUN APPEL HELIUS SUR CE CHEMIN. ██ C'est ce qui permet au feed de
// tourner toutes les heures sans budget on-chain, et de continuer à tourner
// quand Helius est indisponible. Le volet on-chain vit dans /shill-shadow,
// avec sa propre cadence et son propre budget.
//
// IDEMPOTENT PAR LA BASE, pas par le curseur. Le watermark évite de rescanner,
// il ne garantit rien : c'est UNIQUE (kolHandle, tweetId, tokenMint)
// NULLS NOT DISTINCT + `skipDuplicates` qui empêchent les doublons. La fenêtre
// recule donc volontairement d'un recouvrement — perdre un candidat découvert
// dans la même seconde que le dernier ingéré serait pire qu'en relire trente.
//
// L'INVARIANT SNOWFLAKE (T2) GARDE L'ÉCRITURE. Un tweetTimestamp qui diverge
// de l'instant encodé dans le tweetId fait LEVER la persistance. C'est la
// garde qui aurait refusé les 5 lignes décalées de B6a — elle est en amont, et
// une route qui la contournerait réintroduirait le défaut.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { prodWriteGuardResponse } from "@/lib/ops/prodWriteGuard";
import {
  runForwardBridge,
  type ForwardCandidate,
} from "@/lib/shill-correlation/forwardBridge";
import { FEED_MAX_CANDIDATES, FEED_OVERLAP_MINUTES } from "@/lib/shill-correlation/cronConfig";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Gate cron FAIL-CLOSED en temps constant, aligné sur les 19 autres crons du
 * repo. Sans `CRON_SECRET`, la route ne s'ouvre pas : un secret absent est un
 * refus, jamais une permission.
 */
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

/**
 * WATERMARK DU FEED — dérivé, jamais stocké.
 *
 * Le plus récent `discoveredAtUtc` parmi les candidats qu'un ShillEvent
 * référence déjà. Aucune table de curseur, donc aucune DDL. Un curseur
 * persistant peut mentir après un rollback ; un watermark dérivé de l'état
 * réel ne peut pas être en avance sur ce qui a été écrit.
 */
async function readFeedWatermark(): Promise<Date | null> {
  const rows = await prisma.$queryRaw<Array<{ wm: Date | null }>>`
    SELECT max(s."discoveredAtUtc") AS wm
    FROM "social_post_candidates" s
    JOIN "ShillEvent" e ON e."sourcePostCandidateId" = s.id`;
  return rows[0]?.wm ?? null;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrière d'écriture production : un Preview porte le même CRON_SECRET et
  // la même DATABASE_URL que la Production. L'authentification ci-dessus ne
  // distingue pas les deux. Voir docs/PREVIEW_PROD_ISOLATION.md.
  const blocked = prodWriteGuardResponse("/api/cron/shill-feed");
  if (blocked) return blocked;

  const startedAt = new Date();
  try {
    const report = await runForwardBridge({
      // ██ ÉCRITURE RÉELLE — c'est le rôle de ce cron. ██
      dryRun: false,
      limit: FEED_MAX_CANDIDATES,
      overlapMinutes: FEED_OVERLAP_MINUTES,
      readWatermark: readFeedWatermark,
      readCandidates: async ({ since, limit }) => {
        // Prisma, et non un client SQL brut : sur une colonne
        // `timestamp without time zone`, un driver qui interprète en heure
        // locale décale la lecture — c'est ce qui a produit les lignes
        // décalées de B6a. Prisma lit en UTC.
        const rows = await prisma.socialPostCandidate.findMany({
          where: since ? { discoveredAtUtc: { gte: since } } : undefined,
          orderBy: { discoveredAtUtc: "desc" },
          take: limit,
          select: {
            id: true, postId: true, postUrl: true, postedAtUtc: true,
            discoveredAtUtc: true, chain: true, campaignId: true,
            signalTypes: true, signalScore: true,
            detectedTokens: true, detectedAddresses: true, rawText: true,
            influencer: { select: { handle: true } },
          },
        });
        if (rows.length === 0) return [];

        // DÉRIVE DE SCHÉMA, contournée sans la masquer : `ingestionMode` existe
        // en base et MANQUE au modèle Prisma. C'est un critère de
        // qualification — sans lui, le prédicat rejetterait tout pour la
        // mauvaise raison.
        //
        // La requête brute ne ramène QUE du texte : aucun timestamp n'y
        // transite. C'est délibéré — un driver brut interprète une colonne
        // `timestamp without time zone` en heure locale, et c'est exactement
        // ce qui a produit les lignes décalées de B6a. Les dates viennent de
        // Prisma, qui lit en UTC.
        const modes = await prisma.$queryRaw<Array<{ id: string; ingestionMode: string | null }>>`
          SELECT id, "ingestionMode" FROM "social_post_candidates"
          WHERE id = ANY(${rows.map((r) => r.id)}::text[])`;
        const modeById = new Map(modes.map((m) => [m.id, m.ingestionMode]));

        return rows.map((r) => ({
          ...r,
          handle: r.influencer?.handle ?? null,
          ingestionMode: modeById.get(r.id) ?? null,
        })) as unknown as ForwardCandidate[];
      },
    });

    return NextResponse.json({
      ok: true,
      route: "shill-feed",
      heliusFree: true,
      startedAt: startedAt.toISOString(),
      windowSince: report.windowSince?.toISOString() ?? null,
      watermarkBefore: report.watermarkBefore?.toISOString() ?? null,
      watermarkAfter: report.watermarkAfter?.toISOString() ?? null,
      examined: report.examined,
      qualified: report.qualified,
      rejected: report.rejected,
      rejectedByCriterion: report.rejectedByCriterion,
      resolved: report.resolved,
      unresolved: report.unresolved,
      solanaEligible: report.solanaEligible,
      created: report.ingested,
      alreadyPresent: report.alreadyPresent,
      errors: report.errors,
    });
  } catch (e) {
    // L'invariant snowflake (T2) lève ici quand un timestamp diverge. Le 500
    // est VOULU : un cron qui avalerait ce refus écrirait des lignes décalées
    // en silence, et le défaut ne se verrait qu'au run shadow suivant.
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, route: "shill-feed", error: message },
      { status: 500 },
    );
  }
}
