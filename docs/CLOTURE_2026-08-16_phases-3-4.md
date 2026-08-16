# Clôture 2026-08-16 — Phases 3 et 4

Mesures sur `ep-square-band` le 2026-08-16, **lecture seule**. Aucune écriture, aucune migration.
Les consommateurs ont été exécutés pour de vrai contre la base de production — rien n'est déduit.

---

## Phase 3 — Cohérence `publishStatus`

### 3.1 Le chiffre exact

> ⚠️ **La prémisse du prompt est fausse.** Il annonce « 5 KOLs sur 6 ». La réalité est plus large.

**165 liens publics appartiennent à 13 profils non publiés**, sur 187 liens publics au total — soit **88 % des liens publics**.

| Profil | publishStatus | liens publics | symboles distincts | avec caseId |
|---|---|---:|---:|---:|
| captain_meme1 | draft | 53 | 53 | 0 |
| Empire_sol1 | draft | 40 | 36 | 0 |
| fuelkek | draft | 20 | 20 | 0 |
| solana_daily | draft | 19 | 19 | 0 |
| 0xSweep | draft | 15 | 15 | 0 |
| CookerFlips | draft | 6 | 6 | 0 |
| CrashiusClay69 | draft | 5 | 5 | 0 |
| moonbag | draft | 2 | 2 | 1 |
| + 5 autres | draft | 5 | — | — |
| **total** | | **165** | | **1** |

Seuls **22 liens publics sur 187** appartiennent à un profil réellement publié.

### 3.2 Ce que ces liens rendent RÉELLEMENT — prouvé, pas déduit

Méthode : exécution des vrais consommateurs contre la vraie base, sur `TROLL` — un symbole
porté **uniquement** par des profils non publiés (7 liens). Détection : le handle apparaît-il
dans la charge utile sérialisée ?

| Consommateur | Rend du nominatif ? | Taille de la réponse |
|---|---|---|
| Explorer — dossier de lancement `TROLL` | **NON** (`null`) | 4 o |
| Explorer — tous les dossiers | **NON** | 8 399 o |
| Explorer — `getExplorerStats` | **NON** — `linkedLaunches: 9` | agrégat |
| ClusterRiskBadge — `getClusterContextForLaunch` | **NON** | 73 o |
| coordinationSignals — `ForLaunch` | **NON** | 160 o |
| kolLeaderboard — profils | **NON** | 16 843 o |
| kolLeaderboard — stats | **NON** — `totalLinkedTokens: 9` | agrégat |
| **`/api/watchlist`** | **🔴 OUI** | voir ci-dessous |

**Huit consommateurs sur neuf ne rendent rien.** Raison : chacun croise les liens avec
`PUBLIC_KOL_FILTER` (32 profils). Un lien dont le profil est filtré ne produit aucun acteur.
Les compteurs le confirment : `linkedLaunches: 9` et `totalLinkedTokens: 9` ne comptent que
les 9 symboles issus des 22 liens de profils publiés — les 165 autres pèsent **zéro**.

**L'exception est réelle.** `/api/watchlist` construit ses `tickers` depuis
`KolTokenLink.visibility='public'` **sans vérifier la publication du profil**. Résultat :

```
captain_meme1   non publié   KEKIUS, DADDY, MELANIA, WOJAK, NEET, AURA
Empire_sol1     non publié   ASTEROID, KEKIUS, WORLDCUP, AMERICA, TROLL, TREBLE
fuelkek         non publié   HOUSE, FWOG, PNUT, TITCOIN, USA, TRIPLT
solana_daily    non publié   YZY, WORLDCUP, WOJAK, VINE, USDUC, TROLL
0xSweep         non publié   GROKIUS, PIPPIN, FARTCOIN, KEKIUS, VINE, DADDY
CookerFlips     non publié   VINE, WOJAK, NEET, ASTEROID, ASTER, TROLL
+ SOLANA___TRADER, Empire_sol1, moonbag        → 9 entrées au total
```

