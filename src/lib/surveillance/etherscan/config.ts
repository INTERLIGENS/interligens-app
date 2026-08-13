/**
 * src/lib/surveillance/etherscan/config.ts
 * Ne jamais logger ETHERSCAN_API_KEY
 */

import { envInt } from "@/lib/config/envNumber";

export function getEtherscanApiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new Error("[etherscan] ETHERSCAN_API_KEY not set");
  return key;
}

// Non fini -> défaut littéral. RATE_PER_SEC en NaN désarme l'étalement des
// appels Etherscan (délai NaN) et expose le compte à un ban pour flood.
export const RATE_PER_SEC = envInt("ETHERSCAN_RATE_PER_SEC", 5);
export const BATCH_WALLETS = envInt("ONCHAIN_SYNC_BATCH_WALLETS", 5);
export const BASE_URL = "https://api.etherscan.io/api";
