// ─── Moteur de candidats — fusion, cloisonnement, classement ───────────────
// PUR. Aucun accès réseau, aucun accès DB, aucune horloge. Toute la partie
// « décidable localement » de la résolution vit ici et est donc testable sans
// fixture réseau et sans base.
//
// Trois opérations, dans cet ordre, jamais interverties :
//   1. merge     — un candidat par identité (chain:address), sources unies
//   2. gate      — retrait des sources internes quand l'audience est publique
//   3. rank      — ordre total déterministe (aucun ex æquo résiduel)
//
// Le classement est un ORDRE TOTAL : le dernier départage porte sur la clé
// d'identité. Deux exécutions sur les mêmes entrées produisent la même liste,
// quel que soit l'ordre d'arrivée des sources — condition nécessaire pour que
// les tests d'instantané aient un sens.

import { identityKey } from "./address";
import { classifySymbolMatch, matchRank } from "./symbol";
import {
  INTERNAL_ONLY_SOURCES,
  SOURCE_AUTHORITY,
  emptySignals,
  type Audience,
  type CandidateSignals,
  type CandidateSource,
  type RawCandidate,
  type TokenCandidate,
} from "./types";

/** Rang d'autorité d'une source. Plus petit = plus fiable. */
export function sourceRank(s: CandidateSource): number {
  const i = SOURCE_AUTHORITY.indexOf(s);
  return i < 0 ? SOURCE_AUTHORITY.length : i;
}

function bestSourceRank(sources: CandidateSource[]): number {
  let best = SOURCE_AUTHORITY.length;
  for (const s of sources) best = Math.min(best, sourceRank(s));
  return best;
}

// ─── Fusion des signaux ───────────────────────────────────────────────────
// Règle par champ, choisie pour ne jamais SURESTIMER :
//   • liquidité / volume / scanCount : maximum des valeurs connues. Deux sources
//     mesurent le même token ; la plus fraîche est la plus élevée.
//   • kolCount : MAXIMUM, jamais somme. Un même handle apparaît dans KolTokenLink
//     ET KolPromotionMention ; sommer le compterait deux fois.
//   • booléens : OU logique — un signal constaté par une source est constaté.
//   • dumpPct / concentration / porteurs : première valeur connue (source unique).
function maxNullable(a: number | null, b: number | null | undefined): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}

function firstKnown(a: number | null, b: number | null | undefined): number | null {
  return a != null ? a : (b ?? null);
}

export function mergeSignals(
  base: CandidateSignals,
  incoming: Partial<CandidateSignals> | undefined,
): CandidateSignals {
  if (!incoming) return base;
  return {
    liquidityUsd: maxNullable(base.liquidityUsd, incoming.liquidityUsd),
    volume24hUsd: maxNullable(base.volume24hUsd, incoming.volume24hUsd),
    kolCount: Math.max(base.kolCount, incoming.kolCount ?? 0),
    scanCount: maxNullable(base.scanCount, incoming.scanCount),
    hasPublishedCasefile: base.hasPublishedCasefile || !!incoming.hasPublishedCasefile,
    casefileRefs: Array.from(
      new Set([...base.casefileRefs, ...(incoming.casefileRefs ?? [])]),
    ).sort(),
    onChainConfirmed: base.onChainConfirmed || !!incoming.onChainConfirmed,
    dumpPct: firstKnown(base.dumpPct, incoming.dumpPct),
    concentrationScore: firstKnown(base.concentrationScore, incoming.concentrationScore),
    holderCount: firstKnown(base.holderCount, incoming.holderCount),
    isPumpFun: base.isPumpFun || !!incoming.isPumpFun,
  };
}

// ─── 1. Fusion ────────────────────────────────────────────────────────────
/**
 * Un candidat par identité (chain:address). Les doublons de la prod — la même
 * adresse stockée sous chain='solana' ET chain='SOL' (164 + 104 lignes
 * KolTokenLink mesurées le 2026-08-26) — se replient ici sur une seule identité,
 * parce que la chaîne a déjà été canonisée par les lecteurs de sources.
 *
 * Le symbole retenu est celui de la source la PLUS AUTORITAIRE qui en porte un ;
 * une ligne DexScreener ne peut pas renommer un token documenté par un dossier.
 */
export function mergeCandidates(raws: RawCandidate[]): TokenCandidate[] {
  const byId = new Map<
    string,
    { cand: TokenCandidate; symbolRank: number; nameRank: number }
  >();

  for (const r of raws) {
    if (!r.address) continue;
    const key = identityKey(r.chain, r.address);
    const rank = sourceRank(r.source);
    const existing = byId.get(key);

    if (!existing) {
      byId.set(key, {
        cand: {
          chain: r.chain,
          address: r.address,
          symbol: r.symbol ?? null,
          name: r.name ?? null,
          matchType: r.matchType ?? "unknown",
          sources: [r.source],
          signals: mergeSignals(emptySignals(), r.signals),
          chainInferred: !!r.chainInferred,
        },
        symbolRank: r.symbol ? rank : Number.MAX_SAFE_INTEGER,
        nameRank: r.name ? rank : Number.MAX_SAFE_INTEGER,
      });
      continue;
    }

    const c = existing.cand;
    if (!c.sources.includes(r.source)) c.sources.push(r.source);
    c.signals = mergeSignals(c.signals, r.signals);
    // Une seule source non déduite suffit à rendre la chaîne certaine.
    if (!r.chainInferred) c.chainInferred = false;
    if (r.symbol && rank < existing.symbolRank) {
      c.symbol = r.symbol;
      existing.symbolRank = rank;
    }
    if (r.name && rank < existing.nameRank) {
      c.name = r.name;
      existing.nameRank = rank;
    }
    if (matchRank(r.matchType ?? "unknown") > matchRank(c.matchType)) {
      c.matchType = r.matchType ?? "unknown";
    }
  }

  for (const { cand } of byId.values()) {
    cand.sources.sort((a, b) => sourceRank(a) - sourceRank(b));
  }
  return Array.from(byId.values()).map((v) => v.cand);
}

