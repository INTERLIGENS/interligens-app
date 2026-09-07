# BUILD 9 — les quatre blocs SQL, et le modèle qui les gouverne

Branche `feat/cc-offline-159-build9-casefile`, depuis `main = 2f3761b`.
**Aucun write prod, aucune DDL exécutée.** Le SQL est rendu, pas lancé.

---

## STATUS

Séquence 1 à 4 livrée sous forme de **quatre blocs SQL exécutables**, chacun
avec ses post-checks et leurs valeurs attendues. Le modèle des trois états est
en place et testé. Étapes 5 à 7 (régime de publication unique, versioning,
rétrogradation des presets) restent à faire.

Un STOP conservé s'applique et est respecté : **tout write prod reste à
exécuter par le fondateur**, même ratifié.

---

## LES QUATRE BLOCS, DANS L'ORDRE

| ordre | fichier | opération |
|---|---|---|
| 1 | `01_containment_20_snapshots.sql` | dépublication des 20 |
| 2 | `02_attach_50_vine.sql` | rattachement des 50 |
| 3 | `03_ddl_three_structures.sql` | DDL des trois structures |
| 4 | `04_migration_38.sql` | migration des 38 — **généré** |

Tous dans `docs/prep/patches/BUILD9/`.

### Bloc 1 — dépublication

`isPublic = false`, `reviewStatus = 'excluded'`, raison structurée
`EXCLUDED_FROM_PUBLICATION/INSUFFICIENT_PROVENANCE` en note, nommant les champs
manquants — `sha256`, `sourceUrl`, `canonicalMint` — **jamais un contenu**.

Aucune contrainte `CHECK` n'existe sur `reviewStatus` (vérifié : seule la clef
primaire), le vocabulaire s'étend donc **sans DDL**.

Rien n'est détruit, aucun hash n'est fabriqué, aucun sujet n'est inféré. Le
post-check 1.3 le vérifie explicitement : `hash_fabriques = 0`,
`sujets_inferes = 0`, `observedat_intact = 17`.

### Bloc 2 — rattachement

Un seul champ posé, `canonicalMint`. `isPublic = false` **préservé**, `sha256`,
`observedAt`, `sourceUrl` et `reviewStatus` intacts — post-check 2.3.

Le post-check 2.2 vérifie qu'**aucune promotion** n'a eu lieu.

> **Note de séquençage.** `token_casefiles` ne contient aucun dossier VINE (ni
> BOTIFY) — seulement BLACKBULL et LAB. Le rattachement pose une identité et ne
> dépend pas de la ligne ; la jointure vers un dossier ne **résoudra** qu'après
> le bloc 4. Le bloc 2 est valide seul, son effet visible est différé.

### Bloc 3 — DDL, trois structures et pas six

| créé | motif |
|---|---|
| `CaseFileSource` | sans registre, une `evidenceRef` ne résout contre rien |
| `CaseFileClaim` | porte `claims` **et** `new_claims` — une structure, deux noms |
| `CaseFileShiller` | 9/9 démontrés chez VINE |
| `CaseFileSmokingGun` | 1/13 démontré |

| **non créé** | motif |
|---|---|
| `timeline` | BOTIFY 0/7, VINE 0/10 — aucun fait démontré |
| `requisitions` | BOTIFY 0/3, VINE 0/6 — aucun fait démontré |
| `wallets_onchain` | `token_casefiles."keyWallets"` existe et est rempli |

Les trois états vivent **dans le schéma**, pas en commentaire : deux types
`ENUM` et cinq contraintes `CHECK` qui refusent les promotions non gagnées —
un claim `PUBLIC` exige une nature classée et au moins une référence ; un
shiller `PUBLIC` exige une source ; un smoking gun `PUBLIC` exige une signature
de transaction ou une source publique.

Une contrainte porte le contrat d'exclusion : `exclusionReason` non nul exige
un `excludedField` **qui soit un identifiant**.

### Bloc 4 — migration, générée

`node scripts/casefile/generate-migration-sql.mjs` — le SQL **dérive des
fichiers sources**, il n'est pas saisi à la main. Régénération vérifiée
identique.

