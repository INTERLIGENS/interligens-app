// ─── Décision V3 — identité, temps, périmètre, confiance ───────────────────
// PUR ET DÉTERMINISTE. Seul endroit du module autorisé à dire « RESOLVED ».
//
// Trois règles au-dessus de tout le reste :
//
//   E5  l'égalité de symbole n'est jamais une preuve d'identité. Plusieurs
//       contrats sous un même symbole ⇒ jamais RESOLVED, jamais HIGH.
//   D2  un contrat né après l'observation ne peut pas être le token observé.
//       Il est écarté en amont ; ici on refuse simplement de le repêcher.
//   M   la chaîne est un PÉRIMÈTRE déclaré, pas un plafond de confiance. Un
//       asset hors périmètre est RÉSOLU et marqué UNSUPPORTED_BY_CALLER — jamais
//       rendu introuvable.
//
// RÈGLE D'OR conservée : jamais HIGH tant qu'il reste plus d'un candidat
// plausible. Dans le doute → AMBIGUOUS. Jamais RESOLVED par défaut.
//
// Les seuils chiffrés vivent dans policy.ts, marqués « À RATIFIER ».

import { identityKey } from "./address";
import { detectContractIdentityConflicts } from "./identity";
import { classifySymbolMatch, isGenericTicker } from "./symbol";
import { DEFAULT_POLICY, type ResolutionPolicy } from "./policy";
import {
  MARKETLESS_SOURCES,
  type CallerSupport,
  type CandidateSource,
  type Confidence,
  type ResolutionConflict,
  type ResolutionMethod,
  type ResolutionStatus,
  type TokenCandidate,
} from "./types";

/** Sources issues d'une revue ou d'une curation humaine. */
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

/**
 * I3 — un candidat que SEULES des sources sans marché soutiennent.
 * CoinGecko ne renvoie ni liquidité ni volume : il liste des contrats par
 * plateforme. La V1 lui fabriquait `matchType:'exact'` + `lowLiquidity:false`
 * en dur, ce qui suffisait au décideur pour résoudre. L'absence de donnée était
 * lue comme une donnée favorable — c'est ce que cette fonction empêche.
 */
export function isMarketlessOnly(c: TokenCandidate): boolean {
  return c.sources.every((s) => MARKETLESS_SOURCES.has(s));
}

/**
 * E7b — un contrat explicitement fourni est-il PLAUSIBLE comme réponse ?
 *
 * Sert uniquement à départager plusieurs contrats collés dans la même requête
 * (« CA flooding »). Un contrat est plausible s'il vit : une source interne le
 * documente, un dossier le couvre, ou le marché lui donne une liquidité
 * au-dessus du plancher.
 *
 * ATTENTION — cette fonction n'est JAMAIS appliquée à un contrat explicite
 * UNIQUE. Quand l'appelant ne colle qu'une adresse, l'identité est tranchée par
 * la requête : le token doit se résoudre même mort, même illiquide. Le plancher
 * de liquidité gouverne le choix entre candidats, pas la confirmation d'une
 * adresse donnée.
 */
export function isExplicitPlausible(c: TokenCandidate, policy: ResolutionPolicy): boolean {
  if (hasInternalBacking(c)) return true;
  if (c.signals.hasPublishedCasefile) return true;
  return (c.signals.liquidityUsd ?? 0) >= policy.minLiquidityUsdForAutoResolve;
}

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
  /** Candidats retenus (non écartés), déjà classés. */
  candidates: TokenCandidate[];
  /** Candidats écartés — servent à formuler le conflit temporel. */
  excluded?: TokenCandidate[];
  ticker?: string | null;
  /** Identités dont le contrat a été fourni par l'appelant. */
  explicitIdentityKeys: ReadonlySet<string>;
  /**
   * Frontière A — la recherche de contrats rivaux a été TENTÉE et a ÉCHOUÉ
   * (panne provider, budget épuisé). L'absence de rival n'est alors pas une
   * information : c'est un trou.
   */
  rivalSearchDegraded?: boolean;
  policy?: ResolutionPolicy;
}

