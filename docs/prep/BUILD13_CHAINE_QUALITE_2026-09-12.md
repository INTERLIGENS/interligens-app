# BUILD 13 — LOT COURT · la chaîne de qualité avant la fenêtre

**Lecture seule.** Aucun fichier de production modifié, aucun workflow touché,
aucune entrée ajoutée à `eslint-suppressions.json`, aucune règle désactivée.
L'arbre suivi est resté propre : ce lot n'ajoute qu'un document.

**Le worktree de T2 n'a pas été ouvert.** Sa branche a été lue par ses **objets
git** (`git show`, `git diff main...a0e5e01`), depuis mon propre dépôt. Son
répertoire de travail n'a jamais été touché, ni en lecture ni autrement.

---

# 0. CONFIRMATION SUR F — une ligne, comme demandé

**CONFIRMÉ.** Admission operator RÉELLE (`x-admin-token` franchit les deux
gardes, 200 mesuré sur un profil `draft`) + AUCUNE décision WHAT n'autorise le
contenu (380 non publiés contre 32 publiés, et le même handler filtre déjà les
`laundryTrails` par gate de publication **y compris pour l'admin**, dans la même
réponse) → **F = Publication Authority P1/C, pas fuite publique.**

---

# 1. LA QUESTION QUI DÉCIDE — **LINT EST REQUIS**

**Et ce n'est pas ce que dit la protection de branche.** Le ruleset
`protect-main` (id 16637172, actif, sur `~DEFAULT_BRANCH`) exige **deux** checks,
et « Lint » n'en est aucun :

```
· All Security Gates Passed
· Paths / branch guard (règles de main)
strict_required_status_checks_policy = false
```

Lue là, la réponse serait « Lint n'est pas requis ». **Lue dans la définition du
job, elle s'inverse :**

```
all-gates-passed   needs: [gitleaks, semgrep, audit, quality]
  └─ quality       steps: … Type check → Tests → Build → Lint (pnpm lint:ci)
```

`Lint` est une **étape bloquante** de `quality` — pas de `continue-on-error`,
contrairement au cliquet qui le suit. Un `pnpm lint:ci` rouge ⇒ `quality` rouge
⇒ `All Security Gates Passed` rouge ⇒ **PR bloquée**.

C'est la même forme que les deux gardes de `pedigree` : **la propriété effective
ne se lit sur aucune des deux couches prise seule.** Le nom du check ne nomme pas
ce qui l'échoue.

**Donc non, ce lot n'est pas du confort.** Le blocage existe. Mais il n'est pas
là où on le croyait.

---

# 2. LES 13 ERREURS — MESURÉES, ET ELLES NE SONT NI PRÉ-EXISTANTES NI OÙ ON LES A PLACÉES

## L'état de `main`, aujourd'hui, à `2d31a0b`

```
pnpm lint:ci  →  exit 0  ·  246 problems (0 errors, 246 warnings)
```

**Zéro erreur.** Les 13 ne sont pas sur `main`.

## L'état de la branche de T2 — `feat/cc-offline-174-build12-s0-s1`, `a0e5e01`

| mesure | valeur |
|---|---|
| base commune avec `main` | `df031b30` — **2026-09-10** |
| commits de `main` absents de sa branche | **13** |
| `eslint.config.mjs` | **identique à `main`** |
| `eslint-suppressions.json` | **identique à `main`** (263 entrées) |
| `.github/workflows/security.yml` | **identique à `main`** |
| `__tests__/api/cronWatcherBridge.test.ts` | **identique à `main`** |
| `__tests__/api/lyingStates.test.ts` | **identique à `main`** |
| fichiers **ajoutés** sous `__tests__/prebuy/` | **18**, +9 023 lignes |

## Les 13, retrouvées une par une — **toutes dans ses 18 fichiers neufs**

**`@typescript-eslint/no-explicit-any` — 9**

