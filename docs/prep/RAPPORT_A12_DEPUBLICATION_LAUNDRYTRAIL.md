# A12 — L'interrupteur de dépublication de `LaundryTrail`

**Branche :** `feat/cc-offline-70-a12-laundry-publication` — **non mergée, rien de déployé**
**Date :** 2026-08-18
`pnpm typecheck` vert · `pnpm test` **291 fichiers / 3 066 tests verts** (+50) · `eslint` propre

> **Aucun état n'a été basculé.** Les 5 narratifs restent publiés. Le choix de
> retirer `bkokoski` ou `sxyz500` est une décision de publication nominative :
> elle n'est pas prise ici.

---

## CE QUI EST LIVRÉ

| # | Livrable | Où | État |
|---|---|---|---|
| 1 | Migration SQL — colonne d'état + registre | `docs/prep/patches/A12-MIGRATION_laundry_publication_v1.sql` | **affichée, NON exécutée** |
| 2 | Le journal append-only | *(dans la même migration)* | — |
| 3 | Point de filtrage unique, fail-closed | `src/lib/laundry/publicationGate.ts` | **dans l'arbre** |
| 4 | `groundingContext.ts` branché dessus | `src/lib/ask/groundingContext.ts` | **dans l'arbre** |
| 5 | Les 4 surfaces gelées | `docs/prep/patches/A12-surface*.patch` | **patches prêts, vérifiés** |
| 6 | Le correctif de fixture qu'elles impliquent | `docs/prep/patches/A12-test-fixture-*.patch` | **patch prêt** |
| 7 | Les tests | `__tests__/security/laundry-publication-gate.test.ts` | **50 tests verts** |

---

## 1. LA MIGRATION — SUR LE MODÈLE EXACT DE CE QUI EXISTE

Transposition de `MIGRATION_proceeds_containment_v1.sql`, structure pour
structure : `CREATE TABLE IF NOT EXISTS` + index + `ADD COLUMN IF NOT EXISTS`
avec `DEFAULT`. **Additive, ré-exécutable, sans un seul `DROP`, `DELETE` ni
`ALTER` de colonne existante.** Un test le vérifie sur le SQL dépouillé de ses
commentaires.

```sql
ALTER TABLE "LaundryTrail"
  ADD COLUMN IF NOT EXISTS "publication" TEXT NOT NULL DEFAULT 'published';
-- + CHECK ("publication" IN ('published','withdrawn'))
-- + 2 index, dont ("kolHandle","publication") pour la lecture publique
```

`DEFAULT 'published'` : **après exécution, le comportement du produit est
inchangé.** Les 5 lignes existantes gardent leur état.

### Pourquoi un troisième registre et pas l'un des deux existants

`KolProceedsPublicationLog` est keyé sur `kolHandle` et porte une décision sur
un **montant agrégé**. Un trail n'est pas un agrégat : c'est un **texte**, il
peut y en avoir plusieurs par handle, et ce qui est retiré est cette
phrase-là — pas le total du profil. Y consigner un retrait de narratif rendrait
les deux illisibles : on ne saurait plus si `withdrawn` vise le chiffre ou la
phrase. `KolTokenLinkStatusLog`, lui, est keyé sur `linkId` et ses bornes sont
`fromVisibility`/`toVisibility` : aucun trail n'est un lien de jeton.

**Le motif est identique aux deux** — append-only, `reasonCode` contraint,
`actorId` jamais `'admin'`, `contestationRef`. C'est une transposition, pas une
invention.

### Ce qu'on fige — et pourquoi pas le texte

Le journal des proceeds recopie `publishedValueUsd` parce que
`computeProceedsForHandle` **détruit et réécrit** les événements chaque nuit :
la valeur du jour de la décision est structurellement périssable (A5). Ici, le
texte n'est pas périssable — une seule écriture existe dans tout le dépôt, un
`create`. On fige donc son **empreinte** :

```
"narrativeSha256"       NOT NULL, CHECK ~ '^[0-9a-f]{64}$'
"assertedValueUsd"      le montant que la phrase affirme
"primaryEvidenceUsd"    ce que la base soutenait au moment de la décision
"laundryRiskAtDecision"
```

**Recopier le narratif dans le journal doublerait l'exposition nominative** :
deux tables au lieu d'une porteraient la même accusation chiffrée. Une empreinte
prouve *quelle version* a été retirée **sans la republier**. C'est délibéré, et
c'est la seule divergence assumée avec le modèle des proceeds.

