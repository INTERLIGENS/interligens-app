# LAB_REPORT — labs/wallet-integration-core

## Fichiers créés
- src/lib/featureFlags.ts (main)
- src/lib/wallets/types.ts
- src/lib/wallets/registry.ts
- src/lib/wallets/chain-normalizer.ts
- src/lib/wallets/signature-parser.ts
- src/lib/wallets/risk-preflight.ts
- src/lib/wallets/adapters/phantom.ts
- src/lib/wallets/adapters/metamask.ts
- src/lib/wallets/adapters/walletconnect.ts
- src/lib/wallets/adapters/coinbase.ts
- src/lib/wallets/adapters/rabby.ts
- src/lib/wallets/adapters/solflare.ts
- src/lib/wallets/adapters/trust.ts
- src/lib/wallets/adapters/brave.ts
- src/lib/wallets/adapters/ledger.ts
- src/lib/wallets/__tests__/registry.test.ts
- src/lib/wallets/__tests__/chain-normalizer.test.ts
- src/lib/wallets/__tests__/signature-parser.test.ts

## Tests
- registry: 4 tests
- chain-normalizer: 5 tests
- signature-parser: 7 tests
- Total: 16 tests

## Ce qui manque pour être prêt
- Implémentations réelles des adapters connect/disconnect
- Intégration avec @solana/wallet-adapter pour SOL
- Intégration avec wagmi/viem pour EVM
- Tests E2E avec extensions de navigateur

## Risques
- Les adapters utilisent window.* — SSR doit être géré (isInstalled guard)
- risk-preflight dépend de /api/v1/score — si l'API change, le preflight échoue silencieusement
- Feature flag OFF retourne allow:true par défaut — sûr pour prod mais pas de protection
