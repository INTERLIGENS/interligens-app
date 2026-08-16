# P0 — CONTAINMENT DES PROCEEDS · DOSSIER STOP 1

**Date :** 2026-08-16 · **Machine :** Host-001 · **Mode :** lecture seule, aucune ligne de retrait écrite
**Objet :** établir le mécanisme de containment et le périmètre exact, pour validation avant action.

---

## 1. Vérification de la prémisse de l'arbitrage

> L'arbitrage dit : « utiliser le chemin de dépublication déjà construit ».

**PRÉMISSE FAUSSE — confirmée.**

Le chemin livré le 2026-08-16 (`archiveLinkPublication` + `KolTokenLinkStatusLog`) est **structurellement incapable** de porter un retrait de proceeds. Preuve par le schéma de la table du journal, lu en production :

```
KolTokenLinkStatusLog :
  id, linkId, kolHandle, tokenSymbol, canonicalMint,
  fromVisibility, toVisibility, fromReviewStatus, toReviewStatus,
  reasonCode, reason, actorId, createdAt, contestationRef
```

La clé métier est **`linkId`**, un identifiant de `KolTokenLink` — une association *personne ↔ token*. Les colonnes d'état sont `fromVisibility`/`toVisibility`, qui décrivent la visibilité **d'un lien**. Il n'existe aucune colonne capable d'exprimer « le montant publié pour ce handle est retiré », ni de porter la valeur retirée.

Les proceeds vivent dans quatre emplacements sans aucun rapport avec `KolTokenLink` :

| Emplacement | Rôle | Volume |
|---|---|---|
| `KolProfile.totalDocumented` | **le chiffre effectivement publié** sur presque toutes les surfaces | 26 profils > 0 |
| `KolProceedsSummary.totalProceedsUsd` | total du dernier scan on-chain seul | 28 lignes |
| `KolProceedsEvent` | les événements unitaires (dont les 6 lignes CSV Arkham) | 5 602 lignes |
| `KolTokenInvolvement.proceedsUsd` | agrégat gelé depuis 2026-04-11 | 15 lignes |

`archiveLinkPublication` ne lit et n'écrit aucun de ces quatre emplacements.

**Ce qui est réutilisable, en revanche, c'est le *motif* du journal** : append-only, `reasonCode` contraint, `actorId`, `contestationRef`, aucune écriture destructive. Les codes existants incluent déjà exactement les deux que l'arbitrage demande — `erratum` et `evidence_withdrawn` (`src/lib/watcher-bridge/linkPublicationJournal.ts:33-42`). La proposition du §5 est une transposition de ce motif, pas une invention.

---

## 2. Inventaire exhaustif des surfaces qui publient un chiffre de proceeds

Établi par lecture du code **et** par capture des réponses de production le 2026-08-16.

### 2.1 Surfaces API — mesurées en production

| # | Surface | Champ publié | Source de lecture | Filtre de publication | Accès |
|---|---|---|---|---|---|
| 1 | `GET /api/kol/{handle}/proceeds` | `totalProceedsUsd` | **`KolProfile.totalDocumented`** | `reviewStatus='published'` sur le résumé — mais le **total rendu vient du profil, non filtré** | cookie beta |
| 2 | `GET /api/watchlist` | `totalProceeds` | `KolProfile.totalDocumented` | **aucun** (le profil est chargé sans `PUBLIC_KOL_FILTER`) | cookie beta |
| 3 | `GET /api/watchlist` | `cashout.total` | `KolTokenInvolvement` | **aucun** | cookie beta |
| 4 | `GET /api/watchlist/signals/{id}` | `totalProceeds` | `KolProfile.totalDocumented` | — | cookie beta |
| 5 | `GET /api/kol` | `totalDocumented` | `canonical.ts` → profil | `PUBLIC_KOL_FILTER` | cookie beta |
| 6 | `GET /api/kol/leaderboard` | `observedProceedsTotal`, `totalObservedProceeds` | profil | `PUBLIC_KOL_FILTER` | cookie beta |
| 7 | `GET /api/explorer` | `proceedsObservedTotal` par dossier, `minimumObservedProceeds` | somme de `totalDocumented` | profils publiés | cookie beta |
| 8 | `GET /api/v1/kol` | `totalProceedsUsd` | **`KolProceedsSummary`** | **AUCUN** — `SELECT … FROM "KolProceedsSummary"` sans `WHERE` | cookie beta / partenaire |
| 9 | `GET /api/v1/kol/{handle}` | `totalDocumented` | profil | `PUBLIC_KOL_FILTER` | cookie beta / partenaire |
| 10 | `POST /api/scan/ask` | `proceedsSummary` en **prose générée par LLM** (« Min. $580K observed — partial coverage ») | `groundingContext.ts` → profil | `PUBLIC_KOL_FILTER` | **🔴 ANONYME** (sonde : POST corps vide → `400 missing_fields`, pas 401) |
| 11 | `GET /api/scan/grounding` | `proceedsSummary` | idem | idem | cookie beta |
| 12 | `POST /api/mobile/v1/ask` | idem | idem | idem | jeton mobile |
| 13 | `POST /api/mobile/v1/scan` | `kolSnapshot.totalDocumented` | profil | — | jeton mobile |
| 14 | `POST /api/v1/narrative` | montant intégré au texte narratif | entrée appelant | — | cookie beta |
| 15 | `POST /api/investigators/cases/{id}/entities/enrich` | `totalUSD` injecté dans une entité de dossier | résumé puis profil | — | session vault (DB) |
| 16 | `buildCaseIntelligencePack` (vault) | `totalUSD` | profil / résumé | — | session vault (DB) |
| 17 | `GET /api/admin/ops`, `/api/admin/kol/{h}/proceeds/status` | `totalDocumented`, `totalProceedsUsd` | les deux | — | admin |

