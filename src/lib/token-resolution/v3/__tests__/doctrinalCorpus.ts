// ─── Corpus doctrinal — les cas dont la VÉRITÉ a été arbitrée ───────────────
//
// Le corpus factuel (falseCriticalCorpus.ts) mesure un défaut : un contrat servi
// comme certain alors que des rivaux subsistent. Sa vérité ne se discute pas.
//
// Ce corpus-ci est d'une autre nature. Chaque cas posait une QUESTION que le
// code ne pouvait pas trancher seul, et qui a été arbitrée au checkpoint du
// 2026-08-27 (docs/prep/BUILD1_CHECKPOINT_DOCTRINE_2026-08-27.md). Tant que
// l'arbitrage n'était pas rendu, ces cas portaient l'étiquette `PENDING_POLICY`
// — et pour DEUX d'entre eux, cette étiquette désignait l'option qui n'a
// FINALEMENT PAS été retenue :
//
//   I3   étiqueté AMBIGUOUS  → ratifié RESOLVED, plafonné MODERATE
//   R22  étiqueté « écarté » → ratifié RETENU : 10 j d'écart sur une preuve
//                              d'ACTIVITÉ tombent sous la tolérance de 30 j
//
// Les compter comme de fausses résolutions, c'était compter le désaccord d'une
// étiquette périmée avec une doctrine qui l'avait remplacée. Ils sont
// ré-étiquetés ici, et chaque fiche garde trace de l'étiquette abandonnée : une
// correction dont on efface la trace est une correction qu'on ne peut plus
// contester.
//
// Le champ `supersededLabel` n'est pas décoratif — un test vérifie qu'il diffère
// bien de l'attendu ratifié, faute de quoi la fiche prétendrait à une
// ré-étiquette qui n'a pas eu lieu.

import type { ResolutionRequest, Confidence, ResolutionStatus } from "../types";
import type { FakeDbRoute } from "./helpers";
import type { FixtureRoute } from "../providers/fixtureHttp";

/** Contrats réels, mêmes que le corpus factuel et les tests de doctrine. */
export const LIVE = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
export const OTHER = "FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump";
export const OVPP_ETH = "0xb4c6fedd984bc983b1a758d0875f1ea34f81a6af";
export const I3_MINT = "BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST";

/** Instant d'observation commun. Fixe : aucun test ne lit l'horloge. */
export const OBSERVED = new Date("2024-03-01T00:00:00Z");
const MS_DAY = 86_400_000;

function pair(
  chainId: string,
  address: string,
  symbol: string,
  liquidityUsd: number | null,
  pairCreatedAt: number | null = null,
) {
  return {
    chainId,
    baseToken: { address, symbol, name: symbol },
    liquidity: liquidityUsd == null ? {} : { usd: liquidityUsd },
    volume: { h24: 1_000 },
    pairCreatedAt,
  };
}

export const NO_MARKET: FixtureRoute[] = [
  { match: "/latest/dex/search", json: { pairs: [] } },
  { match: "/tokens/v1/", json: [] },
  { match: "coingecko", json: { coins: [] } },
];

function curatedRow(address: string, chain: string, symbol: string) {
  return {
    contractAddress: address,
    chain,
    tokenSymbol: symbol,
    kolHandle: "bkokoski",
    canonicalMint: null,
    canonicalChain: null,
    visibility: "public",
  };
}

export interface DoctrinalExpectation {
  status: ResolutionStatus;
  /** Confiance exacte attendue, quand la doctrine la fixe. */
  confidence?: Confidence;
  /** Plafond : la doctrine interdit d'aller au-delà. */
  maxConfidence?: Confidence;
  selectedIsNull?: boolean;
  selectedAddress?: string;
  excludesAddress?: string;
  limitationsMatch?: RegExp;
  method?: string;
}

export interface DoctrinalCase {
  id: string;
  title: string;
  /** Ce que l'arbitrage du 2026-08-27 impose. */
  ratified: string;
  /**
   * Étiquette d'avant l'arbitrage, UNIQUEMENT quand elle désignait l'option non
   * retenue. Absente pour les cas dont l'étiquette a survécu à l'arbitrage.
   */
  supersededLabel?: string;
  request: ResolutionRequest;
  dbRoutes: FakeDbRoute[];
  httpRoutes: FixtureRoute[];
  expect: DoctrinalExpectation;
}

const CONFIDENCE_ORDER: Confidence[] = ["LOW", "MODERATE", "HIGH"];
export function confidenceRank(c: Confidence): number {
  return CONFIDENCE_ORDER.indexOf(c);
}

