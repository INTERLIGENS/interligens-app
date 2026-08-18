# B3 — Observabilité de la chaîne de preuve

**Branche :** `feat/cc-offline-79-evidence-observabilite` — non mergée
**Date :** 2026-08-18
`typecheck` vert · **291 fichiers / 3 031 tests verts** (+15) · `eslint` propre · guard passé, **aucun `--no-verify`**

---

## LA PIÈCE QUI A RENDU LES TROIS DÉFAUTS VISIBLES

`cmssyx6se0001k3041bp17v0f`, ingérée le **2026-08-14**. En base : sans octets,
**sans marqueur**, et **sans une seule ligne dans `EvidenceAccessLog` — pas même
son `INGEST`**.

**Trois défauts distincts l'ont rendue invisible, et chacun suffisait.** Les
trois sont corrigés, dans l'ordre demandé — l'ordre compte, le premier
conditionne la sûreté d'activer la TSA.

---

## 1. `watcher-health.mjs` — le compteur qui manquait

La requête comptait **deux catégories nommées** sur la population
`r2Key IS NULL` — `[R2:UNAVAILABLE]` et `HASH-ONLY` — et **jamais le total**.

```
Mesuré : count(*) = 1 · accidental = 0 · deliberate = 0
Affiché : « 0 accidentel(s), 0 hash-only délibéré(s) »
```

**Le watchdog annonçait deux zéros pendant qu'une pièce orpheline existait
depuis quatre jours.** Il ne mentait pas — il ne pouvait pas voir : rien ne
comptait ce que personne n'avait pensé à nommer.

**Correctif :** ajout de `count(*)::int AS total`, et alerte **`crit`** sur
l'écart, `evidence_orphan_no_marker`. La ligne de rapport affiche désormais
`N au total — … , M SANS MARQUEUR`.

**Un détail qui compte :** l'écart n'est **pas** `total − (accidental +
deliberate)`. Une pièce peut porter **les deux** marqueurs ; la soustraction
naïve rendrait l'écart négatif sur un double marquage et **masquerait un
orphelin réel**. Le calcul se fait sur les pièces portant *au moins un*
marqueur, par une seconde requête.

**Et l'alerte dit ce qu'il ne faut pas faire :**

> *« NE PAS activer la TSA tant que cet écart n'est pas à zéro — un horodatage
> les rendrait indiscernables d'une pièce complète. »*

C'est la raison de l'ordre. **`TSA_URL_FALLBACK` n'a pas été posée**, et ne doit
pas l'être avant que ce compteur existe : un jeton TSA valide sur un contenu
absent est pire qu'une pièce sans horodatage.

---

## 2. `ingest.ts` — l'exception qui abandonnait une ligne sans trace

```ts
const item = await store.insertItem({ … });   // ligne ÉCRITE
await putEvidenceObject(…);                    // ← LÈVE
await store.setR2(…);                          // jamais atteint
await store.insertAccessLog(item.id, "INGEST", …);  // jamais atteint
```

Le mode dégradé bruyant existant ne couvrait que **« R2 non configuré »**
(`evidenceR2ConfigFromEnv()` rend `null`). Il ne couvrait pas **« R2 configuré,
PUT rejeté »** — le cas exact survenu.

**Correctif :** le PUT est enveloppé. En cas d'échec :

| Effet | Détail |
|---|---|
| Marqueur posé | nouveau `R2_PUT_FAILED_MARKER = "[R2:PUT-FAILED]"`, via `store.markR2Failed` |
| Journal écrit | l'`INGEST` est **enfin atteint**, plus une entrée dédiée `r2 put failed — …` |
| Résultat | `r2PutFailed: true`, `r2Key: null` — l'ingestion **n'échoue pas** |
| Trace console | clé, taille, sha256 et message d'erreur |

**Deux marqueurs et non un.** « La config manquait » et « le stockage a
refusé » n'appellent pas la même action : les confondre ferait chercher une
variable d'environnement là où il faut regarder un bucket.

**L'ingestion n'échoue pas** : une pièce et son empreinte gardent leur valeur
sans octets. On la rend **bruyante, marquée et journalisée** — le contraire de
ce qui se passait. Et si le marquage échoue à son tour, l'ingestion tient : la
ligne dit déjà la vérité par son `r2Key` nul.

*Le contrat `EvidenceStore` gagne une méthode, `markR2Failed`, implémentée dans
les deux stores (Prisma et SQLite). Elle **préfixe** les notes sans jamais
écraser ce qu'elles portaient — c'est au moment où l'archivage échoue que le
contexte d'origine compte le plus.*

---

## 3. `commit/route.ts` — le 200 sur un chaînage échoué

```ts
const ok = report.links.failed.length === 0 && report.evidences.failed.length === 0;
```

`report.evidenceChain` n'y entrait pas. **Une pièce dont le chaînage échouait —
donc une ligne potentiellement orpheline — sortait en `200 ok:true`.** Trois
blocs plus haut, un commentaire affirmait *« jamais un échec silencieux du
commit »*.

**Correctif :** `chainFailed.length === 0` entre dans `ok`, et la réponse porte
`orphanEvidenceItemIds` **au premier niveau**.

