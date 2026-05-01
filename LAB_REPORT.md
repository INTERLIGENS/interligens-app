# LAB_REPORT — labs/jupiter-safe-swap-v2

## Fichiers créés
- src/app/labs/safe-swap/jupiter/page.tsx
- src/app/labs/safe-swap/jupiter/__tests__/verdict.test.ts

## Flow implémenté
1. Connect wallet (Phantom/window.solana)
2. Enter token address
3. INTERLIGENS scan via /api/v1/score
4. Verdict: GREEN=allow, ORANGE=warning+confirm, RED=block+override, BLACK=no route
5. Jupiter route opened uniquement après verdict favorable
6. Preflight log affiché en bas de page

## Tests
- scoreToVerdict: 5 tests (GREEN/ORANGE/RED/BLACK/OFAC)

## Ce qui manque pour être prêt
- Intégration @solana/wallet-adapter pour support multi-wallets
- Jupiter SDK pour routing in-app (plutôt que redirect)
- Tests E2E avec mock de /api/v1/score
- Affichage du quote Jupiter avant confirmation

## Risques
- Page gated par isLabEnabled('jupiterSafeSwapV2') — OFF par défaut
- Aucun custody, aucun signing par INTERLIGENS
- Override RED possible par l'utilisateur — conforme (avertissement affiché)
- BLACK (OFAC) = no route = zero override possible
