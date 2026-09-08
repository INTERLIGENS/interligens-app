# BUILD 10 · T2 — ÉTAT AVANT COMPACTION

Écrit avant auto-compact. **Ce fichier est ma mémoire.** Ce qui n'y est pas
sera perdu.

Base au moment de l'écriture : `origin/main = 69b8ca8` ·
guard `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` ·
**0 exemption, aucune fenêtre ouverte.**

---

## 1 · PR #295 — PRÉPARÉE, NON APPLIQUÉE, NON MERGÉE

Branche : **`feat/cc-offline-171-p3-pdf-authority`**

Rien n'est appliqué. L'arbre de la branche est **identique à `main`** sur les
chemins gelés, et la suite y est verte **sans** les patches.

| artefact | chemin | gelé |
|---|---|---|
| `P3-report-casefile-route.patch` | `src/app/api/report/casefile/route.ts` | **oui** |
| `P3-pdfRenderer.patch` | `src/components/pdf/pdfRenderer.ts` | **oui** |
| `P3-i18n.patch` | `src/lib/i18n/{en,fr}.ts` | non |
| `P3-tests-pdf-report-authority.test.ts.prepared` | `__tests__/casefile/pdf-report-authority.test.ts` | non |

Tous sous `docs/prep/patches/BUILD10/`, avec `README-P3-pdf-authority.md` qui
porte la commande d'application.

**Les trois patches sont interdépendants** : `P3-i18n` change la signature de
`claimsSubtitle`, que `P3-pdfRenderer` appelle. Appliquer l'un sans l'autre ne
compile pas — c'est voulu, ça empêche une demi-application.

**Statut vérifié** : les trois s'appliquent sur `origin/main = 69b8ca8` dans un
**worktree propre**, après le merge P1 de T1, sans conflit.

**Deux fichiers gelés, ni un de plus.** `/api/scan/solana` n'est pas touché.

### Si `main` rebouge — la seule action autorisée en standby

```bash
git rebase origin/main
# puis revérifier dans un worktree PROPRE, pas dans l'arbre de la branche :
git worktree add -q --detach /tmp/wt origin/main
cd /tmp/wt && for p in P3-report-casefile-route P3-pdfRenderer P3-i18n; do
  git apply --check "<repo>/docs/prep/patches/BUILD10/$p.patch"; done
```

Rien d'autre. Pas de merge, pas de fenêtre, pas de nouveau patch.

---

## 2 · LA DÉCISION : RETRAIT DU SCORE, PAS SÉPARATION

L'arbitrage autorisait la séparation de présentation, **avec repli sur le
retrait « si elle n'est pas possible mécaniquement »**. J'ai établi qu'elle ne
l'est pas. **Trois justifications mécaniques :**

1. **L'adjacence est structurelle.** Le score et le nombre de claims occupent
   deux cellules de la **même grille à trois colonnes** du bloc d'en-tête —
   `RISK SCORE` · `STATUS` · `CLAIMS`. Ce n'est pas un voisinage de mise en
   page, c'est la structure du gabarit.
2. **La dérivation était écrite noir sur blanc**, page 2 :
   `claimsSubtitle(penalty, mult, score, count)` →
   *« 8 referenced claims — score: penalty=… × … = … »*, juste sous le tableau
   des claims.
3. **Le dénominateur `/ 8` était en dur** : la taille du corpus legacy, figée
   dans le gabarit.

Séparer aurait exigé de garder le nombre en le qualifiant. Or `risk.score` est
calculé depuis `rawClaims` — **le corpus que ce document cesse précisément de
publier**. Le qualifier honnêtement reviendrait à écrire « score calculé sur un
corpus absent de ce document » : ce n'est pas une séparation, c'est l'aveu
qu'il n'a pas sa place ici.

**Retiré.** Rien recalculé, rien remplacé par `0` ni `null`, aucun poids, seuil
ou formule touché. Le retrait **nomme le champ** :
*« Score withheld — this document does not publish the corpus it was computed
from. Field: `off_chain.source` »*

Accepté par le fondateur comme **couvert par le ruling GPT déjà ratifié**
(OMIT/HIDE si séparation propre impossible) — donc **pas une décision
nouvelle**.

---

## 3 · LES DEUX CHEMINS LEGACY SUPPRIMÉS

Le PDF publiait le corpus legacy **par deux voies distinctes** :

1. **via le scan** — ses claims venaient de `/api/scan/solana`, qui les tire de
   `loadCaseByMint` et pose `off_chain.source = "case_db"` ;
2. **via un `require()`** — `require("data/cases/botify.json")` enrichissait les
   titres et descriptions FR. Une **seconde lecture de la même autorité**, dans
   le même fichier.

Les deux partent. Les claims viennent de `loadPublicProjection`, dans la locale
demandée : la projection porte `titleFr`/`descriptionFr`, il n'y a plus rien à
enrichir, et `_raw_claims` n'est plus injecté.

**Aucun repli** : sans dossier canonique pour ce mint,
`off_chain.source = "none"` et la liste est vide. Se rabattre sur ce que le
scan avait rempli republierait le corpus legacy par la porte de derrière.

**Le scoring n'a pas bougé — mesuré.** `off_chain.claims` est un champ de
**sortie** ; les deux scoreurs lisent `rawClaims` et `!caseFile`, jamais
`off_chain.claims`. Vérifié argument par argument, épinglé par test.

---

## 4 · LES CINQ MUTANTS — 15 tests, 5 mordent

