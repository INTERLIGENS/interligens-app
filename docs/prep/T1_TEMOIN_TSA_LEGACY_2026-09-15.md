# T1-TÉMOIN-TSA-LEGACY — une pièce, et une seule

**2026-09-15** · branche `feat/cc-offline-213-temoin-tsa-legacy-unique`

Ce que ce témoin établit, mot pour mot :

> INTERLIGENS peut horodater une pièce legacy gouvernée dont la localisation a
> été établie et dont les bytes persistés ont été relus et vérifiés.

**Ce qu'il N'ÉTABLIT PAS**, et la limite était posée d'avance : il ne dit rien
du pipeline d'ingestion Evidence de bout en bout. Aucune pièce n'est née pendant
cette fenêtre, aucun `PUT` n'a été émis, sur aucun compartiment. Le chemin de
naissance reste à éprouver par le vertical slice suivant, et ce document ne doit
pas être lu comme s'il l'avait fait.

Le mécanisme employé est un **timestamp RFC 3161 avec vérification offline et
chaîne archivée**.

---

## La chaîne, point par point

| # | Étape | Résultat |
|---|---|---|
| 1 | Sélection | `evi_rep_615f749a1d56e9abf5fc2b07` — identité enregistrée AVANT l'opération |
| 2 | Résolution (runtime canonique) | `interligens-reports`, autorité `registre-de-localisation` |
| 3 | GET des octets, aucun repli | 130 927 o |
| 4 | SHA-256 recalculé DEPUIS LES OCTETS | `7829a0be…b14b90d` |
| 5 | Concordance avec le digest gouverné | OUI |
| 6 | Soumission au repli TSA | `freetsa.org` |
| 7 | Persistance du jeton | 4 643 o, genTime `2026-09-15T11:18:45Z`, 3 certificats archivés |
| 8 | Vérification RFC 3161 OFFLINE | **OK** |
| 9 | Mutant négatif sur le digest | **ÉCHEC attendu** — `message imprint mismatch` |

### Pourquoi CELLE-LÀ

Elle n'a pas été choisie : elle a été **désignée par le sélecteur de
production**. `stamp-pending.ts` ordonne son univers `ORDER BY "ingestedAt" ASC`
et `--limit 1` rend la plus ancienne. Écrire un autre critère de sélection aurait
voulu dire fabriquer un mécanisme qui n'existe pas en production, pour un témoin
censé mesurer la production.

L'identité a été enregistrée **avant** par `--dry-run --limit 1`, c'est-à-dire
par le même sélecteur, sans écriture.

Deux propriétés la rendent de surcroît adaptée : elle appartient à la famille
`deployer_pool` (4 des 31, contre 27 `GordonGekko`), et elle n'est engagée dans
aucun dossier de démonstration — l'horodater ne préempte aucune décision en
attente.

### Le point 9, et la précaution qu'il exige

Un mutant qui ne mute pas est un témoin qui ment. La valeur mutée est donc
**affichée à côté de l'originale** et leur différence est assertée **avant**
l'exécution :

```
[9] digest original : 7829a0be7f295c8122e8ed3de6dda56f99f10b9e611951c3fd2a89e8bb14b90d
[9] digest mutant   : 0829a0be7f295c8122e8ed3de6dda56f99f10b9e611951c3fd2a89e8bb14b90d
[9] le patch a-t-il modifié la valeur ? OUI (position 0 : « 7 » → « 0 »)
[9] VERIFY OFFLINE (digest mutant) : ÉCHEC — ts_check_imprints: message imprint mismatch
```

---

## Les 30 autres — prouvées, pas affirmées

