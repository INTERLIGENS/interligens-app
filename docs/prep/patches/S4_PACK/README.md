# PACK S4 — classement des 1 102 `EvidenceItem` restées `UNCLASSIFIED`

**À APPLIQUER À LA MAIN, UN FICHIER À LA FOIS. Rien n'a été exécuté.** Aucun
DDL, aucun `UPDATE` : tout ce qui a produit ce pack est de la lecture seule sur
`ep-square-band` (`SET default_transaction_read_only = on`, `BEGIN READ ONLY`,
sortie par `ROLLBACK`).

**Neon SQL Editor uniquement. Jamais `prisma migrate`** — verrou A9, `P1012` à
`getConfig` avant tout accès réseau.

## Préalable constaté : S3 est appliqué

Mesuré le 2026-08-28 : le type `DataNature`, les 14 colonnes et les 5 backfills
de S3 sont en base, **aux comptes exacts prévus par le pack S3** —
`EvidenceItem` 2 / 1 102, `KolTokenLink` 175 / 117, `TokenPriceTracker`
338 / 338 / 340, `token_casefiles` 2 lignes, `KolTokenInvolvement` 15.

## Ordre d'exécution

| # | Fichier | Écrit | Lignes | Dépendance |
|---|---|---|---|---|
| 1 | `01_primary_observation.sql` | `rowNature` | 1 050 | — |
| 2 | `02_editorial_assertion.sql` | `rowNature` | 11 | — |
| 3 | `03_inference.sql` | `rowNature` | 1 | — |
| 4 | `04_temporal_confidence.sql` | `timestampMode` | 1 070 | **aucune** |
| 5 | `05_exclusion_non_evidence.sql` | 2 colonnes + 7 exclusions | 7 | — |
| 6 | `06_mixed_assertion_artifacts_GAP.sql` | **rien** | 0 | — |

Les fichiers 01, 02, 03 et 05 sont **mutuellement exclusifs** : aucune ligne
n'est visée par deux d'entre eux. L'ordre entre eux est libre ; celui du tableau
est simplement celui du contrôle le plus lisible.

**Le fichier 04 est volontairement indépendant de l'ordre** : ses prédicats ne
lisent jamais `rowNature`. Un garde `rowNature = 'UNCLASSIFIED'` y aurait
produit 0 écriture si le fichier 01 passait d'abord. Le piège a été vu et évité.

## Les 1 102 lignes, réparties

| Destination | Lignes | Fichier |
|---|---|---|
| `PRIMARY_OBSERVATION` | 1 050 | 01 |
| `EDITORIAL_ASSERTION` | 11 | 02 |
| `INFERENCE` | 1 | 03 |
| Exclues de la chaîne (restent `UNCLASSIFIED`) | 7 | 05 |
| **Artefacts à affirmations mixtes — restent `UNCLASSIFIED`** | **33** | 06 |

1 050 + 11 + 1 + 7 + 33 = **1 102** ✅ — vérifié par prédicat : les 13 lots
somment à 1 102, 0 ligne non couverte, 0 recouvrement.

**État final attendu de la table** (1 104 lignes) : `PRIMARY_OBSERVATION` 1 052
(dont les 2 de S3), `EDITORIAL_ASSERTION` 11, `INFERENCE` 1, `UNCLASSIFIED` 40.

`THIRD_PARTY_DATA` : **0**. `ESTIMATE` : **0** — la seule estimation repérée
(`solPriceEstimate: 200`) est enfouie dans un artefact mixte, donc non classée.

## Les rulings appliqués

1. **`timestampMode` sur 1 070 lignes** — 145 `approximated-from-repo-history`,
   925 `retroactive`. Doctrine : *nature* = ce qu'est l'acte ; *timestampMode* =
   qualité et origine de la datation ; *confiance* = conséquence des deux.
2. **`evidentiaryStatus` + `exclusionReason`** — additives, **aucun `DEFAULT`**.
   `NULL` = « aucune décision d'exclusion prononcée », jamais « active ».
   `'INCLUDED'` n'est écrit nulle part. `exclusionReason` est **obligatoire**
   dès qu'une ligne est exclue, et un invariant le vérifie en fin de fichier 05.
3. **OPTION C** — les 32 PDF et `BOTIFY_KOL_SCAN_REPORT.json` restent
   `UNCLASSIFIED`, sous le libellé
   `ROW-LEVEL MODEL INSUFFICIENT FOR MIXED-ASSERTION ARTIFACT`.
   Aucune table `EvidenceItemAssertion` n'est créée : chantier ultérieur.
4. **Aucun défaut `UNCLASSIFIED` posé pour finir**, aucun classement forcé
   pour atteindre 100 %.

## Réserve écrite — un fait postérieur à l'arbitrage

