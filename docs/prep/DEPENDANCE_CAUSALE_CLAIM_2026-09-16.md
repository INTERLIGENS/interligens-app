# LA DÉPENDANCE CAUSALE CLAIM → CLAIM — UNE CONCLUSION QUI CONSOMME UNE OBSERVATION

**2026-09-16 · CC-OFFLINE-232 · E CLOSED · witness réel en production**

```
OBSERVATION → CAUSAL DEPENDENCY → INFERENCE
et JAMAIS    OBSERVATION → VERDICT STRING
```

Le premier gap causal de CONCLUSION est fermé. `VINE-CONCLUSION-01` existe, elle est une
`INFERENCE`, elle ne cite **aucune pièce**, et son fondement est **entièrement porté** par une
dépendance gouvernée épinglée en version vers `VINE-MEASURE-01 v1`.

> **UNE SOURCE PROBANTE ET UNE ASSERTION INTERMÉDIAIRE NE SONT PAS LA MÊME CHOSE.**
>
> `evidenceRefs` répond : « quelles **PIÈCES** fondent cette observation ? »
> `dependsOn` répond : « quelles **ASSERTIONS GOUVERNÉES** cette inférence consomme-t-elle ? »

---

## 1. LE WITNESS, EN PRODUCTION

```
VINE-MEASURE-01 v1   PRIMARY_OBSERVATION   ATTACHED   evidenceRefs ["SRC-MEASURE-01"]
        ↑
        │ casefile_claim_dependencies #9 · DERIVED_FROM · déclarée par executeFoundation
        │ IL-SHILL-VINE-001 · VINE-CONCLUSION-01 v1 → VINE-MEASURE-01 v1
        │
VINE-CONCLUSION-01 v1  INFERENCE  ATTACHED  evidenceRefs []
```

```
0 ligne PUBLIC dans le dossier        verdict  UNDETERMINED (intact)
```

**`evidenceRefs` est vide, et c'est le point.** La conclusion ne cite pas `SRC-MEASURE-01` : elle
dépend de `VINE-MEASURE-01`, **la claim**. Citer la pièce aurait fondé l'inférence sur la source de
l'observation en prétendant se fonder sur l'observation. **La distinction EST le build.**

### La formulation, bornée au scope scellé

> « Dans le corpus gouverné mesuré le 2026-09-16 par
> `instrument:il-measure-vine-wallet-attribution@1.0.0`, INTERLIGENS ne peut pas établir
> d'attribution monétaire VINE aux quatre comptes observés. »

Et la claim le dit explicitement : **`NOT_ESTABLISHED` n'est pas `ABSENT`.** Elle n'affirme ni
qu'aucun flux monétaire n'existe, ni qu'aucun wallet n'existe, ni qu'aucune attribution ne serait
établissable hors de ce périmètre — ou par une autorité qui manque aujourd'hui.

---

## 2. LE CONTRAT DEVIENT SÉMANTIQUE SELON `rowNature` — EN FAIL-CLOSED

```
PRIMARY_OBSERVATION → fondée par des PIÈCES        evidenceRefs ≥ 1 reste OBLIGATOIRE
INFERENCE           → fondée par des ASSERTIONS    ≥ 1 dépendance DERIVED_FROM validée OBLIGATOIRE
```

⚠️ **Ce n'est PAS « si INFERENCE alors evidenceRefs optionnel ».** C'est une **exigence de plus**, sur
une nature qui n'en avait pas :

| | |
|---|---|
| `INFERENCE` · aucune pièce · aucune dépendance | **REFUSED** `DEPENDENCY_REQUIRED_FOR_INFERENCE` |
| `INFERENCE` · **avec** pièces · aucune dépendance | **REFUSED** — porter des pièces ne dispense pas de consommer une assertion |
| `PRIMARY_OBSERVATION` · aucune pièce · **avec** dépendances | **REFUSED** `EVIDENCE_REFS_EMPTY` |

> **UNE DÉPENDANCE NE TRANSFORME PAS UNE OBSERVATION SANS PIÈCE EN OBSERVATION FONDÉE.**

Le paramètre de relâchement vaut **0 par défaut** : tout appelant non averti, et le contrat de
PUBLICATION tout entier, restent exactement où ils étaient.

---

## 3. LA CONSOMMATION CAUSALE — CE QUI SÉPARE UNE AUTORITÉ D'UNE ANNOTATION

> **UNE LIGNE DE DÉPENDANCE QUI EXISTE MAIS QUE LE PRODUCTEUR NE LIT PAS N'EST PAS UNE AUTORITÉ.**

Dans **la transaction du fondement**, l'exécuteur :

1. lit les `(claimId, version)` **déclarés** — et eux seuls — `FOR SHARE` ;
2. les remet au décideur, qui **juge chaque source selon SA PROPRE `rowNature`** ;
3. insère les lignes de dépendance **après la claim, dans la même transaction**.

⛔ **La clé étrangère prouve que la ligne EXISTE ; elle ne dira jamais si la source est FONDÉE.**
C'est ce qui fait de `DEPENDENCY_NOT_FOUNDABLE` un refus **causal** et non une formalité : une
observation source sans pièce est refusée comme fondement, alors même que sa ligne existe.

