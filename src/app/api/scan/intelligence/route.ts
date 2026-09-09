// ─────────────────────────────────────────────────────────────────────────────
// Public API — Case Intelligence lookup for scanner badge
// Rate-limited. Only returns RETAIL_SAFE entities.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { natureOfTransformation } from "@/lib/data-nature/dto";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { lookupValue, matchEntity } from "@/lib/intelligence";
import {
  readSanctionCoverage,
  assessSanction,
  projectCoverageForAudience,
} from "@/lib/intelligence/sanctionCoverage";
import { prisma } from "@/lib/prisma";
import { normalizeValue, buildDedupKey } from "@/lib/intelligence/normalize";
import type { IntelEntityType } from "@/lib/intelligence";

async function handleLookup(req: Request, value: string, type?: string, chain?: string) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  if (!value) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 });
  }

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

  // Enforce displaySafety gate for public route
  if (signal.matchCount > 0) {
    const types = ["ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"] as const;
    let isRetailSafe = false;

    for (const t of types) {
      const normalized = normalizeValue(t, value);
      const dedupKey = buildDedupKey(t, normalized);
      const entity = await prisma.canonicalEntity.findUnique({
        where: { dedupKey },
        select: { displaySafety: true },
      });
      if (entity?.displaySafety === "RETAIL_SAFE") {
        isRetailSafe = true;
        break;
      }
    }

    if (!isRetailSafe) {
      // ─── S3.2 · CETTE BRANCHE SAIT QU'ELLE SUPPRIME ─────────────────
      //
      // ██  Le moteur a TROUVÉ (`signal.matchCount > 0`). On décide de ne  ██
      // ██  pas le montrer à ce public. Ce n'est pas « rien trouvé ».      ██
      //
      // Mesuré le 2026-09-09 sur TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz,
      // observation ofac/SANCTION ACTIVE : le matcher rendait matchCount 1 et
      // hasSanction TRUE, cette branche servait NO_MATCH_COMPLETE avec
      // negativeIsConclusive true. Une affirmation concluante de propreté sur
      // un résultat qu'on venait de retirer.
      //
      // `hasSanction: false` NE CHANGE PAS — le retrait reste un retrait, et
      // le révéler serait divulguer ce que la gate protège. C'est la
      // CONCLUSION qui cesse : on n'affirme plus.
      //
      // ET AUCUN CHAMP N'EST AJOUTÉ. Un `publicationState: "WITHHELD"` servi
      // ici serait un ORACLE ÉNUMÉRABLE : balayer des adresses reconstituerait
      // la liste des entités sanctionnées-mais-masquées. L'appelant apprend
      // qu'on ne conclut pas ; il n'apprend pas pourquoi.
      // ─── ET LA FORME DE LA CHARGE UTILE EST UN ORACLE, ELLE AUSSI ──
      //
      // ██  Cette branche rendait 7 clefs. Le retour normal en rend 12.   ██
      //
      // Un appelant distinguait donc « retiré » de « rien trouvé » EN
      // COMPTANT LES CHAMPS — sans lire une seule valeur. C'est un oracle
      // plus direct que tout ce que le contenu pouvait trahir, et il
      // PRÉCÈDE S3.2 : la branche a toujours été tronquée.
      //
      // Mesuré en écrivant le verrou de route : 7 clefs contre 12. La route
      // voisine `/api/intelligence/match` ne l'avait pas — son `emptySignal`
      // rend déjà la forme complète.
      //
      // Les quatre champs manquants valent `null` sur une absence vraie. Les
      // rendre ici ne divulgue donc RIEN : c'est exactement ce qu'un négatif
      // sert, et c'est le point.
      return NextResponse.json({
        match: false,
        ims: 0,
        ics: 0,
        matchCount: 0,
        hasSanction: false,
        sanctionAssessment: assessSanction(false, coverage, "WITHHELD"),
        sanctionsCoverage: projectCoverageForAudience(coverage, "WITHHELD"),
        topRiskClass: null,
        sourceSlug: null,
        externalUrl: null,
        matchBasis: null,
        _nature: natureOfTransformation("compute", ["THIRD_PARTY_DATA"]),
      });
    }
  }

  return NextResponse.json({
    match: signal.matchCount > 0,
    ims: signal.ims,
    ics: signal.ics,
    matchCount: signal.matchCount,
    hasSanction: signal.hasSanction,
    // Le retrait décidé à l'étage MATCHER voyage sur le signal. Il ne
    // concerne PAS un refus de provenance ni un délistage — voir matcher.ts.
    sanctionAssessment: assessSanction(signal.hasSanction, coverage, signal.publicationState),
    sanctionsCoverage: projectCoverageForAudience(coverage, signal.publicationState),
    topRiskClass: signal.topRiskClass,
    sourceSlug: signal.sourceSlug,
    externalUrl: signal.externalUrl,
    matchBasis: signal.matchBasis,
    // S2 — topRiskClass est CALCULÉ à partir d'observations tierces : c'est une
    // INFERENCE, pas un fait rapporté par la source. natureBasis retient que son
    // plancher est un flux tiers (Q3). Additif : aucun champ existant ne change.
    _nature: natureOfTransformation("compute", ["THIRD_PARTY_DATA"]),
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const value = (url.searchParams.get("value") || "").trim();
  const chain = url.searchParams.get("chain") || undefined;
  return handleLookup(req, value, undefined, chain);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const value = (body.value || "").trim();
  const type = body.type || undefined;
  const chain = body.chain || undefined;
  return handleLookup(req, value, type, chain);
}