Trois portées, pour que les décisions étroites restent exprimables :
`trail_full` · `trail_narrative` (le texte seul) · `trail_risk` (le badge et
l'ancrage du modèle seuls). Les motifs sont **exactement** les huit de
`KolProceedsPublicationLog` — un test l'assure : deux registres de publication
nominative doivent s'agréger ensemble, sinon « combien de retraits pour
erratum » devient impossible à produire.

---

## 2. LE POINT DE FILTRAGE — UNIQUE, ET FAIL-CLOSED PAR CONSTRUCTION

`src/lib/laundry/publicationGate.ts`. **Quatre façons de ne pas publier, toutes
refusées :**

| # | Cas | Refusé parce que |
|---|---|---|
| 1 | `publication = 'withdrawn'` | décision explicite |
| 2 | valeur inattendue (`'draft'`, `'PUBLISHED'`, `'  published  '`, `true`, `1`, un objet) | seule la chaîne exacte publie |
| 3 | **colonne absente du `select`** → `undefined` | un appelant qui oublie de la demander **n'obtient pas une publication par défaut** |
| 4 | **la lecture LÈVE** | colonne pas encore créée, client Prisma non régénéré, base injoignable |

**Le cas 4 est le plus important, et c'est un choix opposé à celui du garde
d'endpoint (A9).** A9 doit sortir en code 1 ; ici l'échec doit produire *moins
de publication*, pas une panne. Propager l'exception ferait tomber
`/api/scan/ask` entier — et quelqu'un finirait par retirer le filtre pour
rétablir la route. L'exception est donc absorbée et rend `null`.

C'est aussi le chemin **normal** entre la mise en production du code et
l'exécution de la migration : pendant cette fenêtre, le produit se comporte
comme si aucun trail n'était publié. Volontairement plus strict que l'état
actuel.

`redactLaundryTrail` rend **`null`, jamais un objet vidé** : un appelant qui
teste `if (trail)` fait disparaître le bloc, au lieu d'afficher une carte vide
qui porterait encore le nom de la personne.

**Aucune sortie par l'environnement** — pas de `process.env`, pas de `SKIP_`,
`FORCE_`, `ALLOW_`, `NODE_ENV`. Vérifié par un test, sur le code dépouillé de
ses commentaires.

---

## 3. `groundingContext.ts` — LE CONTRASTE, RÉSOLU

C'était le point de départ. Avant :

```ts
      proceedsPublication: true,        // ← « P0 containment », commenté
      …
      laundryTrails: { select: { laundryRisk: true }, take: 1 },   // ← rien
```

Sept lignes d'écart, dans la même requête : le montant soumis au containment,
le trail de blanchiment non — **alors que c'est la surface la plus difficile à
rattraper**, puisque le drapeau ne sort pas dans un champ JSON filtrable mais
est reformulé librement en prose par un modèle de langage.

Après : `laundryTrails` **n'est plus sélectionné du tout**. La lecture passe par
`readPublishedLaundryTrail(prisma, handle, { laundryRisk: true })`.

**Et c'est là que le point unique paye.** `/api/scan/ask` et
`/api/mobile/v1/ask` consomment tous deux `hasLaundryTrail` depuis ce fichier :
**filtrer une fois couvre les deux routes, et aucune des deux — toutes deux sur
chemin gelé — n'a eu besoin d'être touchée.** Un test le verrouille.

---

## 4. LES QUATRE SURFACES GELÉES — PATCHES, PAS FORÇAGE

`src/app/api/**` et `src/components/**` sont gelés par `guard-offline.sh`.
**Aucun `--no-verify`, aucun contournement.** Les correctifs ont été écrits,
appliqués, **vérifiés (`pnpm typecheck` vert, suite complète verte)**, capturés
en patches, puis les fichiers ont été **remis à leur état d'origine**.

| Surface | Patch | Ce qu'il fait |
|---|---|---|
| `GET /api/laundry/{handle}` | `A12-surface…-laundry-handle-route.ts.patch` | filtre dans le `where` + revérification. *`PUBLIC_KOL_FILTER` ne couvre que la publication du PROFIL — un profil public peut porter un narratif retiré.* |
| `GET /api/kol/{handle}/pedigree` | `A12-surface…-pedigree-route.ts.patch` | `where` sur la **relation imbriquée** + `filterPublishedLaundryTrails` |
| `GET /api/pdf/kol` (lawyer) | `A12-surface…-pdf-kol-route.ts.patch` | filtre + `redactLaundryTrail` avant le rendu — *ce PDF sort de la maison* |
| `LaundryTrailCard` | `A12-surface…-LaundryTrailCard.tsx.patch` | **dernière barrière au rendu** : sans état lisible, `return null` |

**Pourquoi une barrière côté composant en plus des routes :** il reçoit son
objet d'un `fetch` client et pourrait demain le recevoir d'ailleurs. Le filtre
n'est unique que dans sa *définition* — pas dans le nombre d'endroits où on le
pose.

**Note technique retenue en chemin :** une extension de client Prisma aurait été
plus élégante qu'un patch par surface, mais **elle n'intercepte pas les lectures
de relations imbriquées** — or `pedigree` et `groundingContext` lisaient
justement le trail en imbriqué. D'où le prédicat exporté une fois et posé
explicitement, qui est le patron déjà utilisé dans le dépôt (`PUBLIC_KOL_FILTER`).

### Un cinquième patch, et pourquoi il est séparé

`__tests__/api/security/laundry-handle.publish-gate.test.ts` échoue avec le
correctif de route : sa fixture est `{ id, kolHandle, signals }`, **sans état de
publication**, et elle attend que le trail soit servi. **C'est exactement le
comportement qu'on change** — un état absent ne publie plus.

Le correctif de fixture est donc un patch **distinct**
(`A12-test-fixture-…patch`), à appliquer avec les quatre autres. Il aurait pu
être versé maintenant sans rien casser ; ne pas le faire est délibéré :
**cette assertion encode une doctrine, elle ne doit pas changer avant la
décision qui la change.**

Vérifié : les cinq patches appliqués ensemble → `git apply` propre,
`pnpm typecheck` vert, **290 fichiers / 3 016 tests verts**.

---

## 5. LES TESTS — 50, ET CE QU'ILS PROUVENT

`__tests__/security/laundry-publication-gate.test.ts`.

- **14 cas de non-publication**, chacun refusé par `isLaundryTrailPublished` et
  par `redactLaundryTrail` — dont l'état absent, l'espace autour, la casse, les
  types non-chaîne, et `null`/`undefined`.
- **Le cas 4** : une lecture qui lève rend `null` **sans propager l'exception**.
- Le filtre est posé **dans le `where`** et l'état est **toujours demandé**,
  même quand l'appelant ne le demande pas.
- **Aucune lecture d'environnement** dans le module.
- Le vocabulaire (`états`, `motifs`, `portées`) est **aligné mot pour mot** sur
  le registre des proceeds.
- **Les six surfaces sont énumérées nommément** : chacune doit être soit filtrée
  dans l'arbre, soit couverte par un patch qui la nomme *et* importe le gate.
  **C'est la garantie de complétude** — aucune surface ne peut être oubliée en
  silence, y compris celles qu'on n'a pas le droit de modifier aujourd'hui.
- La migration existe, porte `STATUS: NON APPLIQUÉE`, et **ne contient ni `DROP`,
  ni `DELETE`, ni `TRUNCATE`, ni `UPDATE "LaundryTrail"`**.

---

## 6. NOTE POUR LE BLOC 4 — LA FAILLE DU CRITÈRE

**Constat, sans action.**

Le critère de sélection du containment du 16 août était *« tout chiffre publié
dans `totalDocumented` »*. Il a fonctionné exactement comme écrit — et il a
laissé passer deux profils :

| Handle | `totalDocumented` | Événements | Montant affirmé par le narratif | Retenu par le critère ? |
|---|---|---|---|---|
| `lynk0x` | **0** | **0** | **26,8 K$** « confirmed on-chain cashout » | **non** |
| `ghostwareos` | **0** | **0** | **33 K$+** via mixer · **280 K$+** de pic | **non** |

Les deux sont `proceedsPublication = 'published'`, et `ghostwareos` est le seul
des cinq dont `KolProceedsSummary.reviewStatus = 'published'`.

**Ce n'est pas un défaut d'application, c'est un défaut de portée.** Le critère
interrogeait *une table*. Les chiffres publiés vivent dans **au moins deux** :
`KolProfile.totalDocumented` **et** `LaundryTrail.narrativeText`, où ils sont
écrits en dur dans de la prose, hors de tout recalcul et hors de tout agrégat.

**Le critère de sortie du bloc 4 doit donc être « tout chiffre publié, quelle
qu'en soit la table », et non « tout profil dont le total est non nul ».**
Conséquence pratique : il faut une **liste des tables porteuses de chiffres
publiés** avant de pouvoir écrire ce critère. Ce recensement n'a pas été fait
ici — il déborde A12.

---

## CONTRÔLE

| Contrainte | État |
|---|---|
| Bascule d'état, dépublication, décision nominative | **aucune** — l'interrupteur est posé, jamais actionné |
| Migration exécutée, `db:*`, `prisma migrate` | **aucune** |
| Écriture en base | **aucune** |
| Déploiement, merge | **aucun** |
| Variable d'environnement posée | **aucune** |
| `--no-verify`, chemin gelé forcé | **aucun** — 4 surfaces en patches, remises à l'origine |
| Fichiers de l'arbre modifiés | `src/lib/ask/groundingContext.ts` · **créés** : le gate, les tests, les patches, ce rapport |
| `BOTIFY_MINT`, `TSA_*`, `R2_PUBLIC_BASE_URL` | non touchés |
| Nominatif | aucun narratif recopié ; le journal fige une **empreinte**, pas le texte |
