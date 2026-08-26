// ─── Décision — conflits, statut, confiance ────────────────────────────────
// PUR ET DÉTERMINISTE. Mêmes entrées → même sortie, toujours. Aucune horloge,
// aucun aléa, aucun accès réseau ou base. C'est le seul endroit du module qui a
// le droit de dire « RESOLVED ».
//
// RÈGLE D'OR, héritée des deux V1 et non négociable :
//   jamais HIGH tant qu'il reste plus d'un candidat plausible.
//   Dans le doute → AMBIGUOUS. Jamais RESOLVED par défaut.
//
// Les seuils chiffrés ne sont PAS ici : ils vivent dans policy.ts, marqués
// « À RATIFIER ». Ce fichier n'implémente que la mécanique.

import { identityKey } from "./address";
import { classifySymbolMatch, isGenericTicker } from "./symbol";
import { DEFAULT_POLICY, type ResolutionPolicy } from "./policy";
import type {
  CandidateSource,
  Confidence,
  ResolutionConflict,
  ResolutionMethod,
  ResolutionStatus,
  TokenCandidate,
} from "./types";

/** Sources issues d'une revue ou d'une curation humaine, par opposition au marché. */
const INTERNAL_SOURCES: ReadonlySet<CandidateSource> = new Set<CandidateSource>([
  "casefile",
  "casefile_preset",
  "curated",
  "ca_map",
  "mentions",
  "involvement",
  "curated_draft",
]);

export function hasInternalBacking(c: TokenCandidate): boolean {
  return c.sources.some((s) => INTERNAL_SOURCES.has(s));
}

function hasSource(c: TokenCandidate, s: CandidateSource): boolean {
  return c.sources.includes(s);
}

/** Méthode à afficher pour un candidat retenu — la source la plus autoritaire. */
export function methodForCandidate(c: TokenCandidate): ResolutionMethod {
  if (c.matchType === "explicit_ca") return "explicit_ca";
  if (hasSource(c, "casefile") || hasSource(c, "casefile_preset")) return "casefile";
  if (hasSource(c, "curated") || hasSource(c, "curated_draft")) return "curated";
  if (hasSource(c, "ca_map")) return "ca_map";
  if (hasSource(c, "mentions")) return "mentions";
  if (hasSource(c, "dexscreener")) {
    return c.matchType === "exact" ? "dexscreener_exact" : "dexscreener_ranked";
  }
  if (hasSource(c, "coingecko")) return "coingecko";
  if (hasSource(c, "onchain")) return "onchain";
  return "internal_ranked";
}

// ─── Détection des conflits ───────────────────────────────────────────────

export interface ConflictInput {
  candidates: TokenCandidate[];
  /** Ticker demandé, s'il y en avait un. */
  ticker?: string | null;
  /** Identités issues d'une adresse explicitement fournie dans la requête. */
  explicitIdentityKeys: ReadonlySet<string>;
  policy?: ResolutionPolicy;
}

/**
 * Les conflits sont CONSTATÉS, pas arbitrés. Un conflit dit « ces deux choses
 * ne peuvent pas être vraies ensemble », il ne dit pas laquelle jeter. C'est
 * cette distinction qui permet de renvoyer un CONFLICT exploitable en revue
 * plutôt qu'un AMBIGUOUS muet.
 */
