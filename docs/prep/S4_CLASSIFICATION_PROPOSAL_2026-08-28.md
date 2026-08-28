# S4 — CLASSEMENT DÉFINITIF · EvidenceItem
### 2026-08-28 · **CLÔTURÉ** — pack exécuté en base, recalage Prisma fermé, guard refermé

> **État final mesuré** : `PRIMARY_OBSERVATION` 1 052 · `EDITORIAL_ASSERTION` 11
> · `UNCLASSIFIED` 41 (34 mixtes + 7 exclues) · `INFERENCE` 0 ·
> `THIRD_PARTY_DATA` 0 · `ESTIMATE` 0. Fichiers passés : 01, 02, 04, 05, 06.
> Le **03 est RETIRÉ**, jamais exécuté.

---

## LA DOCTRINE DATA NATURE

> Un `EvidenceItem` dont les affirmations sont de natures **non homogènes**
> reste `UNCLASSIFIED` jusqu'à classification au niveau **assertion**.
> `rowNature` ne force **jamais** une nature globale.

**`UNCLASSIFIED` ≠ `EXCLUDED`.** Une pièce non classée est **dans** la chaîne
probatoire : elle compte, elle est opposable, elle attend un classement plus
fin. Une pièce `EXCLUDED` n'y participe plus. Deux colonnes, deux
significations — les confondre ferait disparaître 34 pièces valides.

Corollaire mesuré, et il n'était pas prévu : `INFERENCE`, `THIRD_PARTY_DATA` et
`ESTIMATE` valent **0** sur `EvidenceItem`. Chaque artefact qui aurait pu les
porter s'est révélé mixte à la lecture. Le corpus probatoire du produit ne
contient presque aucun document mono-nature en dehors des captures d'écran.

Mesures faites sur `ep-square-band` en **lecture seule** :
`SET default_transaction_read_only = on`, `BEGIN READ ONLY`, sortie par
`ROLLBACK`. Aucun `UPDATE`, aucun DDL, aucun `.sql` exécuté, rien mergé.

Pack : **`docs/prep/patches/S4_PACK/`** — 6 fichiers, 16 `UPDATE` bornés,
2 `ADD COLUMN` additifs, **0 `DELETE`**.

---

## 0. Préalable constaté : S3 est appliqué

Le type `DataNature`, les 15 colonnes et les 5 backfills de S3 sont en base,
**aux comptes exacts prévus** : `EvidenceItem` 2 / 1 102, `KolTokenLink`
175 / 117, `TokenPriceTracker` 338 / 338 / 340, `token_casefiles` 2 lignes,
`KolTokenInvolvement` 15. Les 1 102 lignes traitées ici existent réellement.

---

## 1. Règles ratifiées

**R1 — la nature qualifie l'ACTE, pas la vérité du contenu.** Une capture
d'écran atteste que cet écran a affiché cela. Ni l'authenticité du post, ni la
véracité de ce qu'il dit. La nature de la chose montrée ne remonte pas à la
pièce.

**R2 — nature ≠ confiance.** Un horodatage faible, une provenance dégradée, un
ancrage manquant sont des défauts de **poids probatoire**. Ils se portent
ailleurs. **Reclasser une capture mal datée en `THIRD_PARTY_DATA` est interdit**
— ce serait mélanger les deux axes et faire disparaître la pièce du lot où un
enquêteur la cherchera.

**R3 — conteneur ≠ pièce.** Une archive dont les membres sont versés
individuellement, un déchet système : aucune affirmation portée. Exclusion, et
**jamais de `DELETE`**.

### Arbitrages rendus