« captain_meme1 → KEKIUS, DADDY, MELANIA… » **est** une association nominative personne↔token.
Elle n'est plus publiquement joignable depuis P0-1 (la route est en 401 anonyme), mais elle
reste servie à tout porteur du cookie beta, sur une personne dont le profil n'a jamais été
approuvé pour publication.

### 3.3 Les deux voies, chiffrées

| | Voie A — publier les 13 profils | Voie B — archiver les 165 liens |
|---|---|---|
| Ce que ça publie | 13 personnes nommées, et **165 associations d'un coup** deviennent visibles partout | rien |
| Décisions éditoriales | 13 | **165** |
| Revue humaine requise | 13 profils | 165 liens |
| Entrées au journal | 13 (hors périmètre du journal actuel, qui est par lien) | 165 |
| Réversible ? | non — pas de chemin `published → draft` outillé | oui, `archived` est terminal mais tracé |
| Interdit par ce chantier | **oui** (publication nouvelle) | **oui** (165 décisions sans revue) |
| Coût réel | ~13 revues de profil | ~165 revues de lien |

**Ni l'une ni l'autre n'est applicable en l'état.** La seule action proportionnée et non
interdite est un **correctif ciblé** : aligner `/api/watchlist` sur les huit autres
consommateurs en filtrant ses `tickers` sur le profil publié. Cela ne publie rien, n'archive
rien, ne prend aucune décision éditoriale — ça supprime la seule fuite nominative restante des
165 liens. **Non fait dans ce lot** : ce serait une modification de comportement non demandée,
sur un chemin que l'énoncé désigne comme « analyse seulement ».

### 3.4 Le vrai risque

Les 165 liens sont une **charge amorcée**. Le jour où `captain_meme1` passe en
`publishStatus='published'`, ses **53 liens deviennent visibles instantanément**, sans qu'aucun
d'eux n'ait été revu individuellement. La publication d'un profil est aujourd'hui un acte à
effet de levier ×53, et rien dans le produit ne le signale à l'opérateur.

---

## Phase 4 — Passe A, le reliquat

### 4.1 `social_posts` gelé depuis le 19 avril

**CONFIRMÉ — TOUJOURS OUVERT.** 3 104 lignes, dernier insert **2026-04-19** (119 jours).
Répartition : avril 2 815, mars 289. Aucune ligne depuis.

Producteurs et consommateurs existent pourtant dans le code :
`src/lib/surveillance/reports/generateCaseFile.ts`, `evidencePack.ts`,
`signals/detectSellWhileShilling.ts`, `src/app/api/admin/signals/*`.
C'est une table **lue mais plus alimentée** — les signaux qui en dépendent travaillent sur un
corpus figé depuis 4 mois.

### 4.2 La chaîne des proceeds — LE POINT SENSIBLE

> ⚠️ **Les chiffres du prompt sont périmés, et il y en a trois qui coexistent.**

Pour **GordonGekko**, trois sources vivantes donnent trois montants différents :

| Source | Valeur | Qualité | Calculé le | Surface qui l'affiche |
|---|---:|---|---|---|
| `KolProceedsSummary.totalProceedsUsd` | **94 644,79 $** | `high` | 2026-08-16 04:22 | `/api/v1/kol` → `totalProceedsUsd` |
| `KolProfile.totalDocumented` | **579 645 $** | `partial` | 2026-08-16 06:12 | Explorer, leaderboard |
| `KolTokenInvolvement.sum` | **40 627,04 $** | 3 lignes | dernier sell 2025-01-13 | `/api/watchlist` → `cashout.total` |

**Écart maximal : ×14.** Le chiffre cité dans le prompt (40 627 $) est le plus ancien des trois.
Aucune de ces surfaces ne dit laquelle fait autorité.

Fraîcheur des trois `pricingQuality='high'` — ceux qui sont publiés comme fiables :

| KOL | calculé le | ancienneté |
|---|---|---:|
| **sxyz500** | 2026-04-27 | **111 jours** |
| GordonGekko | 2026-08-16 | 0 j |
| bkokoski | 2026-08-16 | 0 j |