Quatre causes nommées : `DEPENDENCY_REQUIRED_FOR_INFERENCE` · `DEPENDENCY_UNRESOLVED` ·
`DEPENDENCY_SELF` · `DEPENDENCY_NOT_FOUNDABLE`.

---

## 4. LES MUTANTS

`__tests__/casefile/cc-offline-232-dependance-causale.test.ts` — 17 témoins.

| Mutant | Résultat |
|---|---|
| **`PRIMARY_OBSERVATION` sans pièce, APRÈS la bascule** | **REFUSED** — *le témoin essentiel* |
| les quatre autres natures avec dépendances | REFUSED `EVIDENCE_REFS_EMPTY` |
| `INFERENCE` sans dépendance | REFUSED |
| dépendance jamais lue | `DEPENDENCY_UNRESOLVED` |
| dépendance à la mauvaise version | `DEPENDENCY_UNRESOLVED` |
| source non classée / `UNCLASSIFIED` | `DEPENDENCY_NOT_FOUNDABLE` |
| source observation **sans pièce** | `DEPENDENCY_NOT_FOUNDABLE` |
| auto-dépendance | `DEPENDENCY_SELF` |
| source d'un autre dossier | `DOSSIER_MIX` |

**Et le mutant qui compte** — l'exécuteur réel branché sur une connexion scriptée : retirer la lecture
des dépendances de `governedExecutor` fait **rougir** le témoin (`1 failed | 16 passed`), puis la
lecture est restaurée. Sans cela, tous les témoins purs resteraient verts pendant que la dépendance
redeviendrait déclarative.

Côté base, huit mutants exercés en vif et annulés : FK source, FK version, FK inter-dossiers, CHECK
auto-dépendance, CHECK vocabulaire, et les trois refus append-only `UPDATE` / `DELETE` / `TRUNCATE`.

Suite complète : **523 fichiers, 7783 tests verts.**

---

## 5. LA GARDE DE DOSSIER TIENT PAR LA FORME

`casefile_ref` n'existe **qu'une fois** et alimente **les deux** clés étrangères vers
`CaseFileClaim("casefileRef","claimId",version)`. Une dépendance inter-dossiers n'est pas interdite
par un CHECK qu'on pourrait oublier — **elle n'est pas exprimable**.

Et le `CHECK source_claim_id <> dependent_claim_id` porte deux exigences d'un coup : pas
d'auto-dépendance, et **aucun recouvrement possible avec `supersedes`** — qui relie deux *versions*
d'un *même* `claimId`, là où une dépendance relie deux `claimId` *différents*. Les deux relations
sont disjointes par construction.

---

## 6. À CONSIGNER MOT POUR MOT

> **Le `contentHash` d'une INFERENCE seul NE SUFFIT PAS à prouver son fondement causal.**
> Pour reconstruire ou auditer une inférence, il faut
> **CLAIM SEALED CONTENT + APPEND-ONLY VERSION-PINNED DEPENDENCY SET.**
> Ne pas prétendre que le `contentHash` de la claim scelle ses dépendances.

`SEALED_FIELDS` n'a **pas** été modifié, aucun `contentHash` historique n'a été recalculé, aucune
claim existante n'a été migrée. Le sceau couvre ce que la claim **affirme** ; la table append-only
couvre ce qu'elle **consomme**. Deux objets, deux autorités, aucune surchargée. Seal v2 →
**BACKLOG POST-RC**, aucun besoin causal pour le witness.

> **Borne de cycles assumée au RC** : la cible d'une dépendance doit préexister et être épinglée en
> version, ce qui rend le graphe `(claimId, version)` **acyclique par construction**. Le cas
> `A v2 → B v1 → A v1` n'est pas un cycle auto-fondateur : la chaîne se termine sur une
> identité/version historique distincte. **Aucun détecteur de cycle général n'existe, et aucun ne doit
> être construit avant le RC.**

---

## 7. DEUX TÉMOINS ANTI-RÉGRESSION ONT ROUGI, ET AVAIENT RAISON

1. **Forme du plan de fondement** — `dependenciesToInsert` ajoute une clé à l'objet `Foundation`. Le
   témoin qui énumère ses clés pour prouver qu'aucune ne désigne une ligne à *modifier* devait être
   mis à jour : la nouvelle clé est, comme les deux autres, un plan d'**insertion**. Propriété intacte.
2. **Garde S24 · racines SQL par capacité** — elle a découvert `casefile_claim_dependencies` **toute
   seule**, en lisant le gabarit littéral de `governedExecutor`. Déclarée `RACINE_GOUVERNEE`, classe
   `dossier`, hors schéma ORM : elle ne porte que des identités de claims et des versions, jamais un
   nominatif ni une pièce.

---

## 8. NOTE DE PROCÉDURE — CORRIGÉE

Le fondateur a collé treize blocs à la main, dont neuf qui n'étaient **pas** du DDL — des témoins
transactionnels annulés par `ROLLBACK`. C'était mon erreur de répartition : la règle « le SQL de
production ne part jamais du code » vise le **DDL**, pas les témoins.

Désormais : **le fondateur pose le DDL, l'agent exerce les témoins.** Ne lui demander que ce qui
modifie réellement le schéma.

*(Effet de bord bénin, constaté : la séquence d'identité de la table est à 9 — les huit mutants
annulés ont consommé leurs identifiants. Une séquence ne revient pas en arrière sur `ROLLBACK`.
Aucune conséquence.)*
