'use client'

export interface PhantomProvider {
  isPhantom: boolean
  publicKey: { toString(): string } | null
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
}

export function detectPhantom(): PhantomProvider | null {
  if (typeof window === 'undefined') return null
  const solana = (window as unknown as Record<string, unknown>).solana as PhantomProvider | undefined
  if (!solana?.isPhantom) return null
  return solana
}

export async function connectPhantom(): Promise<string> {
  const provider = detectPhantom()
  if (!provider) throw new Error('Phantom not installed')
  const resp = await provider.connect()
  return resp.publicKey.toString()
}

export async function disconnectPhantom(): Promise<void> {
  const provider = detectPhantom()
  if (!provider) return
  await provider.disconnect()
}
