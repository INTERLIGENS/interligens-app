// ─── Moteur de candidats V3 — fusion, cloisonnement, temps, classement ─────
// PUR. Aucun réseau, aucune base, aucune horloge implicite (la date
// d'observation est passée en argument).
//
// Cinq opérations, dans cet ordre, jamais interverties :
//   1. merge     — un candidat par IDENTITÉ (chain, contract) ; jamais par symbole
//   2. gate      — retrait des sources internes quand l'audience est publique
//   3. bind      — marquage des chaînes hors périmètre déclaré par l'appelant
//   4. temporal  — écartement des candidats nés après l'observation (D2)
//   5. rank      — ordre total déterministe, SANS préférence de chaîne
//
// ─── Ce que V3 retire ────────────────────────────────────────────────────
// La V2 classait « Solana d'abord, l'app est Solana-first ». C'était une
// préférence cachée : elle faisait remonter un token SOL devant un token ETH à
// preuves égales, sans que l'appelant l'ait demandé. Le critère a disparu. Le
// périmètre de chaînes est désormais DÉCLARÉ (allowedChains), donc explicite.

import { identityKey } from "./address";
import { DEFAULT_POLICY, isChainAllowed, type ResolutionPolicy } from "./policy";
import { classifySymbolMatch, matchRank } from "./symbol";
import {
  applyTemporal,
  isContractRelativeDate,
  isStrongBirthEvidence,
  temporalRank,
} from "./temporal";
import {
  INTERNAL_ONLY_SOURCES,
  SOURCE_AUTHORITY,
  CURATED_SOURCES,
  emptySignals,
  type Audience,
  type CandidateSignals,
  type CandidateSource,
  type CanonicalChainList,
  type RawCandidate,
  type TokenCandidate,
} from "./types";
import type { CanonicalChain } from "./chain";

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
  incomingSource?: CandidateSource,
): CandidateSignals {
  if (!incoming) return base;

  // firstSeenAt : on garde la preuve d'antériorité la PLUS ANCIENNE. Si une
  // seule source atteste que le contrat existait déjà, il existait déjà — les
  // dates plus tardives des autres sources ne le rajeunissent pas.
  // À égalité de date, la preuve DIRECTE (lancement, dossier) prime sur la
  // preuve indirecte (paire, ligne en base) : c'est elle qui pourra conclure à
  // l'impossibilité sous la tolérance stricte.
  let firstSeenAt = base.firstSeenAt;
  let firstSeenSource = base.firstSeenSource;
  const inSource = incoming.firstSeenSource ?? incomingSource ?? null;
  // REGLE TEMPORELLE CANONIQUE — seule une source qui date LE CONTRAT peut
  // alimenter firstSeenAt. Une date d'ecriture de relation ou de post est
  // refusee ici meme si un lecteur la remontait : le garde-fou est dans le
  // moteur, pas seulement dans le SQL.
  const inAt = isContractRelativeDate(inSource) ? (incoming.firstSeenAt ?? null) : null;
  if (inAt != null) {
    const strictlyEarlier = firstSeenAt == null || inAt < firstSeenAt;
    const sameDateButStronger =
      firstSeenAt != null &&
      inAt === firstSeenAt &&
      isStrongBirthEvidence(inSource) &&
      !isStrongBirthEvidence(firstSeenSource);
    if (strictlyEarlier || sameDateButStronger) {
      firstSeenAt = inAt;
      firstSeenSource = inSource;
    }
  }

  return {
    liquidityUsd: maxNullable(base.liquidityUsd, incoming.liquidityUsd),
    volume24hUsd: maxNullable(base.volume24hUsd, incoming.volume24hUsd),
    // kolCount : MAXIMUM, jamais somme — le même handle vit dans deux tables.
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
    firstSeenAt,
    firstSeenSource,
  };
}

// ─── 1. Fusion — PAR IDENTITÉ DE CONTRAT, jamais par symbole ──────────────
/**
 * E5 : la clé de fusion est (chain, contract). Deux lignes au même symbole sur
 * deux contrats sont DEUX candidats. Les fusionner reviendrait à décréter que
 * l'imitateur et l'original sont le même token — exactement ce que le produit
 * existe pour distinguer.
 */
export function mergeCandidates(raws: RawCandidate[]): TokenCandidate[] {
  const byId = new Map<string, { cand: TokenCandidate; symbolRank: number; nameRank: number }>();

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
          signals: mergeSignals(emptySignals(), r.signals, r.source),
          chainInferred: !!r.chainInferred,
          temporal: "unknown",
        },
        symbolRank: r.symbol ? rank : Number.MAX_SAFE_INTEGER,
        nameRank: r.name ? rank : Number.MAX_SAFE_INTEGER,
      });
      continue;
    }

    const c = existing.cand;
    if (!c.sources.includes(r.source)) c.sources.push(r.source);
    c.signals = mergeSignals(c.signals, r.signals, r.source);
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

