import type { WalletAdapter, Chain } from "./types";

export class TrustWalletAdapter implements WalletAdapter {
  readonly name = "Trust Wallet";
  readonly icon = "https://trustwallet.com/assets/images/media/assets/TWT.png";
  readonly supportedChains: Chain[] = ["ethereum", "base", "arbitrum", "bsc", "solana", "tron"];

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    const eth = (window as unknown as { ethereum?: { isTrust?: boolean; isTrustWallet?: boolean } }).ethereum;
    return !!(eth?.isTrust || eth?.isTrustWallet);
  }

  async connect(): Promise<string> {
    throw new Error("TrustWalletAdapter.connect: not implemented");
  }

  async disconnect(): Promise<void> {
    throw new Error("TrustWalletAdapter.disconnect: not implemented");
  }

  deeplink(address: string): string | null {
    if (!address) return null;
    return `trust://send?address=${address}`;
  }
}
