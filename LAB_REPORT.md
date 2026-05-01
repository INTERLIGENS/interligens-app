# LAB_REPORT — labs/phantom-guard-v2

## Fichiers créés
- src/lib/wallets/phantom-guard/connect.ts
- src/lib/wallets/phantom-guard/scan.ts
- src/lib/wallets/phantom-guard/preflight.ts
- src/lib/wallets/phantom-guard/deeplink.ts
- src/lib/wallets/phantom-guard/__tests__/deeplink.test.ts
- src/app/labs/wallets/phantom/page.tsx

## Tests
- deeplink: 5 tests

## Ce qui manque pour être prêt
- Tests de connect/disconnect (nécessitent mock de window.solana)
- Tests de scan (nécessitent mock de /api/v1/score)
- Preflight avant signature (hook usePhantomPreflight intégré dans le flow de sign)
- Gate basé sur la feature flag côté serveur

## Risques
- detectPhantom() retourne null en SSR — protégé par typeof window check
- Page gated par isLabEnabled('phantomGuardV2') — si flag OFF, redirect /
- Aucun custody, aucun signing par INTERLIGENS