| fichier | ligne | site |
|---|---|---|
| `s11-integrite-artefact-pdf` | 114 | `const scanMinimal = (): any => ({` |
| `s11-integrite-artefact-pdf` | 156 | `} as any);` |
| `s12-ambiguite-operationnelle-et-registre` | 52 | `const scanMinimal = (): any => ({` |
| `s13-identite-autorite-artefact` | 79 | `const scanDe = (…): any => ({` |
| `s14-promesses-empreinte-et-temps` | 84 | `const scanMinimal = (quand: string): any => ({` |
| `s15-reference-garde-et-sonde` | 124 | `const scanDe = (caseId: string): any => ({` |
| `s16-autorite-reference-et-methodologie` | 58 | `const scanDe = (caseId: string): any => ({` |
| `s9-hard-gates-population-lignee` | 239 | `.filter((e: any) => …)` |
| `s9-hard-gates-population-lignee` | 240 | `.map((e: any) => …)` |

**`@typescript-eslint/no-require-imports` — 4**

| fichier | ligne | site |
|---|---|---|
| `s11-integrite-artefact-pdf` | 212 | `require("node:fs").readdirSync(…)` |
| `s14-promesses-empreinte-et-temps` | 226 | `const { createHash } = require("node:crypto");` |
| `s8-200-menteur-et-autorite-non-exercee` | 62 | `const fs = require("node:fs");` |
| `s9-hard-gates-population-lignee` | 236 | `const fs = require("node:fs");` |

**9 + 4 = 13.** Le compte tombe exactement, et **aucune n'est dans
`cronWatcherBridge` ni dans `lyingStates`.**

## Pourquoi ces deux fichiers-là ont été nommés — et pourquoi ils sont verts

Ils portent, **depuis le 2026-08-14** (`7aa5537` et `b9596d5`), un
`// eslint-disable-next-line @typescript-eslint/no-explicit-any` en ligne 35 et
44. Ils sont verts sur `main` **et** sur sa branche — les fichiers y sont
identiques au bit près. Ils ne produisent que trois **avertissements**
`no-unused-vars` (`_db`, `_opts`, `_args`).

> Note au passage, sans l'ouvrir ici : ces deux `eslint-disable` en ligne sont
> exactement la méthode que ce lot interdit. Ils sont antérieurs au registre de
> suppressions et n'y figurent pas. **Backlog, pas ce lot.**

Et **cinq occurrences de plus** dans ses fichiers ressemblent à des violations
sans en être : `s17:103`, `s18:154`, `s18:155`, `s8:127`, `s8:129` portent
`any` **dans des chaînes littérales**, à l'intérieur de
`expect(…).toContain("… (e: any) …")`. Ce sont des gardes qui **lisent du code
source**, pas du code. ESLint ne les signale pas — et c'est la même leçon que
ce matin : **une mention n'est pas une émission.**

## Ce que je ne fais pas, et pourquoi

**Je ne corrige pas les 13.** Elles vivent dans **18 fichiers qui n'existent pas
sur `main`** et qui appartiennent au périmètre de T2. Les corriger d'ici
signifierait écrire dans sa branche. Le remède lui revient ; voici sa forme,
**par le type, sans jamais éteindre une règle et sans toucher au registre de
suppressions** :

| site | correction par le TYPE |
|---|---|
| `(): any => ({…})` ×6 | déclarer le type réel du scan, ou un `type ScanMinimal = Pick<PreSwapScanResult, …>` local si l'objet est volontairement partiel — `satisfies` plutôt que `as` |
| `} as any)` | `as unknown as T`, ou mieux : construire l'objet au bon type dès le départ |
| `.filter((e: any) =>` / `.map((e: any) =>` | `import type { Dirent } from "node:fs"` puis `(e: Dirent)` — `readdirSync(d, { withFileTypes: true })` rend déjà des `Dirent` |
| `require("node:fs")` ×3 | `import { readdirSync } from "node:fs"` en tête de fichier |
| `require("node:crypto")` | `import { createHash } from "node:crypto"` en tête de fichier |

**La cause racine est plus simple que les 13 :** sa branche est **13 commits en
retard** sur `main`. Un rebase ne fera pas disparaître ces erreurs — elles sont
à lui — mais il supprime toute ambiguïté sur ce qui vient d'où.

---

# 3. LES DEUX CHECKS REQUIS, ET LA PORTE PAR OÙ ILS PEUVENT TOMBER

## `All Security Gates Passed` — un récapitulatif de quatre jobs