L'état des **31** identités a été empreint avant l'opération (11 colonnes
chacune, plus le journal de localisation, plus les compteurs de journaux
d'accès), puis réinterrogé après **par id** — jamais par l'univers, car « elle a
disparu de la requête » ne serait pas une mesure de l'état d'une pièce.

```
INTACTES : 30 / 31   MODIFIÉES : 1
  MODIFIÉE  evi_rep_615f749a1d56e9abf5fc2b07   ← LA CIBLE
      tsaNull          : true → false
      tsaProvider      : null → "freetsa.org"
      tsaTimestampedAt : null → "2026-09-15T11:18:45.000Z"
      chainNull        : true → false
JOURNAL DE LOCALISATION : 31 événement(s) (avant 31) — IDENTIQUE
JOURNAUX D'ACCÈS : 1 identité avec un compteur modifié (la cible, 0 → 1)
TABLE : total 1104 · avec_jeton 1070 → 1071 · sans_jeton 34 → 33 · disqualifiées 10
```

Empreinte SHA-256 de l'état avant (31 lignes + journal + compteurs) :
`88532677f356e8c25c755083ebd6fa0330663377ba23006c18c4f9dba83a2053`.

Aucun nettoyage des 1 071 clés historiques, aucun enrichissement du registre,
aucune ligne de journal pour `evidence/5b/…c990.png` — qui reste
`PREEXISTING_UNGOVERNED` et intact. Aucune DDL, aucun backfill, aucun déploiement.

---

## L'invariant ratifié, et où il est inscrit

> Evidence birth authority and evidence readback authority are independent
> gates. Readback of an existing governed object must not depend on
> configuration governing where new evidence may be born.

Le retrait de `ouvrirCompartimentGouverne()` de `readback-verify.ts` est ratifié :
« ce n'est pas la suppression d'un contrôle de sécurité nécessaire, c'est la
suppression d'un contrôle appartenant à une autre frontière d'autorité. »

L'invariant est inscrit à la frontière qu'il gouverne
(`src/lib/evidence-chain/compartment.ts`, section « L'OUVERTURE SUR
DÉSIGNATION ») et rendu **falsifiable** par six témoins
(`__tests__/evidence-chain/ouverture-gouvernee.test.ts`, bloc
`T1-TÉMOIN-TSA-LEGACY`). Les mutants ont été rejoués : re-coupler la relecture à
`R2_EVIDENCE_BUCKET_NAME` fait rougir trois d'entre eux ; réintroduire la porte de
naissance dans la sonde en fait rougir un quatrième.

### La mesure qui fonde l'invariant

Elle n'est pas déduite du code, elle est **observée en vif**. Avec les **trois**
fentes de naissance vidées du processus — `R2_EVIDENCE_BUCKET_NAME`,
`R2_EVIDENCE_ACCESS_KEY_ID`, `R2_EVIDENCE_SECRET_ACCESS_KEY` (dotenv injecte 88
variables au lieu de 91, il ne les réinjecte pas) — la pièce se résout toujours
sur `interligens-reports` et ses 130 927 octets sont relus, SHA-256 concordant.

La capacité de naissance n'est donc pas une condition de la relecture.

---

## ⚠️ CONSTAT OUVERT — le gate d'amorçage de `stamp-pending.ts`

La condition posée était : ce gate est validé **si et seulement si** il protège
effectivement une capacité nécessaire à l'opération irréversible qui suit.

**Il ne la protège pas.** `stamp-pending.ts:81` appelle
`ouvrirCompartimentGouverne()` et refuse tout le run si la porte de NAISSANCE
est fermée. Or :

1. **La valeur rendue n'est utilisée nulle part.** `compartiment` ne sert qu'à
   la condition de la ligne 82 ; aucune capacité n'en est tirée. Le lecteur
   réellement employé est `lieu.readObject`, lié au compartiment que le
   **registre** désigne (`stampGate.ts:126-140`).
2. **Les variables exigées ne sont pas celles consommées.** Le gate exige
   `R2_EVIDENCE_BUCKET_NAME` (+ `= interligens-evidence` par l'INVARIANT 1) et
   les fentes `R2_EVIDENCE_*`. Le chemin des 31 consomme `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — la fente `reports`, et elle
   seule (`CAPACITES_PAR_COMPARTIMENT`).
3. **Aucune écriture R2 n'a lieu.** L'irréversible de ce job est un jeton chez un
   tiers et quatre colonnes en base. Rien n'y naît, donc aucune capacité de
   naissance n'y est requise.
4. **Le contrôle qu'il prétend faire existe déjà, et mieux placé.**
   `ouvrirCompartimentDesigne` vérifie la capacité **du compartiment désigné**,
   par pièce, et refuse en `CAPABILITY_UNAVAILABLE`. Le gate d'amorçage est un
   doublon à l'échelle du **processus**, ce qui est précisément l'échelle à
   laquelle il devient une condition artificielle.

C'est donc le même défaut que celui déjà retiré de `readback-verify.ts`, au même
titre, dans un fichier qui n'a pas encore été traité. Une mauvaise configuration
du pipeline d'ingestion futur suffirait à bloquer l'horodatage de preuves
historiques correctement localisées.

**Il n'a pas été contourné** : la configuration étant présente sur ce poste, le
gate a été franchi normalement et le témoin a traversé le chemin de production
inchangé. Le retrait n'a pas été pris unilatéralement — il relève de la même
décision que celle déjà ratifiée pour la sonde, et il est soumis tel quel.

---

## Ce qui reste

30 pièces sur les 31 restent en attente. Elles n'ont pas été touchées, et ce
document ne demande pas qu'elles le soient : le lot suit sa propre décision.
`TSA_URL_FALLBACK` / `TSA_CA_URL_FALLBACK` ne sont toujours **pas** posées dans
`.env.local` — elles ont été fournies au seul processus de cette fenêtre.
