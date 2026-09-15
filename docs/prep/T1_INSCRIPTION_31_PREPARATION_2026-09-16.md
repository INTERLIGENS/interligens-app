# T1-INSCRIPTION-31-PRÉPARATION — 2026-09-16

> **Machine-observed facts should identify the instrument that produced the observation;
> substituting a human operator as observer creates authority that did not perform the
> measurement.**
>
> **Observation timestamps express captured temporal precision, never reconstructed
> precision.**

Branche : `feat/cc-offline-192-inscription-31`, depuis `origin/main` = `6689190`.

**Aucun INSERT exécuté. Aucun DDL. Aucun octet déplacé. La mesure n'a pas été rejouée.**
Le défaut `--json` n'est pas corrigé (backlog). Rien du chemin de déploiement ni du preflight.

---

## 1 · Le SHA de l'instrument : établi, pas supposé

L'attribution `src/scripts/evidence-chain/mesure-localisation.ts@93d08a1` est **valide**, et
voici la chaîne qui l'établit.

| | |
|---|---|
| blob de l'instrument **dans `93d08a1`** | `2bef7ffacae25e769ec7b3e1025f0e6badcd6e9d` |
| blob du **fichier de travail** | `2bef7ffacae25e769ec7b3e1025f0e6badcd6e9d` — **identique** |
| `discrimination.ts` (lib appelée) | `19901c8719b4…` dans les deux |
| `eligibility.ts` (lib appelée) | `099cccc7dc96…` dans les deux |
| seul commit postérieur, `6689190` | ne touche que `scripts/guard-offline.sh` |

**Le point décisif est le `mtime`.** Les trois fichiers de la fermeture de dépendances de
l'instrument ont été écrits pour la dernière fois à **09:20:46Z**, **09:20:46Z** et
**07:14:35Z** — tous **antérieurs** à la campagne (**09:32:32.725Z**). Une modification
suivie d'un retour en arrière aurait laissé un `mtime` **postérieur**. Le contenu d'aujourd'hui
étant byte-identique à `93d08a1`, le contenu à 09:32:32Z l'était nécessairement aussi.