export function detectConflicts(input: ConflictInput): ResolutionConflict[] {
  const policy = input.policy ?? DEFAULT_POLICY;
  const { candidates, ticker } = input;
  const excluded = input.excluded ?? [];
  const out: ResolutionConflict[] = [];

  // E5 — collisions de contrat sous un même symbole. Détecté même quand il n'y
  // a qu'un seul candidat retenu par ailleurs : c'est la règle la plus haute.
  out.push(...detectContractIdentityConflicts(candidates, input.explicitIdentityKeys));

  if (candidates.length === 0 && excluded.length === 0) return out;

  const explicit = candidates.filter((c) =>
    input.explicitIdentityKeys.has(identityKey(c.chain, c.address)),
  );
  const exacts = candidates.filter((c) => c.matchType === "exact");

  // 1. Un contrat a été fourni, et D'AUTRES contrats portent le même ticker.
  //
  //    ─── La porte se décide sur les RIVAUX D'IDENTITÉ, jamais sur le symbole ──
  //    Une version antérieure ouvrait cette porte dès que le symbole du contrat
  //    fourni « était d'accord » avec le ticker (correspondance exacte ou
  //    préfixe), et la sautait aussi quand le symbole était inconnu. Deux sorties
  //    anticipées, une seule conséquence : le symbole — LA SEULE VARIABLE QUE
  //    L'IMITATEUR CONTRÔLE — désarmait la détection. Recopier « WORLDCUP » sur
  //    son propre contrat suffisait à être servi comme certain, devant trois
  //    contrats curés portant ce ticker.
  //
  //    La décision porte donc sur `rivals` : d'autres contrats (chain+address
  //    distincts) répondent-ils exactement à ce ticker ? Si oui, il y a conflit
  //    d'identité, que le symbole coïncide ou non. Le symbole ne sert plus qu'à
  //    QUALIFIER le conflit, jamais à l'annuler.
  if (ticker) {
    for (const e of explicit) {
      const eKey = identityKey(e.chain, e.address);
      const rivals = exacts.filter((c) => identityKey(c.chain, c.address) !== eKey);
      if (rivals.length === 0) continue;

      const tickerLabel = ticker.replace(/^\$+/, "");
      const symbolDisagrees =
        !!e.symbol && !["exact", "prefix"].includes(classifySymbolMatch(ticker, e.symbol));

      out.push(
        symbolDisagrees
          ? {
              kind: "ticker_vs_address",
              detail:
                `le contrat fourni correspond à $${e.symbol} alors que le ticker demandé ` +
                `$${tickerLabel} désigne ${rivals.length} autre(s) contrat(s) — revue humaine requise`,
              between: [eKey, ...rivals.map((r) => identityKey(r.chain, r.address))],
            }
          : {
              kind: "contract_identity",
              detail:
                `${rivals.length + 1} contrats distincts répondent au ticker $${tickerLabel}` +
                (e.symbol
                  ? ` ; le contrat fourni en porte le symbole, ce qui ne l'identifie pas —` +
                    " un imitateur choisit son symbole"
                  : " ; le contrat fourni n'a pas de symbole connu, rien ne le relie à ce ticker"),
              between: [eKey, ...rivals.map((r) => identityKey(r.chain, r.address))],
            },
      );
    }
  }

  // E7b — plusieurs contrats collés dans la MÊME requête, tous plausibles.
  //   L'ordre du texte n'est pas une preuve d'intention : servir le premier
  //   arrivé revient à laisser un attaquant choisir le verdict en plaçant son
  //   adresse en tête. Un seul plausible → il tranche ; deux ou plus → ambiguïté.
  if (explicit.length >= 2) {
    const plausible = explicit.filter((c) => isExplicitPlausible(c, policy));
    if (plausible.length >= 2) {
      out.push({
        kind: "multiple_explicit_addresses",
        detail:
          `${plausible.length} contrats distincts et vivants sont fournis dans la même requête — ` +
          "l'ordre du texte ne désigne pas lequel est visé",
        between: plausible.map((c) => identityKey(c.chain, c.address)).sort(),
      });
    }
  }

  // Frontière A — on a cherché des rivaux et on n'a pas pu regarder.
  //   Ne jamais conclure « pas de rival » d'un appel en échec. Le conflit n'est
  //   émis que si RIEN d'interne ne corrobore : une source interne qui confirme
  //   l'identité rend la panne du marché sans conséquence (cas T04).
  if (input.rivalSearchDegraded && explicit.length > 0) {
    const uncorroborated = explicit.filter((c) => !hasInternalBacking(c));
    if (uncorroborated.length > 0) {
      out.push({
        kind: "rival_search_degraded",
        detail:
          "la recherche de contrats rivaux a échoué (panne fournisseur ou budget épuisé) — " +
          "aucune source interne ne corrobore : l'absence de contradiction n'est pas établie",
        between: uncorroborated.map((c) => identityKey(c.chain, c.address)).sort(),
      });
    }
  }

  // 2/3. Détail de la collision : même chaîne, ou plusieurs chaînes.
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
      detail: `${list.length} contrats distincts portent exactement ce symbole sur ${chain}`,
      between: list.map((c) => identityKey(c.chain, c.address)),
    });
  }
  if (byChain.size > 1) {
    // Le facteur de domination ne TRANCHE plus rien (sous E5 aucune liquidité
    // ne répond à une question d'identité) ; il qualifie seulement le conflit.
    const sorted = exacts
      .slice()
      .sort((a, b) => (b.signals.liquidityUsd ?? -1) - (a.signals.liquidityUsd ?? -1));
    const first = sorted[0]?.signals.liquidityUsd ?? 0;
    const second = sorted[1]?.signals.liquidityUsd ?? 0;
    const ratio = second > 0 ? first / second : first > 0 ? Infinity : 0;
    out.push({
      kind: "cross_chain",
      detail:
        `symbole exact présent sur ${byChain.size} chaînes` +
        (ratio >= policy.crossChainDominanceRatio
          ? ` (un candidat domine en liquidité, ce qui ne tranche pas l'identité)`
          : " sans dominante de liquidité"),
      between: exacts.map((c) => identityKey(c.chain, c.address)),
    });
  }

  // 4. Curation et marché ne désignent pas le même contrat.
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
      detail: "la source interne et le marché désignent deux contrats différents",
      between: [
        identityKey(topInternal.chain, topInternal.address),
        identityKey(topMarket.chain, topMarket.address),
      ],
    });
  }

  // 5. D2 — tout ce qui restait a été écarté par le temps.
  const temporallyKilled = excluded.filter((c) => c.excluded?.reason === "temporally_impossible");
  if (candidates.length === 0 && temporallyKilled.length > 0) {
    out.push({
      kind: "temporal_impossibility",
      detail:
        `${temporallyKilled.length} candidat(s) écarté(s) : contrat postérieur à l'observation. ` +
        "Aucun contrat antérieur ne correspond — le token observé n'est pas dans nos sources",
      between: temporallyKilled.map((c) => identityKey(c.chain, c.address)),
    });
  }

  return out;
}

