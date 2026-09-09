// ─────────────────────────────────────────────────────────────────────────────
// Public API — Case Intelligence match (alias for /api/scan/intelligence)
// POST { type, value, chain? } → IntelSignal
// GET  ?value=&chain= → IntelSignal
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { matchEntity, lookupValue } from "@/lib/intelligence";
import {
  readSanctionCoverage,
  assessSanction,
  projectCoverageForAudience,
} from "@/lib/intelligence/sanctionCoverage";
import { prisma } from "@/lib/prisma";
import { normalizeValue, buildDedupKey } from "@/lib/intelligence/normalize";
import type { IntelEntityType } from "@/lib/intelligence";

async function isRetailSafe(value: string): Promise<boolean> {
  const types: IntelEntityType[] = ["ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"];
  for (const type of types) {
    const normalized = normalizeValue(type, value);
    const dedupKey = buildDedupKey(type, normalized);
    const entity = await prisma.canonicalEntity.findUnique({
      where: { dedupKey },
      select: { displaySafety: true },
    });
    if (entity?.displaySafety === "RETAIL_SAFE") return true;
  }
  return false;
}

/**
 * ─── S3.2 · L'APPELANT DIT S'IL SUPPRIME ─────────────────────────────────
 *
 * Cette fonction sert DEUX cas qui n'ont rien à voir : une absence vraie, et
 * un match retiré pour cette audience. Elle les rendait identiques, et c'est
 * ce qui produisait `NO_MATCH_COMPLETE` sur un résultat supprimé.
 *
 * Le défaut du paramètre est `PUBLISHED` : un appelant qui ne supprime rien
 * n'invente pas un retrait. Celui qui supprime le dit.
 */
function emptySignal(
  coverage: Awaited<ReturnType<typeof readSanctionCoverage>>,
  publicationState: "PUBLISHED" | "WITHHELD" = "PUBLISHED",
) {
  return NextResponse.json({
    match: false,
    ims: 0,
    ics: 0,
    matchCount: 0,
    hasSanction: false,
    // AUCUN champ ajouté : un `publicationState` servi serait un oracle
    // énumérable sur les entités masquées.
    sanctionAssessment: assessSanction(false, coverage, publicationState),
    sanctionsCoverage: projectCoverageForAudience(coverage, publicationState),
    topRiskClass: null,
    sourceSlug: null,
    externalUrl: null,
    matchBasis: null,
  });
}

async function handleLookup(value: string, type?: string, chain?: string, req?: Request) {
  const rl = await checkRateLimit(getClientIp(req!), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req!));

  if (!value) return NextResponse.json({ error: "Missing value" }, { status: 400 });

  const signal = type
    ? await matchEntity({ type: type as IntelEntityType, value, chain })
    : await lookupValue(value, chain);

    // ── BUILD 10 / P1 — la couverture voyage À CÔTÉ du booléen ──────────
    //
    // `hasSanction: false` ne peut pas signifier « contrôle sanctions négatif »
    // si des sources réglementaires attendues n'ont pas été consultées. Mesuré
    // le 2026-09-08 : `amf` et `fca` sont TIER 1 et n'avaient AUCUN run.
    //
    // Le booléen garde EXACTEMENT sa valeur. `sanctionsCoverage` la qualifie, et
    // `sanctionAssessment` distingue les trois cas — MATCHED, NO_MATCH_COMPLETE,
    // NO_MATCH_PARTIAL. Aucune sanction inventée, aucun `false` retourné en
    // `true`, aucun poids ni seuil modifié.
    const coverage = await readSanctionCoverage();

  // ── S3.2 — le moteur a TROUVÉ, et on décide de ne pas le montrer ────
  //
  // Mesuré le 2026-09-09 : matchCount 1 / hasSanction TRUE côté matcher,
  // NO_MATCH_COMPLETE servi ici. `hasSanction: false` ne change pas — c'est la
  // CONCLUSION qui cesse.
  if (signal.matchCount > 0 && !(await isRetailSafe(value))) {
    return emptySignal(coverage, "WITHHELD");
  }

  return NextResponse.json({
    match: signal.matchCount > 0,
    ims: signal.ims,
    ics: signal.ics,
    matchCount: signal.matchCount,
    hasSanction: signal.hasSanction,
    // Le retrait décidé à l'étage MATCHER voyage sur le signal.
    sanctionAssessment: assessSanction(signal.hasSanction, coverage, signal.publicationState),
    sanctionsCoverage: projectCoverageForAudience(coverage, signal.publicationState),
    topRiskClass: signal.topRiskClass,
    sourceSlug: signal.sourceSlug,
    externalUrl: signal.externalUrl,
    matchBasis: signal.matchBasis,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const value = (url.searchParams.get("value") || "").trim();
  const chain = url.searchParams.get("chain") || undefined;
  return handleLookup(value, undefined, chain, req);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const value = (body.value || "").trim();
  const type = body.type || undefined;
  const chain = body.chain || undefined;
  return handleLookup(value, type, chain, req);
}