| Sujet | Décision |
|---|---|
| **Pivot (164)** | `PRIMARY_OBSERVATION`, confiance temporelle FAIBLE portée par un marqueur explicite. Pas de reclassement (R2). |
| **753 pages de recherche X** | `PRIMARY_OBSERVATION` de ce que la page a montré à ce compte à cet instant. Recapture par permalien = chantier séparé (backlog). **Interdit d'usage** : citer une page de recherche personnalisée comme preuve canonique d'un tweet. |
| **32 PDF générés** | Classer par affirmation — calculé = `INFERENCE`, chiffré = `ESTIMATE`, commentaire = `EDITORIAL_ASSERTION`. Le PDF-artefact n'est **jamais** preuve primaire de ses propres conclusions. |
| **7 artefacts techniques** | Exclusion de la chaîne probatoire active. Conservés pour l'audit de provenance. Pas de `DELETE`. |

---

## 2. Une correction : la lecture des fichiers a infirmé ma proposition

Les 8 fiches « explorateur » étaient proposées en `THIRD_PARTY_DATA`, sur
l'hypothèse que c'étaient des réponses d'API enregistrées telles quelles. Les
7 fichiers concernés existent encore sur le dépôt local. Leur ouverture montre
autre chose :

```json
{ "exhibit_id": "EX-03", "type": "onchain_cashout",
  "label": "Associated Wallet B (BK cluster) — GHOST/BOTIFY cashout $802",
  "amount_usd": 802, "source": "Helius API v0",
  "classification": "on_chain_verified", "confidence": "confirmed" }
```

Ce sont des **fiches d'exposition rédigées à la main**. Le montant vient de
Helius ; l'attribution au cluster BK, la classification et le jugement
« confirmed » viennent de nous. Une note d'enquête qui cite un explorateur ne
devient pas une donnée d'explorateur — sinon toute citation transformerait son
auteur en source tierce.

→ **`EDITORIAL_ASSERTION`.** Conséquence : `THIRD_PARTY_DATA` n'apparaît nulle
part dans le pack S4.

Même méthode pour les 2 JSON sociaux : ils portent le même `exhibit_id`
(EX-01), la **transcription manuscrite** du post @kokoski, et
`screenshot_needed: true` — aucune capture n'existe. La transcription est le
seul enregistrement du post. Ce n'est pas une observation : personne n'a vu
l'écran.

---

## 3. Tableau de lots final

13 lots, prédicats remesurés le 2026-08-28. **Somme = 1 102, 0 ligne non
couverte, 0 recouvrement** (vérifié par requête).

| # | Lot | n | Nature | Fichier | Justification |
|---|---|---|---|---|---|
| 1 | `migrate-snapshots` · URL = page de recherche X | **753** | `PRIMARY_OBSERVATION` | 01 | Atteste l'écran rendu à ce compte à cet instant (R1). |
| 2 | `migrate-snapshots` · URL = profil X nu | **133** | `PRIMARY_OBSERVATION` | 01 | Idem, ancrage source présent. |
| 3 | `migrate-snapshots` · sans `sourceUrl` | **39** | `PRIMARY_OBSERVATION` | 01 | Pivot. Ancrage manquant = poids, pas nature (R2). |
| 4 | `backfill` · `X_POST` · png | **60** | `PRIMARY_OBSERVATION` | 01 | Pivot. Captures d'archives `CAPTURE (X)`, `BK DIONE`. |
| 5 | `backfill` · `OTHER` · png | **51** | `PRIMARY_OBSERVATION` | 01 | Pivot. `sourceType` faux (19 Gordon, 9 @planted, 5 site web) ; l'acte décide. |
| 6 | `backfill` · `EXPLORER` · png | **10** | `PRIMARY_OBSERVATION` | 01 | Pivot. Écran d'explorateur : contenu tiers, acte d'observation. |
| 7 | `backfill` · `.webp` en `octet-stream` | **4** | `PRIMARY_OBSERVATION` | 01 | Pivot. `mimeType` mal deviné à l'ingestion. |
| 8 | `backfill` · `EXPLORER` · json — **fiches de pièce** | **8** | `EDITORIAL_ASSERTION` | 02 | Fiches rédigées citant Helius / Arkham. **Corrigé** (§2). |
| 9a | `INDEX.json` (sha `394fdc21…`) | **1** | `EDITORIAL_ASSERTION` | 02 | Sommaire de dossier : n'observe ni ne calcule. |
| 9b | `sxyz500_hops.json` (`9cc752c6…`) | **1** | *aucune — OPTION C étendue* | 06 | `INFERENCE` (hopIndex, amountUsd) + `_note` rédigé sur **ses 6 entrées**. Fichier 03 **RETIRÉ**. |
| 9c | `BOTIFY_KOL_SCAN_REPORT.json` (`1608ed3e…`) | **1** | *aucune — OPTION C* | 06 | Artefact mixte : agrégats `INFERENCE` + `solPriceEstimate` `ESTIMATE`. |
| 10 | `backfill` · `X_POST` · json — transcriptions | **2** | `EDITORIAL_ASSERTION` | 02 | Transcription manuscrite, `screenshot_needed: true`. |
| 11 | Archives ZIP conteneurs | **5** | *exclusion* | 05 | Membres déjà versés (R3). |
| 12 | `.DS_Store` | **2** | *exclusion* | 05 | Métadonnée macOS, n'atteste rien (R3). |
| 13 | PDF de cas générés | **32** | *aucune — OPTION C* | 06 | Multi-affirmations : `rowNature` ne peut pas les porter. |