| | migrés | sur | règle |
|---|---|---|---|
| sources BOTIFY | 8 | 8 | registre du dossier |
| claims BOTIFY | 8 | 8 | `evidence_refs` qui **résolvent** |
| claims VINE | 8 | 9 | `thread_url` (C13 n'en a pas) |
| shillers VINE | 9 | 9 | `tweet_url` |
| wallets VINE → `keyWallets` | 4 | 4 | `solscan_url` |
| smoking guns VINE | **1** | 13 | signature de transaction |
| **total** | **38** | | |

**Tout entre en `state = 'ATTACHED'` et `rowNature = NULL`.** Rattacher n'est
pas publier, et la nature n'est pas devinée : un élément non classé reste
`UNCLASSIFIED` donc impubliable, et les `CHECK` du bloc 3 le garantissent
mécaniquement.

Les deux dossiers canoniques sont créés **sans score, sans verdict, sans
montant** : rien de tout cela n'est démontré pour ces sujets.

Les `evidenceRefs` des claims VINE sont laissées **vides**. Les 39 références du
fichier sont à 33 de la prose — « screenshots TBC », descriptions de méthode — et
`vine-osint.json` ne porte aucun registre `sources`. Les insérer comme si elles
résolvaient leur donnerait une valeur probante qu'elles n'ont pas.

---

## LE MODÈLE DES TROIS ÉTATS

`src/lib/casefile/publicationState.ts` — 57 tests.

```
ATTACHED    « appartient au corpus de CE dossier »      identité
ADMISSIBLE  « qualifié pour soutenir CETTE assertion »  valeur probante
PUBLIC      « autorisé sur la projection publique »     publication
```

Aucun n'implique le suivant, et les tests le vérifient dans les deux sens : les
20 captures publiées ne sont **même pas `ATTACHED`** (pas de sujet), tandis que
les 50 VINE rattachées sont `ADMISSIBLE` **mais pas `PUBLIC`**.

`isPublic === true` strictement : `"true"`, `1`, `undefined` ne publient pas.

### Une erreur de ma part, trouvée par mon propre test

La première version du garde d'exclusion refusait tout champ contenant trois
chiffres — et rejetait donc `sha256`. Ce n'est pas le nombre de chiffres qui
distingue un nom d'un contenu, c'est la **forme d'identifiant**. Corrigé en
`/^[A-Za-z_][A-Za-z0-9_.]*$/` : `montant 604489` est refusé pour son espace,
pas pour son nombre. Le test couvre maintenant les deux cas.

---

## PROOF

| | |
|---|---|
| suite | **4 788 verts / 4 790**, 2 skipped, 0 rouge |
| typecheck | vert |
| SQL | régénération **identique** au fichier commité |
| guard | `ce13d0c…13e50` — aucun chemin gelé touché, **aucune exemption** |
| prod-write | **0 write, 0 DDL exécutée, 0 Helius, 0 collecte** |

Le contrat de sélection est vérifiable : les comptes du générateur
(`8 · 16 · 9 · 4 · 1`) sont ceux annoncés par la qualification, et le script les
recalcule à chaque exécution depuis les fichiers.

---

## CE QUI RESTE

Étapes 5 à 7 : régime de publication unique sur API/UI/PDF avec la provenance
qui survit au rendu, versioning immuable, rétrogradation des presets en
fixtures.

La provenance au rendu est prête côté modèle mais **pas encore câblée** :
`CaseFileClaim` (le type du renderer) ne porte toujours ni `evidenceRefs` ni
`threadUrl`. Le câblage touche `src/lib/casefile/pdfGenerator.ts` — hors gel — et
les routes API — **gelées**. Une exemption sera nécessaire pour la moitié API.

---

## STOP

**Write prod.** Les quatre blocs touchent la base : dépublication, rattachement,
DDL, migration. Ils sont rendus dans l'ordre, chacun avec ses post-checks et
leurs valeurs attendues. **Je n'en exécute aucun.**

Aucun autre STOP : le périmètre ratifié est tenu, aucune prémisse n'est
contredite, et les deux écarts rencontrés — le total 34 → 38 et le faux positif
`sha256` — étaient les miens et sont corrigés.
