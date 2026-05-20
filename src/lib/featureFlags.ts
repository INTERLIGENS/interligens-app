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

// Admin-only / server-only feature flags.
// Deliberately NOT prefixed NEXT_PUBLIC_ — these must not leak into the client bundle.
// Default is false in every environment; enable locally with e.g.
// FEATURE_CASEFILE_ENGINE_V1=true pnpm dev
export const FEATURE_FLAGS = {
  CASEFILE_ENGINE_V1: process.env.FEATURE_CASEFILE_ENGINE_V1 === 'true',
  WIZARD_SANDBOX: process.env.FEATURE_WIZARD_SANDBOX === 'true',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}