export function detectConflicts(input: ConflictInput): ResolutionConflict[] {
  const policy = input.policy ?? DEFAULT_POLICY;
  const { candidates, ticker } = input;
  const out: ResolutionConflict[] = [];
  if (candidates.length === 0) return out;

  const explicit = candidates.filter((c) =>
    input.explicitIdentityKeys.has(identityKey(c.chain, c.address)),
  );
  const exacts = candidates.filter((c) => c.matchType === "exact");

  // 1. L'adresse du post ne porte pas le ticker annoncé, et un AUTRE token le
  //    porte exactement. C'est le cas le plus dangereux : le lecteur croit
  //    acheter $X, l'adresse collée est celle de $Y.
  if (ticker) {
    for (const e of explicit) {
      if (!e.symbol) continue; // symbole inconnu → rien à contredire
      // L'accord se juge sur le SYMBOLE, jamais sur matchType : un candidat issu
      // d'une adresse explicite conserve matchType "explicit_ca" même quand son
      // symbole coïncide avec le ticker. Lire matchType ici déclarerait un
      // conflit dès qu'un homonyme existe, alors même que le CA est le bon.
      const agreement = classifySymbolMatch(ticker, e.symbol);
      if (agreement === "exact" || agreement === "prefix") continue;
      const rivals = exacts.filter(
        (c) => identityKey(c.chain, c.address) !== identityKey(e.chain, e.address),
      );
      if (rivals.length === 0) continue;
      out.push({
        kind: "ticker_vs_address",
        detail:
          `l'adresse fournie correspond à $${e.symbol} alors que le ticker demandé ` +
          `$${ticker.replace(/^\$+/, "")} désigne un autre token — revue humaine requise`,
        between: [
          identityKey(e.chain, e.address),
          ...rivals.map((r) => identityKey(r.chain, r.address)),
        ],
      });
    }
  }

  // 2. Plusieurs tokens portent EXACTEMENT ce symbole sur la MÊME chaîne :
  //    ce sont des tokens distincts, aucun départage automatique n'est honnête.
  const byChain = new Map<string, TokenCandidate[]>();
  for (const c of exacts) {
    const list = byChain.get(c.chain) ?? [];
    list.push(c);
    byChain.set(c.chain, list);
  }
  for (const [chain, list] of byChain) {
    if (list.length < 2) continue;
    out.push({
      kind: "multiple_exact",
      detail: `${list.length} tokens portent exactement ce symbole sur ${chain}`,
      between: list.map((c) => identityKey(c.chain, c.address)),
    });
  }

  // 3. Même symbole exact sur PLUSIEURS chaînes, sans dominante nette.
  //    Le facteur de domination est un seuil produit → policy.ts.
  if (byChain.size > 1) {
    const sorted = exacts
      .slice()
      .sort((a, b) => (b.signals.liquidityUsd ?? -1) - (a.signals.liquidityUsd ?? -1));
    const first = sorted[0]?.signals.liquidityUsd ?? 0;
    const second = sorted[1]?.signals.liquidityUsd ?? 0;
    const ratio = second > 0 ? first / second : first > 0 ? Infinity : 0;
    if (ratio < policy.crossChainDominanceRatio) {
      out.push({
        kind: "cross_chain",
        detail:
          `symbole exact présent sur ${byChain.size} chaînes sans dominante de liquidité ` +
          `(facteur exigé ≥ ${policy.crossChainDominanceRatio})`,
        between: exacts.map((c) => identityKey(c.chain, c.address)),
      });
    }
  }

  // 4. La source curée et le marché ne désignent pas la même adresse.
  //    Ni l'une ni l'autre n'a automatiquement raison : une curation peut être
  //    périmée, un marché peut indexer un imitateur plus liquide.
  const topInternal = candidates.find((c) => hasInternalBacking(c));
  const topMarket = candidates.find(
    (c) => !hasInternalBacking(c) && (hasSource(c, "dexscreener") || hasSource(c, "coingecko")),
  );
  if (
    topInternal &&
    topMarket &&
    topInternal.matchType === "exact" &&
    topMarket.matchType === "exact" &&
    identityKey(topInternal.chain, topInternal.address) !==
      identityKey(topMarket.chain, topMarket.address)
  ) {
    out.push({
      kind: "internal_vs_market",
      detail:
        "la source interne et le marché désignent deux adresses différentes pour ce symbole",
      between: [
        identityKey(topInternal.chain, topInternal.address),
        identityKey(topMarket.chain, topMarket.address),
      ],
    });
  }

  return out;
}

// ─── Décision ─────────────────────────────────────────────────────────────