Le lot 9 était annoncé homogène : il ne l'est pas. Ses 3 lignes partent dans
**trois directions différentes** — `EDITORIAL_ASSERTION`, `INFERENCE`, et
OPTION C. D'où trois prédicats par `sha256` plutôt qu'un `UPDATE` sur
`sourceType = 'REPO_ARTIFACT'`, qui les aurait emportées d'un coup, dont une que
l'arbitrage a explicitement mise de côté.

### Répartition finale

| Destination | Lignes |
|---|---|
| `PRIMARY_OBSERVATION` | 1 050 |
| `EDITORIAL_ASSERTION` | 11 |
| `INFERENCE` | 0 |
| Exclues de la chaîne — `EXCLUDED` | 7 |
| **Artefacts à affirmations mixtes — OPTION C** | **34** |
| **Total** | **1 102** ✅ |

État final **mesuré** sur 1 104 lignes : `PRIMARY_OBSERVATION` 1 052 (dont les
2 de S3), `EDITORIAL_ASSERTION` 11, `UNCLASSIFIED` 41 = 34 mixtes + 7 exclues.

Les 34 ont un prédicat canonique, sans colonne supplémentaire :
`rowNature = 'UNCLASSIFIED' AND "evidentiaryStatus" IS NULL` — *non classé, et
non exclu*. Ils sont inscrits au backlog `EvidenceItemAssertion`
(`S4_PACK/BACKLOG_EvidenceItemAssertion.md`).

`THIRD_PARTY_DATA` : **0**. `ESTIMATE` : **0** — la seule estimation repérée
(`solPriceEstimate: 200`) est enfouie dans un artefact mixte, désormais non
classé au titre d'OPTION C.

---

## 4. Gaps de schéma surfacés

**1. Marqueur de confiance temporelle — COMBLÉ, sans DDL.** `timestampMode`
(text) existait déjà avec un vocabulaire vivant (`retroactive`,
`at-ingestion`). Le fichier 04 y **promeut en colonne un fait déjà déclaré en
texte libre** dans `notes` — il n'invente rien. Deux valeurs, parce que les
deux faiblesses sont différentes :

- `approximated-from-repo-history` — **145 lignes** dont `capturedAt` est la
  date d'un commit git (mesuré : 145/145 portent « vraie date de capture
  inconnue » dans leurs notes, zéro exception). C'est le marqueur ratifié.
- `retroactive` — **925 lignes** à `capturedAt` déclaratif issu d'un
  `observedAt` source. Valeur déjà en usage sur les 32 PDF.

