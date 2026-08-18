# A14 — L'interrupteur étendu aux porteurs monétaires

**Branche :** `feat/cc-offline-72-a14-interrupteur-monetaire` — **non mergée, rien de déployé**
**Date :** 2026-08-18
`pnpm typecheck` vert · `pnpm test` **291 fichiers / 3 056 tests verts** (+40) · guard passé, aucun `--no-verify`

> **Aucun état n'a été basculé.** `monetaryClaimsPublication` naît à
> `'published'` pour les 411 profils. Aucune décision n'est prise.

---

## LE PRINCIPE — UN CHIFFRE, PLUSIEURS PORTEURS, UNE SEULE DÉCISION

Les 210 000 $ de `bkokoski` existent **trois fois** :

| # | Porteur | Couvert le 16/08 ? |
|---|---|---|
| 1 | `KolProceedsEvent` `SUMMARY_ARKHAM` = 210 000 $ | ✅ |
| 2 | `KolEvidence` type `coordinated_exit` = 210 000 $ | ❌ |
| 3 | `LaundryTrail.narrativeText` — « moved $210K USDC across 4 wallets » | ❌ |

**Un interrupteur par table reconstruirait le défaut qu'on corrige** : il
faudrait trois décisions pour retirer un chiffre, et l'on en oublierait une.

D'où la règle, qui tient tout le chantier :

> **Une affirmation monétaire est publiable si — et seulement si — aucun des
> interrupteurs qui la concernent n'est retiré.** Ils se composent en ET.

Le test qui le prouve : *« UN SEUL retrait d'encaissement les couvre TOUS LES
TROIS »*. Il exerce les trois porteurs contre l'état
`proceedsPublication = 'withdrawn'` — exactement celui écrit le 2026-08-16 —
et exige `null` sur les trois.

---

## DEUX INTERRUPTEURS, ET POURQUOI PAS UN

« Ce que la personne a encaissé » et « l'ampleur du préjudice attribué » ne
sont pas la même affirmation. Sur `bkokoski` : **210 900 $** d'encaissement
retirés, **4 500 000 $** de `totalScammed` — facteur 21, deux assertions
distinctes. **Les fondre ferait disparaître l'une avec l'autre sans qu'aucune
décision ne l'ait dit.**

| Famille | Interrupteur | Porteurs |
|---|---|---|
| **`proceeds`** — ce qui a été encaissé | `proceedsPublication` *(existant, 6 décisions au 16/08)* | `totalDocumented` · `KolCase.paidUsd` · `KolTokenInvolvement.proceedsUsd` · `KolEvidence` de type d'encaissement · narratif `LaundryTrail` |
| **`scam_scale`** — l'ampleur du préjudice | **`monetaryClaimsPublication`** *(nouveau, `DEFAULT 'published'`, aucune décision)* | `totalScammed` · `KolEvidence` de type de préjudice |

`monetaryClaimsPublication` est consulté dans **les deux** cas : c'est
l'interrupteur général « plus aucun chiffre sur cette personne », celui qui
permet de tout taire d'un geste sans énumérer les familles.

**Un montant non qualifié exige les deux.** Un appelant qui n'a pas classé son
chiffre n'obtient pas le régime le plus permissif — il obtient le plus strict.
Même règle pour un `KolEvidence.type` inconnu : **un type ajouté demain sans
être classé sera plus protégé, pas moins.**

### ⚠️ La conséquence de fusionner, à connaître

Les six décisions du 16 août portent `proceedsPublication = 'withdrawn'`. **Dès
que ce code est servi, elles couvrent aussi les porteurs d'encaissement
latéraux** — `paidUsd`, `proceedsUsd`, les preuves d'encaissement. C'est le
défaut mesuré par A13, donc l'effet voulu ; c'est aussi un **élargissement
effectif de décisions déjà prises**.

Rien n'est basculé ici — la branche n'est ni fusionnée ni déployée. **La
décision, c'est celle de fusionner.**

---

## CE QUI EST LIVRÉ

| # | Livrable | Où | État |
|---|---|---|---|
| 1 | Point de filtrage unique, fail-closed | `src/lib/publication/monetaryGate.ts` | **dans l'arbre** |
| 2 | Migration — colonne + 4 portées de registre | `docs/prep/patches/A14-MIGRATION_monetary_claims_v1.sql` | **affichée, NON exécutée** |
| 3 | Câblage des surfaces gelées | `docs/prep/patches/A14-surface*.patch` (2) | **patches vérifiés** |
| 4 | Tests, dont celui des trois porteurs | `__tests__/security/monetary-publication-gate.test.ts` | **40 tests verts** |
| 5 | Garde anti-récidive | `docs/prep/patches/A14-garde-anti-recidive.test.ts.prepared` | **préparé, NON livré** |