`sxyz500` porte un montant estampillé `high` recalculé il y a près de 4 mois.

Cadence réelle du producteur `KolProceedsEvent` — **3 jours d'écriture dans toute l'histoire de
la table** : 2026-04-15 (134), 2026-04-22 (5 332), 2026-08-16 (136). Entre le 22 avril et le
16 août : **116 jours sans une seule écriture**. La chaîne n'est pas « toujours en marche » ;
elle a redémarré aujourd'hui après un arrêt de presque 4 mois.

`onchain_events` : **0 ligne**, alors qu'un écrivain existe
(`src/lib/surveillance/onchain/ingest.ts:89`) et que trois modules la lisent
(`pdf/engine.ts`, `holdingsComputer.ts`, `detectSellWhileShilling.ts`).

`KolTokenInvolvement` (source de `RetailCounter` et des buckets cashout de la watchlist) :
15 lignes, dernier `firstSellAt` **2025-01-21** — 7 mois.

**Verdict : CONFIRMÉ — TOUJOURS OUVERT.** La chaîne produit, mais de façon sporadique, avec
trois chiffres concurrents et une entrée `high` périmée de 111 jours. Un chiffre publié faux
est possible ici, et il l'est probablement déjà — sans qu'on puisse dire lequel des trois est
le bon.

### 4.3 night-vetting

**CONFIRMÉ — JAMAIS LANCÉ EN AUTOMATIQUE.** `src/scripts/night-vetting.ts` existe (avec
`apply-vetting-decisions.ts`), mais **zéro** référence dans `package.json` et dans
`vercel.json`. Aucun cron, aucun script npm. Exécution manuelle uniquement ; aucune trace
d'exécution en base (`JobRunLog` ne contient que `watcher_bridge_promote`).
*[INDÉTERMINÉ : une exécution manuelle en local ne laisserait aucune trace consultable.]*

### 4.4 Phantom Guard

**RÉFUTÉ (dans le sens attendu).** Aucun module « Phantom Guard » dans `src/`. Les seules
occurrences de « phantom » sont sans rapport (`plainte/data.ts`, `mm/engine/detectors/fakeLiquidity.ts`,
`publicScore/`). Le nom n'apparaît que dans de la documentation : `FULL_AUDIT_REPORT.md`,
`docs/DEPLOYMENT_GUIDE.md`, `docs/branch-cleanup-2026-07-30.txt`.
**C'est de la documentation qui décrit un composant inexistant** — le drapeau était justifié.

### 4.5 EquityWatch

**RÉFUTÉ.** La prémisse dit « collecte seule, sans consommateur ». C'est l'inverse : les
consommateurs existent (`src/lib/equity/signals.ts`, `src/app/admin/equity/page.tsx`,
`src/app/api/admin/equity/route.ts`) et c'est **la collecte qui est vide** —
`EquitySignal` : **0 ligne**.

### 4.6 LIBERTAS

**CONFIRMÉ — NON INTÉGRÉ.** Zéro occurrence dans `src/`, `docs/` et les `.md` racine. Le
sujet n'existe pas dans ce dépôt.

### 4.7 Catégorisation des sous-systèmes

Coût mensuel : aucun de ces sous-systèmes n'a de ligne de facturation propre identifiable.
Le seul coût récurrent mesuré du dépôt est l'API X (~127 $/mois avant Phase 2). Le reste est
du stockage Neon et du calcul Vercel, non ventilés par sous-système — d'où les « ~0 $ » ci-dessous,
qui sont un constat d'absence de mesure, **pas** une mesure à zéro.