| # | mutant | tests tués |
|---|---|---|
| 1 | le score revient dans le bloc d'en-tête | 1 |
| 2 | la phrase de dérivation revient | 2 |
| 3 | **le score remplacé par `0`** ← **MUTANT DE SUR-CORRECTION** | 1 |
| 4 | repli vers le corpus du scan quand le dossier manque | 1 |
| 5 | l'autorité servie mal déclarée (`case_db` au lieu de `canonical`) | 1 |

**Le n° 3 est le mutant de sur-correction** : remplacer le score par `0`
réintroduirait, **par la porte du rendu**, la coercition « absence →
rassurance » que P0 a fermée. Retirer n'est pas fabriquer.

```
suite, patches APPLIQUÉS   5073 passed | 2 skipped
suite, arbre NON patché    5058 passed | 2 skipped
typecheck vert dans les DEUX états · lint 0 erreur
```

**Les « 2 » sont des SKIPS, pas des rouges.** `evidence-chain.test.ts`, deux
suites `describe.runIf` désarmées par `EVIDENCE_TSA_LIVE` / `EVIDENCE_R2_LIVE`
— délibérément, pour éviter une CI flaky réseau. **Zéro test rouge.** Ce n'est
pas le flake contradiction-detector (D12).

---

## 5 · VERDICT `api/admin/export/botify` — **INHERITS_GATES**

**La route CONSOMME, elle ne duplique pas. Zéro `prisma.` dans le fichier gelé.**

```
GET /api/admin/export/botify
  → requireAdminApi(req)                                   [GELÉ]
  → loadBotifyDbEnrichment(case_id)   ← TOUTES les requêtes [LIBRE]
  → buildBotifyEvidenceRows(caseData, db)                   [LIBRE]
  → rowsToCsv(rows)                                         [LIBRE]
```

Le correctif de T1 sur `src/scripts/export/botifySpreadsheet.ts` **s'y propage
intégralement**. Les trois axes sont **dans le fichier libre** :

| axe | constat établi sur le code |
|---|---|
| **1 · KolWallet** | `findMany({ where: { kolHandle: { in: [...] } }, select: { kolHandle, address, label } })` — **aucun** `isPubliclyUsable`, le champ n'est **même pas sélectionné**. `PUBLISHABLE_WALLET_FILTER` existe (`src/lib/kol-memory/walletPublication.ts`) et n'est pas importé. |
| **2 · mint synthétique** | le JSON source porte la clé **43 car.** `…UnZac**ja4**…`, mais **0 URL externe du CSV ne la porte** : les `evidenceUrl` sont bâties sur `wallet`/`address` (`solscan.io/account/…`, 2 sites) ou `thread_url`. |
| **3 · KolProceedsEvent** | `SELECT * FROM "KolProceedsEvent" LIMIT 500` puis filtre par `JSON.stringify(r).includes("botify")`. **Ni** `proceedsPublication` **ni** `redactProceeds` — les deux existent (15 et 11 fichiers). |

**Deux constats de la même famille**, signalés :
- le **`LIMIT 500` est une « sécurité par hasard »** — pas une gate : au-delà des
  lignes tombent en silence, en deçà il ne filtre rien ;
- **coercition d'absence en valeur** : `amountUsd: amount != null ? String(amount) : ""`
  et `amountUsd: ""` — un montant absent devient une **cellule vide** sous un
  en-tête « Amount USD », indistinguable d'un zéro dans Excel.

**Contrôle d'accès — DIFFÉRENT de `admin/kol/network` :**

| route | mécanisme |
|---|---|
| `admin/export/botify` | `requireAdminApi` → `x-admin-token` **OU cookie httpOnly** |
| `admin/kol/network` | comparaison directe `Authorization: Bearer` vs `ADMIN_TOKEN` |

Conséquence : `export/botify` est atteignable **depuis un navigateur
authentifié**, pas seulement par un appel serveur porteur d'un Bearer.
Fail-closed si `ADMIN_TOKEN` absent (500).

**Indivisibilité : NON REMPLIE.** Les requêtes ne sont ni définies ni exécutées
dans le fichier gelé ; un fichier **libre** les définit et peut interposer le
gate. **Les trois axes se ferment sans toucher au chemin gelé.**

→ **La route n'entre PAS dans la fenêtre pdf/kol.** Position retenue par le
fondateur. **Pas de fenêtre 3.**

---

## 6 · LA QUESTION OUVERTE — NON TRANCHÉE

**Bascule d'autorité du CSV.** `api/admin/export/botify` importe
`data/cases/botify.json` **en import statique** comme autorité de dossier.

- ce n'est **aucun des trois axes** : c'est une question d'**autorité**, pas de
  fuite de publication ;
- la fermer = remplacer l'import par le lecteur canonique → **+1 fichier gelé** ;
- **en attente de l'arbitrage GPT.**

**Je ne prépare AUCUN patch de bascule tant que ce n'est pas tranché.**

---

## 7 · STANDBY — CE QUE JE NE FAIS PAS

- ne pas merger #295 · ne pas ouvrir de fenêtre ni d'exemption
- ne pas prendre `main` (T1 le tient dans `~/dev/interligens-web`)
- ne pas déployer — **rien n'est en prod** : elle sert `mjyo7j3xe`, sans
  P0/P1/P2/P3. **Un seul déploiement cumulatif, après la fenêtre.**
- ne pas toucher `src/scripts/export/botifySpreadsheet.ts` ni
  `data/cases/botify.json` — **T1 y travaille en ce moment**
- ne préparer aucun patch de bascule d'autorité

**Seule action autorisée si `main` rebouge** : rebaser #295 et revérifier
l'applicabilité des trois patches en worktree propre.