// ─── Décision ─────────────────────────────────────────────────────────────

export interface DecisionInput {
  /** Candidats retenus, DÉJÀ classés. */
  candidates: TokenCandidate[];
  /** Candidats écartés (chaîne hors périmètre, temps impossible). */
  excluded?: TokenCandidate[];
  ticker?: string | null;
  explicitIdentityKeys: ReadonlySet<string>;
  conflicts: ResolutionConflict[];
  /** Une date d'observation a-t-elle été fournie ? Change le plafond de confiance. */
  observedAtProvided?: boolean;
  /** Frontière A — la recherche de rivaux a échoué. */
  rivalSearchDegraded?: boolean;
  policy?: ResolutionPolicy;
}

export interface Decision {
  status: ResolutionStatus;
  confidence: Confidence;
  method: ResolutionMethod;
  callerSupport: CallerSupport;
  selected: TokenCandidate | null;
  limitations: string[];
}

function isPlausibleCompetitor(
  c: TokenCandidate,
  top: TokenCandidate,
  policy: ResolutionPolicy,
): boolean {
  if (identityKey(c.chain, c.address) === identityKey(top.chain, top.address)) return false;
  if (c.matchType !== top.matchType) return false;
  if (hasInternalBacking(c)) return true;
  // Une source sans marché revendique quand même une identité pour ce ticker.
  // Depuis la ratification de I3 elle peut résoudre ; elle peut donc aussi
  // faire obstacle. Sous le régime strict (knob à false) elle ne pèse rien.
  if (isMarketlessOnly(c)) return policy.marketlessSourcesCanAutoResolve;
  return (c.signals.liquidityUsd ?? 0) >= policy.minLiquidityUsdForAutoResolve;
}

