# Chaîne de preuve V1 (CC-OFFLINE-54)

Chaîne de possession forensique pour les captures INTERLIGENS : hash → horodatage
RFC 3161 → stockage → manifeste vérifiable par un tiers, **hors ligne**.

## 1. Prérequis (une fois)

Appliquer la migration dans le **Neon SQL Editor** (ep-square-band) — jamais `prisma db push` :
```
MIGRATION_evidence_chain_v1.sql   # additif, idempotent, rejouable
```
Puis vérifier (voir requêtes en bas du fichier SQL).

### Variables d'environnement
| Var | Rôle |
|-----|------|
| `R2_ACCOUNT_ID`,`R2_ACCESS_KEY_ID`,`R2_SECRET_ACCESS_KEY`,`R2_ENDPOINT` | accès R2 |
| `R2_EVIDENCE_BUCKET_NAME` | bucket preuves dédié (sinon `R2_BUCKET_NAME`) |
| `TSA_URL_PRIMARY` / `TSA_CA_URL_PRIMARY` | TSA commerciale (P0). ⚠️ code-signing-scoped ; usage forensique garanti = payant/eIDAS |
| `TSA_URL_FALLBACK` / `TSA_CA_URL_FALLBACK` | TSA de repli (ex. `https://freetsa.org/tsr` + `.../files/cacert.pem`) |
| `TSA_COMMERCIAL_MIN_DELAY_MS` | anti-hammer avant la primaire (défaut 15000 ; Sectigo exige ≥15s) |

## 2. Ingérer une capture au fil de l'eau (zéro friction)
```
pnpm tsx src/scripts/evidence-chain/ingest-capture.ts <fichier> \
  --handle <kol> [--criticality P0|OTHER] [--source-type X_POST|EXPLORER|WEB_PAGE|TELEGRAM|REPO_ARTIFACT|OTHER] \
  [--casefile <id>] [--at <iso>] [--window 48] [--link-all]
```
Fait tout seul : SHA-256 (fichier intact) → dedup → EvidenceItem → copie R2
(content-addressed) → horodatage TSA (routage par criticité, chaîne de certif
archivée) → **propose les posts Watcher V2 candidats** (±window autour de la
capture) à valider. `--link-all` crée les `EvidenceLink` (X_API_RECORD).
Une capture peut porter **plusieurs** liens (3 posts sur 1 image = 3 liens).

## 3. Backfill des pièces existantes
```
pnpm tsx src/scripts/evidence-chain/backfill-evidence.ts            # dry-run (défaut)
pnpm tsx src/scripts/evidence-chain/backfill-evidence.ts --commit   # après migration
```
Cible `./evidence/**` + artefacts racine. `capturedAt` = **date du commit git
d'introduction** (seule date honnête ; documentée dans `notes`). `sourceUrl=null`.

## 4. Manifeste + vérification tierce (hors ligne)
Générer un manifeste par casefile (via `generateManifest`, embarque hash +
token TSA + **chaîne de certif** + liens + corroboration ; le manifeste est
lui-même hashé et horodatable). Vérifier avec, au choix, seulement le manifeste
et le dossier de fichiers — **aucun accès au système, aucun réseau** :
```
pnpm tsx src/scripts/evidence-chain/verify-manifest.ts <manifest.json> <dossierFichiers> [--no-tsa]
```
→ PASS/FAIL par pièce (exit 0 si tout PASS). La TSA est validée à partir de la
chaîne archivée dans le manifeste (openssl, sans réseau), donc vérifiable même
après expiration des certs.

## 5. Rétention — ⚠️ PAS du WORM
L'object lock R2 est indisponible sur ce compte (vérifié). Mode **dégradé** :
bucket dédié + clés content-addressed + (recommandé) token **write-only** côté
dashboard Cloudflare. `immutableStored=false`. Ne jamais présenter comme WORM.

## Modèle
`EvidenceItem` (1) → `EvidenceLink` (N, X_API_RECORD/ONCHAIN_TX/WALLET/MANUAL)
+ `EvidenceAccessLog` (INGEST/READ/EXPORT/LINK/VERIFY). Détails : `src/lib/evidence-chain/`.
