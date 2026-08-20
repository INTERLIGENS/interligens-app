# Fermeture de l'atterrissage — 2026-08-20

## 1. LE DELTA EST-IL EXPLIQUÉ — **OUI.** Mais il ne vaut pas 17, et rien n'a été supprimé.

## 2. LES 32 EMPREINTES CONCORDENT-ELLES — **PARTIEL. 31 / 32.**

---

# ⛔ INCIDENT EVIDENCE — À LIRE AVANT TOUT LE RESTE

**Une pièce de la chaîne de conservation n'existe plus dans R2. Elle a été
effacée aujourd'hui. Ce n'est pas un accident : c'est une règle de cycle de vie
nommée `auto-delete-30d`, et elle va effacer les 31 autres, une par jour,
jusqu'au 2026-09-15.**

```
reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf   →  NoSuchKey
```

**Ce n'est PAS une divergence d'empreinte.** Les 31 pièces lisibles concordent
au bit près. Celle-ci est illisible parce que **les octets n'existent plus**.

## La preuve que la règle existe — mesure directe, `HeadObject`

```
reports/GordonGekko/CASE_GordonGekko_2026-07-21T04-38-57.pdf
  x-amz-expiration: expiry-date="Thu, 20 Aug 2026 04:38:57 GMT",
                    rule-id="auto-delete-30d"
```

**R2 annonce lui-même la date d'effacement de chaque objet, et le nom de la
règle.** 30 jours après le `LastModified`. La pièce du 2026-07-20 est arrivée à
échéance **le 2026-08-19 à 04:38:58 UTC** — quelques heures avant cette
vérification. La chaîne a été ouverte le 2026-08-19 à 13:36 UTC : **elle a été
ouverte sur une pièce déjà effacée depuis neuf heures.**

## Le calendrier — 31 pièces, une par jour

| Date | Pièces effacées | Reste |
|---|---:|---:|
| **2026-08-20** *(demain 04:38 UTC)* | 1 | 30 |
| 2026-08-21 → 2026-08-28 | 1/jour | 22 |
| 2026-08-29, 08-30 | 2/jour | 18 |
| 2026-08-31 → 2026-09-10 | 1/jour | 7 |
| 2026-09-11, 09-12 | 2/jour | 3 |
| 2026-09-13, 09-14 | 1/jour | 1 |
| **2026-09-15** | 1 | **0** |

**Au 2026-09-15, les 32 lignes d'`EvidenceItem` versées hier désigneront 32
objets inexistants.** La base gardera 32 empreintes de fichiers que plus
personne ne pourra produire.

## Ce qui n'est PAS touché

`evidence/` — les **1 071** pièces de la chaîne principale — **ne porte aucune
en-tête d'expiration**. Sondé aux deux extrémités : `Expiration (aucune)`. La
règle est **cantonnée au préfixe `reports/`**. Le sinistre est borné aux 32
archives versées hier.

## Je n'ai rien corrigé, et je ne peux pas lire la règle

`GetBucketLifecycleConfiguration` → **`AccessDenied`**. Les identifiants de ce
dépôt ne peuvent pas lire la configuration du bucket — seulement l'en-tête
`x-amz-expiration` que R2 attache à chaque objet. **La règle est donc établie
par ses effets, pas par sa déclaration.** Sa portée exacte (préfixe, filtres) et
sa date de création restent **UNKNOWN** — elles se lisent dans le tableau de
bord Cloudflare, pas d'ici. `GetBucketVersioning` → `AccessDenied`,
`ListObjectVersions` → `NotImplemented` : **aucune restauration par version
n'est possible depuis cette machine.**

⛔ **Aucun `capturedAt` n'a été touché. Aucune ligne n'a été écrite. Aucun objet
R2 n'a été écrit ni supprimé.** La session base était `READ ONLY`.

---

# 2. LES 32 OBJETS, RELUS ET RECALCULÉS EN FLUX · **VERIFIED (31/32)**

