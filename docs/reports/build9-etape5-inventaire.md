# BUILD 9 · ÉTAPE 5 — inventaire des chemins gelés

Branche `feat/cc-offline-160-vine-wallets`, depuis `main = 231df9b`.
**Aucune exemption ouverte.** Inventaire rendu avant toute demande.

---

## CORRECTION FACTUELLE

La PR **#268 est mergée** (`859a453`) — c'est le code du correctif `tigerScore`,
mergé dans la fenêtre d'exemption sur votre instruction. Seule la **#271** est
ouverte. Le travail ci-dessous vit sur une troisième branche.

---

## CE QUI EST DÉJÀ FAIT, HORS GEL

### Le lecteur canonique — `src/lib/casefile/canonicalReader.ts`

Charge un dossier, ses claims et son registre de sources depuis l'autorité, et
résout chaque `evidenceRef` contre le registre. Il porte le gate :

```ts
assertProvenanceSurvives(claims, where)   // lève si un claim PUBLIC
                                          // sort sans fondement
```

Trois décisions de forme, chacune contre un mode de défaillance mesuré :

- **`provenance: null` explicite** plutôt qu'un champ absent. Un champ absent
  laisserait le renderer décider ; `null` l'oblige à dire qu'il n'y a rien.
- **`unresolvedRefs` rendues visibles.** Les 33 références en prose de VINE ne
  sont pas écartées en silence — un fondement manquant qu'on ne voit pas est
  indiscernable d'un fondement absent.
- **Une provenance non nulle ne suffit pas.** Un claim `PUBLIC` dont *toutes*
  les références sont non résolues est refusé.

Colonnes énumérées, jamais `SELECT *`. `localFilePath`, `sessionId`, `notes` et
les identifiants de ligne ne sont **pas lus** — ce qui n'est pas lu ne peut pas
fuir par un spread distrait.

> **Constat de dette, pas un choix.** Le lecteur passe par `$queryRaw` :
> `CaseFileSource` et `CaseFileClaim` existent en base (bloc 3) mais ne sont pas
> déclarées dans `prisma/schema.prod.prisma`, qui est gelé. C'est exactement la
> dette que BUILD 8 avait constatée sur `KolProceedsEvent`.

### Un défaut trouvé et corrigé — l'index de preuves fabriquait sa provenance

`src/lib/casefile/pdfGeneratorPublic.ts`, l'« Evidence Index » du PDF **retail**.
Trois colonnes sur six ne rendaient pas ce que leur en-tête annonçait :

| en-tête | valeur rendue avant |
|---|---|
| Type | le **titre** du claim |
| Source | sa **catégorie** |
| **Horodatage** | **`TODAY_ISO`** — la date de génération du PDF |

La troisième est la plus grave : **chaque pièce paraissait captée le jour de
l'export**, alors que `botify.json` porte de vrais `captured_at`. Un index de
preuves qui invente ses horodatages ne documente pas, il rassure.

Chaque colonne rend désormais son champ depuis la source résolue, et `—` quand
il manque. Fichier **hors gel** — corrigé, avec trois tests dont un mutant.

---

## L'INVENTAIRE — 3 fichiers gelés

Pour chacun, la raison de l'**indivisibilité**, pas seulement l'utilité.

| # | fichier | ce qu'il faut y faire | pourquoi indivisible |
|---|---|---|---|
| 1 | `src/lib/casefile/pdfGenerator.ts` | *(hors gel — pour mémoire)* le type `CaseFileClaim` gagne sa provenance et la rend | — |
| 2 | `src/app/api/casefile/public/route.ts` | servir le dossier depuis l'autorité via `loadCanonicalCaseFile`, plus depuis `presets.ts` | **c'est la surface retail.** Elle appelle `generateCaseFilePdfPublic(lang, caseId)` — deux scalaires, aucun dossier. Le générateur va donc chercher le JSON lui-même. Tant que la route ne passe pas le dossier canonique, le PDF public reste servi par une autorité concurrente, et l'étape 7 est inatteignable |
| 3 | `src/app/api/casefile/pdf/route.ts` | idem, pour les deux gabarits | même appel, mêmes deux autorités. Il porte en plus `generateCaseFilePdf(input)` où `input` vient de `buildBotifyInput()` — le preset à zéro provenance |
| 4 | `src/components/cases/TokenCasefileView.tsx` | afficher la provenance des claims sur la fiche | **c'est la seule surface UI d'un dossier token.** Le gate porte sur « API, UI et PDF » ; sans elle, l'UI reste la surface où un claim démontré perd son fondement |

**`src/app/api/casefile/route.ts` n'est PAS demandé.** Il sert du JSON depuis sa
`CASE_DB` en ligne et ne rend aucun claim canonique : il relève de l'étape 7, pas
de l'étape 5. Je ne l'ajoute pas « pendant qu'on y est ».

**`src/app/api/casefile/generate/route.ts` n'est PAS demandé** non plus — route
admin de génération à la demande, sans surface publique.

### Ce qui reste faisable hors gel, et que je fais en attendant

Le type `CaseFileClaim` et son rendu dans `pdfGenerator.ts`, le lecteur
canonique, et les tests. Autrement dit : **la provenance sera prête à être
rendue avant que la fenêtre s'ouvre**, et la fenêtre ne servira qu'au câblage.

---

## POURQUOI CES QUATRE ET PAS MOINS

Le gate ratifié dit « sur API, UI **et** PDF ». Trois surfaces :

- **PDF public** → `casefile/public/route.ts` (#2)
- **PDF interne** → `casefile/pdf/route.ts` (#3)
- **UI** → `TokenCasefileView.tsx` (#4)

Retirer l'une laisse une surface où un claim démontré perd son fondement — ce
que le gate interdit nommément. Il n'existe pas de sous-ensemble qui satisfasse
« aucune surface ne perd silencieusement ».

Et aucune des trois ne peut être atteinte depuis un fichier libre : les deux
routes **déclarent leur appel au générateur**, la fiche **déclare son type**.

---

## PROOF

| | |
|---|---|
| suite | **4 802 verts / 4 804**, 2 skipped, 0 rouge |
| typecheck | vert |
| guard | `ce13d0c…13e50` — **aucun chemin gelé touché, aucune exemption** |
| prod-write | 0 write, 0 DDL, 0 Helius, 0 collecte |

Trois de mes tests ont d'abord rougi **sur mes propres commentaires** — un
en-tête qui explique pourquoi `TODAY_ISO` a été retiré contient forcément
« TODAY_ISO ». Troisième fois dans ce chantier ; j'ai posé un utilitaire
`codeSeul()` qui ferme la classe d'erreur au lieu de la corriger au cas par cas.

---

## STOP

**Exemption de chemins gelés**, 3 fichiers — deux routes et la fiche. Inventaire
ci-dessus, avec la raison d'indivisibilité de chacun.

Je n'ouvre rien. Si un quatrième fichier apparaît en cours de câblage, je
m'arrête et je vous le dis avant de l'ajouter.
