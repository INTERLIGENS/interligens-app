// src/lib/wallet-connect/adapter.ts
// Stub adapter for WalletConnect — branchable to @walletconnect/web3modal later.

import type { WalletSession } from "./types";

export interface WalletConnectAdapterOptions {
  onConnect?: (session: WalletSession) => void;
  onDisconnect?: () => void;
}

export class WalletConnectAdapter {
  private session: WalletSession | null = null;
  private opts: WalletConnectAdapterOptions;

  constructor(opts: WalletConnectAdapterOptions = {}) {
    this.opts = opts;
  }

  async connect(address: string, chain: WalletSession["chain"]): Promise<WalletSession> {
    this.session = { address, chain, connectedAt: new Date() };
    this.opts.onConnect?.(this.session);
    return this.session;
  }

  disconnect(): void {
    this.session = null;
    this.opts.onDisconnect?.();
  }

  getSession(): WalletSession | null {
    return this.session;
  }

  isConnected(): boolean {
    return this.session !== null;
  }
}