const ORDER: Confidence[] = ["LOW", "MODERATE", "HIGH"];
function cap(actual: Confidence, ceiling: Confidence): Confidence {
  return ORDER[Math.min(ORDER.indexOf(actual), ORDER.indexOf(ceiling))];
}

/**
 * Plafond imposé par le TEMPS, jamais par la chaîne.
 * Si l'appelant a fourni une date d'observation et qu'on ne sait pas dater le
 * contrat, on ne peut pas confirmer qu'il existait : la confiance plafonne.
 */
function temporalCeiling(c: TokenCandidate, observedAtProvided: boolean): Confidence {
  if (!observedAtProvided) return "HIGH";
  return c.temporal === "compatible" ? "HIGH" : "MODERATE";
}

function unresolved(limitation: string): Decision {
  return {
    status: "UNRESOLVED",
    confidence: "LOW",
    method: "none",
    callerSupport: "supported",
    selected: null,
    limitations: [limitation],
  };
}

export function decide(input: DecisionInput): Decision {
  const policy = input.policy ?? DEFAULT_POLICY;
  const { candidates, ticker, conflicts } = input;
  const excluded = input.excluded ?? [];
  const observedAtProvided = !!input.observedAtProvided;
  const limitations: string[] = [];

  // ─ 0. Plus aucun candidat retenu — dire POURQUOI, jamais « introuvable » sec.
  if (candidates.length === 0) {
    const outOfScope = excluded.filter((c) => c.excluded?.reason === "chain_not_allowed");
    const timeKilled = excluded.filter((c) => c.excluded?.reason === "temporally_impossible");

    // Hors périmètre de l'appelant : l'asset EST identifié. Le déclarer
    // introuvable ferait conclure à l'utilisateur qu'il n'existe pas.
    if (outOfScope.length > 0 && timeKilled.length === 0) {
      const best = outOfScope[0];
      const uniqueIdentity =
        new Set(outOfScope.map((c) => identityKey(c.chain, c.address))).size === 1;
      return {
        status: uniqueIdentity ? "RESOLVED" : "AMBIGUOUS",
        confidence: uniqueIdentity ? "MODERATE" : "LOW",
        method: methodForCandidate(best),
        callerSupport: "unsupported_by_caller",
        selected: uniqueIdentity ? best : null,
        limitations: [
          `asset identifié sur ${best.chain}, hors du périmètre déclaré par l'appelant — ` +
            "non traitable ici, mais il existe",
        ],
      };
    }
    if (timeKilled.length > 0) {
      return unresolved(
        `${timeKilled.length} candidat(s) écarté(s) comme postérieurs à l'observation — ` +
          "aucun contrat antérieur ne correspond",
      );
    }
    return unresolved("aucun candidat — ni source interne, ni marché, ni chaîne");
  }

  // ─ 1. Conflits bloquants.
  const tickerVsAddress = conflicts.find((c) => c.kind === "ticker_vs_address");
  if (tickerVsAddress) {
    return {
      status: "CONFLICT",
      confidence: "LOW",
      method: "explicit_ca",
      callerSupport: "supported",
      selected: null,
      limitations: [tickerVsAddress.detail],
    };
  }

  // E5 — plusieurs contrats sous un même symbole. Jamais RESOLVED, jamais HIGH.
  //
  //   FRONTIÈRE B, ratifiée — quand la contradiction est INTERNE À LA REQUÊTE
  //   (l'appelant colle un contrat A et demande un ticker que le contrat B
  //   porte), le verdict est CONFLICT, pas AMBIGUOUS. « Ces deux affirmations
  //   sont incompatibles » n'est pas « choisissez » : c'est le post lui-même qui
  //   se contredit, et pour un produit d'enquête cette distinction porte de
  //   l'information.
  //
  //   Sinon : CONFLICT si deux de NOS sources internes se contredisent (nos
  //   données sont fausses, revue humaine) ; AMBIGUOUS quand c'est à
  //   l'utilisateur de choisir.
  const identityConflict = conflicts.find((c) => c.kind === "contract_identity");
  if (identityConflict) {
    const colliding = candidates.filter((c) =>
      identityConflict.between.includes(identityKey(c.chain, c.address)),
    );
    const selfContradiction = identityConflict.between.some((k) =>
      input.explicitIdentityKeys.has(k),
    );
    const internallyContested = colliding.filter((c) => hasInternalBacking(c)).length >= 2;
    return {
      status: selfContradiction || internallyContested ? "CONFLICT" : "AMBIGUOUS",
      confidence: "LOW",
      method: methodForCandidate(candidates[0]),
      callerSupport: "supported",
      selected: null,
      limitations: [
        identityConflict.detail,
        ...(selfContradiction
          ? [
              "la requête se contredit elle-même : le contrat fourni et le ticker demandé " +
                "désignent des tokens différents",
            ]
          : []),
        ...(internallyContested
          ? ["deux sources internes désignent des contrats différents — arbitrage humain requis"]
          : []),
      ],
    };
  }

  // E7b — plusieurs contrats explicites plausibles dans la même requête.
  const multiExplicit = conflicts.find((c) => c.kind === "multiple_explicit_addresses");
  if (multiExplicit) {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: "explicit_ca",
      callerSupport: "supported",
      selected: null,
      limitations: [multiExplicit.detail],
    };
  }

  const top = candidates[0];
  const topIsExplicit = input.explicitIdentityKeys.has(identityKey(top.chain, top.address));

  // ─ 2. Contrat fourni par l'appelant : l'identité est déjà tranchée.
  if (topIsExplicit) {
    // FRONTIÈRE A, ratifiée — on ne résout JAMAIS par ABSENCE de rival quand on
    // n'a pas pu chercher. Une source interne qui corrobore rend la panne du
    // marché sans conséquence ; sans elle, on cesse d'affirmer.
    if (input.rivalSearchDegraded && !hasInternalBacking(top)) {
      return {
        status: "AMBIGUOUS",
        confidence: "LOW",
        method: "explicit_ca",
        callerSupport: "supported",
        selected: null,
        limitations: [
          "recherche de contrats rivaux en échec et aucune corroboration interne — " +
            "l'absence de contradiction n'est pas établie, résolution suspendue",
        ],
      };
    }

    // Le PLANCHER DE LIQUIDITÉ NE S'APPLIQUE PAS ICI. L'appelant a fourni le
    // contrat : l'identité vient de la requête, pas du marché. Un token mort,
    // rugué, à zéro de liquidité doit se résoudre — c'est le sujet du produit.
    const confirmedByMarket = top.signals.liquidityUsd != null || !!top.symbol;
    if (confirmedByMarket) {
      return {
        status: "RESOLVED",
        confidence: cap("HIGH", temporalCeiling(top, observedAtProvided)),
        method: "explicit_ca",
        callerSupport: "supported",
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
          callerSupport: "supported",
          selected: null,
          limitations: [
            "mint confirmé on-chain mais aucun marché indexé — résolution on-chain désactivée par la politique",
          ],
        };
      }
      return {
        status: "RESOLVED",
        confidence: cap("MODERATE", temporalCeiling(top, observedAtProvided)),
        method: "onchain",
        callerSupport: "supported",
        selected: top,
        limitations: [
          "mint confirmé on-chain, aucune paire indexée (contrat neuf ou illiquide) — " +
            "symbole et données de marché indisponibles, cohérence du ticker non vérifiable",
        ],
      };
    }
    return unresolved(
      "contrat fourni valide mais confirmé par aucune source : ni marché, ni chaîne, ni base interne",
    );
  }

  // ─ 3. J3 — ticker générique. Contrôle appliqué sur TOUS les chemins.
  //     En V2 il était conditionné à l'absence d'adresse dans la requête : dès
  //     qu'une adresse présente échouait à être localisée, le contrôle sautait
  //     et un ticker de la liste noire pouvait se résoudre.
  if (policy.genericTickerNeverAutoResolves && ticker && isGenericTicker(ticker)) {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: methodForCandidate(top),
      callerSupport: "supported",
      selected: null,
      limitations: ["ticker générique (liste noire) — désambiguïsation manuelle requise"],
    };
  }

  // ─ 4. Règle d'or : un concurrent plausible subsistant interdit de trancher.
  const competitors = candidates.filter((c) => isPlausibleCompetitor(c, top, policy));
  if (competitors.length > 0) {
    const detail = conflicts
      .filter((c) => c.kind === "multiple_exact" || c.kind === "cross_chain")
      .map((c) => c.detail);
    return {
      status: "AMBIGUOUS",
      confidence: competitors.length === 1 ? "MODERATE" : "LOW",
      method: methodForCandidate(top),
      callerSupport: "supported",
      selected: null,
      limitations: [
        `${competitors.length + 1} candidats plausibles restent en lice — jamais résolu automatiquement`,
        ...detail,
      ],
    };
  }

  // ─ 5. Candidat unique en tête.
  if (top.chainInferred) {
    limitations.push(
      `chaîne déduite de la forme de l'adresse (colonne d'origine inexploitable) — ${top.chain}`,
    );
  }
  if (observedAtProvided && top.temporal === "unknown") {
    limitations.push(
      "antériorité du contrat non attestée : impossible de confirmer qu'il existait à la date observée",
    );
  }

  const ceiling = temporalCeiling(top, observedAtProvided);

  // ─ I3, ratifié — une source SANS MARCHÉ peut identifier, jamais certifier.
  //   Les trois conditions sont déjà acquises à ce point du parcours :
  //     • contrat unique — aucun conflit d'identité n'a été levé (étape 1) ;
  //     • dans le périmètre déclaré — sinon le candidat aurait été écarté ;
  //     • aucun concurrent plausible — règle d'or, étape 4.
  //   Reste le plafond MODERATE, qui n'est pas un curseur : sans donnée de
  //   marché on ne peut pas dire HIGH. DexScreener enrichit ce candidat quand il
  //   le connaît ; il n'est pas requis pour l'identifier.
  if (isMarketlessOnly(top)) {
    if (!policy.marketlessSourcesCanAutoResolve) {
      return {
        status: "AMBIGUOUS",
        confidence: "LOW",
        method: methodForCandidate(top),
        callerSupport: "supported",
        selected: null,
        limitations: [
          ...limitations,
          "régime strict : aucune résolution sur des sources sans donnée de marché",
        ],
      };
    }
    if (top.matchType === "unknown") {
      return {
        status: "AMBIGUOUS",
        confidence: "LOW",
        method: methodForCandidate(top),
        callerSupport: "supported",
        selected: null,
        limitations: [
          ...limitations,
          "source sans marché et symbole non comparable au ticker — rien ne relie ce contrat à la requête",
        ],
      };
    }
    limitations.push(
      "aucune donnée de marché sur ce contrat (catalogue, index de dossiers ou chaîne seule) — " +
        "identité retenue, certitude plafonnée",
    );
    return {
      status: "RESOLVED",
      confidence: cap("MODERATE", ceiling),
      method: methodForCandidate(top),
      callerSupport: "supported",
      selected: top,
      limitations,
    };
  }

  const internal = hasInternalBacking(top);

  if (internal) {
    // V3-3 — la curation atteste un CONTRAT, pas une autorité universelle.
    // Le périmètre de chaîne et le temps s'appliquent AVANT ce point
    // (bindChains / applyTemporal) : un lien curé hors périmètre ou postérieur
    // à l'observation n'arrive jamais ici. On ne le repêche pas.
    if (top.matchType === "prefix") {
      if (!policy.internalResolvesOnPrefix) {
        return {
          status: "AMBIGUOUS",
          confidence: "LOW",
          method: methodForCandidate(top),
          callerSupport: "supported",
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
        callerSupport: "supported",
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
        callerSupport: "supported",
        selected: top,
        limitations,
      };
    }
    return {
      status: "RESOLVED",
      confidence: cap("HIGH", ceiling),
      method: methodForCandidate(top),
      callerSupport: "supported",
      selected: top,
      limitations,
    };
  }

  // ─ 6. Marché seul : exact ET liquide assez.
  if (top.matchType !== "exact") {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: methodForCandidate(top),
      callerSupport: "supported",
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
      callerSupport: "supported",
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
    confidence: cap("HIGH", ceiling),
    method: methodForCandidate(top),
    callerSupport: "supported",
    selected: top,
    limitations,
  };
}
