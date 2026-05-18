export const flags = {
  walletLab: process.env.NEXT_PUBLIC_ENABLE_WALLET_LAB === 'true',
  phantomGuardV2: process.env.NEXT_PUBLIC_ENABLE_PHANTOM_GUARD_V2 === 'true',
  metamaskSnapV2: process.env.NEXT_PUBLIC_ENABLE_METAMASK_SNAP_V2 === 'true',
  jupiterSafeSwapV2: process.env.NEXT_PUBLIC_ENABLE_JUPITER_SAFE_SWAP_V2 === 'true',
  walletConnectLab: process.env.NEXT_PUBLIC_ENABLE_WALLETCONNECT_LAB === 'true',
  cloudflareWeb3: process.env.NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB3_GATEWAY === 'true',
} as const

export function isLabEnabled(flag: keyof typeof flags): boolean {
  return flags[flag]
}