| Sous-système | Volume | Consommateur | Catégorie | Ce qu'on perd en coupant | Coût/mois |
|---|---:|---|---|---|---|
| `DomainLabel` | **632 807 lignes** | **aucun** (le seul `domainLabel` du code est une variable locale dans `off-chain-credibility/engine.ts`) | **ARCHIVE** | rien de câblé | stockage Neon, non ventilé |
| `social_posts` | 3 104, gelé depuis 04-19 | lu par 4 modules surveillance | **KEEP + PAUSE** | les signaux `detectSellWhileShilling` et les evidence packs perdraient leur corpus | ~0 |
| `onchain_events` | **0 ligne** | 3 lecteurs | **REBUILD LATER** | rien aujourd'hui (déjà vide) | ~0 |
| `KolTokenInvolvement` | 15, gelé depuis 2025-01 | RetailCounter, watchlist cashout | **KEEP + OPERATE** ⚠️ | c'est une des 3 sources de proceeds publiées | ~0 |
| MM_TRACKER | `MmEntity` 10, `MmScanRun` 79 | 4 routes publiques `/api/v1/mm/*`, `/api/mobile/v1/mm/*` | **KEEP + OPERATE** | une surface publique servie | ~0 |
| EquityWatch | `EquitySignal` **0** | admin page + route | **KEEP + PAUSE** | rien (collecte vide) | ~0 |
| Investigators Workspace | 1 profil, 126 sessions | pages `/investigators/*` | **KEEP + OPERATE** | le gate beta lui-même en dépend (cookie `investigator_session`) | ~0 |
| LIBERTAS | inexistant | — | **DELETE LATER** (la mention en doc) | rien | 0 |
| Phantom Guard | inexistant | — | **DELETE LATER** (3 docs à corriger) | rien | 0 |
| night-vetting | script non câblé | — | **KEEP + PAUSE** | rien (jamais lancé) | 0 |

⚠️ `KolTokenInvolvement` est classé `KEEP + OPERATE` malgré ses 15 lignes gelées **parce qu'il
alimente un chiffre publié**. Le geler serait figer un montant affiché ; le couper le ferait
disparaître d'une surface. C'est le sous-système le plus urgent à trancher.

---

## Phase 1 — Bouton d'archivage (livré, déployé `1178ab8`)

Rendu vérifié à l'origine, hors Cloudflare, session admin : HTTP 200, sections
`Published links` / `Archive (unpublish)` / `Registre des décisions **VIDE**` présentes.

Refus serveur, 14 tests sur le **handler de route** avec les charges utiles que l'UI ne
produit jamais :

| Charge utile | Réponse |
|---|---|
| sans session admin | 401 |
| motif absent / espaces / non textuel / corps absent | 400 `missing_reason` |
| code inconnu | 400 `invalid_reason_code` + liste des 6 codes |
| `approved` / `rejected` | 400 — codes de mise en ligne, pas de retrait |
| lien `draft` | 409 `not_public` |
| lien déjà archivé | 200 `noop_already_archived`, sans rejournaliser |
| lien inexistant | 404 `not_found` |

**Aucun refus n'écrit quoi que ce soit** (test de bilan global). Mutation testing : 5 mutants
(motif de dépublication `approved` accepté / session admin non vérifiée / draft archivable /
motif vide accepté / route rendant 200 sur tout refus) → **5 tués**.

Preuve en production sur un id inexistant : 401 sans auth, **404** avec auth et entrées
valides — la route atteint bien la base. Jamais de 500.

## Phase 2 — Mode économique X (appliqué)

Valeurs réelles avant écriture, lues via `vercel env ls` :

| Variable | Avant | Après | Scope |
|---|---|---|---|
| `WATCHER_MAX_HANDLES` | existait (96 j) — valeur exacte **non lisible** | **20** | Production |
| `WATCHER_MAX_POSTS_PER_HANDLE` | **n'existait pas** → défaut code 15 | **3** | Production |
| `X_API_HARD_CAP_POSTS` | **n'existait pas** → défaut code 24 000 | **3500** | Production |
| `WATCHER_BRIDGE_ENABLED` | existait (2 j) | **false** | Production |

Toutes mono-scope Production — aucun risque prod+preview. Format validé à l'octet avant
écriture (`od -c` + `wc -c`) : `20` = 2 o, `3` = 1 o, `3500` = 4 o, `false` = 5 o, aucun `\n`.

