# AUDIT REPORT — Module 6/6 Destination Risk

## MODÈLE UTILISÉ
Sonnet 4.6 : OUI

## STATUT GLOBAL
GREEN

## FICHIERS CRÉÉS
- `src/lib/destination-risk/checker.ts`
- `src/components/scan/DestinationRiskBanner.tsx`
- `src/app/en/destination-check/page.tsx`
- `src/app/api/v1/destination-risk/route.ts`
- `tests/lib/destination-risk/checker.test.ts`

## FICHIERS MODIFIÉS
Aucun.

## TESTS
- Baseline : 1127
- Total après : 1133
- Nouveaux : 6 (KNOWN_SCAMMER × 1, TigerScore > 70 × 1, fresh wallet × 1, clean × 1, OFAC × 1, mixer + flags × 1)
- Tous green : OUI

## TSC EXIT CODE
0

## BUILD LOCAL
OK — Compiled 5.2s, 240 pages, 0 erreur.

## FLAGS IMPLÉMENTÉS

| FlagType       | Triggered by                              | risk_level |
|---------------|------------------------------------------|-----------|
| KNOWN_SCAMMER  | category ∈ {scammer, drainer, phishing, exploiter} | CRITICAL |
| MIXER          | category ∈ {mixer, tornado, tornado_adjacent} | CRITICAL |
| BLACKLIST      | category ∈ {ofac, amf, sanctioned, blacklist} | CRITICAL |
| CEX_FLAGGED    | category = cex                            | HIGH      |
| INTEL_MATCH    | vault severity high/critical (no label match) | HIGH/CRITICAL |
| FRESH_WALLET   | < 7 days, < 50 txs (SOL via Helius) or first tx < 7j (EVM via Etherscan) | MEDIUM |

## INTEL VAULT BRANCHÉ : OUI
- `lookupAddress()` — WalletLabel table, exact address match
- `vaultLookup()` — AddressLabel + RiskSummaryCache, chain+address
- Tous deux injectables pour les tests (injectable `_lookupFn` / `_vaultFn`)

## TIGERSCORE INTÉGRÉ : OUI
- `computeTigerScore()` appelé avec `evm_known_bad: true` si severity ≥ high
- Score > 70 → risk_level HIGH (test 2 vérifié: score = 100 > 70)

## FRESH WALLET DETECTION
- Solana: Helius `getSignaturesForAddress` limit 50, si count < 50 ET oldest.blockTime < 7j
- EVM: Etherscan `txlist?sort=asc&offset=1` premier tx < 7j
- Skip si risk déjà ≥ HIGH (pas de downgrade)

## DEPS REQUESTED
Aucune nouvelle. Réutilise `@/lib/tigerscore/engine`, `@/lib/labels/lookup`, `@/lib/intel-vault/scan-lookup`.

## BLOCKERS
Aucun.

## DÉCISIONS AUTONOMES NON TRIVIALES
1. **Injectable deps pattern** : `_lookupFn`, `_vaultFn`, `_fetchFn` injectés pour éviter Prisma dans les tests. Dynamic imports en production.
2. **maxRisk accumulation** : les flags s'accumulent — un KNOWN_SCAMMER + FRESH_WALLET donne CRITICAL (pas de downgrade). `maxRisk(a, b)` assure que le niveau reste le plus haut.
3. **TigerScore seulement si vault match** : le TigerScore est calculé uniquement si `vaultLookup` retourne un match, pas à chaque appel (trop coûteux). En v0, c'est un pure function call (pas de RPC).
4. **Pas de page FR** : le spec ne demandait que `/en/destination-check`. Cohérent avec Module 5.
5. **Fresh wallet skip si déjà HIGH+** : évite un appel réseau inutile si Intel Vault a déjà flaggé l'adresse.

## PROCHAINE ÉTAPE
Attente OK humain pour merger feat/destination-risk sur main.
