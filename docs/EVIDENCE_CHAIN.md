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
`EvidenceItem` (1) → `EvidenceLink` (N, X_API_RECORD/ONCHAIN_TX/WALLET/MANUAL/ARCHIVE_MEMBER)
+ `EvidenceAccessLog` (INGEST/READ/EXPORT/LINK/VERIFY). Détails : `src/lib/evidence-chain/`.

## 6. Horodatage rétroactif vs au fil de l'eau — ⚠️ PRINCIPE
Un token TSA prouve que **le hash existait à la date de stamping**, PAS que la
capture a eu lieu à `capturedAt`. Ces deux dates sont distinctes.
- Pièce capturée au fil de l'eau (`ingest-capture`) : `timestampMode="at-capture"`.
- Pièce **migrée** (`migrate-snapshots`) : notes marquées `[TIMESTAMP:RETROACTIVE]`,
  `capturedBy="legacy:evidence-snapshot"`, `capturedAt` = `observedAt` **déclarative
  (non prouvée)**. Le manifeste expose `timestampMode="retroactive"` par pièce +
  un `disclaimer`. Ne jamais présenter une pièce rétroactive comme équivalente à
  une capture horodatée au fil de l'eau.

## 7. Réconciliation EvidenceSnapshot → EvidenceItem (CC-OFFLINE-55)
```
pnpm tsx src/scripts/evidence-chain/audit-snapshots.ts        # Phase 1 (read-only) → docs/EVIDENCE_RECONCILIATION_AUDIT.md
pnpm tsx src/scripts/evidence-chain/migrate-snapshots.ts      # Phase 2 dry-run (défaut)
pnpm tsx src/scripts/evidence-chain/migrate-snapshots.ts --commit [--limit N] [--throttle-ms M]
pnpm tsx src/scripts/evidence-chain/migrate-snapshots.ts --stamp-pending [--throttle-ms M]   # reprise TSA
pnpm tsx src/scripts/evidence-chain/migrate-snapshots.ts --test-stamp 5                       # test (sans écriture)
```
ADDITIF : ne touche jamais `EvidenceSnapshot` (source). Catégories : A migrable,
C hashable, **B quarantaine (hash divergent, non migré)**, D absente. Dedup par
sha256 (pièce déjà en base → lien MANUAL seul). Lien MANUAL `externalId` = id
EvidenceSnapshot source (traçabilité). Idempotent/reprenable. `--stamp-pending`
rejoue les pièces `tsaToken NULL`. ~23 min estimées pour 925 (throttle 1s).

## 8. Provenance + câblage des flux live (CC-OFFLINE-56)
Colonnes additives (`MIGRATION_evidence_provenance_v1.sql`, appliquée 2026-08-13) :
`provenanceType` (`FIRST_PARTY_CAPTURE`|`THIRD_PARTY_SUBMISSION`|`MIGRATED_BACKFILL`),
`submittedBy` (ipHash retail), `timestampMode` (+ `at-ingestion` : la TSA prouve la
**réception**, pas la capture). Règles (`ingest.ts`, throw) : `capturedBy="unattributed"`
UNIQUEMENT si THIRD_PARTY_SUBMISSION ; THIRD_PARTY_SUBMISSION exige `submittedBy`.
**Les 1070 pièces pré-provenance restent NULL (jamais réécrites — Option A)** ; le
manifeste (v2) dérive `MIGRATED_BACKFILL` + `timestampMode` du marqueur notes.
Les manifestes v1 déjà émis restent vérifiables (shim disclaimer dans `verifyManifest`).

Flux câblés — la pièce naît À LA RÉCEPTION, jamais au traitement :
- **Retail** `POST /api/osint/submit` : EvidenceItem dès réception des bytes acceptés,
  AVANT vision (`evidenceChainBridge.ts`). Échec chaîne = non bloquant pour la soumission.
- **Opérateur** `POST /api/admin/osint/commit` : `imagesBase64` optionnel — sha256
  recalculé serveur DOIT matcher le plan AVANT toute écriture (mismatch = 422, zéro
  pièce) ; fallback hash-only si bytes absents (`evidenceCommitBridge.ts`).
- **Watcher** `run-auto-evidence.ts` : artefact JSON canonique du candidate
  (`stableStringify`) → EvidenceItem + liens X_API_RECORD/MANUAL.

TSA en serverless : JAMAIS en requête (openssl non garanti + latence) — les pièces
naissent `tsaToken NULL` et sont rattrapées par :
```
pnpm tsx src/scripts/evidence-chain/stamp-pending.ts [--dry-run] [--limit N] [--throttle-ms M]
```
launchd quotidien Host-001 (08:30) : `src/scripts/evidence-chain/com.interligens.evidence-stamp.plist`
(⚠️ PATH homebrew : le LibreSSL d'Apple n'a pas `openssl ts`). Le watchdog de 09:00
rapporte « TSA pending: N » sur Telegram (warn ≥ WATCHDOG_TSA_PENDING_WARN, déf 50).
Opt-in TSA en requête : `EVIDENCE_TSA_INROUTE="true"` (retries 0, jamais bloquant).
