# T1-RESOLUTION-DE-STOCKAGE — l'éligibilité ne suffit plus

> « Evidentiary eligibility does not imply storage resolvability. An irreversible
> evidence operation requires both. »

Option C honorée : **aucun déplacement d'octet, aucun DDL, aucune écriture de production,
aucun déploiement**. Aucun `evidentiaryStatus` n'a été lu pour décider ni écrit. Les seuls
appels réseau sont **trois `SELECT`** en lecture seule.

**506 fichiers, 7 355 tests verts**, `tsc --noEmit` propre.

---

## 1 — OÙ VIT LA RÉSOLUTION, ET COMMENT ELLE EST DÉRIVÉE

`src/lib/evidence-chain/storageResolution.ts`. Le gate a désormais une **étape 0** :

```
0. RÉSOUDRE LE COMPARTIMENT de la pièce
1. relire les octets persistés, DANS CE COMPARTIMENT
2. recalculer le SHA-256 DEPUIS CES OCTETS
3. confronter
4. refuser AVANT tout appel TSA
5. ne soumettre QUE le hash recalculé
```

### La capacité de lecture n'existe pas avant la résolution

C'est le cœur du correctif, et il est structurel plutôt que conventionnel :

```ts
export interface LocalisationResolue {
  readonly ok: true;
  readonly compartiment: string;
  readonly autorite: string;
  readonly readObject: ReadObjectFn;   // ← RENDU PAR la résolution
}
```

`readObject` **n'est plus une dépendance du gate**. `StampGateDeps` ne porte plus que
`{ resolveStorage, timestamp }`. Le gate est donc *incapable* de lire avant d'avoir
résolu — non parce qu'un test l'interdit, mais parce qu'il n'y a rien à appeler.

### La dérivation

Trois niveaux, tous dérivés, aucun littéral :

1. **Le registre des autorités** — `AUTORITES_DE_LOCALISATION`, **VIDE et gelé**. Une
   autorité NOMME le compartiment d'une pièce, ou rend `null` pour dire « je ne la
   revendique pas ». Elle ne devine jamais : une autorité qui rendrait un compartiment par
   défaut serait le repli sous un autre nom.
2. **L'ouvreur** — la seule façon de transformer un nom en capacité de lecture est
   `ouvrirCompartimentGouverne`. Un compartiment **nommé** qu'aucun ouvreur ne dessert
   n'est **pas résolu** : le nommer ne suffit pas, il faut pouvoir y lire. C'est ce qui
   rend le repli vers `R2_BUCKET_NAME` non pas interdit par convention mais
   **inatteignable** — aucun chemin de code n'y mène.
3. **L'ordre des refus** — pas de clé → rien à localiser ; aucune revendication → non
   résolu ; plusieurs revendications divergentes → **une ambiguïté n'est pas une
   résolution**, on refuse au lieu de choisir.

Le registre est **injectable** (`resoudreLocalisation(ligne, env, registre)`) : c'est ce
qui rend la branche positive éprouvable sans inventer une autorité dans le code de
production **ni réécrire la fonction dans un test** — une reproduction côté test serait
une seconde source de vérité, et elle vieillirait.

---

## 2 — LES CINQ PREUVES

### (a) résolvable + octets présents → passe