---

## LA MIGRATION — ET LA SEULE OPÉRATION NON ADDITIVE DE LA SESSION

`§1` `ADD COLUMN IF NOT EXISTS "monetaryClaimsPublication" … DEFAULT 'published'`
— additif. `§3` deux index — additif.

**`§2` élargit le `CHECK` de portée de `KolProceedsPublicationLog`, et c'est la
seule opération non strictement additive de tous les chantiers de cette
session.** Elle est signalée comme telle dans le fichier. Élargir un `CHECK`
impose de le remplacer : les `CHECK` se composent en ET, en ajouter un
resserre toujours.

Trois garanties l'encadrent :

1. la nouvelle liste **contient l'ancienne mot pour mot** — `profile_total`,
   `summary`, `event`, `involvement` — plus `scammed_total`, `case_paid`,
   `evidence_amount`, `monetary_all` ;
2. un **contrôle préalable** (`§0`) compte les lignes existantes qui sortiraient
   de la nouvelle liste et **fait échouer la transaction** si `> 0` ;
3. le tout est dans un `BEGIN … COMMIT`.

Un test vérifie que les quatre portées d'origine sont toutes présentes dans le
SQL, qu'aucun `DROP TABLE`/`DELETE`/`TRUNCATE` n'y figure, et qu'aucun `UPDATE`
ni `INSERT` de décision n'y est glissé.

### Pourquoi on réutilise le registre au lieu d'en créer un quatrième

`KolProceedsPublicationLog` est keyé sur le **handle** et son `scope` prévoyait
déjà `'involvement'` — **jamais utilisée**. C'est un registre d'affirmations
monétaires nominatives, pas un registre de `totalDocumented`. En créer un
quatrième pour les mêmes personnes et les mêmes montants rendrait impossible la
seule question qui compte : *« combien de retraits, pour quel motif, sur cette
personne »*.

La règle qui se dégage : **un registre par NATURE d'objet, pas un registre par
table.** C'est pourquoi le narratif de blanchiment en a bien reçu un propre en
A12 — ce n'est pas un montant agrégé, c'est un texte, et il peut y en avoir
plusieurs par personne.

---

## LE CÂBLAGE — DEUX PATCHES, ZÉRO FORÇAGE

Les deux fichiers sont sur chemins gelés (`^src/lib/kol/`, `^src/app/api/`).
Correctifs écrits, **appliqués, vérifiés (`typecheck` vert, 291 fichiers /
3 056 tests verts), capturés en patches, fichiers remis à l'origine.**

| Fichier | Ce que le patch corrige |
|---|---|
| **`src/app/api/v1/kol/[handle]/route.ts`** | **la ligne du rapport A13.** `totalScammed` passe par `redactMonetary(…, "scam_scale")` ; `totalPaidUsd` passe par `sumPublishedMonetary` ; chaque `evidences[].amountUsd` par `redactEvidenceAmount` ; chaque `cases[].paidUsd` par `redactMonetary(…, "proceeds")` |
| **`src/lib/kol/canonical.ts`** | même défaut, **troisième occurrence** : `totalDocumented: redactProceeds(...)` ligne 170 et `totalScammed` servi brut. Corrige d'un coup la liste KOL, l'explorer et le leaderboard, qui consomment tous cet instantané |

**Les sommes calculées à la volée** — `totalPaidUsd`, `totalLoss` — étaient le
piège : invisibles à toute requête, aucun filtre Prisma ne les atteint. D'où
`sumPublishedMonetary`, qui rend **`null` et jamais `0`** : « 0 $ » serait une
affirmation, et une affirmation fausse.

**Restent à câbler** (non faits, listés pour le bloc 4) :
`class-action` (`totalLoss` + somme des preuves, plus ses `cexTargets` en dur),
`cashout`, `watchlist` (`proceedsUsd`), `pdf/kol`, `KolAlert`, `CashoutProof`,
`ShillToExitCard`, `KolNarrative`, `ProceedsCard`.

---

## LE GARDE ANTI-RÉCIDIVE — PRÉPARÉ, NON LIVRÉ

`docs/prep/patches/A14-garde-anti-recidive.test.ts.prepared`, destiné à
`__tests__/security/monetary-surface-coverage.test.ts`. Non livré
délibérément : il fige un état qui n'est pas encore le bon, et le poser
aujourd'hui calibrerait le cliquet **avant** les correctifs de surface.