**Cette seconde moitié demandait un correctif en amont.** `chainOperatorEvidence`
rendait `evidenceItemId: null` dans son `catch` — la réponse ne permettait
d'identifier aucune ligne orpheline. `itemId` est désormais déclaré **hors du
`try`** et rendu même en échec : *on ne peut ni marquer, ni réparer, ni retirer
une ligne dont on ignore l'identifiant.*

### Ce que le correctif a révélé dans un test existant

`src/app/api/admin/osint/commit/route.test.ts` ne simulait **pas**
`chainOperatorEvidence`. Il tournait donc pour de vrai contre un client Prisma
simulé, **échouait à chaque exécution**, rendait `mode: "failed"` — et le test
affirmait `status === 200`.

**Le test ne mentait pas : il ne pouvait pas voir**, exactement comme le
watchdog. Le correctif le fait passer à 207, ce qui est la bonne réponse. Le
simulacre ajouté rend un chaînage **réussi** : ce fichier teste le mode ombre
des liens, pas la chaîne de preuve.

---

## LE TEST QUI COMPTE — LES QUATRE, PAS TROIS

`__tests__/security/evidence-observability.test.ts` — **15 tests**.

Un `putEvidenceObject` qui lève doit produire **les quatre effets** :

| # | Effet | Vérifié |
|---|---|---|
| **1** | une ligne **marquée** | `markR2Failed(id, "[R2:PUT-FAILED]", …)`, avec l'id et le message d'erreur |
| **2** | une **entrée de journal** | ≥ 2 appels : l'`INGEST` **et** l'entrée dédiée `r2 put failed`, contenant l'erreur |
| **3** | un **`ok:false`** | `ok` inclut `evidenceChain.filter(c => c.mode === "failed")`, statut 207 |
| **4** | un **`evidenceItemId` non nul** | `itemId` hors du `try`, `mode: "failed", evidenceItemId: itemId` |

Plus : les deux marqueurs sont **distincts** · un PUT réussi ne marque ni ne
journalise d'échec · un marquage qui échoue à son tour **ne fait pas tomber
l'ingestion** · l'écart du watchdog se calcule sur « au moins un marqueur » et
non sur la somme · l'alerte porte bien l'avertissement TSA.

---

## LES PATCHES

| Fichier | Gelé ? | Forme |
|---|---|---|
| `src/scripts/watchdog/watcher-health.mjs` | non | **dans l'arbre** |
| `src/lib/evidence-chain/ingest.ts` | non — `^src/lib/evidence/` ne matche pas `evidence-chain/` | **dans l'arbre** |
| `src/lib/evidence-chain/types.ts`, `store/prisma.ts`, `store/sqlite.ts` | non | **dans l'arbre** |
| `src/lib/osint/evidenceCommitBridge.ts` | non | **dans l'arbre** |
| `src/app/api/admin/osint/commit/route.ts` | ✅ | `B3-…-commit-route.ts.patch` |
| `src/app/api/admin/osint/commit/route.test.ts` | ✅ | `B3-…-commit-route.test.ts.patch` |

**Vérifié avec les deux patches appliqués :** `typecheck` vert, **291 fichiers /
3 031 tests verts**. **Arbre laissé nu et vert :** mêmes chiffres — le test lit
le **patch** pour les trois assertions portant sur la route, et échoue si ni
l'arbre ni le patch ne portent le correctif.

*Un point de vocabulaire utile : `^src/lib/evidence/` ne gèle pas
`src/lib/evidence-chain/` — le motif exige le slash après `evidence`. Vérifié,
pas supposé : c'est ce qui permet aux correctifs 1 et 2 d'entrer dans l'arbre.*

---

## CE QUI N'A PAS ÉTÉ FAIT, DÉLIBÉRÉMENT

- **`TSA_URL_FALLBACK` n'est pas posée**, ni aucune variable `TSA_*`. Le
  compteur du point 1 devait exister d'abord ; il existe maintenant, mais
  l'écart n'a pas été mesuré après correctif — **la décision d'activer la TSA
  reste ouverte**, et elle doit être prise en regardant ce compteur.
- **Aucune écriture en base.** La pièce orpheline `cmssyx6se…` n'a été ni
  marquée, ni journalisée, ni supprimée. Les correctifs valent pour les
  ingestions **à venir** ; la ligne existante reste à traiter, et c'est une
  décision.
- **Aucun rattrapage rétroactif.** Aucun script ne parcourt les pièces
  existantes pour leur poser un marqueur — ce serait réécrire l'histoire de la
  chaîne de possession.

---

## CONTRÔLE

| Contrainte | État |
|---|---|
| Écriture en base | **aucune** |
| Variable d'environnement posée | **aucune** — `TSA_*` en particulier |
| Chemin gelé forcé | **aucun** — 2 fichiers en patches, remis à l'origine |
| `--no-verify` | **aucun** |
| Migration, `db:*`, `prisma migrate` | **aucune** |
| Arbre laissé rouge | **non** — 291 fichiers / 3 031 tests verts |
| `BOTIFY_MINT`, `R2_PUBLIC_BASE_URL` | non touchés |