export const DOCTRINAL_CORPUS: DoctrinalCase[] = [
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "I3",
    title: "$GHOSTCAT — un catalogue sans marché est la SEULE source",
    ratified:
      "contrat unique + périmètre couvert + zéro rival → RESOLVED, plafonné MODERATE. " +
      "Une source sans marché peut IDENTIFIER ; elle ne peut jamais CERTIFIER.",
    supersededLabel:
      "AMBIGUOUS — option écartée à l'arbitrage : elle rendait introuvable un token " +
      "dont l'identité ne faisait pourtant aucun doute.",
    request: {
      ticker: "GHOSTCAT",
      audience: "public",
      allowedChains: ["SOL"],
    },
    dbRoutes: [],
    httpRoutes: [
      {
        match: "/api/v3/search",
        json: { coins: [{ id: "ghostcat", symbol: "GHOSTCAT", name: "GhostCat" }] },
      },
      {
        match: "/api/v3/coins/ghostcat",
        json: {
          id: "ghostcat",
          symbol: "GHOSTCAT",
          name: "GhostCat",
          platforms: { solana: I3_MINT },
        },
      },
      ...NO_MARKET,
    ],
    expect: {
      status: "RESOLVED",
      confidence: "MODERATE",
      maxConfidence: "MODERATE",
      selectedAddress: I3_MINT,
      limitationsMatch: /aucune donnée de marché/,
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "R22-in",
    title: "$LATE — contrat postérieur de 10 j, preuve d'ACTIVITÉ",
    ratified:
      "10 j d'écart sur une preuve d'ACTIVITÉ (une paire vue, pas une naissance " +
      "datée) tombent SOUS la tolérance faible de 30 j : le candidat est retenu. " +
      "La tolérance ratifiée décide du sort du cas qui l'avait motivée.",
    supersededLabel:
      "écarté comme temporellement impossible — option écartée : une paire " +
      "observée 10 j après ne prouve pas que le contrat soit né après.",
    request: {
      ticker: "LATE",
      audience: "public",
      allowedChains: ["SOL"],
      observedAt: OBSERVED,
    },
    dbRoutes: [],
    httpRoutes: [
      {
        match: "/latest/dex/search",
        json: {
          pairs: [
            pair("solana", LIVE, "LATE", 400_000, OBSERVED.getTime() + 10 * MS_DAY),
          ],
        },
      },
      ...NO_MARKET,
    ],
    expect: {
      status: "RESOLVED",
      selectedAddress: LIVE,
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "R22-out",
    title: "$LATE — contrat postérieur de 400 j, hors tolérance",
    ratified:
      "hors tolérance : le candidat est ÉCARTÉ (temporally_impossible), jamais " +
      "servi avec une confiance dégradée. C'est le MÉCANISME qui a été ratifié.",
    request: {
      ticker: "LATE",
      audience: "public",
      allowedChains: ["SOL"],
      observedAt: OBSERVED,
    },
    dbRoutes: [],
    httpRoutes: [
      {
        match: "/latest/dex/search",
        json: {
          pairs: [
            pair("solana", LIVE, "LATE", 400_000, OBSERVED.getTime() + 400 * MS_DAY),
          ],
        },
      },
      ...NO_MARKET,
    ],
    expect: {
      status: "UNRESOLVED",
      selectedIsNull: true,
      excludesAddress: LIVE,
      limitationsMatch: /APRÈS l'observation/,
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "E7b",
    title: "deux contrats plausibles collés dans la même requête",
    ratified:
      "≥2 contrats explicites plausibles → AMBIGUOUS, aucun n'est élu. " +
      "Choisir, c'est deviner.",
    request: {
      addresses: [LIVE, OTHER],
      audience: "public",
      allowedChains: ["SOL"],
    },
    dbRoutes: [],
    httpRoutes: [
      { match: `/tokens/v1/solana/${LIVE}`, json: [pair("solana", LIVE, "ALPHA", 90_000)] },
      { match: `/tokens/v1/solana/${OTHER}`, json: [pair("solana", OTHER, "BETA", 70_000)] },
      ...NO_MARKET,
    ],
    expect: {
      status: "AMBIGUOUS",
      confidence: "LOW",
      selectedIsNull: true,
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "S04-in-scope",
    title: "$OVPP — curation ETH, appelant ETH : elle tranche",
    ratified:
      "la curation fait autorité DANS son périmètre de chaîne : elle résout, " +
      "sans même consulter le marché.",
    request: {
      ticker: "OVPP",
      audience: "public",
      allowedChains: ["ETH"],
    },
    dbRoutes: [{ match: 'FROM "KolTokenLink"', rows: [curatedRow(OVPP_ETH, "ethereum", "OVPP")] }],
    httpRoutes: NO_MARKET,
    expect: {
      status: "RESOLVED",
      method: "curated",
      selectedAddress: OVPP_ETH,
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "S04-out-of-scope",
    title: "$OVPP — curation ETH, appelant SOL : elle ne décide pas ailleurs",
    ratified:
      "hors périmètre : identifié et marqué unsupported_by_caller, jamais rendu " +
      "introuvable — le déclarer absent ferait conclure qu'il n'existe pas.",
    request: {
      ticker: "OVPP",
      audience: "public",
      allowedChains: ["SOL"],
    },
    dbRoutes: [{ match: 'FROM "KolTokenLink"', rows: [curatedRow(OVPP_ETH, "ethereum", "OVPP")] }],
    httpRoutes: NO_MARKET,
    expect: {
      status: "RESOLVED",
      excludesAddress: OVPP_ETH,
      limitationsMatch: /hors du périmètre/,
    },
  },
];
