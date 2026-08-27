// ─── Corpus factuel — les 5 faux CRITICAL du bypass E5 par accord de symbole ─
//
// Chaque cas est une instance du MÊME défaut : un contrat explicite est fourni,
// son symbole COÏNCIDE avec le ticker demandé, et la porte de conflit s'ouvre
// sur cet accord de symbole — la seule variable que l'imitateur contrôle. Des
// contrats rivaux portant le même ticker existent pourtant, et sont ignorés.
//
// E4 · E5 · S01 · S05 exercent le bypass « accord exact/préfixe → continue ».
// K6 exerce le bypass « symbole absent → continue » : un contrat fraîchement
// déployé, dont aucun marché ne connaît le symbole, passait la porte sans même
// être comparé aux rivaux.
//
// ─── Provenance des données ──────────────────────────────────────────────
// Les contrats et les collisions sont RÉELS, relevés en lecture seule sur
// ep-square-band le 2026-08-27 (KolTokenLink, visibility='public', marqueurs
// éditoriaux exclus) :
//   WORLDCUP → 3 contrats Solana distincts
//   DIONE    → 2 contrats Ethereum distincts
//   OVPP     → 2 contrats, un BASE et un ETH (collision inter-chaînes)
//   GHOST    → 1 contrat curé par 5 KOL
//
// Les IDENTIFIANTS de cas (E4, E5, S01, S05, K6) reprennent ceux du backtest T2.
// Le contenu exact de ce backtest ne m'étant pas accessible, chaque cas a été
// reconstruit à partir du mode de défaillance décrit — un contrat explicite
// servi comme certain alors que des rivaux d'identité subsistent. Si un cas T2
// recouvre une autre situation, la fiche est à réécrire ; la mesure, elle, reste
// valable pour le défaut nommé.

import type { ResolutionRequest } from "../types";
import type { FakeDbRoute } from "./helpers";
import type { FixtureRoute } from "../providers/fixtureHttp";

// Contrats réels (prod).
export const WORLDCUP_A = "2B5N1WpuPFwbJGm1ne1RkZYWGjoHy89SPqokTm8Bpump";
export const WORLDCUP_B = "Hy4A25PEsBu12gqY24yGDhkgSzF4itDDVDMBudYPpump";
export const WORLDCUP_C = "fxahEm5tei1DcD5pgivooZu17daFTwmspvdVRPYpump";
export const DIONE_A = "0x65278f702019078e9ab196c0da0a6ee55e7248b7";
export const DIONE_B = "0x89b69f2d1adffa9a253d40840b6baa7fc903d697";
export const OVPP_BASE = "0x8c0d3adcf8ce094e1ae437557ec90a6374dc9bdd";
export const OVPP_ETH = "0xb4c6fedd984bc983b1a758d0875f1ea34f81a6af";
export const GHOST_CURATED = "BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST";
/** Imitateur non listé : contrat inconnu de la base, symbole recopié. */
export const WORLDCUP_IMITATOR = "9hdynudAhhWzuNFAnpz7NjvdKMfh9z8mcZKNYHuAUgJQ";
/** Contrat fraîchement déployé, aucun marché ne connaît son symbole. */
export const GHOST_FRESH = "C2omVhcvt3DDY77S2KZzawFJQeETZofgZ4eNWWkXpump";

interface CuratedSeed {
  address: string;
  chain: string;
  symbol: string;
  handle: string;
}

function curatedRows(seeds: CuratedSeed[]) {
  return seeds.map((s) => ({
    contractAddress: s.address,
    chain: s.chain,
    tokenSymbol: s.symbol,
    kolHandle: s.handle,
    canonicalMint: null,
    canonicalChain: null,
    visibility: "public",
  }));
}

/** Paire DexScreener minimale : donne au contrat explicite son symbole. */
function pair(chainId: string, address: string, symbol: string, liquidityUsd = 60_000) {
  return {
    chainId,
    baseToken: { address, symbol, name: symbol },
    liquidity: { usd: liquidityUsd },
    volume: { h24: 20_000 },
    pairCreatedAt: null,
  };
}

export interface CorpusCase {
  id: string;
  title: string;
  /** Ce que la V1/V2 servait à tort. */
  falseVerdict: string;
  request: ResolutionRequest;
  dbRoutes: FakeDbRoute[];
  httpRoutes: FixtureRoute[];
  /** Identités rivales qui auraient dû empêcher toute certitude. */
  rivals: string[];
}

const NO_MARKET: FixtureRoute[] = [
  { match: "/latest/dex/search", json: { pairs: [] } },
  { match: "/tokens/v1/", json: [] },
  { match: "coingecko", json: { coins: [] } },
];