`GetObject` → `crypto.createHash("sha256")` en flux, octet par octet, confronté
à `EvidenceItem.sha256`.

| Contrôle | Résultat |
|---|---|
| lignes sous `reports/%` | **32** |
| **empreintes concordantes** | **31** |
| **empreintes divergentes** | **0** |
| **objets illisibles** | **1** *(NoSuchKey)* |
| tailles divergentes | **0** |

**Aucune falsification, aucune corruption.** Les 31 pièces encore présentes
portent exactement les octets que la base affirme. L'inventaire du 18 était
juste — il l'était **le 18**.

## L'inventaire signé confirme que la pièce manquante a existé · **VERIFIED**

`~/interligens-snapshots/evidence/reports-archive-inventory-2026-08-18T11-09-27Z.json`
— `shasum -c` : **OK**, et son empreinte
`283ff8852878afbc1efc85f40451ba3d59c6f71ed50ceb7d9a6f3c26cf817d63` est
**identique** à celle inscrite dans les `notes` des 32 pièces.

L'entrée de la pièce disparue :

```json
{ "r2Key": "reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf",
  "size": 182296, "bytesRead": 182296, "sizeMatchesListing": true,
  "lastModified": "2026-07-20T04:38:58.270Z",
  "sha256": "0467e0c8ae5597b7b9cfca6afe5d0216097747c0415492cf03356006a2f3b06f" }
```

`bytesRead: 182296` — l'inventaire **a lu les octets** et calculé l'empreinte en
flux. Le `sha256` est identique à celui de la base. **La pièce existait le
2026-08-18 à 11:09 UTC, avec ces octets exacts. Elle a disparu entre cette date
et aujourd'hui.** L'inventaire signé est aujourd'hui la **seule** attestation
survivante de son contenu — et il vit hors du dépôt, sur une seule machine,
sans copie.

## Un défaut de date, découvert au passage · **VERIFIED**

Les `notes` des 32 pièces déclarent :

> *« DATE OBJECTIVEMENT VERIFIABLE : capturedAt = LastModified de l'objet R2 »*

**C'est faux sur les 32.** `capturedAt` vaut le `LastModified` **moins deux
heures**, aux millisecondes près.

| | inventaire / R2 | base |
|---|---|---|
| pièce du 07-20 | `2026-07-20T04:38:58.270Z` | `2026-07-20T02:38:58.270Z` |
| écart, 31 pièces lisibles | — | **−2 h 00 sur 31/31** |

Une heure locale (`Europe/Paris`, CEST = UTC+2) a été écrite dans une colonne
UTC. Le champ que la chaîne désigne comme son ancre objective **ne vaut pas ce
qu'il déclare valoir**. Le `LastModified` réel reste vérifiable dans R2 tant que
l'objet existe, et dans l'inventaire signé ensuite.

⛔ **Je n'ai rien réécrit.** Corriger `capturedAt` serait modifier une donnée
historique. La correction, si elle a lieu, est une décision — et elle
s'inscrit, elle ne s'applique pas en silence.

## Les deux `latest.pdf` écartés · **VERIFIED — état documenté attendu, confirmé**

| clé | R2 | octets | sha256 | entrées de chaîne |
|---|---|---:|---|---:|
| `reports/deployer_pool/latest.pdf` | **présent** | 125 190 | `71bef305…effca` | **0** |
| `reports/GordonGekko/latest.pdf` | **présent** | 182 301 | `b5598a39…a928cf` | **0** |

Présents dans R2, **aucune entrée de chaîne**, empreintes identiques à celles
annoncées au CORRECTIF 3. **Exactement l'état documenté.** Le bucket contient
**33** objets sous `reports/` : 31 versés lisibles + 2 écartés. Le 34ᵉ, c'est
celui qui a expiré.

*Ils expirent aussi : le 2026-09-12 et le 2026-09-15.*

---

# 3. LE CONTRÔLE R2 DU WATCHDOG — QUESTION C2 · **REFUTED, et c'est pire**