// ─── 3. Liaison de chaîne — périmètre DÉCLARÉ par l'appelant ──────────────
/** Le candidat est-il porté par une revue humaine ? */
export function hasCuratedBacking(c: TokenCandidate): boolean {
  return c.sources.some((s) => CURATED_SOURCES.has(s));
}

/**
 * Un candidat hors périmètre n'est pas faux : il est simplement hors de ce que
 * l'appelant sait traiter. Il est MARQUÉ, jamais supprimé — la résolution devra
 * pouvoir dire « ce token existe, mais pas pour toi » (UNSUPPORTED_BY_CALLER)
 * au lieu de « introuvable », qui ferait conclure à tort à l'utilisateur.
 *
 * ─── Curseur curatedRequiresChainBinding ────────────────────────────────
 * L'invariant encodé : une curation humaine ne peut pas ÉCRASER une
 * contradiction de chaîne. Un lien curé sur BSC ne répond pas à un appelant qui
 * ne sait traiter que Solana — la revue atteste un contrat, pas une chaîne.
 *
 *   true  (défaut) : le curé est soumis au périmètre, comme tout le monde.
 *   false          : permissif EXPLICITE — le curé survit hors périmètre.
 *                    Réservé aux tests et aux backtests qui veulent mesurer
 *                    l'effet du curseur ; jamais une valeur de production
 *                    choisie par défaut.
 */
export function bindChains(
  candidates: TokenCandidate[],
  allowedChains: CanonicalChainList | undefined,
  policy: ResolutionPolicy = DEFAULT_POLICY,
): TokenCandidate[] {
  return candidates.map((c) => {
    if (isChainAllowed(allowedChains, c.chain)) return c;
    if (!policy.curatedRequiresChainBinding && hasCuratedBacking(c)) {
      // Régime permissif assumé : on garde le candidat ET on garde la trace.
      return { ...c, chainBindingWaived: true };
    }
    return {
      ...c,
      excluded: {
        reason: "chain_not_allowed" as const,
        detail: `chaîne ${c.chain} hors du périmètre déclaré par l'appelant`,
      },
    };
  });
}

// ─── 5. Classement ────────────────────────────────────────────────────────
/**
 * Ordre total, sans préférence de chaîne. Critères, dans cet ordre :
 *
 *   1. non écarté      — un candidat écarté ne peut pas être choisi
 *   2. pertinence      — explicit_ca > exact > préfixe > inconnu
 *   3. antériorité     — attesté compatible > date inconnue > (impossible, écarté)
 *   4. dossier publié
 *   5. autorité source
 *   6. KOL distincts
 *   7. liquidité       8. volume 24 h     9. scans
 *  10. clé d'identité  — départage final, ordre total garanti
 *
 * Le critère 3 est ce qui fait remonter la famille HISTORIQUE : quand une date
 * d'observation est fournie, un contrat dont l'antériorité est attestée passe
 * devant un contrat récent au passé inconnu, même plus liquide.
 */
export function compareCandidates(a: TokenCandidate, b: TokenCandidate): number {
  let d = Number(!!a.excluded) - Number(!!b.excluded);
  if (d) return d;

  d = matchRank(b.matchType) - matchRank(a.matchType);
  if (d) return d;

  d = temporalRank(b.temporal) - temporalRank(a.temporal);
  if (d) return d;

  d = Number(b.signals.hasPublishedCasefile) - Number(a.signals.hasPublishedCasefile);
  if (d) return d;

  d = bestSourceRank(a.sources) - bestSourceRank(b.sources);
  if (d) return d;

  d = b.signals.kolCount - a.signals.kolCount;
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

/**
 * Recalcule matchType à partir du ticker demandé.
 * RAPPEL E5 : matchType mesure une ressemblance de NOM. Il sert à ordonner,
 * jamais à identifier.
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

export interface BuildCandidateSetOptions {
  ticker?: string | null;
  audience: Audience;
  allowedChains?: readonly CanonicalChain[];
  observedAt?: Date | null;
  policy: ResolutionPolicy;
}

export interface CandidateSet {
  /** Candidats retenus, classés. */
  candidates: TokenCandidate[];
  /** Candidats écartés, avec leur motif. */
  excluded: TokenCandidate[];
  droppedInternal: number;
}

/** Pipeline local complet : fusion → cloisonnement → liaison → temps → classement. */
export function buildCandidateSet(
  raws: RawCandidate[],
  opts: BuildCandidateSetOptions,
): CandidateSet {
  const merged = mergeCandidates(raws);
  const { kept, dropped } = gateForAudience(merged, opts.audience);
  const matched = applyTickerMatch(kept, opts.ticker);
  const bound = bindChains(matched, opts.allowedChains, opts.policy);
  const timed = applyTemporal(bound, opts.observedAt, opts.policy);
  const ranked = rankCandidates(timed);
  return {
    candidates: ranked.filter((c) => !c.excluded),
    excluded: ranked.filter((c) => !!c.excluded),
    droppedInternal: dropped,
  };
}