export const FALSE_CRITICAL_CORPUS: CorpusCase[] = [
  {
    id: "E4",
    title: "$WORLDCUP + contrat curé n°1 — deux contrats curés rivaux ignorés",
    falseVerdict: "RESOLVED / HIGH sur WORLDCUP_A",
    request: {
      ticker: "WORLDCUP",
      addresses: [WORLDCUP_A],
      audience: "public",
      allowedChains: ["SOL"],
    },
    dbRoutes: [
      {
        match: 'FROM "KolTokenLink"',
        rows: curatedRows([
          { address: WORLDCUP_A, chain: "solana", symbol: "WORLDCUP", handle: "bkokoski" },
          { address: WORLDCUP_B, chain: "solana", symbol: "WORLDCUP", handle: "planted" },
          { address: WORLDCUP_C, chain: "solana", symbol: "WORLDCUP", handle: "lynk0x" },
        ]),
      },
    ],
    httpRoutes: [
      { match: `/tokens/v1/solana/${WORLDCUP_A}`, json: [pair("solana", WORLDCUP_A, "WORLDCUP")] },
      ...NO_MARKET,
    ],
    rivals: [WORLDCUP_B, WORLDCUP_C],
  },
  {
    id: "E5",
    title: "$WORLDCUP + imitateur non listé qui a recopié le symbole",
    falseVerdict: "RESOLVED / HIGH sur un contrat absent de toute source curée",
    request: {
      ticker: "WORLDCUP",
      addresses: [WORLDCUP_IMITATOR],
      audience: "public",
      allowedChains: ["SOL"],
    },
    dbRoutes: [
      {
        match: 'FROM "KolTokenLink"',
        rows: curatedRows([
          { address: WORLDCUP_A, chain: "solana", symbol: "WORLDCUP", handle: "bkokoski" },
          { address: WORLDCUP_B, chain: "solana", symbol: "WORLDCUP", handle: "planted" },
          { address: WORLDCUP_C, chain: "solana", symbol: "WORLDCUP", handle: "lynk0x" },
        ]),
      },
    ],
    httpRoutes: [
      {
        match: `/tokens/v1/solana/${WORLDCUP_IMITATOR}`,
        json: [pair("solana", WORLDCUP_IMITATOR, "WORLDCUP", 900_000)],
      },
      ...NO_MARKET,
    ],
    rivals: [WORLDCUP_A, WORLDCUP_B, WORLDCUP_C],
  },
  {
    id: "S01",
    title: "$DIONE + contrat ETH n°1 — second contrat ETH curé ignoré",
    falseVerdict: "RESOLVED / HIGH sur DIONE_A",
    request: {
      ticker: "DIONE",
      addresses: [DIONE_A],
      audience: "public",
      allowedChains: ["ETH"],
      chainHint: "ethereum",
    },
    dbRoutes: [
      {
        match: 'FROM "KolTokenLink"',
        rows: curatedRows([
          { address: DIONE_A, chain: "ethereum", symbol: "DIONE", handle: "sxyz500" },
          { address: DIONE_B, chain: "ethereum", symbol: "DIONE", handle: "GordonGekko" },
        ]),
      },
    ],
    httpRoutes: [
      { match: `/tokens/v1/ethereum/${DIONE_A}`, json: [pair("ethereum", DIONE_A, "DIONE")] },
      ...NO_MARKET,
    ],
    rivals: [DIONE_B],
  },
  {
    id: "S05",
    title: "$OVPP + contrat BASE — rival ETH sur le même ticker (inter-chaînes)",
    falseVerdict: "RESOLVED / HIGH sur OVPP_BASE",
    request: {
      ticker: "OVPP",
      addresses: [OVPP_BASE],
      audience: "public",
      allowedChains: ["BASE", "ETH"],
      chainHint: "base",
    },
    dbRoutes: [
      {
        match: 'FROM "KolTokenLink"',
        rows: curatedRows([
          { address: OVPP_BASE, chain: "base", symbol: "OVPP", handle: "planted" },
          { address: OVPP_ETH, chain: "ethereum", symbol: "OVPP", handle: "DonWedge" },
        ]),
      },
    ],
    httpRoutes: [
      { match: `/tokens/v1/base/${OVPP_BASE}`, json: [pair("base", OVPP_BASE, "OVPP")] },
      ...NO_MARKET,
    ],
    rivals: [OVPP_ETH],
  },
  {
    id: "K6",
    title: "$GHOST + contrat fraîchement déployé, sans symbole connu",
    falseVerdict: "RESOLVED sur un contrat que rien ne relie au ticker",
    request: {
      ticker: "GHOST",
      addresses: [GHOST_FRESH],
      audience: "public",
      allowedChains: ["SOL"],
    },
    dbRoutes: [
      {
        match: 'FROM "KolTokenLink"',
        rows: curatedRows(
          ["bkokoski", "GordonGekko", "planted", "lynk0x", "sxyz500"].map((h) => ({
            address: GHOST_CURATED,
            chain: "solana",
            symbol: "GHOST",
            handle: h,
          })),
        ),
      },
    ],
    // Aucun marché n'indexe le contrat frais : son symbole reste inconnu, et la
    // chaîne confirme seulement qu'il s'agit d'un mint.
    httpRoutes: [
      { match: "helius-rpc.com", json: { result: { value: { data: { parsed: { type: "mint" } } } } } },
      ...NO_MARKET,
    ],
    rivals: [GHOST_CURATED],
  },
];