## Ta question suppose qu'un contrôle R2 existe et qu'il est en panne. Il n'existe pas.

`src/scripts/watchdog/watcher-health.mjs:283-291` — le compteur nº 4, en entier :

```sql
SELECT count(*) FILTER (WHERE "notes" LIKE '[R2:UNAVAILABLE]%')::int AS accidental,
       count(*) FILTER (WHERE "notes" LIKE '%HASH-ONLY%')::int        AS deliberate
  FROM "EvidenceItem" WHERE "r2Key" IS NULL
```

**Il n'y a aucun appel à R2. Pas de `HeadObject`, pas de `GetObject`, pas de
client S3 dans tout le fichier.** `[R2:UNAVAILABLE]` n'est pas un état : c'est
une **chaîne de caractères écrite dans `notes` au moment de l'insertion** par
`src/lib/evidence-chain/ingest.ts:84`, quand `evidenceR2ConfigFromEnv()` avait
rendu `null`. Le compteur relit une **étiquette posée dans le passé**.

**Il n'est donc pas « indisponible depuis deux jours ». Il n'a jamais regardé
R2, pas une fois, depuis qu'il existe.** Le « 0 » n'est pas une absence de
mesure : c'est une mesure **exacte** — d'autre chose.

## Le contrôle peut-il échouer ? Les quatre niveaux

| | Verdict | Mesure |
|---|---|---|
| **C0** présence | ✅ | le compteur existe, `watcher-health.mjs:283` |
| **C1** exécution | ✅ | requête exécutée ; en cas de panne base, `catch` → `ERREUR check` — **pas** un 0 silencieux |
| **C2** sensibilité | ⚠️ **partielle** | le `FILTER` est vivant : même requête, motif présent en base → **1**. Le 0 vient de `anywhere = 0` : **aucune ligne de la table ne porte le marqueur** |
| **C3** discrimination | ❌ | **il ne discrimine pas ce qu'il a l'air de discriminer** |

**Le C2 est passé, et c'est ce qui rend le résultat trompeur.** Le compteur
*peut* rendre autre chose que 0 — mais seulement si une ligne porte l'étiquette.
Il ne peut rendre autre chose que 0 pour **aucun** état de R2.

Sa clause `WHERE "r2Key" IS NULL` **exclut 1 103 des 1 104 lignes de la table.**
Les 1 103 lignes qui désignent un objet R2 ne sont regardées par **aucun** des
quatre compteurs du watchdog. **La pièce effacée aujourd'hui est dans ces
1 103.** Le watchdog aurait dit « 0 accidentel » ce matin, et il aurait dit « 0
accidentel » le 2026-09-16, la chaîne entièrement vide.

**Réponse directe à ta question :** oui, c'est un contrôle qui ne peut pas
échouer sur le fait qu'il paraît couvrir. Mais la formulation exacte est plus
grave que « il affiche un 0 quand il n'arrive pas à regarder » — **il n'essaie
jamais de regarder, et son 0 est sincère.** C'est la pire des deux versions :
un contrôle en panne finit par se voir ; un contrôle qui mesure autre chose que
son nom ne se voit jamais.

## Le correctif existe, il est écrit, il est testé — et il n'est pas sur `main`

`feat/cc-offline-79-evidence-observabilite` (B3, `3158d53`) ajoute au compteur
nº 4 le **total** et l'**écart sans marqueur**, avec 15 tests
(`__tests__/security/evidence-observability.test.ts`). **`main` porte la source
de B3 antérieure (`f96c9a6`, déjà dans la base `b010529`) mais PAS ce
correctif-ci** : `git diff HEAD feat/cc-offline-79 -- watcher-health.mjs` rend
**+48 lignes**. Le fichier déployé est la version à deux compteurs.

**Et même B3 n'aurait pas vu l'incident d'aujourd'hui.** Il compte mieux les
lignes `r2Key IS NULL` ; il ne sonde toujours pas R2. Le contrôle qui manque
n'existe sur aucune branche.

