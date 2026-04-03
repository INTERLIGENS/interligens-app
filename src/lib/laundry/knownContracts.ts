export const KNOWN_MIXERS: string[] = [
  "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b", // Tornado Cash Router
  "0x722122dF12D4e14e13Ac3b6895a86e84145b6967", // Tornado Cash Proxy
];

export const KNOWN_BRIDGES: string[] = [
  "wormhole",
  "stargate",
  "synapse",
  "across",
  "orbiter",
  "allbridge",
  "layerzero",
  "hyperliquid", // Relevant to BOTIFY — Gordon EVM wallet attributed via Hyperliquid
];

export const KNOWN_PRIVACY_ENTRIES: string[] = [
  // Entries for Monero, Zcash shielded pool, privacy-as-a-service
];

export const KNOWN_CEX_CLUSTERS: string[] = [
  // Known CEX deposit clusters (Binance, OKX, Bybit)
  // To be enriched per-casefile as wallet graph expands
];
