export type Chain = "ethereum" | "base" | "arbitrum" | "solana" | "bsc" | "tron";

export interface WalletAdapter {
  name: string;
  icon: string;
  supportedChains: Chain[];
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  isInstalled(): boolean;
  deeplink(address: string): string | null;
}