`WATCHER_MAX_HANDLES` : valeur exacte **jamais lue** (`vercel env pull` interdit, l'entrée est
chiffrée dans `env ls`, les logs runtime hors fenêtre). Mais `handlesV2.slice(0, maxHandles)`
avec `handlesV2.length = 108` rend **toute valeur ≥ 108 behaviouralement identique** — et
l'observation empirique (candidats issus de l'index 107 sur 7 jours) prouve que la liste
entière était scannée. Le chiffrage tient.

**Effet chiffré.** Usage réel du cycle X lu le 2026-08-16 : `project_usage = 15 514` posts,
reset jour 21.

* Avant : ~127 $/mois projeté (août au 15 : 61,35 $ / 10 577 posts, soit 4,09 $/j).
* Pire cas après : 19 × 3 + 100 (GordonGekko, **codé en dur**) = **157 posts/run** → 4 710/mois
  → 27,32 $/mois.
* Plafond absolu `X_API_HARD_CAP_POSTS = 3500` → **20,30 $/cycle**, quoi qu'il arrive.
* **Économie ≈ 107 $/mois, −84 %.**

**Effet immédiat assumé** : `15 514 + 157 ≥ 3500` → le Watcher saute tous ses runs jusqu'au
reset du 21 août. C'est la pause décidée, pas un effet de bord. Reprise ensuite à ~157/run.

**Non vérifiable avant le prochain run.** Les 4 entrées sont créées « Sensitive » donc
non relisibles. Point de contrôle : le cron du 2026-08-17 06:00 UTC journalise
`Budget mode: scanning 20 of 108 handles (WATCHER_MAX_HANDLES=20)` et `cap=3 posts/handle`.

**Piège latent signalé** : `envBool` teste `v === "true"`. Une valeur `"true\n"` posée depuis
l'UI Vercel donnerait **false** silencieusement. À savoir pour qui réactivera le bridge.

## État de la base après ce chantier

| | |
|---|---|
| `KolTokenLinkStatusLog` | **0 ligne** — la règle absolue tient |
| `KolTokenLink` | public **187** (inchangé), draft **104**, rejected 1 |
| `KolProfile` publiés | **32** (inchangé) |
| Dépense X août | 65,51 $ / 11 295 posts |

Les drafts sont passés de 92 à 104 : le run bridge de **06:57 (avant déploiement)** en a créé
12. Les runs suivants (07:49, 07:57) sont `disabled`. L'alternance `success`/`disabled`
constatée hier reste **inexpliquée** — elle précède le changement d'env ; celui-ci ne prendra
effet qu'au prochain run.

## Ce qui reste réellement humain

| # | Sujet | Pourquoi une machine ne peut pas trancher |
|---|---|---|
| 1 | **Revoir les 104 drafts** | chaque draft est une accusation nominative ; l'approuver est une décision éditoriale engageant la responsabilité, pas une validation technique |
| 2 | **Trancher les 3 chiffres de proceeds** | 94 644 $ / 579 645 $ / 40 627 $ pour GordonGekko : décider lequel fait autorité suppose de savoir ce qu'on veut *dire* par « proceeds » — définition produit, pas bug |
| 3 | **Décider du sort des 165 liens** | publier 13 profils ou archiver 165 liens : les deux sont des décisions éditoriales de masse |
| 4 | **Recalculer ou retirer `sxyz500`** | un montant `high` de 111 jours est publié ; le laisser, le rafraîchir ou le dépublier engage |
| 5 | **Rouvrir la collecte X** | dépend des seuils de reprise (% revus, diversité, délai médian), c'est-à-dire d'un jugement sur la capacité de revue |
| 6 | **Corriger la doc Phantom Guard / LIBERTAS** | décider si c'est une erreur de doc ou un projet abandonné |
| 7 | **Le 403 Cloudflare sur les pages** | seul un humain avec un navigateur non challengé peut dire si l'incident est réel ou limité à mon client |