### 2.2 Écrans

| Écran | Affichage | Source |
|---|---|---|
| `/en/kol/{handle}`, `/fr/kol/{handle}` | `PROCEEDS: $X` / `PRODUITS : $X` | `totalDocumented` |
| `components/kol/ProceedsCard.tsx` | le grand nombre jaune + ventilation | `/api/kol/{h}/proceeds` |
| `/en/investigator` | `totalProceedsUsd` | résumé |
| `/admin/ops`, `/admin/pdf` | tableaux de suivi | profil |
| `components/explorer/IntelligenceOverview` | agrégats | leaderboard |

### 2.3 Documents produits — **le point dur**

| Artefact | Contient | Persistance | Accès |
|---|---|---|---|
| **PDF R2 `reports/GordonGekko/CASE_*.pdf`** | « CASHOUTS DOCUMENTÉS **$580K** », « TOTAL **$579 645** », mention **« CONFIDENTIEL — usage judiciaire »** | **31 objets figés**, 2026-07-18 → 2026-08-16, jamais écrasés | identifiants R2 uniquement |
| `reports/{handle}/latest.pdf` | idem, version courante | écrasé à chaque génération | `GET /api/pdf/{handle}` — admin **ou session investigateur validée en base** (401 avec cookie forgé) |
| `GET /api/pdf/kol?handle=` | dossier à la demande, somme `KolProceedsEvent` **sans filtre `ambiguous`** | aucune | admin |
| `POST /api/admin/plainte/generate` preset `botify` | **40 627 $** (`certitude: ETABLI`) et **604 489 $** (`statut: CONSTATE`) | **aucune** — littéraux dans `src/lib/plainte/data.ts` | admin |
| `GET /api/casefile/public` | **aucun montant** — exclusion explicite dans le générateur | à la demande | cookie beta |
| `CaseExport` POLICE_ANNEX_PDF | **aucun montant** — le générateur ne rend que des IOC | 1 ligne tracée | session vault |

> Détail complet des documents : `docs/AUDIT_BOTIFY_PROCEEDS_2026-08.md`.

---

## 3. Mécanismes de retrait réellement existants

| Emplacement | Mécanisme | Verdict |
|---|---|---|
| `KolProfile.totalDocumented` | **aucun** — ni drapeau, ni statut, ni filtre. Seuls leviers : passer le profil en `draft` (dépublie **tout** le profil, non outillé, effet de bord massif) ou écrire `NULL` (destructif, silencieux, non tracé — **interdit par la doctrine**) | 🔴 **INEXISTANT** |
| `KolProceedsSummary.reviewStatus` | **vrai interrupteur**, mais respecté par **1 consommateur sur 3** : `/api/kol/{h}/proceeds` le filtre ; `/api/v1/kol` et l'enrichissement vault l'ignorent | 🟠 **PARTIEL** |
| `KolProfile.proceedsStatus` | colonne existante (`none` 404, `verified` 3, `partial` 3, `pending_verification` 1) — **lue par un seul fichier, `/api/admin/kol-review`**. Aucun pouvoir de gate | 🔴 **INERTE** |
| `KolProceedsEvent` | aucune colonne de statut de publication (`ambiguous` sert au calcul, pas à la publication) | 🔴 **INEXISTANT** |
| `KolTokenInvolvement.proceedsUsd` | aucun | 🔴 **INEXISTANT** |
| PDF archivés en R2 | aucun — objets immuables ; le seul retrait possible serait une suppression, **interdite** | 🔴 **INEXISTANT** |
| `plainte/data.ts` | littéraux en dur : seul un changement de code les retire | 🔴 **INEXISTANT** |

