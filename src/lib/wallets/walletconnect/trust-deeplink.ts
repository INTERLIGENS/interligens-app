// Trust Wallet — WalletConnect + deeplink support

export function trustWalletConnectDeeplink(wcUri: string): string {
  return `trust://wc?uri=${encodeURIComponent(wcUri)}`
}

export function trustMobileDeeplink(address: string): string {
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(`https://interligens.com/scan/${address}`)}`
}

export function isTrustInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const eth = (window as unknown as Record<string, unknown>).ethereum as Record<string, unknown> | undefined
  return !!(eth?.isTrust)
}