**Certitude : haute.** Ce n'est pas une inférence de commodité — l'argument se ferme des deux
côtés (identité de contenu **et** antériorité d'écriture).

Une précision d'honnêteté : au moment de la campagne, `HEAD` valait **`6689190`**, pas
`93d08a1`. `93d08a1` reste le bon désignateur — c'est le commit qui **introduit** cette version
de l'instrument, et `6689190` lui est byte-identique sur tout le chemin concerné. La condition
de GPT — « 93d08a1 est bien le commit contenant EXACTEMENT l'instrument exécuté » — est donc
satisfaite.

### Le SHA est épinglé, et il ne suivra jamais HEAD

`INSTRUMENT_CAMPAGNE_2026_09_15` dans `mesure-localisation.ts`, en dur, avec le pourquoi
écrit à l'endroit où quelqu'un le lirait avant de « corriger » :

- **il ne suit pas le HEAD du commit qui inscrit** — celui-ci vient forcément *après* la
  campagne ; le faire suivre attribuerait l'observation à un code qui n'existait pas quand
  elle a été faite ;
- **il ne suit pas non plus les éditions de son propre fichier** — qui a changé depuis
  `93d08a1` (il porte cette constante, précisément). La constante enregistre un **fait passé**,
  pas l'état courant du dépôt ;
- **une nouvelle campagne exige une nouvelle constante**, et le nom porte la date pour que
  l'oubli se voie.

Un témoin vérifie que la valeur est littérale et qu'aucun `rev-parse` / `execSync` ne s'en
approche. Le mutant **M7** rougit si l'identité redevient un opérateur humain.

---

## 2 · `observed_at` : cas **campagne**, et il est qualifié

**Cas 2.** L'instrument n'a **pas** capturé l'instant de chaque HEAD, et c'est vérifiable dans
la version exécutée (`git show 93d08a1`) :

- `interface Sonde` porte `bucket`, `presence`, `observation` — **aucun champ temporel** ;
- `const quand = new Date().toISOString()` est lu **une seule fois**, **après** la boucle de
  sondes, au moment du rendu.

La valeur `2026-09-15T09:32:32.725Z` est donc l'horodatage de **clôture de la passe
d'observation**, pas l'instant de chacune des 62 sondes. Elle est **réellement capturée** — une
vraie lecture d'horloge — mais sa précision porte sur la campagne, pas sur la ligne.

Conformément à l'ordre de préférence, je l'ai **gardée telle quelle** et **qualifiée
explicitement** dans l'en-tête du fichier :

```
--   HORODATAGE DE CAMPAGNE — instant de CLÔTURE de la passe d'observation du
--   2026-09-15, lu une seule fois après les 62 sondes. Ce n'est PAS
--   l'instant de chaque HEAD : l'instrument ne les a pas capturés, et on ne
--   les reconstruit pas.
```

**Aucun pseudo-instant n'a été fabriqué.** Le paramètre `natureDeLHorodatage` est désormais
**obligatoire** — un horodatage sans sa nature invite à lui prêter une précision qu'il n'a pas.
Le mutant **M8** rougit si 31 instants échelonnés sont reconstruits après coup.

---

## 3 · La régénération, et la répétition à blanc

**Le fichier a été ré-attribué, pas re-mesuré.** Les 31 triplets `(id, compartiment, clé)` et
l'horodatage ont été **relus** du fichier existant ; seules les identités ont changé. Contrôle :
les données du fichier régénéré sont **identiques** à la capture extraite avant réécriture.
Aucun `HeadObject` n'a été émis.

`declared_by` et `observed_by` sont désormais **deux paramètres distincts** de
`rendreInscriptions`. Ils coïncident ici — l'outil qui a sondé rend aussi l'inscription — mais
un paramètre unique aurait rendu la divergence **inexprimable**, donc la distinction
invérifiable. L'en-tête du fichier dit les deux sémantiques.

`scripts/evidence-chain/repetition-inscription-31-pglite.mts` rejoue **le fichier lui-même**,
séquence positionnée à 2 comme en production. **Tout vert :**

- **(A)** le bloc passe, post-check intégré `ok = true` — `{lignes:31, pieces:31,
  verified_by_head:31, avec_observation:31, compartiments:1}`
- **(B)** `id` **3 → 33** · aucune ligne orpheline · chaque `storage_key` **égale** le `r2Key`
  de sa pièce (aucune `KEY_DIVERGENCE` à naître) · **une seule identité** sur les deux colonnes ·
  **un seul instant** pour les 31 · `observed_by` est un **instrument** (`chemin@commit`), jamais
  un opérateur
- **(C)** `UPDATE` / `DELETE` / `TRUNCATE` sur les 31 fraîchement posées → **`23001`**, et les
  31 restent intactes

---

## 4 · Le fichier est committé

`docs/prep/INSCRIPTION_31.sql` — 31 lignes, dans le commit de cette PR. Il était non suivi par
git, ce qui contredisait toute la semaine sur la provenance.

---

## 5 · Les deux blocs à coller

`docs/prep/INSCRIPTION_31.sql` porte les deux, dans l'ordre :

1. **le bloc `BEGIN … COMMIT`** — 31 `INSERT` ;
2. **le post-check**, en lecture seule, à coller **après** le `COMMIT`. Il doit rendre
   `ok = true` et `lignes = pieces = verified_by_head = avec_observation = 31`,
   `compartiments = 1`.

Les `id` iront de **3 à 33** : les deux épreuves append-only en transaction annulée ont consommé
1 et 2, et un `ROLLBACK` ne rend pas une valeur d'IDENTITY. Le fichier le dit en en-tête.

---

## 6 · La mesure de fermeture

```
npx tsx src/scripts/evidence-chain/mesure-de-fermeture.ts
```

Lecture seule : un SELECT sur `"EvidenceItem"`, un SELECT sur le registre, puis la résolution
**par le chemin réel** — registre → `autoriteDuRegistreDeLocalisation` → `resoudreLocalisation`.
Aucun octet lu dans R2.

**Non lancée** : le registre est vide, elle rendrait 31 `NO_LOCATION_EVENT` et ne prouverait rien.

### ⚠️ Ce qu'elle rendra, et il faut le savoir AVANT de coller

Elle compte **deux choses séparément**, parce qu'elles échouent séparément :

| | |
|---|---|
| **NOMMÉES** | une autorité gouvernée revendique un compartiment — ce que l'inscription apporte |
| **RÉSOLUES** | *et* un ouvreur gouverné dessert ce compartiment — ce que la **configuration** apporte |

**Mesuré aujourd'hui : `R2_EVIDENCE_BUCKET_NAME` est ABSENTE de `.env.local`.** Or
`ouvrirCompartimentGouverne` refuse sans elle, et `resoudreLocalisation` n'ouvre que le
compartiment que cette porte nomme. Joué d'avance en PGlite, dans les deux configurations :

- **config actuelle** → **31 NOMMÉES, 0 RÉSOLUES**, refus
  `evidence_compartment_unconfigured`. Ce n'est **plus** « aucune autorité ne revendique » :
  **la dette de localisation est soldée**, et c'est ce que la fenêtre devait livrer.
- **porte armée sur `interligens-reports`** → **31/31 RÉSOLUES**, chacune rendant son
  compartiment et sa capacité de lecture liée, autorité `registre-de-localisation`.

Donc : l'inscription seule ne fera pas passer le compteur de résolution à 31/31. Il y faut aussi
`R2_EVIDENCE_BUCKET_NAME=interligens-reports`. Ce n'est pas un défaut de l'inscription — c'est
une question de configuration, et elle appartient à l'armement du chemin TSA. Le script le dit
en clair plutôt que de laisser lire « l'inscription a échoué ».

---

## Preuves

**52 tests verts** · suite complète **510 fichiers / 7 527 tests** · `tsc` 0 · ESLint 0.
**8 / 8 mutants rouges** — les six précédents, plus **M7** (opérateur humain comme observateur)
et **M8** (précision reconstruite).

## État à la clôture

- Registre : **0 ligne**, séquence à 2, deux triggers armés.
- `docs/prep/INSCRIPTION_31.sql` : committé, répété à blanc, **prêt à coller**.
- L'inscription attend le fondateur. Puis la mesure de fermeture.
- `D` en HOLD, `A` et la convention de préfixe NO-GO. Après cette inscription : retour au
  chemin produit/TSA.