## Ce que le compteur, lui, dit correctement · **VERIFIED**

`r2Key IS NULL` : **1** ligne — `cmssyx6se…`, sonde `vision-ingest`
`probe-930aee8d` du 2026-08-14, 118 octets, sans marqueur, comptée nulle part.

Et le balayage complet en trouve une **seconde**, d'une autre nature :
`cmst0d2yn…`, `evidence/5b/5b2dcac7….png`, 104 octets, sonde `probe2-5b2dcac7`
du 2026-08-14 — **`r2Key` renseignée, objet absent de R2**. Elle ne porte
aucune en-tête d'expiration : sa disparition n'est **pas** l'effet de
`auto-delete-30d`. Cause **UNKNOWN**.

**Les « orphelins à 2, pas 0 » du préambule sont donc mesurés, et ce sont bien
deux : une sans clé, une à clé morte.** Aucune n'est visible dans le watchdog.

## Balayage complet des 1 103 références R2 · **VERIFIED**

| Contrôle | Résultat |
|---|---|
| références `r2Key` non nulles | **1 103** |
| **objets absents** | **2** — les deux nommés ci-dessus |
| tailles divergentes | **0** |
| **sous règle d'expiration** | **31** — les 31 `reports/` survivants, **et eux seuls** |

---

# 4. LE DELTA DE TESTS · **L'HYPOTHÈSE EST REFUTED**

## Elle t'arrangeait. Elle est fausse sur son point central.

