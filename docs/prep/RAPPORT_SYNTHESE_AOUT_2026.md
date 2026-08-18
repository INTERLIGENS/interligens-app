# Synthèse — session autonome d'août 2026

**Date :** 2026-08-18
**Périmètre :** 19 chantiers, 20 branches préparées, 1 chantier fusionné sur `main`.

**Mesuré, les 19 branches fusionnées séquentiellement sur `origin/main` :**

```
42 commits · aucun conflit
typecheck vert · 295 fichiers de test / 3 188 tests verts  (+5 fichiers, +172 tests)
```

Le seul message de fusion est un `Auto-merging` bénin sur
`src/scripts/watchdog/watcher-health.mjs`, où A9 ajoute un import et B3 modifie
un compteur — résolu par Git, sans intervention.

---

# 1. PRÊT À MERGER

## L'ordre

**Une seule contrainte d'ordre existe dans tout le lot : A14 avant A15, ou A15
seul** (A15 contient les deux commits d'A14 — vérifié par
`merge-base --is-ancestor`).

**Toutes les autres sont indépendantes** et partent de `9b1d641` ou `b010529`.
*Correction d'une hypothèse : A14 ne descend PAS d'A12 — la « chaîne
A12 → A14 → A15 » n'existe pas, seul le maillon A14 → A15 est réel.*

| # | Branche | Ce qu'elle change | Ce qu'elle prouve | Indép. |
|---|---|---|---|---|
| 1 | **A9** `67-garde-endpoint` | garde d'endpoint réutilisable (TS + `.mjs`), 17 points couverts, cliquet | 3 scripts visaient `ep-bold-sky` ; le nom de base ne discrimine rien | ✅ |
| 2 | **A5** `63-proceeds-snapshot` | script d'instantané en lecture seule + export signé | 4 handles divergent entre `totalDocumented` et le résumé, jusqu'à ×3 513 | ✅ |
| 3 | **A16** `74-inventaire-archives` | inventaire signé des 34 archives + SQL de versement | `latest.pdf` est un **doublon exact** ; 34/34 portent « usage judiciaire » | ✅ |
| 4 | **A12** `70-laundry-publication` | interrupteur de dépublication `LaundryTrail` + registre + 50 tests | le seul objet nominatif publié sans état de publication | ✅ |
| 5 | **A14 → A15** `72` puis `73` | interrupteur monétaire, 12 surfaces câblées, 70 tests | un retrait couvre **12 porteurs** du même chiffre, pas 1 | ⛓️ **ordre imposé** |
| 6 | **B2** `78-bloc1-auth` | le gate nominatif **valide** la session au lieu de la constater | un cookie arbitraire ouvrait 12 familles d'endpoints | ✅ |
| 7 | **B3** `79-evidence-observabilite` | 3 angles morts de la chaîne de preuve, 15 tests | une pièce orpheline existait depuis 4 jours, invisible | ✅ |
| 8 | **B4** `81-bloc3-flags` | drapeau marché, `confidence`/`dataQuality` propagés, `rpc_down` sur 200 vide | une panne faisait passer 62/ORANGE → 0/GREEN **en silence** | ✅ |
| 9 | **A8** `66-gardes-depot` | bloc `⛔` en tête de `CLAUDE.md` | les interdictions vivaient dans une conversation | ✅ |
| 10-19 | **A1, A2, A3, A6, A7, A10, A11, A13, D1, D2** | rapports seuls, aucun code | — | ✅ |

**Recommandation d'ordre pratique** — non contraignante, sauf le maillon
A14→A15 :

> **A9 · A5 · A16 · A12 · A14 · A15 · B2 · B3 · B4 · A8**, puis les dix rapports
> dans n'importe quel ordre.

A9 en tête parce que son cliquet nomme deux fichiers qui arrivent avec A5 et
A16 ; l'exclusion est **déjà écrite** et se révoque d'elle-même si l'un des deux
se met à écrire.

## Ce que voit `main` aujourd'hui — les sept gates

