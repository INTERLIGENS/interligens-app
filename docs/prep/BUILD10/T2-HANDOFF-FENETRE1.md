# BUILD 10 · FENÊTRE 1 — HANDOFF T2 → T1

**T1 tient la fenêtre de bout en bout : ouverture, application, tests, merge,
refermeture. T2 ne merge rien, n'ouvre rien, ne prend pas main.**

Base vérifiée : `origin/main = 4607d282f70e55eaddc1e5c169a3c65095a41ee3`
(#299, refermeture du P0 public).
Branche porteuse : `feat/cc-offline-171-p3-pdf-authority` = `b8fd4d3da980f25b55ed0f24d551a3744ef61c91`.
Guard : `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50`.

Les trois patches ont été revérifiés **sur `4607d28`, en worktree détaché** —
jamais dans l'arbre de T2, qui pourrait déjà les porter et rendre la
vérification fausse. Résultat : les trois s'appliquent, seuls **et** en cumul
dans l'ordre ci-dessous, sans rejet.

---

## 1 · Ordre d'application

L'ordre est celui qui a été vérifié en cumul. Ne pas le changer.

```bash
git apply docs/prep/patches/BUILD10/P3-report-casefile-route.patch
git apply docs/prep/patches/BUILD10/P3-pdfRenderer.patch
git apply docs/prep/patches/BUILD10/P3-i18n.patch
cp    docs/prep/patches/BUILD10/P3-tests-pdf-report-authority.test.ts.prepared \
      __tests__/casefile/pdf-report-authority.test.ts
```

| # | patch | fichier(s) cible | gelé | lignes de diff (+/-) |
|---|---|---|---|---|
| 1 | `docs/prep/patches/BUILD10/P3-report-casefile-route.patch` | `src/app/api/report/casefile/route.ts` | **OUI** | 77 |
| 2 | `docs/prep/patches/BUILD10/P3-pdfRenderer.patch` | `src/components/pdf/pdfRenderer.ts` | **OUI** | 30 |
| 3 | `docs/prep/patches/BUILD10/P3-i18n.patch` | `src/lib/i18n/en.ts` **et** `src/lib/i18n/fr.ts` | non | 18 |
| 4 | `…/P3-tests-pdf-report-authority.test.ts.prepared` → `__tests__/casefile/pdf-report-authority.test.ts` | — | non | 15 tests |

**Deux fichiers gelés, ni un de plus.** L'exemption à demander couvre
exactement `src/app/api/report/casefile/route.ts` et
`src/components/pdf/pdfRenderer.ts`. `/api/scan/solana` **n'est pas dans le
périmètre** et ne doit pas y entrer.

Après les quatre commandes, `git status` doit montrer **exactement** :

```
 M src/app/api/report/casefile/route.ts
 M src/components/pdf/pdfRenderer.ts
 M src/lib/i18n/en.ts
 M src/lib/i18n/fr.ts
?? __tests__/casefile/pdf-report-authority.test.ts
```

Aucune autre ligne. Une ligne de plus = quelque chose a débordé.

## 2 · Interdépendances

**Patches 2 et 3 sont indissociables.** `P3-i18n` change la signature de
`claimsSubtitle`, que `P3-pdfRenderer` appelle. C'est délibéré : ça rend une
demi-application **non compilable** plutôt que silencieusement fausse.

Conséquence pratique : **entre l'étape 2 et l'étape 3, l'arbre ne typecheck
pas.** C'est normal. Ne lancer `typecheck` / `test` qu'après les quatre
commandes.

Le patch 1 est indépendant des deux autres sur le plan de la compilation, mais
il n'a de sens qu'avec eux : seul, il retire l'autorité legacy de la route
pendant que le renderer continue de présenter le score dérivé de cette autorité.
**Les trois partent ensemble ou aucun.**

## 3 · Où vivent les tests

**Dans le patch uniquement — rien n'est dans la branche.**
`git diff --stat origin/main..b8fd4d3 -- __tests__/` est **vide** : la branche
ne porte que deux commits de documentation. Les 15 tests existent seulement
dans le `.prepared`, et n'entrent dans l'arbre que par le `cp` de l'étape 4.

C'est voulu : tant que la fenêtre n'est pas ouverte, la branche doit être verte
**sans** les patches, donc elle ne peut pas porter des tests qui les exigent.

Les tests P3 déjà **sur main** (à ne pas recopier, ils y sont) :
`__tests__/casefile/surface-registry.test.ts`, `publicationRegime.test.ts`,
`canonicalReader.test.ts`, `etape7-authority-switch.test.ts`,
`dossier-agnostic-renderer.test.ts`, `containment*.test.ts`, `versioning.test.ts`,
`seal-three-properties.test.ts`, `point5-canonical-subject.test.ts`,
`publicationState.test.ts`.

### Commande exacte

Le ciblé, pendant l'itération :

```bash
pnpm vitest run __tests__/casefile/pdf-report-authority.test.ts
```

La suite complète — **les cinq variables sont obligatoires**, sinon le job
Tests échoue sur l'absence de `DATABASE_URL` avant d'exécuter quoi que ce soit :

```bash
DATABASE_URL='postgresql://ci:ci@db.invalid:5432/none?sslmode=disable' \
ADMIN_TOKEN=ci-not-a-secret \
VAULT_AUDIT_SALT=ci-not-a-secret \
ADMIN_BASIC_USER=ci \
ADMIN_BASIC_PASS=ci-not-a-secret \
pnpm test
```

Attendu, patches appliqués : **5073 verts / 5075, 0 rouge**. Les 2 non-verts
sont des **skips**, pas des rouges : `__tests__/evidence/evidence-chain.test.ts`
porte deux `describe.runIf(EVIDENCE_TSA_LIVE)` / `runIf(EVIDENCE_R2_LIVE)` qui
ne s'exécutent pas hors environnement live. Arbre non patché : 5058 / 5060,
mêmes 2 skips. `typecheck` vert dans les deux états, `lint` 0 erreur.

## 4 · Les cinq mutants

Décrits dans `docs/prep/patches/BUILD10/README-P3-pdf-authority.md` §4, et
implémentés dans le fichier de test préparé — chaque test qui en tue un porte
`MUTANT` dans son intitulé, donc `grep -n MUTANT` sur le fichier les localise.

| # | mutation à rejouer | tests tués | où |
|---|---|---|---|
| 1 | remettre `risk.score` / `risk.tier` dans le bloc d'en-tête de `pdfRenderer.ts` | 1 | test l. 82 |
| 2 | rétablir la phrase de dérivation `claimsSubtitle(penalty, mult, score, count)` | 2 | tests l. 87, 95 |
| 3 | **SUR-CORRECTION — remplacer le score retiré par `0`** (ou par `null`) | 1 | **test l. 108** |
| 4 | rétablir le repli vers le corpus du scan quand aucun dossier canonique ne répond | 1 | test l. 58 |
| 5 | déclarer `off_chain.source = "case_db"` alors que le canonique est servi | 1 | test l. 54 |

**Le mutant de sur-correction est le n° 3.** C'est celui qui compte : remplacer
le score retiré par `0` réintroduirait par la porte du rendu la coercition
« absence → rassurance » que P0 a fermée. Un `0` sur un document de dossier se
lit comme un risque nul mesuré.

Rejeu : appliquer les patches, éditer le fichier ciblé pour réintroduire la
mutation, relancer la commande ciblée du §3, vérifier que le nombre de rouges
correspond à la colonne « tests tués », puis `git checkout --` le fichier.
Un mutant qui ne mord pas est un trou de preuve, pas un test de plus.

## 5 · Ce qui doit être vrai APRÈS application

À vérifier avant de merger. Chaque point est couvert par au moins un test, mais
la liste sert de relecture indépendante.

1. **Claims canoniques.** Les claims du PDF CaseFile viennent de
   `loadPublicProjection`, dans la locale demandée. `titleFr` / `descriptionFr`
   viennent de la projection.
2. **Les deux chemins legacy sont supprimés.** (a) les claims ne viennent plus
   de `/api/scan/solana` / `loadCaseByMint` ; (b) le
   `require("data/cases/botify.json")` de la route a disparu, et `_raw_claims`
   n'est plus injecté. Les deux, pas un seul.
3. **Aucun repli.** Si aucun dossier canonique ne répond pour ce mint :
   `off_chain.source = "none"` et liste vide. Se rabattre sur ce que le scan
   avait rempli republierait le corpus legacy par la porte de derrière.
4. **TigerScore retiré du document**, pas séparé, pas requalifié. Le retrait est
   **signalé** et **nomme le champ**, jamais la valeur :
   *« Score withheld — this document does not publish the corpus it was computed
   from. Field: `off_chain.source` »*
5. **Aucun recalcul.** Aucun poids, seuil, formule ou agrégation n'est touché.
6. **Aucune substitution.** Ni `0`, ni `null`, ni `""`, ni sentinelle numérique
   à la place du score retiré. La dégradation voyage à côté du nombre, jamais
   dedans.
7. **`/api/scan/solana` et le scoring intacts.** Le fichier n'est pas modifié par
   ce lot. `off_chain.claims` est un champ de **sortie** : ni `computeScore` ni
   `computeTigerScoreFromScan` ne le lisent — ils lisent `rawClaims`. C'est ce
   qui rend la substitution mécanique, et c'est épinglé par test.
8. **Deux fichiers gelés touchés, exactement.** Le guard doit être byte-identique
   après refermeture.

## 6 · Ce que T1 gagnerait à savoir tout de suite

**a) Les patches ont été vérifiés sur `4607d28`, après #298 — pas avant.**
#298 a modifié `src/app/api/scan/solana/route.ts` (2 lignes : `safeEvidenceUrl`
appliqué à `thread_url` dans le mapping `off_chain.claims`). J'ai revérifié les
cinq chaînes que mon test épingle dans ce fichier : **les cinq tiennent encore**
sur `4607d28`. Le test « le fichier de scan est INCHANGÉ par ce lot » n'épingle
aucun hash, seulement des sous-chaînes — il ne casse pas au moindre commit sur
scan/solana.