La pièce est horodatée, et le hash soumis est le **recalculé** (colonne en majuscules dans
le scénario, pour que les deux chemins restent distinguables à l'espion). Le lecteur est
appelé **une fois**, avec la clé attendue.

Et la preuve que le refus d'aujourd'hui vient du **registre vide** et non d'une incapacité
du mécanisme : une autorité injectée, et le vrai résolveur résout.

### (b) non résolvable → `STORAGE_LOCATION_UNRESOLVED`, aucune lecture tentée

Deux espions, pas un :

- **espion de compte** : un lecteur est tenu sous la main et n'est **jamais appelé** — pour
  que « il n'a pas été appelé » soit une mesure, pas une fatalité ;
- **espion d'ORDRE** : le journal des appels vaut exactement `["resolve", "read", "tsa"]`.
  Un gate qui sonderait l'objet « pour voir » avant de résoudre laisserait une trace ici
  même si son résultat final était identique.

Plus la garantie structurelle : `deps.readObject` n'existe plus, et l'ordre est lisible
dans le source (`resolveStorage` avant `readbackDigest`).

### (c) résolvable, objet absent → `object_absent`

Un 404 **dans le bon compartiment** est un fait sur la preuve, et il se rapporte comme tel.
Un 403 au même endroit reste `object_unreadable` : la distinction d'août tient toujours.

### (d) les deux causes ne se confondent dans aucun sens

| sens | vérifié |
|---|---|
| non résolu → jamais `object_absent` ni `object_unreadable` | ✅ |
| objet absent → jamais `storage_location_unresolved` | ✅ |
| `READBACK_REFUSAL_KINDS` ne contient pas la cause de localisation | ✅ |
| `STAMP_REFUSAL_KINDS` = celle de la relecture **+ une** | ✅ |

Et la garantie structurelle : `readback.ts` ne connaît **pas la notion de compartiment** —
un test vérifie que les mots `compartiment` et `bucket` n'y figurent pas. Elle est donc
incapable d'émettre cette cause par accident.

### (e) LE CHIFFRE — les 31 pièces, mesurées en lecture seule

`src/scripts/evidence-chain/resolution-census.ts`, exécuté le 2026-09-15. Aucun `GetObject`,
aucun appel TSA, aucune écriture :

```
[resolution-census] univers : "tsaToken" IS NULL AND "evidentiaryStatus" IS NULL
[resolution-census] 31 pièce(s) probatoirement ÉLIGIBLE(s)

  RÉSOLUES                    : 0
  STORAGE_LOCATION_UNRESOLVED : 31
      · aucune autorité ne revendique : 31

  ÉLIGIBILITÉ PROBATOIRE ≠ RÉSOLVABILITÉ DE STOCKAGE : 31 éligibles, 0 localisables.
```

> ### **31 sur 31 — et toutes pour le MÊME motif.**

Ce que le chiffre dit, et qui compte pour le RC :

- **Aucune ne tombe faute de clé.** Les 31 portent toutes un `r2Key`. Le défaut n'est pas
  dans le registre de la preuve : il est dans l'absence d'autorité de localisation.
- **Le motif est unique.** Pas un mélange de causes à démêler : une seule dette, homogène,
  qui se referme d'un seul geste le jour où une autorité existe.
- **Leur éligibilité probatoire est INTACTE.** L'univers SQL rend toujours 31. Rien n'a été
  disqualifié, rien n'a été sorti de la queue. Une dette qu'on ne compte plus est un oubli.

---

## 3 — LES QUATRE MUTANTS

Chacun posé dans l'arbre, suite relancée, arbre restauré.

| # | mutant | ce qu'il a rougi |
|---|---|---|
| **M1** | `STORAGE_LOCATION_UNRESOLVED` rendu comme `object_absent` | 2 — l'espion de (b), et **`SENS 1 · non résolu ne se rapporte jamais object_absent`** |
| **M2** | repli vers `R2_BUCKET_NAME` quand la résolution échoue | 3 — dont `le résolveur ne nomme JAMAIS R2_BUCKET_NAME` et le recensement des sites gouvernés |
| **M3** | la lecture tentée avant la résolution | 2 — le compteur de (a), et **`ORDRE MESURÉ · le journal commence par la résolution`** |
| **M4** | `evidentiaryStatus` muté pour vider la queue | 2 — `aucun fichier du chemin n'ÉCRIT evidentiaryStatus`, `le recensement est en LECTURE SEULE` |
| **M4 bis** | la résolvabilité contamine le prédicat SQL probatoire | 4 — dont `l'univers SQL reste probatoire` et trois témoins d'août sur `tsaPendingUniverseSql` |

M4 bis n'était pas demandé : je l'ai posé parce que c'est l'autre façon de « sortir les 31
de la queue » — non pas en écrivant un statut, mais en rétrécissant le prédicat. Elle fait
disparaître la dette du compteur au lieu de la faire refuser, et elle est plus discrète que
la première. Elle rougit aussi.

### Un renforcement découvert en chemin

Le recensement des sites gouvernés ne cherchait que la forme d'import **absolue**
(`evidence-chain/compartment`). `storageResolution.ts` — qui ouvre des compartiments —
l'importe en **relatif** (`./compartment`) et échappait donc au recensement. Corrigé : le
scan accepte les deux formes, et le résolveur est inscrit à la liste déclarée.

---

## 4 — LES FORMES POSSIBLES D'UNE AUTORITÉ DE LOCALISATION

**Décrites, non construites.** Aucune n'est entamée dans cette fenêtre.

### Le chiffrage, mesuré en lecture seule le 2026-09-15

```
objets avec r2Key    : 1 103  ·  4 962,9 Mo
dont éligibles TSA   :    31  ·      5,2 Mo
préfixes de clé      : evidence/ = 1 071   reports/ = 32
```

⚠️ **Le fait qui disqualifie une des quatre formes** : 1 071 clés commencent par
`evidence/` alors que leurs octets vivent dans le compartiment `interligens-reports`. **La
clé dit « evidence », le compartiment dit « reports ».** Le préfixe de clé ne porte aucune
information sur le compartiment, et croire le contraire est précisément l'erreur que le
ruling interdit.

### A — Colonne par objet · `EvidenceItem.r2Bucket TEXT NULL`

L'autorité est la ligne elle-même.

* **Coût** : 1 DDL additif (1 colonne) + le writer qui la renseigne à l'ingestion + 1 entrée
  au registre + un backfill des 1 103 lignes.
* **Le vrai coût est le backfill.** Le renseigner par déduction (« tout ce qui précède la
  date D est dans reports ») inscrirait une **inférence comme un fait** — la faute que
  `EXECUTION_2026-08-19.sql` a explicitement refusé de commettre sur la provenance. Le
  renseigner par **mesure** demande un `HeadObject` par clé et par compartiment candidat :
  ~2 206 appels, quelques minutes, aucun octet transféré. C'est la version honnête.
* **Fidélité** : maximale, par objet.
* **Risque** : une colonne nullable que personne ne remplit est un nouveau trou silencieux.
  Il est ici neutralisé d'avance : `NULL` ⇒ aucune revendication ⇒ refus.

### B — Table de résolution · `EvidenceObjectLocation(itemId, bucket, method, observedAt)`

L'autorité est une **observation datée**, pas un attribut.

* **Coût** : 1 DDL additif (1 table) + writer + backfill, soit un peu plus que A.
* **Ce qu'elle apporte et que A n'a pas** : elle porte la **provenance de la localisation
  elle-même** — `method = 'declared-at-write'` vs `'verified-by-head'`. On sait alors si
  l'on croit un registre ou une mesure, ce qui est exactement la distinction que tout ce
  module défend ailleurs. Elle admet aussi plusieurs candidats, et le résolveur refuse déjà
  sur ambiguïté.
* **Fidélité** : maximale, et auditable.

### C — Convention de préfixe · le compartiment déduit de `r2Key`

* **Coût d'implémentation** : quasi nul, zéro DDL.
* **⚠️ ET ELLE EST FAUSSE POUR EXACTEMENT LES LIGNES QUI POSENT PROBLÈME.** Les 1 071 clés
  `evidence/…` sont dans `interligens-reports`. La convention ne peut valoir que pour les
  objets écrits **après** qu'elle soit imposée — c'est-à-dire pas pour le backlog.
* **C'est la plus dangereuse des quatre** : elle a l'apparence d'une autorité, elle coûte
  presque rien, et elle rendrait `ok: true` en désignant le mauvais compartiment. Le refus
  qui suivrait se lirait `object_absent` — le mensonge que cette fenêtre vient de rendre
  impossible. **À écarter explicitement.**

### D — Migration des octets · la dette est supprimée, pas enregistrée

* **Coût** : `GET` + `PUT` par objet. **Pour les 31 éligibles seulement : 5,2 Mo** — de
  l'ordre de la minute. Pour la totalité : 4,96 Go.
* **Après elle**, l'énoncé « tout objet gouverné est dans le compartiment dédié » devient
  **vrai**, et l'autorité tient en une entrée de registre triviale — sans DDL du tout.
* **Ce qu'elle exige** : une passe de vérification (SHA-256 recalculé sur la copie, confronté
  à la colonne) sans laquelle la copie n'est pas une conservation ; une décision sur le sort
  des originaux ; et — parce que R2 n'est pas WORM — l'inscription de la copie comme
  **événement de chaîne de conservation**, sans quoi on aura déplacé des preuves sans trace.
* **C'est la seule option qui supprime la dette au lieu de l'enregistrer**, et la seule
  dont le coût soit dérisoire si on la borne aux 31.

### Lecture d'ensemble

| | DDL | backfill | résout le backlog | risque |
|---|---|---|---|---|
| **A** colonne | 1 colonne | 2 206 HeadObject | oui | colonne non remplie |
| **B** table | 1 table | 2 206 HeadObject | oui | aucun propre à la forme |
| **C** préfixe | aucun | aucun | **non — et ment** | **élevé** |
| **D** migration 31 | aucun | 5,2 Mo transférés | oui, pour les 31 | copie non journalisée |

**A, B et D ne s'excluent pas** : D borné aux 31 débloque le vertical slice tout de suite,
B enregistre proprement ce qui a été observé, et le registre les accueille l'une comme
l'autre sans qu'une ligne du gate change.

Aucune n'est construite. La décision appartient à GPT.
