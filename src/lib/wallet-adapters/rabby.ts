import type { WalletAdapter, Chain } from "./types";

export class RabbyAdapter implements WalletAdapter {
  readonly name = "Rabby";
  readonly icon = "https://rabby.io/assets/images/logo.svg";
  readonly supportedChains: Chain[] = ["ethereum", "base", "arbitrum", "bsc"];

  isInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return !!(window as unknown as { ethereum?: { isRabby?: boolean } }).ethereum?.isRabby;
  }

  async connect(): Promise<string> {
    throw new Error("RabbyAdapter.connect: not implemented");
  }

  async disconnect(): Promise<void> {
    throw new Error("RabbyAdapter.disconnect: not implemented");
  }

  deeplink(address: string): string | null {
    if (!address) return null;
    return `rabby://send?to=${address}`;
  }
}
