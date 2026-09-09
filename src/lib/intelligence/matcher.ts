// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Entity Matcher
// Looks up a value (address, domain, token CA) in CanonicalEntity
// and returns a scored IntelSignal for the scanner badge.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import {
  admitObservations,
  loadSourcePolicy,
  loadIngestionProvenance,
  observationIsProvenanced,
  type IntelAudience,
  type IngestionProvenanceIndex,
  type SourcePolicy,
} from "./retailAdmissibility";
import { normalizeValue, buildDedupKey } from "./normalize";
import type {
  IntelEntityType,
  IntelRiskClass,
  IntelSignal,
  MatchTarget,
  SourceObservationMinimal,
} from "./types";

// ── Risk weights for IMS (Interligens Match Score) ──────────────────────────
const RISK_WEIGHT: Record<IntelRiskClass, number> = {
  SANCTION: 100,
  HIGH: 80,
  MEDIUM: 50,
  LOW: 20,
  UNKNOWN: 5,
};

const TIER_MULTIPLIER: Record<number, number> = {
  1: 1.5, // Regulatory
  2: 1.0, // Technical
  3: 0.6, // Community (post-beta)
};

function computeIMS(
  observations: SourceObservationMinimal[]
): { ims: number; ics: number } {
  if (observations.length === 0) return { ims: 0, ics: 0 };

  // IMS: weighted score from strongest observation
  let maxWeighted = 0;
  for (const obs of observations) {
    const w = RISK_WEIGHT[obs.riskClass] ?? 5;
    const m = TIER_MULTIPLIER[obs.sourceTier] ?? 1;
    const weighted = w * m;
    if (weighted > maxWeighted) maxWeighted = weighted;
  }
  const ims = Math.min(100, Math.round(maxWeighted));

  // ICS: corroboration score (0.0–1.0)
  // Tier-1 regulatory source alone = 0.95 (near-certain).
  // Each additional source adds diminishing confidence.
  const activeObs = observations.filter((o) => o.listIsActive);
  const tierWeights: Record<number, number> = { 1: 0.95, 2: 0.50, 3: 0.25 };
  let ics = 0;
  const seenSlugs = new Set<string>();
  for (const obs of activeObs) {
    if (seenSlugs.has(obs.sourceSlug)) continue;
    seenSlugs.add(obs.sourceSlug);
    const w = tierWeights[obs.sourceTier] ?? 0.25;
    // Each source fills remaining gap: ics = 1 - (1 - ics) * (1 - w)
    ics = 1 - (1 - ics) * (1 - w);
  }
  ics = Math.round(ics * 100) / 100; // two decimal places

  return { ims, ics };
}

// ── Classe de risque réellement portée par les observations actives ─────────
// Ne sert qu'au garde-fou P0-B2. `obs` est non vide à l'appel (retour anticipé
// plus haut quand aucune observation active n'existe).

function strongestActiveRiskClass(
  obs: SourceObservationMinimal[]
): IntelRiskClass {
  return obs.reduce<IntelRiskClass>((best, o) => {
    const wBest = RISK_WEIGHT[best] ?? 0;
    const wCur = RISK_WEIGHT[o.riskClass] ?? 0;
    return wCur > wBest ? o.riskClass : best;
  }, obs[0].riskClass);
}

// ── Detect entity types to check for a given value ──────────────────────────

function guessEntityTypes(value: string): IntelEntityType[] {
  const v = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/i.test(v))
    return ["ADDRESS", "CONTRACT", "TOKEN_CA"];
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))
    return ["ADDRESS", "CONTRACT", "TOKEN_CA"];
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}$/i.test(v))
    return ["DOMAIN"];
  return ["ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"];
}

/**
 * L'absence de signal. Une seule définition : le littéral était recopié à deux
 * endroits, et l'admissibilité en aurait ajouté un troisième.
 *
 * `matchCount: 0` est ce que lit le consommateur (`engine.ts:518`) pour dire
 * NO_MATCH. Une contribution écartée produit donc exactement le même résultat
 * qu'une entité inconnue : le scoreur ne reçoit rien, il n'a rien à corriger.
 */
const SIGNAL_VIDE: IntelSignal = {
  ims: 0,
  ics: 0,
  matchCount: 0,
  hasSanction: false,
  topRiskClass: null,
  matchBasis: null,
  sourceSlug: null,
  externalUrl: null,
  winner: null,
  // Une absence VRAIE ne porte aucune décision de retrait.
  publicationState: "PUBLISHED",
};

// ── Public lookup ───────────────────────────────────────────────────────────

