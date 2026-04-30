import type { WalletAdapter } from "./types";
import { RabbyAdapter } from "./rabby";
import { CoinbaseAdapter } from "./coinbase";
import { TrustWalletAdapter } from "./trustwallet";

type AdapterFactory = () => WalletAdapter;

const REGISTRY = new Map<string, AdapterFactory>([
  ["rabby", () => new RabbyAdapter()],
  ["coinbase", () => new CoinbaseAdapter()],
  ["trustwallet", () => new TrustWalletAdapter()],
]);

export function getAdapter(walletName: string): WalletAdapter | null {
  const factory = REGISTRY.get(walletName.toLowerCase());
  return factory ? factory() : null;
}

export function listAdapters(): string[] {
  return Array.from(REGISTRY.keys());
}
