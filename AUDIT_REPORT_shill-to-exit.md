# AUDIT REPORT — Module 2/6 Shill-to-Exit Detector

## MODÈLE UTILISÉ
Sonnet 4.6 : OUI

## STATUT GLOBAL
GREEN

## FICHIERS CRÉÉS
- `src/lib/shill-to-exit/engine.ts`
- `src/components/kol/ShillToExitTimeline.tsx`
- `src/app/api/v1/shill-to-exit/route.ts`
- `tests/lib/shill-to-exit/engine.test.ts`

## FICHIERS MODIFIÉS
- `src/app/en/kol/[handle]/page.tsx`
  - ligne 6 : import ShillToExitTimeline
  - ligne 8 : import ShillToExitResult type
  - ligne 108 : state `shillResult`
  - lignes 134-136 : fetch `/api/v1/shill-to-exit`
  - ligne 425 : rendu `<ShillToExitTimeline>` après ProceedsCard

- `src/app/fr/kol/[handle]/page.tsx`
  - ligne 5 : import ShillToExitTimeline
  - ligne 7 : import ShillToExitResult type
  - ligne 109 : state `shillResult`
  - lignes 138-141 : fetch `/api/v1/shill-to-exit`
  - ligne 432 : rendu `<ShillToExitTimeline>` après ProceedsCard

## TESTS
- Baseline : 1098 (134 fichiers)
- Total après : 1105 (135 fichiers)
- Nouveaux ajoutés : 7 (buildShillToExitResult × 7)
- Tous green : OUI

## TSC EXIT CODE
0

## BUILD LOCAL
OK — Compiled 4.7s, 236 pages, 0 erreur/warning.

## DONNÉES KOL TROUVÉES EN DB
Schéma disponible pour l'engine :
- `KolEvidence` : twitterPost, postTimestamp, deltaMinutes, amountUsd, sampleTx, token
- `KolProceedsEvent` : sell/cex_deposit events avec tokenAddress, txHash, amountUsd
- `SocialPostCandidate` : detectedTokens[], postedAtUtc, postUrl (utilisé par detector.ts)
- `LaundryTrail` : walletAddress, trailType, laundryRisk (enrichissement)

KOLs avec données exploitables (d'après les seeds et data existants) :
- **GordonGekko** : 8 wallets Arkham SOL + $40,627 BINANCE cashout documenté
- **bkokoski** : ETH address + Friend.tech wallet
- **planted** : handle watcher high priority

L'engine.ts wrappe `detectShillToExit()` (detector.ts V1 déjà complet) et produit `ShillToExitResult` avec timeline structurée.

## TIMELINE EXEMPLE
```
T+0h    📢 SHILL   · Promoted $SCAM
T+12h   💸 SELL    · $40K sold · 12h after shill   [0xtx12…]
```
Confidence : HIGH (delta < 24h)

## DEPS REQUESTED
Aucune.

## BLOCKERS
Aucun.

## DÉCISIONS AUTONOMES NON TRIVIALES
1. **engine.ts wrappe detector.ts** au lieu de dupliquer la logique DB. `detectShillToExit()` est déjà en production — l'engine est une couche d'adaptation propre et testable sans Prisma.
2. **Tests sur `buildShillToExitResult` (pur)** au lieu de mocker Prisma. La fonction pure est testable directement avec des fixtures `ShillToExitSignal[]`.
3. **7 tests** au lieu de 6 minimum : le test 7 (tokenMint filter) couvre un cas de filtrage non trivial.
4. **`ShillToExitTimeline` (props `result`)** intégré via fetch dans les KOL pages — pattern identique à `mmResult`/`clusterResult` des demo pages.
5. **Pas de RetailCounter ni followers** dans le composant — uniquement les données forensics.

## PROCHAINE ÉTAPE
Attente OK humain pour merger feat/shill-to-exit sur main.
