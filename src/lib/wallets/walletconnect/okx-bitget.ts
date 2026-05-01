// OKX + Bitget — WalletConnect only (no direct injection support)

export function okxWalletConnectDeeplink(wcUri: string): string {
  return `okex://main/wc?uri=${encodeURIComponent(wcUri)}`
}

export function bitgetWalletConnectDeeplink(wcUri: string): string {
  return `bitkeep://wc?uri=${encodeURIComponent(wcUri)}`
}

export function isOkxInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as Record<string, unknown>).okxwallet
}

export function isBitgetInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as Record<string, unknown>).bitkeep
}