**Le suffixe `.prepared` a été gagné.** Le fichier portait d'abord l'extension
`.test.ts`, en supposant que Vitest ne parcourait que `__tests__/` et `tests/`.
Faux — le motif d'inclusion par défaut balaye tout le dépôt. Le garde a été
collecté, exécuté, et il a échoué : il exige `src/lib/laundry/publicationGate.ts`,
qui vit sur la branche A12. **Un fichier « préparé, non livré » qui casse la
suite n'est pas préparé, il est livré à moitié.** Renommé, la suite est verte.

**Ce qu'il fait.** Il balaye les 18 répertoires qui servent du nominatif — dérivés
du matcher de `src/proxy.ts` et de `NOMINATIVE_PREFIXES` — et compte les
fichiers qui manipulent un champ monétaire ou un champ de prose **sans importer
aucun point de filtrage**. Plafonds mesurés ce jour, sur l'arbre **sans** les
correctifs A14 :

```
MAX_MONETAIRES_SANS_GARDE = 15
MAX_PROSE_SANS_GARDE      = 5
```

Deux vérifications l'empêchent d'être désarmé en silence : les quatre points de
filtrage doivent **exister** (un renommage non répercuté rendrait tous les
fichiers « informés » d'un coup), et **aucun préfixe déclaré dans
`nominativeApiGate.ts` ne doit être hors du périmètre balayé** — le garde ne
voit que ce qu'on lui montre.

**Ce qu'il n'est pas, et il faut le dire.** Ce n'est **pas** une preuve de
couverture. Il prouve qu'un fichier *connaît* un point de filtrage, pas qu'il
l'applique sur chaque ligne. **Il attrape l'ajout silencieux, pas l'erreur
d'application.** Il produit aussi des faux positifs assumés — `types.ts` déclare
des types, `signals.ts` calcule des seuils — qui comptent dans le plafond et le
feront baisser quand on les traitera. Un cliquet honnête compte ce qu'il voit.

C'est la réponse à la conclusion d'A13 : *un recensement par `SELECT` ne suffira
jamais, il faut une seconde passe sur le code, et elle n'est reproductible que
par un test.* **C'est lui qui empêche les 36 de devenir 40.**

---

## LES TESTS — 40

- **13 cas de refus** sur `isMonetaryClaimPublished` : profil nul, état absent
  du `select`, `null`, chaîne vide, espaces, casse, valeur inattendue, types
  non-chaîne.
- **Les deux familles ne se confondent pas** : un retrait d'encaissement ne tait
  pas l'ampleur du préjudice, et l'interrupteur général tait les deux.
- **Type d'évidence inconnu → soumis aux deux interrupteurs.**
- `redactMonetary` et `sumPublishedMonetary` rendent **`null`, jamais `0`** —
  vérifié explicitement (`expect(out).not.toBe(0)`).
- **Le bloc des trois porteurs** — cinq tests, dont : un seul retrait les couvre
  tous les trois · l'interrupteur propre au narratif (A12) suffit à le taire
  seul **sans** taire les deux autres · un état d'objet demandé mais absent
  (`null`) refuse, un objet sans état propre (`undefined`) n'ajoute rien.
- **Le facteur 21, en test** : après ce chantier, retirer l'encaissement de
  `bkokoski` ne tait toujours **pas** ses 4 500 000 $ — c'est **voulu**, c'est
  une autre affirmation. Ce qui change, c'est qu'un interrupteur existe
  désormais pour la prendre.
- Le module ne lit **aucune** variable d'environnement.
- La migration : non appliquée, additive, sans destruction, sans décision.

---

## CONTRÔLE

| Contrainte | État |
|---|---|
| Bascule d'état, décision nominative | **aucune** — les interrupteurs sont posés, jamais actionnés |
| Migration exécutée, `db:*`, `prisma migrate` | **aucune** |
| Écriture en base, déploiement, merge | **aucun** |
| Variable d'environnement posée | **aucune** |
| `--no-verify`, chemin gelé forcé | **aucun** — 2 surfaces en patches, remises à l'origine |
| Fichiers de l'arbre modifiés | **créés** : le gate, les tests, les patches, ce rapport. **Aucun fichier existant modifié.** |
| `BOTIFY_MINT`, `TSA_*`, `R2_PUBLIC_BASE_URL` | non touchés |
| Nom civil | aucun transcrit |