**b) Point d'attention non vérifié, à ne pas confondre avec un défaut.**
#298 fait passer les `thread_url` de `off_chain.claims` par `safeEvidenceUrl`
dans scan/solana. Après ce lot, le PDF CaseFile ne lit plus ce chemin : ses
`threadUrl` viennent de `provenance.threadUrl` du canonique, qui **ne traverse
pas** la projection d'identité publique de #298. Je **n'ai pas pu mesurer** si
des `threadUrl` canoniques portent la clé synthétique 43 — aucun `.env.local`
dans ce worktree, et GPT a interdit toute reconnaissance nouvelle. Je le
signale comme question ouverte, **pas** comme un constat : si T1 a la base sous
la main, une lecture de `CaseFileClaim."threadUrl"` tranche en une requête.

**c) Le §5 du README de prep est PÉRIMÉ.** Il dit que le lot « attend le
résultat de T1 sur le containment des montants ». C'est fait : #296 a livré le
containment CSV. Et la fenêtre 3 (bascule d'autorité de
`api/admin/export/botify`) est **annulée** — requalifiée `NOT_MECHANICAL` parce
qu'elle exige un pont d'identité de dossier qui n'est déclaré nulle part. Ne
rien entreprendre sur ce paragraphe. Contexte complet :
`docs/prep/BUILD10/T2-TEMPS1-verdict-export-botify.md`, et les notes du chantier
Case Identity sur `feat/cc-offline-172-case-identity-notes` (`7ca5c80`).

**d) Encodage.** Les trois `.patch` et le `.prepared` sont **sans BOM** —
vérifié. Seul le README en porte un, et il n'est jamais appliqué.

**e) Le guard mord au pre-commit, pas au push.** Les deux fichiers gelés seront
refusés tant que l'exemption n'est pas mergée. Ordre ratifié, jamais inversé :
PR `hotfix/guard-*` → CI → merge de l'exemption → application → tests/mutants →
merge du code **pendant** la fenêtre → refermeture immédiate → guard
byte-identique.

**f) Si un patch ne s'applique plus.** Le dire, ne pas le rafistoler à la main :
un patch rejeté signifie que la cible a bougé, et c'est à T2 de le régénérer sur
la nouvelle base — pas à T1 de reconstruire l'intention depuis un `.rej`.

---

*T2, 2026-09-08. STANDBY strict après ce document : aucun merge, aucune fenêtre,
aucun chemin gelé touché. En cas de contradiction sur un patch, T2 ne corrige
rien sans passer par le fondateur.*
