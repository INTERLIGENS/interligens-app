export type EntityCategory = "dex" | "bridge" | "tool" | "nft" | "lending" | "wallet" | "unknown";
export type Entity = { name: string; category: EntityCategory; isOfficial: boolean; url?: string };

const REGISTRY: Record<string, Record<string, Entity>> = {
  ETH: {
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": { name: "Uniswap V2 Router", category: "dex", isOfficial: true, url: "https://uniswap.org" },
    "0xe592427a0aece92de3edee1f18e0157c05861564": { name: "Uniswap V3 Router", category: "dex", isOfficial: true, url: "https://uniswap.org" },
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": { name: "Uniswap Universal Router", category: "dex", isOfficial: true, url: "https://uniswap.org" },
    "0x1111111254eeb25477b68fb85ed929f73a960582": { name: "1inch V5 Router", category: "dex", isOfficial: true, url: "https://1inch.io" },
    "0x111111125421ca6dc452d289314280a0f8842a65": { name: "1inch V6 Router", category: "dex", isOfficial: true, url: "https://1inch.io" },
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": { name: "SushiSwap Router", category: "dex", isOfficial: true, url: "https://sushi.com" },
  },
  BSC: {
    "0x10ed43c718714eb63d5aa57b78b54704e256024e": { name: "PancakeSwap V2 Router", category: "dex", isOfficial: true, url: "https://pancakeswap.finance" },
    "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": { name: "PancakeSwap V3 Router", category: "dex", isOfficial: true, url: "https://pancakeswap.finance" },
  },
  SOL: {
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": { name: "Raydium AMM", category: "dex", isOfficial: true, url: "https://raydium.io" },
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": { name: "Jupiter Aggregator V6", category: "dex", isOfficial: true, url: "https://jup.ag" },
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc":  { name: "Orca Whirlpool", category: "dex", isOfficial: true, url: "https://orca.so" },
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin": { name: "Serum DEX V3", category: "dex", isOfficial: true, url: "https://projectserum.com" },
  },
};

export function resolveEntity(chain: string, address: string): Entity {
  const chainRegistry = REGISTRY[chain.toUpperCase()] ?? {};
  for (const [addr, entity] of Object.entries(chainRegistry)) {
    if (addr.toLowerCase() === address.toLowerCase()) return entity;
  }
  return { name: "Unknown", category: "unknown", isOfficial: false };
}

export function resolveEntities(chain: string, addresses: string[]): Array<Entity & { address: string }> {
  return addresses.map(addr => ({ address: addr, ...resolveEntity(chain, addr) }));
}
