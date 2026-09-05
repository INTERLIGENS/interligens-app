# P0 — Classification des gardes CI rouges sur `main`

Étape 1 : **cartographie seule**. Aucune configuration CI modifiée, aucun code
touché, aucun re-run mutant. Branche `feat/cc-offline-141-ci-signal-classification`,
depuis `main = 522154e`.

## Le constat d'ensemble

**`main` n'a jamais été vert.** Sur les **200 derniers runs** du workflow
`Security Gates` (remontant au 2026-06-26) : **151 `failure`, 49 `cancelled`,
zéro `success`**. Ce n'est pas une régression récente, c'est un signal éteint
depuis au moins deux mois et demi.

Deux workflows existent :

| workflow | déclencheur | état |
|---|---|---|
| `CC Offline Guard` (« Paths / branch guard ») | `pull_request` → main | **vert** — c'est la garde qui protège les merges |
| `Security Gates` | `push` sur main + branches de chantier, `pull_request` | **rouge en permanence** |

Un cinquième signal, hors GitHub Actions : un **status `Vercel`** posté sur le
commit.

## Le tableau

| garde | rouge depuis | raison exacte (lue dans les logs) | catégorie | restauration admissible proposée |
|---|---|---|---|---|
| **Quality Gates** | ≥ 2026-06-26 (déjà rouge au plus ancien run listé, `ad71cb8`) | `next build` échoue : `Error: [env] Missing required env var in prod: ADMIN_TOKEN`, en collectant les données de `/api/admin/ingest/pdf`. `src/lib/config/env.ts` exige en prod `DATABASE_URL`, `ADMIN_TOKEN`, `VAULT_AUDIT_SALT`, `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS` ; `next build` pose `NODE_ENV=production`, et le job n'en fournit **aucune** | **CONFIG/INFRA** | Fournir des valeurs **factices de CI** dans le `env:` du job. La garde fail-fast continue de fonctionner exactement comme avant en production réelle : on ne la désactive pas, on cesse de la faire tirer sur un environnement qui n'est pas la prod. Zéro ligne de code applicatif touchée. |
| **Dependency Audit** | ≥ 2026-06-26 (`ad71cb8`) | `pnpm audit --audit-level=moderate` → **112 vulnérabilités** (8 low, 44 moderate, 60 high), toutes transitives dans l'outillage : `.>jsdom>undici` (GHSA-v3r7-h72x-cjcm), `.>eslint>@humanfs/node` (GHSA-p498-v437-472g), etc. | **EXPECTED_BASELINE_DEBT** | **Le mécanisme existe déjà** — voir ci-dessous. Le job porte deux étapes : `pnpm audit` (bloquante, indistincte) et `pnpm audit:classify` (`continue-on-error: true`, qui sépare prod / dev / transitif). Le durcissement `--fail-on-prod` est **déjà nommé « phase 3 »** dans le commentaire du workflow. La restauration admissible consiste à faire porter le verdict bloquant par le classement déjà écrit, pas à relever un seuil ni à ignorer des advisories. |
| **SAST (Semgrep)** | **2026-08-26** — vert le 2026-08-21 (`9c27004`), rouge depuis (rouge par intermittence avant, pour d'autres causes) | **1 seule finding**, et elle est dans la CI elle-même : `.github/workflows/security.yml:234`, `run: pnpm ratchet:check origin/${{ github.base_ref }}` → règle `yaml.github-actions.security.run-shell-injection`. La ligne a été introduite le 2026-08-26 par `94f9662` (« câble le ratchet et le classement d'audit dans la CI ») — **la date où SAST est passé au rouge** | **REAL_FAILURE** (voir la réserve d'exploitabilité) | Le correctif est celui que la règle recommande, et il ne faiblit rien : passer `github.base_ref` par un `env:` intermédiaire et l'utiliser en `"$BASE_REF"`. **Aucun** `nosemgrep`, **aucune** exclusion de règle. |
| **All Security Gates Passed** | ≥ 2026-06-26 | Job récapitulatif, `needs: [gitleaks, semgrep, audit, quality]`, `if: always()`. Log : `❌ Un ou plusieurs security gates ont échoué.` Il n'a aucune logique propre | **CASCADE** | Redevient vert seul quand les trois autres le sont. **Rien à faire dessus** — et surtout pas l'assouplir : c'est le job unique que la branch protection surveille. |
| **Vercel** (status de commit) | non déterminé — voir réserve | `Deployment has failed`, déploiement `dpl_FDxiqa9QYGNyPda9UkY3U2GivNv9`, projet **`interligens-web`** | **CONFIG/INFRA présumé — non confirmé** | Aucune proposition tant que la cause n'est pas lue (voir réserve). |

`Secret Scanning (Gitleaks)` est **vert** sur toute la fenêtre observée.

## Le mécanisme baseline/ratchet déjà présent — nommé

Le dépôt **possède déjà** la doctrine que R4 autorise, en **phase 1** :

| pièce | rôle |
|---|---|
| `scripts/ratchet-check.mjs` | compare **deux baselines versionnées** de suppressions ESLint (base de fusion vs PR), jamais la sortie d'ESLint — le verdict ne dépend ni de la version d'ESLint, ni de l'ordre des fichiers, ni du parallélisme |
| `eslint-suppressions.json` (32 963 o) | la baseline versionnée |
| `pnpm ratchet:check` | l'entrée `package.json` |
| `security.yml:231-234` | l'étape CI, `continue-on-error: true`, PR seulement |
| `scripts/audit-classify.mjs` + `pnpm audit:classify` | classe chaque advisory par la **racine** de ses chemins : `prod` (code livré) / `dev` (outillage seul) / `inconnu` |
| `security.yml:95-98` | l'étape CI, `continue-on-error: true` |

Les commentaires du workflow disent explicitement la trajectoire : **phase 1**
mesure sans bloquer, **phase 3** rend bloquant (`--fail-on-prod`, ratchet
`required`). Aucun nouveau mécanisme n'est à inventer — il faut le brancher.

## La REAL_FAILURE isolée

**SAST (Semgrep) — `security.yml:234`.**

C'est la seule garde dont la cause est un défaut du dépôt et non une
configuration d'environnement ou une dette acceptée. Elle remonte à l'arbitrage.

**Réserve d'exploitabilité, à peser dans l'arbitrage.** La règle Semgrep vise
l'interpolation de contexte `github` dans un `run:`. Ici la variable est
`github.base_ref` — le nom de la branche **cible** de la PR, donc une branche de
ce dépôt. Un attaquant sans droit d'écriture ne peut pas la choisir ; c'est
`github.head_ref` qui serait librement contrôlable. Le motif signalé est réel,
sa voie d'exploitation est étroite.

Cela **ne change pas** la conclusion : le correctif recommandé par la règle est
mécanique, il ne retire aucune couverture, et laisser la garde rouge coûte plus
que de l'appliquer — c'est elle qui masque aujourd'hui toute nouvelle finding
Semgrep.

## Réserve : le status Vercel

Le déploiement en échec appartient au projet Vercel **`interligens-web`**. Je
n'ai pas pu lire ses logs (`npx vercel inspect` demande une authentification
interactive, hors périmètre read-only de cette étape), donc :