**Conclusion : il n'existe aucun mécanisme de containment pour les proceeds.** Il faut en créer un.

---

## 4. Périmètre exact — les proceeds publics, et leur adossement à des observations primaires

Requête d'agrégation sur `KolProfile` × `KolProceedsEvent`, production, 2026-08-16.
Critère d'observation primaire retenu : **événement on-chain avec une signature de transaction Solana référençable**, hors `eventType = 'SUMMARY_ARKHAM'` et hors `ambiguous = true`.

| # | Handle | Publié (`totalDocumented`) | Observation primaire | Import CSV Arkham | Tx on-chain | Part non primaire | Décision proposée |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | **OrbitApe** | 817 000 $ | **0 $** | 817 000 $ | **0** | **100 %** | 🔴 retrait — `evidence_withdrawn` |
| 2 | **GordonGekko** | 579 645 $ | 94 645 $ | 485 000 $ | 126 | **83,7 %** | 🔴 retrait — `evidence_withdrawn` |
| 3 | **James** | 380 000 $ | **0 $** | 380 000 $ | **0** | **100 %** | 🔴 retrait — `evidence_withdrawn` |
| 4 | **bkokoski** | 210 900 $ | 900 $ | 210 000 $ | 4 | **99,6 %** | 🔴 retrait — `evidence_withdrawn` |
| 5 | **sxyz500** | 141 594 $ | **0 $** | 85 000 $ | **0** | **100 %** + **56 594 $ sans aucune ligne en base** | 🔴 retrait — **`erratum`** |
| 6 | **Myrrha** | 127 036 $ | 36 $ | 127 000 $ | 1 | **99,97 %** | 🔴 retrait — `evidence_withdrawn` |
| 7 | 0xBossman | 2 932 $ | 2 932 $ | 0 $ | 2 | 0 % | 🟢 conservé |
| 8 | Geppetto | 2 082 $ | 2 082 $ | 0 $ | 3 | 0 % | 🟢 conservé |
| | **Total publié** | **2 261 189 $** | **100 595 $** | **2 104 000 $** | | **95,5 %** | **6 retraits / 8** |

**Le total de 2 261 189 $ publié aujourd'hui par `/api/kol/leaderboard` (`totalObservedProceeds`) et `/api/explorer` (`minimumObservedProceeds`) repose à 95,5 % sur six lignes CSV non sourcées.**

### 4.1 Le cas `sxyz500` justifie un motif distinct

`totalDocumented = 141 594 $`, alors que la base ne contient pour ce handle **qu'une seule ligne**, l'import Arkham de 85 000 $.

```
141 594 − 85 000 = 56 594 $ qui ne correspondent à AUCUNE ligne de KolProceedsEvent
```

Ces 56 594 $ correspondent au résumé calculé le 2026-04-27, qui déclare `eventCount = 151` — 151 événements qui n'ont jamais été persistés (`ON CONFLICT ("txHash") DO NOTHING` sur une contrainte globale, résumé calculé depuis la mémoire). C'est une **assertion chiffrée matériellement incorrecte**, pas une preuve insuffisante : le motif est **`erratum`**.

### 4.2 Hors périmètre de retrait — non publiés

`NachSOL` porte `totalDocumented = 14 947 889 $`, adossé à **4 582 transactions on-chain primaires**, mais son profil est en `draft` : il n'est publié par aucune surface. Il n'entre pas dans le containment. Il illustre en revanche l'asymétrie : le seul chiffre massivement adossé à des observations est le seul qui ne soit pas publié.

### 4.3 Effets induits, à valider

Le retrait des 6 handles fait mécaniquement tomber :

