import type { WalletAdapter, Chain } from "./types";

export class CoinbaseAdapter implements WalletAdapter {
  readonly name = "Coinbase Wallet";
  readonly icon = "https://www.coinbase.com/favicon.ico";
  readonly supportedChains: Chain[] = ["ethereum", "base", "arbitrum", "bsc", "solana"];

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    const eth = (window as unknown as { ethereum?: { isCoinbaseWallet?: boolean } }).ethereum;
    return !!eth?.isCoinbaseWallet;
  }

  async connect(): Promise<string> {
    throw new Error("CoinbaseAdapter.connect: not implemented");
  }

  async disconnect(): Promise<void> {
    throw new Error("CoinbaseAdapter.disconnect: not implemented");
  }

  deeplink(address: string): string | null {
    if (!address) return null;
    return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(`https://interligens.com/scan?addr=${address}`)}`;
  }
}