Run [`32150389358`](https://github.com/INTERLIGENS/interligens-app/actions/runs/32150389358), commit `b010529`.

| Gate | Avant la session | **Maintenant** |
|---|---|---|
| Secret Scanning (Gitleaks) | ✅ | ✅ |
| **SAST (Semgrep)** | ❌ | **✅** |
| **Type check** | *jamais exécuté* | **✅** |
| **Tests** | *jamais exécuté* | ❌ — 2 fichiers sur 291 |
| **Build** | *jamais exécuté* | ❌ — `ADMIN_TOKEN` |
| Lint | ❌ | ❌ — 1 244 |
| Dependency Audit | ❌ | ❌ — 108, **0 `critical`** |

**1 vert sur 7 → 3 verts sur 7. Et trois gates qui n'avaient jamais tourné
tournent désormais à chaque run.**

### Le rouge qui est un état correct assumé

> **`Build`, sur `ADMIN_TOKEN`.**

`env.ts` exige cinq variables en production. `DATABASE_URL` a été posée —
factice, hôte `.invalid` (RFC 2606), **uniquement dans le workflow**. Les quatre
autres sont des **secrets d'authentification**, et `vitest.config.ts` porte déjà
la doctrine pour l'une d'elles :

> *« `ADMIN_TOKEN` n'est PAS posé ici : plusieurs tests vérifient justement le
> fail-closed quand il manque, et le poser globalement les rendrait verts pour
> la mauvaise raison. »*

**Poser un jeton factice désarmerait, dans l'artefact, la vérification que ce
jeton existe.** Le rouge est le comportement correct.

*`Tests` relève du même choix : étendre la `DATABASE_URL` factice à cette étape
rendrait verts deux fichiers qui signalent un vrai défaut —
`src/lib/kol/pricing.ts:7` construit un `PrismaClient` au chargement de module.*

---

# 2. ATTEND UNE DÉCISION

## A. Les trois écritures en base — ordre imposé

| # | Écriture | Écrit | Précédée de | Irréversible |
|---|---|---|---|---|
| **1** | `A12-MIGRATION_laundry_publication_v1.sql`<br>`A14-MIGRATION_monetary_claims_v1.sql` | 2 colonnes `DEFAULT 'published'`, 1 table de registre, 6 index, **+4 portées** au `CHECK` | rien — mais le **code se déploie après**, jamais avant | rien. Additives, ré-exécutables. **Sauf le `§2` d'A14** : seul `DROP CONSTRAINT` de la session, encadré d'un contrôle qui **échoue la transaction** si une ligne existante en sortait |
| **2** | `A16-VERSEMENT_reports_archive_evidence_v1.sql` | **34 `INSERT`** dans `EvidenceItem` — clé, taille, empreinte, `capturedAt` = date réelle | l'inventaire signé (**fait**) | **l'ouverture de la chaîne de conservation.** `provenanceType`, `capturedAt` et `timestampMode` font foi ensuite ; un versement mal qualifié ne se corrige qu'en s'ajoutant à lui-même |
| **3** | `A15-REGISTRE_elargissement_portee.sql` | **6 `INSERT`** dans `KolProceedsPublicationLog`, `scope='monetary_all'` | migration A14 · **déploiement A14+A15** · le même jour | **journal append-only.** Écrite avant le déploiement, elle consigne une décision non appliquée ; longtemps après, elle date faux. S'en défaire exige une **seconde décision** |

**Ordre : `1 → déploiement → 3`.** Le versement (2) est indépendant, **mais il
doit précéder toute décision de retrait sur les archives** — il n'existe aucune
trace de qui a téléchargé ces documents (`EvidenceAccessLog` est en écriture
seule et personne ne le lit). Retirer avant d'inscrire effacerait la preuve de
ce qui a été affirmé et quand.

**⚠️ Ce que le déploiement d'A14+A15 fait, en plus du code :** les six décisions
du 16 août portaient la portée `profile_total`. Servies par le nouveau code,
elles couvrent **onze porteurs de plus**. C'est le défaut mesuré, donc l'effet
voulu — mais c'est un **élargissement effectif de décisions déjà prises**. C'est
pourquoi l'entrée de registre (3) existe.

## B. Les deux patches en attente de fenêtre d'exemption

| Patch | Chemin gelé | Motif — **séparé, jamais groupé** |
|---|---|---|
| `A8-retrait-proceeds-entete.patch` | `^migrations/` | corriger un en-tête annonçant `NON APPLIQUÉ` alors que la migration **est appliquée depuis le 2026-08-16 19:59:51** |
| `A9-directurl-fail-closed.patch` | `^prisma/` | pointer `directUrl` sur une variable **inexistante**, pour que `prisma migrate` échoue bruyamment au lieu de réussir sur `ep-bold-sky` |

*La procédure est éprouvée : ouverture → extension motivée → modification
autorisée → fermeture, en quatre PR (#98 → #101), **aucun `--no-verify`**, et
vérification à `0` occurrence résiduelle après fermeture.*

## C. Les décisions produit non prises

| Sujet | État | Pourquoi c'est une décision |
|---|---|---|
| **Le plancher legacy** | 3 patches prêts, non appliqués | `Math.max(legacy, canonique)` avec un legacy **constant à 20/GREEN** sur les 23 cas de la sonde C-07. Le retirer **change le score affiché** |
| **Les 14 surfaces à seuil divergent** | recensées, **non touchées** | `scan/eth:325` sert un `tier` à 40 **à côté d'un `tiger_tier` à 35, même JSON** · `report/v2:55` bascule le **PDF public** en `AMBER` à 40 · `api/v1/scan:11` rend ORANGE pour tout `score <= 79` — **ni 35 ni 40, une troisième règle**. Les aligner change des verdicts servis |
| **`SecurityAuditLog` et `SecurityVendorExposureLink`** | 0 ligne, **0 écrivain** | créées, jamais alimentées, jamais expliquées. Reliquat ou attente de V2 : personne ne le sait |
| **`AGENTS.md`** | ligne 6 corrigée **localement, non versée** | il **ne porte pas** le bloc `⛔` de `CLAUDE.md`. Un agent qui ne lit que lui n'est averti de rien — ni des 9 variables, ni d'`ep-bold-sky`, ni du SQL à ne pas rejouer. La question n'est pas « faut-il le corriger » mais **quel fichier de contexte fait autorité** |
| **`src/lib/prisma.ts` hors du garde d'endpoint** | délibéré | tranchable **sans lire aucune valeur** : une requête sur une route gardée par `prodWriteGuard` depuis un **Preview** rend `dbHost` en clair dans son 403 |
| **`security:center:check`** | rouge par conception | il exige un cron **délibérément supprimé**. Correctif d'**une ligne**, meilleur rapport de tout le lot |

---

# 3. RESTE OUVERT

## A4 — non fait

Le balayage IDOR sur les routes paramétrées n'a pas été mené. Le périmètre est
posé : `[handle]`, `[id]`, `[caseId]`, `[fileId]`, en priorité celles qui
servent du nominatif, avec une session valide de sujet A visant les ressources
de sujet B. **Le bon réflexe existe déjà** dans `src/app/api/investigators/*` —
`profileId` pris du cookie, jamais du corps — et la question est de savoir qui
l'applique.

## U2 — non tranchable d'ici

`launchctl list` sur Host-005 et Host-010. Machines non joignables, aucun
substitut : les plists installés ne laissent de trace ni en base, ni dans Git,
ni dans un journal centralisé. **Acquis quand même :** l'historique complet du
dépôt ne contient que **deux** plists, jamais un troisième. Si un 3ᵉ agent
tourne ailleurs, **il n'est pas versionné** — et c'est en soi le constat le plus
lourd.

## Les 14 porteurs de chiffres non couverts

Sur les 36 recensés, **14 couverts** après A12/A14/A15. Les 14 restants :

**Prose — 10 porteurs · couvrables, non couverts**
`KolProfile.partialFacts` *(publie une revendication explicitement « pending »)*
· `documentedFacts` · `observedBehaviorSummary` · `summary` · `exitNarrative` ·
`KolWallet.label` *(60 lignes, jusqu'à 5,5 M$ de PnL affirmé)* · `sourceLabel` ·
`attributionNote` · `KolTokenLink.note` · `KolCase.evidence`

Le patron d'A12 s'y transpose, mais **le chiffre est noyé dans du texte** : le
retirer, c'est retirer la phrase — comme pour `KolNarrative`.

**Constantes compilées — 4 porteurs · structurellement hors de portée**
`CASE_DB` (claims C1→C8) · les `cexTargets` de `class-action` *(montants, scores
de complicité, handle nommé)* · `pdfGeneratorPublic` *(62 % / 78 % en dur, EN et
FR)* · les pages `en/cases/botify/evidence`, `en/demo/review`, `simulator`.

**Aucun interrupteur ne peut les atteindre. Aucun `UPDATE` ne les corrigera :
il faut un déploiement — et les recenser exige un test, pas une requête.** C'est
ce que fait le garde anti-récidive d'A14, **préparé, non livré**.

**Scores calculés — 3 porteurs** — `deriveTigerScore` *(plancher inconditionnel
de 20, sort par l'API nominative et l'app mobile)*, `computeScore` legacy,
`max(legacy, tiger)`. Ils relèvent du bloc 3, pas du bloc 4.

## Les 34 archives hors chaîne de conservation

`EvidenceItem WHERE r2Key LIKE 'reports/%'` → **0**. 34 objets, **34/34 portant
« CONFIDENTIEL — usage judiciaire »**, **29 pour un handle dont la publication
est retirée depuis le 16 août**.

**Non joignables anonymement** — `HEAD` sur une clé inexistante rend 401, et
`R2_PUBLIC_BASE_URL` est absente de tous les environnements. **La réserve :** un
sous-domaine r2.dev inexistant rend **aussi** 401. Le code ne distingue pas
« accès public désactivé » de « non provisionné ». Même conclusion aujourd'hui,
**fragilité différente demain** : activer r2.dev sur ce bucket rendrait 32
archives nominatives publiques **à un chemin devinable, sans changer une ligne
de code**.

*Fermer `/api/pdf/{handle}` ne couvrirait que 2 objets sur 34 — mais sans perte
d'information, `latest.pdf` étant un doublon exact.*

## La dette d'observation — 4,35

**212 annotations `: any` → `: unknown` sur 19 fichiers de production produisent
922 erreurs `tsc`** : 669 « valeur utilisée sans contrôle », 247 « propriété lue
sans garantie ». **Ratio 4,35 accès non vérifiés par `any`.**

Ni bruit, ni dette de correction : **dette d'observation, désormais chiffrée**.
Extrapolée aux 577 `any` de production, de l'ordre de **2 500 sites** où le
compilateur n'a rien à dire — *indicatif, l'échantillon étant biaisé vers les
fichiers les plus denses*.

## Et la TSA

`TSA_URL_FALLBACK` **n'est pas posée**, délibérément. Le compteur d'orphelines
de B3 doit exister d'abord : **un horodatage sur une pièce sans octets la rend
indiscernable d'une pièce complète** — un jeton TSA valide sur un contenu
absent. L'alerte `evidence_orphan_no_marker` porte cet avertissement dans son
texte.

---

# CE QUI DOIT ÊTRE FAIT AVANT LE 1ᵉʳ SEPTEMBRE

**Avant :** fusionner A9 → A5 → A16 → A12 → A14 → A15 → B2 → B3 → B4 → A8 *(42
commits, aucun conflit, 3 188 tests verts, mesuré)* · exécuter les deux
migrations puis déployer, **puis** écrire l'entrée de registre le même jour ·
verser les 34 archives **avant** toute décision sur elles · et corriger la ligne
de `security:center:check`, qui coûte une minute et rend une commande de santé
utilisable.

**Peut attendre :** les 10 porteurs de prose, les 14 surfaces à seuil divergent,
le plancher legacy, les deux tables mortes du Security Center, la dette
d'observation, et l'ingestion du Security Center — **qui est le seul vrai
chantier neuf de septembre, tout le reste étant à finir, pas à écrire.**

**Ne doit pas être fait avant d'avoir mesuré :** poser `TSA_URL_FALLBACK`,
activer le garde anti-récidive, et toucher aux archives R2.