export async function matchEntity(
  target: MatchTarget,
  // ─── AM · P0 — L'AUDIENCE EST EXPLICITE, ET SON DÉFAUT EST RETAIL ───────
  //
  // Le défaut est le cas CONSERVATEUR : un appelant qui ne se déclare pas
  // n'obtient pas d'autorité de décision retail sur des contributions
  // inadmissibles. Les consommateurs internes légitimes déclarent INTERNAL —
  // ils sont peu nombreux, et ils le disent.
  audience: IntelAudience = "RETAIL",
  /**
   * La politique de source, quand l'appelant l'a déjà chargée.
   *
   * `lookupValue` essaie jusqu'à cinq types : sans ce passage, le registre
   * était relu cinq fois pour une seule consultation. Il n'y a pas de cache et
   * pas de TTL — inventer une durée de fraîcheur pour une politique de
   * gouvernance serait inventer une règle.
   */
  policy?: SourcePolicy,
  /** L'index de provenance, quand l'appelant l'a déjà chargé. Même raison. */
  provenance?: IngestionProvenanceIndex,
): Promise<IntelSignal> {
  const normalized = normalizeValue(target.type, target.value);
  const dedupKey = buildDedupKey(target.type, normalized);

  // Le matcher LOCALISE toujours l'entité — c'est la gate d'audience qui décide
  // ensuite quelles contributions portent une autorité, pas la requête.
  const entity = await prisma.canonicalEntity.findUnique({
    where: { dedupKey },
    include: {
      observations: {
        where: { listIsActive: true },
        orderBy: { ingestedAt: "desc" },
      },
    },
  });

  if (!entity || entity.observations.length === 0) {
    return SIGNAL_VIDE;
  }

  // ── L'ADMISSIBILITÉ, avant toute agrégation ───────────────────────────
  //
  // Une observation écartée n'entre dans AUCUN calcul : ni IMS, ni ICS, ni
  // `hasSanction`, ni le vainqueur. Le résultat est donc exactement celui du
  // scoreur existant sur les contributions admissibles restantes — on ne
  // corrige pas un score après coup, on ne lui donne pas l'entrée.
  const index = provenance ?? (await loadIngestionProvenance());
  const { retained, refused } = admitObservations({
    entity: { isActive: entity.isActive, displaySafety: entity.displaySafety },
    // AX — chaque instance porte sa provenance. C'est un FAIT sur la ligne,
    // calculé ici, jamais supposé par le prédicat.
    observations: entity.observations.map((o) => ({
      ...o,
      ingestionProvenanceProven: observationIsProvenanced(index, o.sourceSlug, o.ingestedAt),
    })),
    audience,
    policy: policy ?? (await loadSourcePolicy()),
  });

  // ─── S3.2 · LE POINT EXACT OÙ LES DEUX ABSENCES SE CONFONDAIENT ───────
  //
  // ██  L'entité EXISTE, ses observations sont ACTIVES, et l'admissibilité  ██
  // ██  n'en retient aucune pour cette audience. Ce n'est PAS « rien        ██
  // ██  trouvé » : c'est « trouvé, et retiré ».                             ██
  //
  // Jusqu'ici les deux rendaient `SIGNAL_VIDE`, et la route en tirait
  // `NO_MATCH_COMPLETE` avec `negativeIsConclusive: true` — une affirmation
  // concluante de propreté sur un résultat qu'on venait de retirer.
  //
  // Le témoin, mesuré le 2026-09-09 : `TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz`,
  // observation `ofac`/SANCTION ACTIVE. Le matcher rend matchCount 1 et
  // hasSanction TRUE ; la route servait hasSanction false, NO_MATCH_COMPLETE.
  // (J'avais d'abord nommé 0xa5b0edf6… : sa ligne ofac est DÉLISTÉE, elle
  // n'est pas le cas — voir plus bas, elle ne doit surtout pas basculer.)
  //
  // Ce qui suit ne révèle RIEN du retrait : ni source, ni classe de risque,
  // ni compte. Le signal reste vide — seule sa PUBLICATION est typée, et
  // c'est ce qui fait cesser l'affirmation. EXCLUSION ≠ ÉLECTION, à l'étage
  // du contrat.
  //
  // ─── TOUS LES REFUS NE SONT PAS DES RETRAITS ──────────────────────────
  //
  // ██  Une preuve INADMISSIBLE n'est pas un renseignement CACHÉ.          ██
  //
  // Ma première version posait `WITHHELD` dès que `retained` était vide. Elle
  // aurait fait basculer `0xa5b0edf6…01d41`, dont la seule observation active
  // est une ligne `forta` écrite hors pipeline — refusée pour
  // `UNPROVEN_INGESTION_PROVENANCE`. Or cette ligne n'est pas une observation
  // qu'on dissimule : c'est une ligne qui n'atteint pas le rang de preuve.
  // La compter comme un retrait laisserait un DÉFAUT DE DONNÉES connu (3
  // lignes, déjà au backlog AX) dégrader cette adresse en permanence.
  //
  // Même raisonnement pour un délistage : `OBSERVATION_INACTIVE` veut dire que
  // la liste ne la porte plus. C'est un négatif VRAI, et le plus important à
  // servir correctement — une sortie de liste OFAC doit pouvoir se lire.
  //
  // Seul un refus de NIVEAU ENTITÉ pour cette AUDIENCE est un retrait : on a
  // une preuve admissible, et on a décidé de ne pas la montrer à ce public.
  //
  // ─── La règle de visibilité est une LISTE BLANCHE ─────────────────────
  //
  // Elle ne s'écrit pas `!= INTERNAL_ONLY` : `ANALYST_REVIEWED` a été relu et
  // n'est explicitement PAS publiable. Les deux refus d'entité comptent, et
  // `ENTITY_CLEARANCE_UNKNOWN` aussi — un état d'autorisation que le
  // vocabulaire ne connaît pas ne se lit jamais comme une permission.
  const retraitParAudience = refused.some(
    (r) =>
      r.refus === "ENTITY_INTERNAL_ONLY_AND_SOURCE_NOT_RETAIL_ADMISSIBLE" ||
      r.refus === "ENTITY_ANALYST_REVIEWED_AND_SOURCE_NOT_RETAIL_ADMISSIBLE" ||
      r.refus === "ENTITY_CLEARANCE_UNKNOWN_AND_SOURCE_NOT_RETAIL_ADMISSIBLE",
  );

  // Le cas `entity.observations.length === 0`, traité plus haut, reste un
  // négatif VRAI : rien d'actif n'existe, donc rien n'a été retiré, et il
  // garde `PUBLISHED`. Les confondre ici remplacerait une fausse réassurance
  // par une alerte permanente — le même défaut sous un autre signe.
  if (retained.length === 0) {
    return retraitParAudience ? { ...SIGNAL_VIDE, publicationState: "WITHHELD" } : SIGNAL_VIDE;
  }

  const obs: SourceObservationMinimal[] = retained.map((o) => ({
    id: o.id,
    sourceSlug: o.sourceSlug,
    sourceTier: o.sourceTier,
    riskClass: o.riskClass as IntelRiskClass,
    matchBasis: o.matchBasis as any,
    listIsActive: o.listIsActive,
    externalUrl: o.externalUrl,
    observedAt: o.observedAt,
    ingestedAt: o.ingestedAt,
  }));

  const { ims, ics } = computeIMS(obs);
  const hasSanction = obs.some((o) => o.riskClass === "SANCTION");

  // P0-B2 — `entity.riskClass` est un RÉSUMÉ dérivé, figé au moment où il a été
  // calculé : il survit à la désactivation de l'observation qui l'a produit
  // (retrait d'une liste OFAC, ligne fabriquée neutralisée). `obs` ne contient
  // QUE les observations actives. Affirmer « SANCTION » alors qu'aucune
  // observation active ne la porte, c'est publier une sanction que plus rien ne
  // soutient — mesuré en production sur 0xa5b0edf6…01d41, servi avec
  // hasSanction:false ET topRiskClass:"SANCTION". Dans ce seul cas on retombe
  // sur la classe la plus forte réellement portée. Hors SANCTION : inchangé.
  const summaryRiskClass = entity.riskClass as IntelRiskClass;
  const topRiskClass: IntelRiskClass =
    summaryRiskClass === "SANCTION" && !hasSanction
      ? strongestActiveRiskClass(obs)
      : summaryRiskClass;

  // Winner = highest weighted observation
  const winner = obs.reduce((best, o) => {
    const wBest =
      (RISK_WEIGHT[best.riskClass] ?? 0) *
      (TIER_MULTIPLIER[best.sourceTier] ?? 1);
    const wCur =
      (RISK_WEIGHT[o.riskClass] ?? 0) *
      (TIER_MULTIPLIER[o.sourceTier] ?? 1);
    return wCur > wBest ? o : best;
  }, obs[0]);

  return {
    // Un match SERVI : rien n'a été retiré de ce qui suit.
    publicationState: "PUBLISHED",
    ims,
    ics,
    matchCount: obs.length,
    hasSanction,
    topRiskClass,
    matchBasis: winner.matchBasis,
    sourceSlug: winner.sourceSlug,
    externalUrl: winner.externalUrl,
    winner,
  };
}

// ── Multi-type lookup (scanner convenience) ─────────────────────────────────

export async function lookupValue(
  value: string,
  chain?: string,
  /** Même défaut conservateur que `matchEntity`. */
  audience: IntelAudience = "RETAIL",
): Promise<IntelSignal> {
  const types = guessEntityTypes(value);

  // Chargées UNE fois pour toute la consultation, pas une fois par type.
  const policy = await loadSourcePolicy();
  const provenance = await loadIngestionProvenance();

  // S3.2 — un retrait rencontré sur N'IMPORTE QUEL type essayé doit survivre
  // à la boucle. `lookupValue` tente jusqu'à cinq types et ne gardait que le
  // premier match ; un signal WITHHELD, ayant `matchCount: 0`, était jeté avec
  // les autres et l'absence redevenait indistinguable d'un vrai négatif.
  let retireSurUnType = false;

  // Try each type, return first match with signal
  for (const type of types) {
    const signal = await matchEntity({ type, value, chain }, audience, policy, provenance);
    if (signal.matchCount > 0) return signal;
    if (signal.publicationState === "WITHHELD") retireSurUnType = true;
  }

  return retireSurUnType ? { ...SIGNAL_VIDE, publicationState: "WITHHELD" } : SIGNAL_VIDE;
}