| Hypothèse | Verdict |
|---|---|
| `3 171` = après le correctif de contrat | **VERIFIED** |
| `+8` = `sql-execution-file-lint.test.ts` (PR #123) → `3 179` | **VERIFIED** |
| `3 188 − 3 171 = 17` tests **présents le 18, absents le 19** | **REFUTED** |

## Les trois totaux, mesurés — pas recopiés

Suite complète exécutée à chaque point, rapporteur JSON, même `node_modules` :

| Point | Fichiers | Collectés | **Verts** | Ignorés |
|---|---:|---:|---:|---:|
| `b010529` — base `main` avant la session | 290 | 3 018 | **3 016** | 2 |
| `2b20f74` — après le correctif de contrat | 295 | 3 173 | **3 171** | 2 |
| `7744d8c` — HEAD, PR #123 | 296 | 3 181 | **3 179** | 2 |

**`3 171` et `3 179` sont confirmés par exécution.** Les 2 ignorés sont les
**mêmes** aux trois points — les deux tests *live* de `evidence-chain.test.ts`
(TSA réelle, aller-retour R2). **Aucun test n'a été passé en `skip`.**

## D'où vient `3 188` — ce n'est pas `main` le 18

`RAPPORT_SYNTHESE_AOUT_2026.md:10`, introduit par `b85a124`
(**2026-08-18 21:36:13**), l'écrit lui-même :

> *« Mesuré, **les 19 branches fusionnées séquentiellement sur `origin/main`** »*

**`3 188` est le total d'un arbre de fusion éphémère qui n'a jamais existé comme
commit.** `main` portait ce jour-là 290 fichiers de test. L'arbre fusionné en
portait 295. Comparer `3 188` à `3 179` compare deux arbres différents — c'est
la faute de la journée, une seconde fois : **une valeur qui survit au contexte
qui la produisait.**

## La composition, à l'unité près

L'arbre de fusion se recompose exactement, sans reste :

```
3 016   base b010529
 +  49   endpoint-guard.test.ts            (A9, branche 67)
 +  15   evidence-observability.test.ts    (B3, branche 79)
 +  50   laundry-publication-gate.test.ts        (A12)
 +  40   monetary-publication-gate.test.ts       (A14)
 +  18   monetary-carrier-coverage.test.ts       (A15, AVANT d219d5d)
━━━━━━
= 3 188   ✅ exact
```

Contrôle : sur les 19 branches encore présentes, **deux seulement** touchent un
fichier de test, et **uniquement en ajout** — `git diff --numstat b010529 <br>`
donne `0 files` pour les 17 autres. `endpoint-guard` mesuré à **49** sur
`d132ceb`, `evidence-observability` à **15** sur `3158d53`,
`monetary-carrier-coverage` à **18** sur `4aa6e9f`.

Et `main` se recompose tout aussi exactement :

```
3 016   base b010529
 +  29   a4-idor-sweep.test.ts                (A4)
 +   7   prisma-migrate-target-lock.test.ts   (verrou A9)
 +  50   laundry-publication-gate.test.ts
 +  40   monetary-publication-gate.test.ts
 +  29   monetary-carrier-coverage.test.ts    (APRÈS d219d5d)
━━━━━━
= 3 171   ✅   puis + 8 (PR #123) = 3 179   ✅
```

`b010529 → 2b20f74` : **5 fichiers ajoutés, aucun fichier existant n'a changé de
compte.** Diff par fichier des deux rapports JSON — net exactement +155.

## Le delta réel : **−9**, et il se lit dans les deux sens

| | tests | fichier | pourquoi |
|---|---:|---|---|
| − | **49** | `__tests__/security/endpoint-guard.test.ts` | **jamais sur `main`** — branche 67 (A9) non fusionnée |
| − | **15** | `__tests__/security/evidence-observability.test.ts` | **jamais sur `main`** — branche 79 (B3) non fusionnée |
| + | 11 | `monetary-carrier-coverage.test.ts` | `d219d5d`, **2026-08-18 22:09:26** — 33 min **après** la mesure `3 188` |
| + | 29 | `a4-idor-sweep.test.ts` | A4, fusionné le 18 après la synthèse |
| + | 7 | `prisma-migrate-target-lock.test.ts` | verrou A9, fusionné après |
| + | 8 | `sql-execution-file-lint.test.ts` | PR #123, **non mergée** |
| | **−9** | | |

**SUPPRIMÉS : aucun. SKIPPÉS : aucun. JAMAIS PRÉSENTS SUR `main` : 64 tests,
2 fichiers.** Rien n'a été perdu — **64 tests n'ont jamais été livrés**, et 55
ont été écrits après la mesure. Le chiffre 17 n'a jamais désigné quoi que ce
soit : il vaut `3 188 − 3 171` entre deux arbres incomparables.

## Celui qui touche EVIDENCE, en premier comme demandé

> **`__tests__/security/evidence-observability.test.ts` — 15 tests, branche
> `feat/cc-offline-79-evidence-observabilite` (B3, `3158d53`).**

C'est le seul des deux qui touche l'un des quatre domaines nommés. **Et c'est
exactement le contrôle du §3** : ces 15 tests couvrent le compteur d'orphelins
que le watchdog n'a pas, et qui aurait affiché « 1 SANS MARQUEUR » au lieu de
rien depuis quatre jours. `endpoint-guard.test.ts` (49) porte sur le garde
d'endpoint base — **sa source `src/lib/db/endpointGuard.ts` n'est pas non plus
sur `main`** : le test et le code manquent ensemble, ce qui est le moins mauvais
des deux cas.

---

# CE QUI RESTE UNKNOWN

1. **La règle `auto-delete-30d` elle-même.** Établie par ses effets
   (`x-amz-expiration` sur chaque objet). Sa portée déclarée, ses filtres, sa
   date de création, son auteur : **illisibles d'ici** (`AccessDenied`). Se
   lisent dans le tableau de bord Cloudflare.
2. **Depuis quand elle s'applique.** L'inventaire du 18 trouvait 34 objets dont
   le plus ancien datait du 2026-07-20 — soit 29 jours. Cohérent avec une règle
   déjà active, **pas une preuve**. Aucune archive antérieure au 07-20 n'a
   jamais été observée.
3. **La pièce du 07-20 est-elle récupérable ?** `ListObjectVersions` →
   `NotImplemented`. Aucune restauration depuis cette machine. Une copie
   existe-t-elle ailleurs (poste générateur, Host-005) : **non vérifié**.
4. **Pourquoi `evidence/5b/5b2dcac7….png` a disparu.** Aucune expiration sur ce
   préfixe. Effacement délibéré, sonde nettoyée, ou autre : **non tranché**.
   Le test `evidence-chain — R2 (live) DELETE SUCCEEDS` est une piste — il est
   `skip` aujourd'hui, son historique d'exécution n'a pas été reconstitué.
5. **Le `capturedAt` décalé de 2 h : quelle ligne de `EXECUTION_2026-08-19.sql`
   l'a produit.** Le fait est mesuré sur 31/31 ; l'origine exacte dans le
   fichier n'a pas été isolée.
6. **Les 1 071 pièces `evidence/` : existence vérifiée, empreintes NON
   recalculées.** `HeadObject` seul — clé présente, taille conforme. Une
   substitution d'octets à taille égale ne se verrait pas. Seules les **32** de
   `reports/` ont été rehachées en flux.
7. **`3 188` n'a pas été rejoué.** Les branches A12/A14/A15 ont été rebasées
   puis supprimées : l'arbre de fusion d'origine n'est plus reconstituable. La
   recomposition à `3 188` est **arithmétique et exacte**, à partir de cinq
   mesures indépendantes — ce n'est pas une exécution de cet arbre-là.
8. **Les UNKNOWN 1, 2, 3 et 6 de la passe 2 restent ouverts** : sessions
   d'investigateur en production, `shill-to-exit`, neuf surfaces d'A15,
   valeurs d'avant pour `GordonGekko` et `lynk0x`. Non mesurés aujourd'hui.

---

# CE QUE JE N'AI PAS FAIT

**Aucune écriture.** Session base `READ ONLY` (`SET SESSION CHARACTERISTICS AS
TRANSACTION READ ONLY`). Sur R2 : `GetObject`, `HeadObject`, `ListObjectsV2`
uniquement — **aucun `Put`, aucun `Delete`**. Aucun déploiement, aucun merge,
aucun `capturedAt` touché, aucune donnée historique réécrite.

**Aucune vérification ultérieure n'a été inscrite en base.** Elle l'aurait été
si les 32 concordaient ; elles sont 31. **Cette relecture reste dans ce
document, à sa date réelle — le 2026-08-20.**

**Aucun fichier applicatif modifié.** Un arbre de travail jetable a servi aux
mesures hors du dépôt, puis a été retiré (`git worktree remove` + `prune`).
Exécuter la suite réécrit l'horodatage de
`__tests__/reflex/calibration/last-report.json` — **contenu identique, seul
`generatedAt` change** ; restauré par `git checkout --`.

```console
$ git status --short
?? AGENTS.md
?? AUDIT_CLOSURE_CRITICAL_UNKNOWNS_2026-08-17.md
?? docs/prep/SMOKE_PASSE2_2026-08-19.md
$ git worktree list
/Users/dood/dev/interligens-web  7744d8c [feat/cc-offline-90-fix-virgule-orpheline]
```

Trois fichiers non suivis, antérieurs à cette session. **Aucun `M`.**

---

# LA DÉCISION QUI NE M'APPARTIENT PAS, ET SON HORLOGE

**Une pièce disparaît demain matin à 04:38 UTC** — `06:38` à Paris. Puis une par
jour. Aucune de ces échéances n'attend une réunion.

Ce que je constate, sans le faire : la règle se désactive dans le tableau de
bord Cloudflare, et cette désactivation ne récupère **pas** la pièce du 07-20 —
elle arrête seulement l'hémorragie. Le seul exemplaire survivant du contenu des
32 pièces est l'inventaire signé du 18, et il n'existe **qu'en un exemplaire,
sur une seule machine, hors dépôt**.

Le sixième invariant a tenu : **le contrôle qui affichait `0` n'était pas en
panne — il ne mesurait pas ce que son nom annonçait.** Trois pannes sur trois
étaient dans le contrôle le 19 août. Aujourd'hui, la quatrième aussi.
