# LAB_REPORT — labs/metamask-snap-v2

## Fichiers créés
- packages/metamask-snap-v2/snap.manifest.json
- packages/metamask-snap-v2/package.json
- packages/metamask-snap-v2/src/index.ts
- packages/metamask-snap-v2/src/__tests__/snap.test.ts
- docs/METAMASK_SNAP_V2.md

## Tests
- onTransaction: 5 tests (no warnings for plain transfer, detects infinite approval, extracts spender, shows target contract, handles missing data)

## Ce qui manque pour être prêt
- Build webpack config
- Publication sur MetaMask Snap registry
- Score lookup en temps réel (nécessite un proxy Snap → API car les Snaps ont accès réseau limité)
- UI companion page pour activer/désactiver le snap

## Risques
- Pas de custody ni de signing : conforme aux règles INTERLIGENS
- Les Snaps ne peuvent pas faire de requêtes réseau arbitraires sans permission fetch explicite
- Le snap est en mode LAB — ne pas publier sur le registry sans audit de sécurité
