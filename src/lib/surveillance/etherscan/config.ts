/**
 * src/lib/surveillance/etherscan/config.ts
 * Ne jamais logger ETHERSCAN_API_KEY
 */

export function getEtherscanApiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new Error("[etherscan] ETHERSCAN_API_KEY not set");
  return key;
}

export const RATE_PER_SEC = parseInt(process.env.ETHERSCAN_RATE_PER_SEC ?? "5");
export const BATCH_WALLETS = parseInt(process.env.ONCHAIN_SYNC_BATCH_WALLETS ?? "5");
export const BASE_URL = "https://api.etherscan.io/api";
