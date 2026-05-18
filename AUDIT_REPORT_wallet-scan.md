# AUDIT REPORT — Module 4/6 Wallet Scan

## MODÈLE UTILISÉ
Sonnet 4.6 : OUI

## STATUT GLOBAL
GREEN

## FICHIERS CRÉÉS
- `src/lib/wallet-scan/engine.ts`
- `src/app/api/v1/wallet-scan/route.ts`
- `src/app/en/wallet-scan/page.tsx`
- `src/app/fr/wallet-scan/page.tsx`
- `tests/lib/wallet-scan/engine.test.ts`

## FICHIERS MODIFIÉS
- `src/components/beta/BetaNav.tsx`
  - Slug union étendu : ajout de `"wallet-scan"`
  - Nouveau NavItem entre Explorer et Investigators : `{ slug: "wallet-scan", label: { en: "Wallet Scan", fr: "Scan Wallet" }, match: ["/en/wallet-scan", "/fr/wallet-scan"] }`

## TESTS
- Baseline : 1113 (136 fichiers)
- Total après : 1119 (137 fichiers)
- Nouveaux : 6 (scoreRisk ×3, computeTopRiskLevel ×1, computeWalletScan ×2)
- Tous green : OUI

## TSC EXIT CODE
0

## BUILD LOCAL
OK — Compiled 4.8s, 238 pages, 0 erreur.

## ARCHITECTURE ENGINE

### Interfaces publiques
- `WalletChain` : "solana" | "ethereum" | "base" | "arbitrum"
- `RiskLevel` : "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"
- `WalletScanInput` : `{ address, chain, _fetchFn? }`
- `TokenHolding` : `{ mint, symbol, name, balanceFormatted, balanceUsd, riskLevel, explorerUrl }`
- `WalletScanResult` : `{ address, chain, tokenCount, tokens[], topRiskLevel, revokeRecommended, computed_at, error? }`

### Fonctions exportées
- `scoreRisk(symbol, name, balanceUsd)` — pure, heuristique: KNOWN_SAFE → LOW, SCAM_PATTERN → CRITICAL, empty → UNKNOWN, other → MEDIUM
- `computeTopRiskLevel(tokens[])` — pure, retourne le niveau le plus élevé
- `computeWalletScan(input)` — async, dispatch Solana ou EVM

### Sources de données
- **Solana** : Helius DAS `getAssetsByOwner` — `POST https://mainnet.helius-rpc.com/?api-key=KEY`, limit 10, showFungible: true, timeout 12s
- **EVM** : Etherscan-compatible `tokenlist` — GET `{api}.etherscan.io / basescan.org / arbiscan.io`, apikey `ETHERSCAN_API_KEY`, timeout 12s

### revokeRecommended
- `true` uniquement sur chain EVM ET topRiskLevel CRITICAL ou HIGH
- Pointe vers revoke.cash dans le banner UI
- Note : vérification des approbations on-chain non implémentée en v1 (nécessite scan des logs Approval ERC-20)

## DÉCISIONS AUTONOMES NON TRIVIALES
1. **Injectable `_fetchFn`** : même pattern que freshness/engine.ts pour les tests sans vrais appels réseau.
2. **KNOWN_SAFE list** : 30 tokens hardcodés couvrant les majeurs SOL/EVM. Pas de requête externe pour validation.
3. **revokeRecommended = false sur Solana** : les approvals Solana (delegations) sont hors scope v1.
4. **Pas de TigerScore par token** : trop lent (10 appels API). Heuristique locale suffisante pour quick scan. Note visible dans le footer de la page.
5. **Etherscan tokenlist sans USD** : l'endpoint tokenlist n'inclut pas les prix. `balanceUsd: null` pour EVM.

## PROCHAINE ÉTAPE
Attente OK humain pour merger feat/wallet-scan sur main.