// ─── 2. Cloisonnement par audience ────────────────────────────────────────
/**
 * Retire les sources internes d'une sortie publique, puis élimine tout candidat
 * qu'aucune source publique ne soutient plus.
 *
 * C'est la SECONDE barrière : la première est la clause visibility='public' dans
 * le SQL des lecteurs (invariant __tests__/security/koltokenlink-visibility-invariant).
 * Deux barrières parce qu'un brouillon promu par erreur en public n'est pas
 * rattrapable après coup — il a été servi.
 *
 * kolCount est conservé (agrégat non nominatif, déjà toléré sur /api/scan/resolve
 * — cf. src/lib/security/nominativeApiGate.ts). Aucun handle ne transite par un
 * TokenCandidate, par construction du type.
 */
export function gateForAudience(
  candidates: TokenCandidate[],
  audience: Audience,
): { kept: TokenCandidate[]; dropped: number } {
  if (audience === "internal") return { kept: candidates, dropped: 0 };
  const kept: TokenCandidate[] = [];
  let dropped = 0;
  for (const c of candidates) {
    const publicSources = c.sources.filter((s) => !INTERNAL_ONLY_SOURCES.has(s));
    if (publicSources.length === 0) {
      dropped++;
      continue;
    }
    kept.push({ ...c, sources: publicSources });
  }
  return { kept, dropped };
}

// ─── 3. Classement ────────────────────────────────────────────────────────
/**
 * Ordre total, du plus au moins probable. Critères dans cet ordre exact :
 *
 *   1. pertinence      — explicit_ca > exact > préfixe > inconnu
 *   2. dossier publié  — un token documenté prime, à pertinence égale
 *   3. autorité source — casefile > curated > mentions > … > coingecko
 *   4. KOL distincts   — décroissant
 *   5. Solana d'abord  — l'app est Solana-first
 *   6. liquidité       — décroissante
 *   7. volume 24 h     — décroissant
 *   8. scans           — décroissant
 *   9. clé d'identité  — croissante, DÉPARTAGE FINAL (ordre total garanti)
 *
 * La pertinence passe AVANT la confiance : un dossier publié sur un autre token
 * ne doit pas remonter devant une correspondance exacte de ce que l'utilisateur
 * a demandé. C'est le même arbitrage que compareResolveCandidates en amont
 * (exact avant préfixe, avant liquidité), étendu aux sources internes.
 */
export function compareCandidates(a: TokenCandidate, b: TokenCandidate): number {
  let d = matchRank(b.matchType) - matchRank(a.matchType);
  if (d) return d;

  d = Number(b.signals.hasPublishedCasefile) - Number(a.signals.hasPublishedCasefile);
  if (d) return d;

  d = bestSourceRank(a.sources) - bestSourceRank(b.sources);
  if (d) return d;

  d = b.signals.kolCount - a.signals.kolCount;
  if (d) return d;

  d = (b.chain === "SOL" ? 1 : 0) - (a.chain === "SOL" ? 1 : 0);
  if (d) return d;

  d = (b.signals.liquidityUsd ?? -1) - (a.signals.liquidityUsd ?? -1);
  if (d) return d;

  d = (b.signals.volume24hUsd ?? -1) - (a.signals.volume24hUsd ?? -1);
  if (d) return d;

  d = (b.signals.scanCount ?? -1) - (a.signals.scanCount ?? -1);
  if (d) return d;

  const ka = identityKey(a.chain, a.address);
  const kb = identityKey(b.chain, b.address);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

export function rankCandidates(candidates: TokenCandidate[]): TokenCandidate[] {
  return candidates.slice().sort(compareCandidates);
}

// ─── Correspondance de symbole appliquée après coup ───────────────────────
/**
 * Recalcule matchType à partir du ticker demandé. Les candidats issus d'une
 * adresse explicite gardent "explicit_ca" : leur pertinence ne vient pas du
 * symbole, elle vient de la requête elle-même.
 */
export function applyTickerMatch(
  candidates: TokenCandidate[],
  ticker: string | null | undefined,
): TokenCandidate[] {
  if (!ticker) return candidates;
  return candidates.map((c) => {
    if (c.matchType === "explicit_ca") return c;
    return { ...c, matchType: classifySymbolMatch(ticker, c.symbol) };
  });
}

/** Pipeline local complet : fusion → cloisonnement → correspondance → classement. */
export function buildCandidateSet(
  raws: RawCandidate[],
  opts: { ticker?: string | null; audience: Audience },
): { candidates: TokenCandidate[]; droppedInternal: number } {
  const merged = mergeCandidates(raws);
  const { kept, dropped } = gateForAudience(merged, opts.audience);
  const matched = applyTickerMatch(kept, opts.ticker);
  return { candidates: rankCandidates(matched), droppedInternal: dropped };
}
