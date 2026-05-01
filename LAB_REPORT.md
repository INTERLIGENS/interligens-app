# LAB_REPORT — labs/solana-wallets-v1

## Fichiers créés
- src/lib/wallets/solana/types.ts
- src/lib/wallets/solana/phantom-adapter.ts
- src/lib/wallets/solana/solflare-adapter.ts
- src/lib/wallets/solana/backpack-adapter.ts
- src/lib/wallets/solana/registry.ts
- src/app/labs/wallets/solana/page.tsx
- src/lib/wallets/solana/__tests__/registry.test.ts

## Wallets supportés
- Phantom: adapter complet (window.solana)
- Solflare: adapter complet (window.solflare)
- Backpack: placeholder adapter (window.xnft.solana)

## Tests
- registry: 5 tests (wallet list, getByName, null case, structure, no install in test env)

## Ce qui manque pour être prêt
- Intégration @solana/wallet-adapter (si disponible)
- Tests de connect/disconnect avec mock de window providers
- Scan address + preflight avant signature
- Support multi-accounts

## Risques
- Page gated par isLabEnabled('walletLab') — OFF par défaut
- Aucun custody, aucun signing par INTERLIGENS
- Backpack provider path (window.xnft.solana) peut varier selon version