- **je n'affirme pas** que la cause est la même que celle de Quality Gates,
  même si les deux exécutent `next build` et que l'hypothèse est naturelle ;
- **je n'affirme pas** que ce projet est celui qui sert la production. Le
  déploiement de production documenté vise `app.interligens.com` ; le nom de
  projet observé ici est différent, et savoir si `interligens-web` est un projet
  secondaire, hérité, ou le bon, demande une vérification que je n'ai pas faite.

Les deux points doivent être tranchés avant qu'une restauration touche à Vercel.

## Ordre de restauration suggéré (étape 2, non appliqué)

1. **Quality Gates** — le plus gros gain de signal : il ré-ouvre `tsc`, le build
   et les tests. Purement configuration de job.
2. **SAST** — un correctif d'une ligne, qui rend visibles toutes les findings
   Semgrep futures.
3. **Dependency Audit** — brancher le classement existant. C'est le seul point
   qui demande une décision de doctrine (quel niveau bloque), donc le dernier.
4. **All Security Gates Passed** — redevient vert de lui-même.
5. **Vercel** — après lecture de ses logs et confirmation du projet.

## Attestation

- **Zéro configuration CI modifiée**, zéro workflow touché.
- **Zéro code applicatif touché.**
- Aucun re-run déclenché, aucun `workflow_dispatch`.
- Aucune garde désactivée, aucun `continue-on-error` ajouté, aucun seuil
  déplacé, aucune dépendance mise à jour.
- La branche ne porte que ce rapport.

**STOP.** Aucune restauration appliquée ; le plan attend votre revue et
l'arbitrage sur la REAL_FAILURE.