export interface DecisionInput {
  /** Candidats DÉJÀ classés (rankCandidates). L'ordre fait foi. */
  candidates: TokenCandidate[];
  ticker?: string | null;
  explicitIdentityKeys: ReadonlySet<string>;
  conflicts: ResolutionConflict[];
  policy?: ResolutionPolicy;
}

export interface Decision {
  status: ResolutionStatus;
  confidence: Confidence;
  method: ResolutionMethod;
  selected: TokenCandidate | null;
  limitations: string[];
}

/** Un candidat « plausible » peut disputer la première place au candidat de tête. */
function isPlausibleCompetitor(
  c: TokenCandidate,
  top: TokenCandidate,
  policy: ResolutionPolicy,
): boolean {
  if (identityKey(c.chain, c.address) === identityKey(top.chain, top.address)) return false;
  if (c.matchType !== top.matchType) return false;
  if (hasInternalBacking(c)) return true;
  return (c.signals.liquidityUsd ?? 0) >= policy.minLiquidityUsdForAutoResolve;
}

/** Plafond de confiance imposé par la chaîne du candidat. */
function chainCeiling(policy: ResolutionPolicy, c: TokenCandidate): Confidence | null {
  if (policy.highConfidenceChains.has(c.chain)) return "HIGH";
  if (policy.moderateOnlyChains.has(c.chain)) return "MODERATE";
  return null; // chaîne non résolvable automatiquement
}

function cap(actual: Confidence, ceiling: Confidence): Confidence {
  const order: Confidence[] = ["LOW", "MODERATE", "HIGH"];
  return order[Math.min(order.indexOf(actual), order.indexOf(ceiling))];
}