- `/api/explorer` → dossier **BOTIFY** `proceedsObservedTotal: 932 139 $` (= GordonGekko + bkokoski + sxyz500) → **2 082 $** ;
- `/api/explorer` → dossier **GHOST** : même valeur 932 139 $, les mêmes trois handles comptés une seconde fois → **0 $** ;
- `/api/explorer` → dossier **SERIAL-12RUGS** 210 900 $ → **0 $** ;
- `/api/kol/leaderboard` → `totalObservedProceeds` 2 261 189 $ → **5 014 $** ; `profilesWithProceeds` 8 → **2** ;
- `/api/kol/{h}/proceeds` → `found: false` pour GordonGekko, bkokoski, sxyz500 ;
- `/api/watchlist` → `totalProceeds: null` pour orbitape, GordonGekko, bkokoski, sxyz500 ;
- `/api/scan/ask` → disparition de la phrase « Min. $580K observed » du contexte LLM.

*(Le champ `proceedsObservedTotal: 12 000 000 $` de l'entrée `platform-IL-PON-CBEX-001` ne provient pas du pipeline proceeds — donnée de plateforme distincte, hors périmètre.)*

---

## 5. Mécanisme proposé

Principe : **la valeur reste en base, seule sa publication change, et le changement est une décision consignée.** Aucun `UPDATE` silencieux, aucune suppression, réversible par une seconde décision.

### 5.1 Une table de journal, transposée du motif P0-2

```sql
-- NON APPLIQUÉE — à exécuter par David dans le Neon SQL Editor après validation
CREATE TABLE "KolProceedsPublicationLog" (
  id               text PRIMARY KEY,
  "kolHandle"      text NOT NULL,
  scope            text NOT NULL,   -- 'profile_total' | 'summary' | 'involvement'
  "fromStatus"     text NOT NULL,   -- 'published' | 'withdrawn'
  "toStatus"       text NOT NULL,
  "publishedValueUsd" numeric,      -- la valeur AU MOMENT du retrait, figée
  "primaryEvidenceUsd" numeric,     -- la part adossée à une observation primaire
  "reasonCode"     text NOT NULL,
  reason           text NOT NULL,
  "actorId"        text NOT NULL,
  "contestationRef" text,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "KolProceedsPublicationLog_reasonCode_allowed"
    CHECK ("reasonCode" IN ('approved','rejected','contested','erratum',
                            'evidence_withdrawn','legal','duplicate','other')),
  CONSTRAINT "KolProceedsPublicationLog_status_allowed"
    CHECK ("fromStatus" IN ('published','withdrawn')
       AND "toStatus"   IN ('published','withdrawn'))
);
CREATE INDEX ON "KolProceedsPublicationLog" ("kolHandle", "createdAt" DESC);
```

Append-only : aucune ligne n'est jamais modifiée ni supprimée. Le cycle `published → withdrawn → published` laisse trois lignes, pas un état écrasé. `publishedValueUsd` fige le montant retiré : **c'est ce qui rend le retrait auditable même après un recalcul ultérieur** — précisément ce qui manque aujourd'hui.

### 5.2 Une colonne d'état, additive

```sql
ALTER TABLE "KolProfile"
  ADD COLUMN "proceedsPublication" text NOT NULL DEFAULT 'published';
ALTER TABLE "KolProfile"
  ADD CONSTRAINT "KolProfile_proceedsPublication_allowed"
    CHECK ("proceedsPublication" IN ('published','withdrawn'));
```

`totalDocumented` **n'est pas touché**. La valeur reste lisible en base, en admin, et par toute réinvestigation. Seule sa publication bascule.

### 5.3 Un point de filtrage unique, sur le modèle de `PUBLIC_KOL_FILTER`

Un helper `src/lib/kol/proceedsGate.ts` exportant :

- `PUBLISHED_PROCEEDS_FILTER` — clause Prisma pour les agrégats (`explorer`, `leaderboard`) ;
- `redactProceeds(profile)` — rend `null` quand `proceedsPublication === 'withdrawn'`.

Appliqué aux **12 surfaces API** et aux **5 écrans** du §2, plus `groundingContext.ts` (la prose LLM). Un test verrouille l'alignement liste-des-surfaces ↔ helper, comme le fait déjà `nominative-api-gate.test.ts` pour le matcher du proxy.

### 5.4 Le résumé, aligné dans la même décision

`KolProceedsSummary.reviewStatus` passe à `draft` pour les 6 handles — l'interrupteur existe déjà et gate `/api/kol/{h}/proceeds`. Il faut en plus **corriger `/api/v1/kol`**, dont la requête `SELECT … FROM "KolProceedsSummary"` n'a aucune clause `WHERE` (une ligne).

### 5.5 Les PDF : gel, pas suppression

Doctrine : rien n'est supprimé physiquement. Les **31 archives R2 restent intactes** — elles sont la seule trace de ce qui a été affirmé et à quelle date, et le dossier BOTIFY en dépend.

Deux gardes proposés, tous deux réversibles :

1. `GET /api/pdf/{handle}` rend **409 `proceeds_withdrawn`** lorsque le handle est en retrait — `latest.pdf` cesse d'être servi sans être effacé ;
2. `src/app/api/cron/helius-scan/route.ts:87` cesse d'appeler `generateCasePdf` pour un handle en retrait — **aucun 32ᵉ document ne sera créé** avec le chiffre retiré.

### 5.6 Le générateur de plainte

`POST /api/admin/plainte/generate` refuse le préréglage `botify` tant que les proceeds sont en retrait (409 avec le motif). Les données restent dans `src/lib/plainte/data.ts` — non supprimées, non réécrites. Corriger les montants du préréglage est une **décision éditoriale et juridique**, pas une opération technique : je ne la prends pas.

### 5.7 Ce que le mécanisme ne couvre pas

- Les documents déjà sortis du système (captures, copies, pièces jointes) — hors de portée par nature.
- Les 31 PDF archivés, conservés délibérément.
- L'exactitude matérielle des montants : le retrait dit « nous ne publions plus ce chiffre », **pas** « le chiffre réel est X ».

---

## 6. `actorId` — la valeur que je propose

Le journal exige un acteur attribuable, et `"admin"` ne l'est pas. Je propose :

```
actorId = "person:david-douville"
```

Justification : c'est la seule personne physique identifiable dans le dépôt comme responsable éditorial — `src/lib/plainte/data.ts:193-195` la désigne comme plaignant et fondateur d'INTERLIGENS, et c'est le titulaire du compte git et du compte Vercel. Le format `person:<slug>` la distingue sans ambiguïté des acteurs machine déjà présents dans les journaux (`watcher_bridge`, `admin:cron`, `manual:dood`, `local-test`).

L'adresse de courriel sera consignée dans le champ `reason` de chaque ligne, pas dans `actorId` — un identifiant d'acteur ne doit pas porter de donnée de contact susceptible de changer.

**À confirmer par toi.** Si tu préfères une autre valeur (nom complet, identifiant interne, adresse), dis-la : elle sera posée telle quelle et ne sera plus modifiable, le journal étant append-only.

---

## 7. Ce que je demande de valider

| # | Point | Défaut proposé |
|---|---|---|
| 1 | Le mécanisme du §5 (table de journal + colonne d'état + filtre unique) | tel quel |
| 2 | Le périmètre : **6 retraits**, **2 conservés** (0xBossman 2 932 $, Geppetto 2 082 $) | tel quel |
| 3 | Le motif : `evidence_withdrawn` pour 5, **`erratum` pour `sxyz500`** | tel quel |
| 4 | `actorId = "person:david-douville"` | à confirmer |
| 5 | Le gel des PDF : 409 sur `/api/pdf/{handle}` + arrêt de la régénération, **archives conservées** | tel quel |
| 6 | Le refus du préréglage `botify` du générateur de plainte | tel quel |
| 7 | La correction d'une ligne sur `/api/v1/kol` (absence de `WHERE` sur le résumé) | incluse |
| 8 | `/api/scan/ask` est **ouvert en anonyme** et publie le montant en prose LLM. Le filtre du §5.3 le couvre — mais son ouverture relève du gate nominatif, hors périmètre | signalé, non traité |

**Aucune ligne de retrait n'est écrite tant que ces points ne sont pas validés.**

---

## 8. Signalements hors périmètre (non corrigés)

Conformément à la consigne, signalés sans être touchés :

- **Famille `??` / `||` et famille C.** Aucune nouvelle occurrence dans les fichiers parcourus pour ce chantier. La famille env est close par `src/lib/config/envNumber.ts`. Deux sites `parseFloat` sur données non-env, rencontrés en chemin, restent latents : `src/app/api/casefile/route.ts:141,173,234` (`parseFloat(top10_pct ?? "0")` — une panne RPC devient « concentration nulle ») et `src/app/api/market/route.ts:57` (`NaN` explicite).
- **`src/lib/kol/proceeds.ts:258-262`** : le commentaire annonce un plafond de 10 portefeuilles, le code applique `.slice(0, 5)`. Sur `Myrrha`, `walletCount` publié vaut 113.
- **`src/app/api/admin/kol/sync-proceeds/route.ts:6-14`** : la documentation annonce `helius-scan` « every 12h » ; `vercel.json` planifie `0 4 * * *`.