*Portée étendue, à signaler :* le pivot ratifié couvrait 164 lignes, le fichier
04 en marque 1 070. Raison : la faiblesse temporelle est une propriété de la
**fabrication** de la ligne, pas de son classement — la restreindre au pivot
laisserait 906 lignes également dégradées sans marqueur. Écriture gardée,
rollback fourni : vetoable en une commande.

*Réserve :* `timestampMode` est un `text` sans `CHECK` ni enum — son
vocabulaire peut dériver. Le contraindre relève de S5.

**2. Statut d'exclusion probatoire — COMBLÉ par DDL additif.** Vérifié :
`EvidenceItem` ne portait **aucune** colonne de statut (`%status%`, `%activ%`,
`%exclu%`, `%valid%` → 0 résultat). L'exclusion ratifiée était donc
inexprimable. Le fichier 05 ajoute `evidentiaryStatus` et `exclusionReason`,
nullables, sans `DEFAULT`.

**`NULL` ne signifie pas « active »** mais « aucune décision d'exclusion
prononcée ». Écrire `'ACTIVE'` sur les 1 097 autres affirmerait qu'elles sont
toutes probatoirement valides — ce que personne n'a établi. Même faute que
classer les 1 070 `NULL` pour finir S3.

**3. Natures par affirmation — NON COMBLÉ. OPTION C ratifiée.** `rowNature` est
au niveau ligne, pour un artefact. Le régime FIELD ne sauve rien : il nomme des
**colonnes**, et les affirmations d'un rapport sont dans le document, hors du
schéma. Aucun des quatre régimes du registre ne décrit un document.

**33 lignes restent `UNCLASSIFIED`**, sous le libellé porté en tête du fichier
06 : `ROW-LEVEL MODEL INSUFFICIENT FOR MIXED-ASSERTION ARTIFACT`. Ce n'est pas
un abandon, c'est le résultat — assigner une nature unique mentirait sur les
autres, et « aucun classement forcé pour atteindre 100 % » est une contrainte
ferme.

La règle de classement resterait applicable si un porteur existait (calculé →
`INFERENCE`, chiffré → `ESTIMATE`, commentaire → `EDITORIAL_ASSERTION`). Ce qui
manque n'est pas la règle : c'est l'endroit où l'écrire. **Aucune table
`EvidenceItemAssertion` n'est créée** — chantier ultérieur, et son coût réel
n'est pas la migration mais le dépouillement de 33 documents à la main.

*Réserve levée — l'arbitrage a tranché.* `sxyz500_hops.json` portait un `_note`
rédigé à la main sur **ses 6 entrées** ; par le critère qui avait sorti
`BOTIFY_KOL_SCAN_REPORT.json`, il relevait du même sursis. **OPTION C a été
étendue** : le fichier 03 n'a jamais été exécuté et il est marqué `RETIRED`,
son `UPDATE` neutralisé en commentaire. L'ensemble passe de 33 à **34 pièces**.

C'est la réserve écrite *avant* exécution qui a rendu cet arbitrage possible :
sans elle, la pièce serait passée en `INFERENCE` sans que personne ne regarde
son contenu.

**4. Circularité — inexprimable en base.** « Un PDF généré n'est jamais preuve
primaire de ses propres conclusions » est ratifié, mais aucune colonne ne le
porte. La règle ne tient aujourd'hui que par le fait que ces 32 lignes restent
non classées — une garantie par omission, donc fragile.