`sxyz500_hops.json` (fichier 03, classé `INFERENCE`) porte un champ `_note`
rédigé à la main sur **ses 6 entrées** — p. ex. « Dad wallet — received supply
on BOTIFY + GHOST, sold. Real KolWallet. » Par le critère qui a sorti
`BOTIFY_KOL_SCAN_REPORT.json`, ce fichier relève du même sursis. L'arbitrage l'a
rendu sans cette mesure : la règle est appliquée telle quelle, le fait est écrit.

**Si OPTION C est étendue : ne pas exécuter le fichier 03.** Un seul `UPDATE`,
aucune autre étape n'en dépend.

## Les trois propriétés de S3, tenues à l'identique

**Additif.** Deux `ADD COLUMN IF NOT EXISTS` nullables sans `DEFAULT` (fichier
05), rien d'autre. Aucun `ALTER`, aucun `DROP`, **aucun `DELETE`**.

**Rejouable.** Chaque `UPDATE` est gardé par un état (`rowNature =
'UNCLASSIFIED'`, `timestampMode IS NULL`, `evidentiaryStatus IS NULL`).
Relancer un fichier ne produit rien la seconde fois.

**Jamais d'`UPDATE` global.** 15 `UPDATE`, chacun avec son prédicat explicite et
son compte attendu en commentaire. **Un compte qui diverge = on s'arrête.** Le
lot `REPO_ARTIFACT` en est l'illustration : 3 lignes, 3 destinations
différentes — un `UPDATE` sur `sourceType = 'REPO_ARTIFACT'` les aurait
emportées d'un coup, dont une que l'arbitrage a explicitement mise de côté.

## Une correction par rapport à la proposition initiale

Les 8 fiches « explorateur » étaient proposées en `THIRD_PARTY_DATA`, sur
l'hypothèse que c'étaient des réponses d'API enregistrées telles quelles.
**L'hypothèse était fausse.** Les fichiers existent encore sur le dépôt local ;
leur lecture montre des fiches d'exposition rédigées à la main (`exhibit_id`,
`label`, `classification`, `confidence`) qui *citent* Helius ou Arkham. Une note
d'enquête qui cite un explorateur ne devient pas une donnée d'explorateur.
Elles passent en `EDITORIAL_ASSERTION` (fichier 02).

## Gaps de schéma

**1. Marqueur de confiance temporelle — COMBLÉ, sans DDL.** `timestampMode`
(text) existait déjà avec un vocabulaire vivant (`retroactive`,
`at-ingestion`). Le fichier 04 y promeut un fait **déjà déclaré** en texte libre
dans `notes`. *Réserve : la colonne est un `text` sans `CHECK` ni enum — son
vocabulaire peut dériver. Le contraindre relève de S5.*

**2. Statut d'exclusion probatoire — COMBLÉ par DDL additif.** Aucune colonne de
statut n'existait (`%status%`, `%activ%`, `%exclu%`, `%valid%` : 0 résultat).

**3. Natures par affirmation — NON COMBLÉ, chantier ultérieur.** 33 lignes
restent non classées. Voir le fichier 06.

**4. Circularité — inexprimable en base.** « Un PDF généré n'est jamais preuve
primaire de ses propres conclusions » est ratifié, mais aucune colonne ne le
porte. La règle ne tient que par le fait que ces 33 lignes restent non classées
— une garantie par omission, donc fragile.

**5. Dérive Prisma — EN COURS DE FERMETURE.** `schema.prod.prisma` ne déclare
aucune des 16 colonnes Data Nature. L'exemption guard ciblée est mergée
(`0cf5c66`) ; la PR de recalage est prête mais **ne doit être mergée qu'APRÈS
le fichier 05** — Prisma sélectionne tous les champs scalaires d'un modèle, et
déclarer une colonne absente de la base casserait toute lecture d'`EvidenceItem`
en production.

## Ce que ce pack NE fait PAS

- **Aucun code produit n'est modifié.** Les pièces `EXCLUDED` ne sont filtrées
  nulle part : le filtrage en lecture reste à écrire. Poser la colonne ne suffit
  pas à faire respecter l'exclusion.
- **Aucun `mimeType` n'est corrigé**, alors que 4 captures `.webp` sont rangées
  en `application/octet-stream` et que 51 captures X sont étiquetées `OTHER`.
  Défauts d'ingestion réels, sans effet sur la nature.
- **Aucune recapture par permalien.** Les 753 captures de pages de recherche X
  restent `PRIMARY_OBSERVATION` ; le chantier de recapture est un backlog
  séparé. L'interdit qui l'accompagne — ne jamais citer une page de recherche
  personnalisée comme la preuve canonique d'un tweet — est une règle d'usage,
  elle ne se code pas dans une migration.
- **Aucun `DELETE`**, jamais.