export function decide(input: DecisionInput): Decision {
  const policy = input.policy ?? DEFAULT_POLICY;
  const { candidates, ticker, conflicts } = input;
  const limitations: string[] = [];

  if (candidates.length === 0) {
    return {
      status: "UNRESOLVED",
      confidence: "LOW",
      method: "none",
      selected: null,
      limitations: ["aucun candidat — ni source interne, ni marché, ni chaîne"],
    };
  }

  // ─ 1. Un conflit ticker↔adresse prime sur tout le reste. Il n'est pas
  //      arbitrable automatiquement : le servir résolu serait servir un faux.
  const blocking = conflicts.find((c) => c.kind === "ticker_vs_address");
  if (blocking) {
    return {
      status: "CONFLICT",
      confidence: "LOW",
      method: "explicit_ca",
      selected: null,
      limitations: [blocking.detail],
    };
  }

  const top = candidates[0];
  const topIsExplicit = input.explicitIdentityKeys.has(identityKey(top.chain, top.address));

  // ─ 2. Adresse explicitement fournie et confirmée : la requête EST la réponse.
  //      Aucune recherche par symbole ne peut la contredire — le conflit
  //      éventuel a déjà été traité à l'étape 1.
  if (topIsExplicit) {
    const confirmedByMarket = top.signals.liquidityUsd != null || !!top.symbol;
    if (confirmedByMarket) {
      return {
        status: "RESOLVED",
        confidence: "HIGH",
        method: "explicit_ca",
        selected: top,
        limitations,
      };
    }
    if (top.signals.onChainConfirmed) {
      if (!policy.resolveOnChainOnlyMint) {
        return {
          status: "AMBIGUOUS",
          confidence: "LOW",
          method: "onchain",
          selected: null,
          limitations: [
            "mint confirmé on-chain mais aucun marché indexé — résolution on-chain désactivée par la politique",
          ],
        };
      }
      return {
        status: "RESOLVED",
        confidence: "MODERATE",
        method: "onchain",
        selected: top,
        limitations: [
          "mint confirmé on-chain, aucune paire indexée (token neuf ou illiquide) — " +
            "symbole et données de marché indisponibles, cohérence du ticker non vérifiable",
        ],
      };
    }
    return {
      status: "UNRESOLVED",
      confidence: "LOW",
      method: "none",
      selected: null,
      limitations: [
        "adresse fournie valide mais confirmée par aucune source : ni marché, ni chaîne, ni base interne",
      ],
    };
  }

  // ─ 3. Ticker générique (BTC, SOL, PEPE…) sans adresse : jamais auto-résolu.
  //      Le ticker ne désigne rien d'unique, quelle que soit la liquidité.
  if (ticker && isGenericTicker(ticker) && input.explicitIdentityKeys.size === 0) {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: "internal_ranked",
      selected: null,
      limitations: ["ticker générique (liste noire) — désambiguïsation manuelle requise"],
    };
  }

  // ─ 4. Règle d'or : un concurrent plausible subsistant interdit de trancher.
  const competitors = candidates.filter((c) => isPlausibleCompetitor(c, top, policy));
  if (competitors.length > 0) {
    const crossChain = conflicts.find((c) => c.kind === "cross_chain");
    const sameChain = conflicts.find((c) => c.kind === "multiple_exact");
    return {
      status: "AMBIGUOUS",
      confidence: competitors.length === 1 ? "MODERATE" : "LOW",
      method: methodForCandidate(top),
      selected: null,
      limitations: [
        `${competitors.length + 1} candidats plausibles restent en lice — jamais résolu automatiquement`,
        ...(sameChain ? [sameChain.detail] : []),
        ...(crossChain ? [crossChain.detail] : []),
      ],
    };
  }

  // ─ 5. Candidat unique en tête. Reste à savoir ce qui le soutient.
  const ceiling = chainCeiling(policy, top);
  if (!ceiling) {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: methodForCandidate(top),
      selected: null,
      limitations: [`chaîne ${top.chain} hors périmètre d'auto-résolution`],
    };
  }
  if (top.chainInferred) {
    limitations.push(
      `chaîne déduite de la forme de l'adresse (colonne d'origine inexploitable) — ${top.chain}`,
    );
  }

  const internal = hasInternalBacking(top);

  if (internal) {
    // Une curation humaine tranche même sur un préfixe — mais la confiance
    // baisse d'un cran, parce qu'un préfixe reste une correspondance partielle.
    if (top.matchType === "prefix") {
      if (!policy.internalResolvesOnPrefix) {
        return {
          status: "AMBIGUOUS",
          confidence: "LOW",
          method: methodForCandidate(top),
          selected: null,
          limitations: [
            ...limitations,
            "correspondance de préfixe seule — résolution interne sur préfixe désactivée par la politique",
          ],
        };
      }
      limitations.push("correspondance de préfixe, non exacte — confiance plafonnée");
      return {
        status: "RESOLVED",
        confidence: cap("MODERATE", ceiling),
        method: methodForCandidate(top),
        selected: top,
        limitations,
      };
    }
    if (top.matchType === "unknown" && ticker) {
      limitations.push("symbole du candidat inconnu — correspondance avec le ticker non vérifiable");
      return {
        status: "RESOLVED",
        confidence: cap("MODERATE", ceiling),
        method: methodForCandidate(top),
        selected: top,
        limitations,
      };
    }
    // Correspondance exacte + soutien interne : le meilleur cas du produit.
    return {
      status: "RESOLVED",
      confidence: ceiling,
      method: methodForCandidate(top),
      selected: top,
      limitations,
    };
  }

  // ─ 6. Marché seul. Exigences cumulées : exact ET liquide assez.
  if (top.matchType !== "exact") {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: methodForCandidate(top),
      selected: null,
      limitations: [
        ...limitations,
        "correspondance non exacte sur source de marché seule — jamais auto-résolue",
      ],
    };
  }
  const liq = top.signals.liquidityUsd;
  if (liq == null || liq < policy.minLiquidityUsdForAutoResolve) {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: methodForCandidate(top),
      selected: null,
      limitations: [
        ...limitations,
        liq == null
          ? "liquidité inconnue sur source de marché seule — non auto-résolue"
          : `liquidité ${Math.round(liq)} $ sous le plancher ${policy.minLiquidityUsdForAutoResolve} $ — non auto-résolue`,
      ],
    };
  }

  return {
    status: "RESOLVED",
    confidence: ceiling,
    method: methodForCandidate(top),
    selected: top,
    limitations,
  };
}