**5. Dérive Prisma — FERMÉE.** Schéma recalé (PR #173, main `dca38bc`),
vérifié colonne par colonne contre `information_schema` : 0 divergence, enum
identique valeur par valeur et dans le même ordre. Exemption guard refermée
byte-identique (PR #176, main `090cc52`). *Détail de la fermeture ci-dessous.*

**5-bis. Le contexte de la fermeture.** `schema.prod.prisma` ne déclare
**aucune** des 16 colonnes Data Nature (14 de S3 déjà en base + 2 de S4).
L'exemption guard ciblée est mergée (`0cf5c66`, PR #172), limitée au seul
`^prisma/schema\.prod\.prisma$`.

*Correction de cible :* l'ordre nommait `prisma/schema.prisma`. Ce fichier
compte 53 modèles et **ne contient pas `EvidenceItem`** — il n'y a rien à y
déclarer. Le fichier qui porte les 5 modèles concernés est
`prisma/schema.prod.prisma` (160 modèles), et c'est celui que l'exemption vise.

*Contrainte d'ordre :* la PR de recalage **ne peut être mergée qu'après le
fichier 05**. Prisma sélectionne tous les champs scalaires d'un modèle :
déclarer `evidentiaryStatus` avant que la colonne existe casserait toute
lecture d'`EvidenceItem` en production. L'inverse est sans risque — une colonne
en base non déclarée est simplement ignorée.

---

## 5. Périmètre — ce qui n'est pas touché

- **Les 117 `KolTokenLink` en `PENDING:*`** restent `UNCLASSIFIED` par
  conception. Vérifié : toujours 117.
- **Les lignes classées en S3** ne sont pas reconsidérées. Le rollback du
  fichier 01 exclut explicitement les 2 `FIRST_PARTY_CAPTURE`.
- **Aucun code produit n'est modifié.** Les pièces `EXCLUDED_NON_EVIDENCE` ne
  sont filtrées nulle part : poser la colonne ne fait pas respecter l'exclusion.
  Le filtrage en lecture reste à écrire.
- **Aucun `mimeType` n'est corrigé** (4 `.webp` en `octet-stream`, 51 captures X
  étiquetées `OTHER`). Défauts d'ingestion réels, sans effet sur la nature.
- **Aucune recapture par permalien.** Backlog séparé.

---

## 6. Discipline S3, tenue à l'identique

**Additif** — 2 `ADD COLUMN IF NOT EXISTS` nullables sans `DEFAULT`, rien
d'autre. Aucun `ALTER`, `DROP` ou `DELETE` (vérifié par balayage des 6 fichiers).

**Rejouable** — chaque `UPDATE` gardé par un état : `rowNature =
'UNCLASSIFIED'`, `timestampMode IS NULL`, `evidentiaryStatus IS NULL`.

**Jamais d'`UPDATE` global** — 15 `UPDATE`, chacun avec son prédicat explicite
et son compte attendu en commentaire. Un compte qui diverge = arrêt.

**Un piège d'ordre évité** : le fichier 04 ne lit jamais `rowNature`. Un garde
`rowNature = 'UNCLASSIFIED'` y aurait produit 0 écriture si le fichier 01
passait d'abord. Les fichiers 01, 02, 03, 05 sont mutuellement exclusifs ;
le 04 est indépendant de l'ordre ; le 06 n'écrit rien.


---

## 7. Ce qui reste ouvert après la clôture

**Le backlog `EvidenceItemAssertion`** — 34 pièces, sans date. Le coût n'est pas
la migration mais le dépouillement de 34 documents à la main. Voir
`S4_PACK/BACKLOG_EvidenceItemAssertion.md`.

**La doctrine n'est pas exécutable.** `src/lib/data-nature/` ignore la notion
d'artefact à affirmations mixtes : rien, dans le code, n'empêche d'écrire une
`rowNature` sur l'une des 34. La règle de circularité — un PDF généré n'est
jamais preuve primaire de ses propres conclusions — ne tient elle aussi que par
le fait que ces lignes restent non classées. **Une garantie par omission**, qui
disparaîtra sans bruit le jour où quelqu'un les classera sans connaître la
règle. La rendre opposable (invariant ou test) reste à faire.

**Le filtrage des pièces exclues** n'existe pas : `evidentiaryStatus` est posé,
mais aucune lecture produit ne le consulte. Poser la colonne ne fait pas
respecter l'exclusion.

Aucun de ces trois points n'est dans S5, qui porte sur les `methodRef` des
39 estimations sans méthode (`KolWallet` 29 + `KolCase` 10).