| job | ce qu'il fait | **peut-il échouer pour une raison ÉTRANGÈRE au diff ?** |
|---|---|---|
| `gitleaks` | action épinglée par SHA, scanne l'**historique** | **oui** — un secret dans un commit ancien entré dans la plage de la PR |
| `semgrep` | CLI, **jeux de règles distants** (`p/owasp`) | **oui, et c'est le vecteur le plus net** — les packs sont récupérés à l'exécution ; une mise à jour de règle rougit un diff inchangé |
| `audit` | `pnpm audit:classify --fail-on-new` | **oui** — un avis de sécurité publié en amont entre deux runs est « nouveau » sans qu'une ligne ait bougé |
| `quality` | typecheck → tests → build → **lint** | **oui** — `--frozen-lockfile` (dérive du lockfile), 5 937 tests (toute bascule), `next build` (réseau) |

Le cliquet `CI Ratchet` qui suit `Lint` est en `continue-on-error: true` : **il ne
bloque pas**, phase 1 assumée.

## `Paths / branch guard (règles de main)` — et sa porte est **de conception**

`on: pull_request: branches: [main]`. Le job **récupère `origin/main`**, en
**extrait le guard**, et l'exécute sur le diff de la PR — le guard vient donc de
`main`, jamais de la PR. C'est l'anti-altération : **une PR ne peut pas affaiblir
le guard qui la juge.**

Conséquence directe, et il faut la connaître avant d'ouvrir la fenêtre : **si le
guard de `main` change entre deux exécutions, le MÊME diff change de verdict.**
C'est précisément le mécanisme de la fenêtre — l'ouvrir et la refermer modifie le
guard sur `main`. Le check peut donc virer sans que la PR bouge, et **c'est
voulu**.

## Une porte de plus, qui ne concerne pas la CI mais le poste

`pnpm lint` — **le script sans `:ci`** — sort en **exit 2** sur `main`, avec
`0 errors` :

```
There are suppressions left that do not occur anymore.
Consider re-running the command with `--prune-suppressions`.
```

Des suppressions périmées, pas des erreurs de lint. Seul `lint:ci` porte
`--pass-on-unpruned-suppressions`. **Mesurer la chaîne de qualité avec `pnpm lint`
donne un rouge qui n'est pas celui de la CI** — à savoir avant de conclure quoi
que ce soit d'un run local.

---

# 4. LA VÉRIFICATION DUE — UN RUNNER NEUF NE TOMBERA PAS

**Confirmé, et par exécution, pas par lecture.**

Les cinq variables factices sont posées au niveau du **JOB** `quality`
(`security.yml`), donc héritées par **toutes** ses étapes — `Tests` comprise, ce
qui est le point que T2 soulève. Ce sont des littéraux du workflow, pas des
secrets : **un runner neuf les a sans configuration**, et `db.invalid` est un TLD
réservé (RFC 2606) qui ne résout nulle part.

Le job pose aussi `Generate Prisma client` (`pnpm prisma:generate`) **avant** les
quatre gates — sans quoi `Tests` et `Type check` sont impossibles sur un runner
vierge.

Suite rejouée avec **exactement** cet environnement et rien d'autre
(`env -i`, aucun `.env.local`, aucune variable du poste) :

```
Test Files  444 passed (444)
      Tests  5937 passed | 1 expected fail | 2 skipped (5940)
```

Vérifié au préalable que **rien n'auto-charge `.env.local`** dans la suite :
`vitest.config.ts` ne pose que deux sels et ne déclare ni `setupFiles` ni
`dotenv`. **Le vert ne dépend pas de l'environnement local.**

---

# CE QUI N'A PAS BOUGÉ

Aucun workflow touché — `^.github/` est gelé, et **rien n'a exigé d'y toucher**.
Aucune entrée ajoutée à `eslint-suppressions.json`. Aucune règle désactivée.
Aucun fichier du périmètre de T2 modifié, son worktree jamais ouvert. Le « 14 »
reste CLOSED. `auto-delete-30d` : aucune configuration touchée. Aucune
remédiation storage, aucun protocole de réconciliation construit. Artifact
CLOSED, `report/v2` CLOSED, `loadCaseByMint` HOLD. Fusion `0xsweep/0xSweep` :
hors scope.
