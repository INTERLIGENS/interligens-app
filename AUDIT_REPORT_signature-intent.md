# AUDIT REPORT — Module 5/6 Signature Intent Scanner

## MODÈLE UTILISÉ
Sonnet 4.6 : OUI

## FIX P0 MM supprimé : OUI
`src/components/scan/MMScoreBadge.tsx` — when `verdict === "CLEAN"` and `!result.fallback`, now returns `null` (silence total).
La phrase "No market-manipulation signals detected" n'est plus rendue.

## STATUT GLOBAL
GREEN

## FICHIERS CRÉÉS
- `src/lib/signature-intent/analyzer.ts`
- `src/components/scan/SignatureIntentBanner.tsx`
- `src/app/en/signature-check/page.tsx`
- `src/app/api/v1/signature-intent/route.ts`
- `tests/lib/signature-intent/analyzer.test.ts`

## FICHIERS MODIFIÉS
- `src/components/scan/MMScoreBadge.tsx`
  - Fix P0 : CLEAN verdict sans fallback → return null (silence)

## TESTS
- Baseline : 1119
- Total après : 1127
- Nouveaux : 8 (approve MAX × 1, approve limited × 1, permit × 1, setApprovalForAll × 1, transferFrom × 1, multicall hidden approve × 1, Solana setAuthority × 1, unknown × 1)
- Tous green : OUI

## TSC EXIT CODE
0

## BUILD LOCAL
OK — Compiled 5.0s, 239 pages, 0 erreur.

## PATTERNS DÉTECTÉS

| Selector     | Method                  | risk_level | intent_type              |
|-------------|------------------------|-----------|--------------------------|
| 0x095ea7b3  | approve(address,uint256) | CRITICAL si MAX_UINT256, MEDIUM sinon | UNLIMITED_APPROVAL / APPROVE |
| 0xd505accf  | permit(EIP-2612)         | HIGH      | PERMIT                   |
| 0xa22cb465  | setApprovalForAll        | CRITICAL  | SET_APPROVAL_FOR_ALL     |
| 0x23b872dd  | transferFrom             | LOW       | TRANSFER_FROM            |
| 0xac9650d8  | multicall(bytes[])       | HIGH si approve caché, MEDIUM sinon | MULTICALL_WITH_APPROVAL |
| 0x5ae401dc  | multicall(uint256,bytes[]) | idem    | (Uniswap V3 variant)    |
| decoded_data: setAuthority (Solana) | CRITICAL | SET_AUTHORITY |
| decoded_data: approve (Solana) | HIGH | APPROVE |
| inconnu | any | MEDIUM | UNKNOWN |

## DEPS REQUESTED
Aucune — décodage EVM en pur pattern matching (4 bytes selector), pas de `ethers` / `viem` requis.

## BLOCKERS
Aucun.

## DÉCISIONS AUTONOMES NON TRIVIALES
1. **Pas d'ethers/viem** : le décodage EVM utilise du pur string slicing sur le calldata hex. Suffisant pour tous les patterns V0 ciblés.
2. **MAX_UINT256 detection** : `"f".repeat(64)` comparé au slot uint256 directement — pas de conversion BigInt (évite overflow sur certains moteurs).
3. **Multicall hidden approve** : `data.toLowerCase().includes(SEL_APPROVE)` — pattern match simple mais efficace pour détecter une approbation encodée dans les sous-appels.
4. **Solana raw_tx** : décodage heuristique limité en v0. La détection fiable passe par `decoded_data`. Noté dans le rapport et dans les red_flags.
5. **SignatureIntentBanner** : return null pour LOW et SAFE — silence pour les transactions saines, pas de bruit inutile.
6. **Page /en/signature-check uniquement** : le spec ne demandait que EN. Pas de page FR créée.

## PROCHAINE ÉTAPE
Attente OK humain pour merger feat/signature-intent sur main.
