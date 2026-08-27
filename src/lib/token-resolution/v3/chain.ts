// ─── Chaînes canoniques — normalisation unique ─────────────────────────────
// UNE seule table de correspondance chaîne pour toute la V2.
//
// Pourquoi ce fichier existe : la prod stocke la MÊME chaîne sous plusieurs
// écritures, mesuré en lecture seule sur ep-square-band le 2026-08-26 :
//   KolTokenLink        : "solana" (164), "SOL" (104), "unknown" (17),
//                         "ethereum" (5), "base" (2)
//   TokenPriceTracker   : "SOL" (310), "ETH" (27), "solana" (2), "BASE" (1)
//   KolPromotionMention : "solana" (61), "SOL" (12)
//   token_casefiles     : clés jsonb en libellé humain — "BNB Chain", "Ethereum"
// À quoi s'ajoutent les codes providers : DexScreener ("solana", "bsc"),
// CoinGecko ("binance-smart-chain", "arbitrum-one").
//
// Le résolveur V1 du scan (normalizeChain, route gelée) couvre une partie de ces
// formes mais PAS "BNB Chain" (son test porte sur "BNB" exact après upper) ni
// "unknown". Deux lignes casefile sur trois seraient donc muettes. La V2 tranche
// en normalisant par squelette alphanumérique, pas par égalité de chaîne.

/** Chaînes que la V2 sait nommer. Une valeur hors de cette liste n'existe pas. */
export type CanonicalChain =
  | "SOL"
  | "ETH"
  | "BSC"
  | "BASE"
  | "ARBITRUM"
  | "TRON"
  | "HYPER";

export const CANONICAL_CHAINS: readonly CanonicalChain[] = [
  "SOL",
  "ETH",
  "BSC",
  "BASE",
  "ARBITRUM",
  "TRON",
  "HYPER",
] as const;

/** Chaînes de familles EVM — même format d'adresse, même normalisation. */
const EVM_CHAINS = new Set<CanonicalChain>(["ETH", "BSC", "BASE", "ARBITRUM", "HYPER"]);

export function isEvmChain(chain: CanonicalChain): boolean {
  return EVM_CHAINS.has(chain);
}

/**
 * Squelette de comparaison : majuscules, alphanumériques seulement.
 * "BNB Chain" → "BNBCHAIN" · "arbitrum-one" → "ARBITRUMONE" · "  sol " → "SOL".
 */
function skeleton(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Toutes les écritures observées, plus les alias providers. Clé = squelette.
const CHAIN_ALIASES: Record<string, CanonicalChain> = {
  // Solana
  SOL: "SOL",
  SOLANA: "SOL",
  SPL: "SOL",
  // Ethereum
  ETH: "ETH",
  ETHEREUM: "ETH",
  ERC20: "ETH",
  MAINNET: "ETH",
  // BNB
  BSC: "BSC",
  BNB: "BSC",
  BNBCHAIN: "BSC",
  BNBSMARTCHAIN: "BSC",
  BINANCE: "BSC",
  BINANCESMARTCHAIN: "BSC",
  BEP20: "BSC",
  // Base
  BASE: "BASE",
  // Arbitrum
  ARB: "ARBITRUM",
  ARBITRUM: "ARBITRUM",
  ARBITRUMONE: "ARBITRUM",
  // Tron
  TRON: "TRON",
  TRX: "TRON",
  TRC20: "TRON",
  // Hyperliquid
  HYPER: "HYPER",
  HYPERLIQUID: "HYPER",
  HYPEREVM: "HYPER",
};

/**
 * Normalise n'importe quelle écriture de chaîne vers sa forme canonique.
 * Retourne null pour une valeur vide, inconnue, ou explicitement non renseignée
 * ("unknown" — 17 lignes KolTokenLink en prod). null n'est PAS une erreur : c'est
 * un candidat dont la chaîne devra être déduite de la forme de son adresse.
 */
export function normalizeChain(raw: string | null | undefined): CanonicalChain | null {
  if (!raw) return null;
  const s = skeleton(String(raw));
  if (!s) return null;
  return CHAIN_ALIASES[s] ?? null;
}

/** true quand la valeur brute est un « non renseigné » assumé, pas une faute. */
export function isUnknownChainMarker(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const s = skeleton(String(raw));
  return s === "UNKNOWN" || s === "NA" || s === "NONE" || s === "TBD" || s === "";
}
