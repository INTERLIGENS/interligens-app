# Restauration du signal CI — CC-OFFLINE-142

**Branche** : `feat/cc-offline-142-ci-signal-restore` — **mergée** (`2549fc3`)
**Date** : 2026-09-05
**Prédécesseur** : `docs/reports/ci-signal-classification.md` (CC-OFFLINE-141, mergé)
**État** : ✅ **clos — `main` est vert**

Objectif : rendre le signal CI de `main` interprétable. Chaque garde repasse verte
**pour la bonne raison** — aucune n'est désarmée, aucun seuil n'est relevé.

---

## Résumé

| Gate | Verdict | État |
|---|---|---|
| G1 — Quality Gates | Réparé, vert en CI | ✅ |
| G2 — SAST / Semgrep | Finding réellement supprimée (pas de `nosemgrep`) | ✅ |
| G3 — Dependency Audit | Verdict porté par le cliquet existant + baseline versionnée | ✅ |
| G4 — All Security Gates Passed | Sémantique inchangée, vert par ses parents | ✅ |
| G5 — Vercel `interligens-web` | 4 prémisses **confirmées** — geste hors périmètre repo | ⚠️ à faire par David |
| **Merge** | Dansé, exemption refermée byte-identique | ✅ |

---

## ✅ CLÔTURE — `main` est vert

**Run [33973251708](https://github.com/INTERLIGENS/interligens-app/actions/runs/33973251708)
sur `main` en `2549fc3`, le 2026-09-05 : `CONCLUSION: success`.**

Premier succès du workflow `Security Gates` sur `main`. Les 200 runs précédents,
remontant au 2026-06-26, étaient tous en échec ou annulés.

```
  success   Secret Scanning (Gitleaks)
  success   SAST (Semgrep)
  success   Dependency Audit
  success   Quality Gates
  success   All Security Gates Passed
```

Et le détail par étape — chacune a réellement tourné, aucune n'est masquée :

```
== Quality Gates
   success   Generate Prisma client
   success   Type check
   success   Tests
   success   Build
   success   Lint
   skipped   CI Ratchet          (if: github.event_name == 'pull_request')

== Dependency Audit
   success   Dependency audit — cliquet sur la dette atteignant le code livré
     [audit] 105 advisories
       portée     critical     high moderate      low     info
       prod              0       25       23        3        0
       dev               0       32       18        4        0
     [audit] cliquet : baseline 25 acceptées — mesuré 25
     [audit] ✅ aucune dette NEUVE atteignant le code livré.
```

> Le runner Linux compte **105** advisories là où le poste macOS en compte 112 —
> écart de dépendances optionnelles par plateforme. Le sous-ensemble qui porte le
> verdict, lui, est **identique : 25 prod high+**. La baseline est donc stable
> d'une plateforme à l'autre, ce qui était la condition pour qu'elle serve de
> référence.

### La danse d'exemption, déroulée

`.github/` est un chemin gelé. La fenêtre a été ouverte et refermée par la voie
de maintenance du guard (`^hotfix/guard-[a-z0-9-]+$`, système de garde **seul**
dans le diff), sans `--admin` :

| # | Commit | PR | Objet |
|---|---|---|---|
| 1 | `798a08e` | [#243](https://github.com/INTERLIGENS/interligens-app/pull/243) | Exemption ciblée — `security.yml`, une branche, un fichier |
| 2 | `dd8c1c4` | [#244](https://github.com/INTERLIGENS/interligens-app/pull/244) | Refermeture — retour byte-identique |
| 3 | `1d0e3c4` `5845754` `2549fc3` | [#242](https://github.com/INTERLIGENS/interligens-app/pull/242) | Le chantier CC-OFFLINE-142 |

La refermeture a été mergée **avant** le chantier : l'ordre a été validé
explicitement, et il tient parce que le check `Paths / branch guard` de la #242
était déjà passé (il s'évalue sur l'évènement `pull_request`, pas au merge). La
fenêtre n'est donc restée ouverte que le temps de la #242, et jamais au-delà.

### Vérification de fermeture

```
$ git show origin/main:scripts/guard-offline.sh | shasum -a 256
ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50

$ git show origin/main:scripts/guard-offline.sh | grep -c ci-signal-restore
0
```

**SHA-256 = `ce13d0c0…3e50`**, identique à celui mesuré avant l'ouverture.
**Zéro exemption résiduelle.** `^\.github/` regèle en entier.

Branches supprimées : `feat/cc-offline-142-ci-signal-restore`,
`hotfix/guard-ci-signal-restore`, `hotfix/guard-ci-signal-restore-close` —
distantes **et** locales.

### Ce qui reste rouge sur `main`, et pourquoi c'est correct

Le seul statut en échec est `Vercel`, celui du projet **`interligens-web`** — le
parasite diagnostiqué en G5. Il n'appartient à aucun flux de production et n'est
requis par rien. Son extinction est un réglage de dashboard, décrit plus bas.

---

## Ce que la classification n'avait pas vu

La classification annonçait, pour Quality Gates, une seule cause : les variables
d'environnement manquantes au `Build`. Le run réel du 2026-09-05
([33970480505](https://github.com/INTERLIGENS/interligens-app/actions/runs/33970480505))
en montre **trois étapes en échec**, pas une :

```
Quality Gates: failure
   6 success   Generate Prisma client
   7 failure   Type check      ← non classé
   8 failure   Tests           ← non classé
   9 failure   Build           ← classé
  10 success   Lint
```

Les trois sont réelles. Deux d'entre elles ont la même racine que la troisième.

---

## G1 — Quality Gates (CONFIG/INFRA)

### Trois défauts, deux racines

**(a) `Build` — le fail-fast d'env.ts, mesuré.**

`src/lib/config/env.ts` exige **cinq** variables dès `NODE_ENV=production` et lève
à l'import. Le job n'en fournissait qu'**une**, sur la seule étape `Build` :

```
Error: [env] Missing required env var in prod: ADMIN_TOKEN
> Build error occurred
Error: Failed to collect page data for /api/admin/ingest/pdf
```

Il mourait sur la 2ᵉ des 5, sans même atteindre les trois suivantes.

**(b) `Tests` — la MÊME racine, par un autre chemin.**

17 fichiers de test non collectés, 5 tests en échec. Cause unique :

```
PrismaClientConstructorValidationError: Invalid value undefined for datasource "db"
  ❯ src/lib/kol/pricing.ts:7:16
      const prisma = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
```

Sans `DATABASE_URL`, le constructeur jette **à l'import du module**. En local le
poste a un `.env.local` : la même suite y est verte depuis toujours. C'est
exactement l'écart qui rendait la CI illisible — 4 441 tests verts au poste, 22
rouges sur le runner, pour une variable absente.

**(c) `Type check` — une régression réelle, celle-là.**

```
src/lib/shill-correlation/__tests__/exclusion-persistence.test.ts(103,11):
  error TS2739: Type '{ excludedReason; flags; txCount30d; distinctTokenAccounts;
  infraHits }' is missing the following properties from type 'VetVerdict':
  dimensionsMet, evidence, collectionSaturated, ruleName
```

Le commit `e4d66a5` (« retire la règle high_frequency invalide, grave SHILL-C1 et
SHILL-C2 ») a ajouté quatre champs à `VetVerdict` sans compléter ce littéral. Rien
ne l'a signalé : `Type check` n'avait jamais tourné en CI. **Reproduit en local,
corrigé en complétant le verdict** — pas en relâchant le type.

### Le correctif

Les cinq variables passent dans l'`env:` du **job** `quality` — factices, et
elles n'existent que dans ce fichier :

```yaml
    env:
      DATABASE_URL: postgresql://ci:ci@db.invalid:5432/none?sslmode=disable
      ADMIN_TOKEN: ci-not-a-secret
      VAULT_AUDIT_SALT: ci-not-a-secret
      ADMIN_BASIC_USER: ci
      ADMIN_BASIC_PASS: ci-not-a-secret
```

Ce qui n'est **pas** fait, et ne doit pas l'être :

- **aucun fallback applicatif** — `env.ts` n'est pas touché, `requireInProd()`
  lève toujours, le fail-fast en production réelle est inchangé ;
- **aucune valeur de production** — rien ici n'existe dans Vercel ni dans un
  `.env` ; ces chaînes ne sont les identifiants de rien ;
- **aucune connexion possible** — `.invalid` est un TLD réservé (RFC 2606) : il
  ne résout nulle part et ne peut être enregistré par personne.

`NODE_ENV` reste volontairement **sur la seule étape `Build`**. Au niveau du job,
il ferait sauter les `devDependencies` de `pnpm install` et changerait le
comportement des tests — il arme le fail-fast, il ne doit pas armer le reste.

### Vérification

Reproduction locale **à l'identique du runner** : `.env.local` déplacé, seules
les cinq valeurs factices posées.

| Étape | Résultat |
|---|---|
| `Type check` | ✅ 0 erreur |
| `Tests` | ✅ **361 fichiers, 4 449 tests** (les 17 fichiers et 22 tests réparés) |
| `Build` | ✅ traverse `Collecting page data`, table de routes complète |
| `Lint` | ✅ 0 erreur, 227 warnings (inchangé) |

---

## G2 — SAST / Semgrep (REAL_FAILURE)

Finding unique du dépôt, et elle était **dans la CI elle-même** :

```
.github/workflows/security.yml
  ❯❯❱ yaml.github-actions.security.run-shell-injection   ❰❰ Blocking ❱❱
  234┆ run: pnpm ratchet:check origin/${{ github.base_ref }}
```

Une donnée du contexte `github` interpolée dans un `run:` est substituée **avant**
que bash ne voie la ligne : un nom de branche construit pour ça exécute ce qu'il
veut sur le runner, avec les secrets du job.

**Correctif — la valeur transite par `env:` et n'est lue que citée :**

```yaml
        env:
          BASE_REF: ${{ github.base_ref }}
        run: pnpm ratchet:check "origin/$BASE_REF"
```

Aucun `nosemgrep`, aucune exclusion, aucune suppression : la ligne signalée
n'existe plus. Vérifié qu'il ne reste **aucune** interpolation de contexte
`github` dans un `run:` du dépôt. Les `${{ needs.*.result }}` de
`all-gates-passed` ne sont pas du contexte `github` et n'ont jamais été signalés
par la règle (le run réel ne remontait qu'une finding) — ils restent intacts, cf.
G4.

---

## G3 — Dependency Audit (EXPECTED_BASELINE_DEBT)

### Pourquoi `--fail-on-prod` seul ne pouvait pas marcher

Le drapeau `--fail-on-prod` existait déjà dans `scripts/audit-classify.mjs`, prévu
pour la « phase 3 ». **Mesuré aujourd'hui, il ne rend pas le job vert** :

```
  portée     critical     high moderate      low     info
  prod              0       25       23        3        0
  dev               0       32       18        4        0

  atteignant le code livré, high+ : 25
```

25 advisories prod high+ historiques (next ×11, puppeteer-core ×6, postcss ×2,
`@aws-sdk/client-s3`, `prisma`, `dagre`…). `--fail-on-prod` bloquerait sur cette
dette d'héritage. La consigne interdit d'y toucher pour obtenir du vert — et elle
interdit tout autant de relever un seuil.

### Le verdict passe au cliquet existant

La doctrine du dépôt possédait déjà exactement la sémantique demandée : la
baseline acceptée peut rester, la dette **neuve** bloque. C'est
`scripts/ratchet-check.mjs`. Elle est **importée telle quelle** — pas réécrite,
pas dupliquée, pas paramétrée différemment :

```js
import { compare, total } from "./ratchet-check.mjs";
```

Seul le corpus comparé change :

| | fichier versionné | forme |
|---|---|---|
| lint | `eslint-suppressions.json` | `{ fichier: { règle: { count } } }` |
| audit | `audit-baseline.json` | `{ module: { GHSA-id: { count } } }` |

Les deux règles du cliquet s'appliquent inchangées : total non croissant, et
**couple NEUF** = manquement. La seconde est celle qui compte ici, et c'est elle
qui rattrape le piège du remplacement à total constant (une dette corrigée, une
autre apparue : le compte ne bouge pas, la régression est neuve, le job rougit).

**Périmètre du blocage** : `prod × (critical|high)` — exactement la définition de
`bloquantes` qui préexistait dans le script. Le reste (dev, inconnu, moderate,
low) reste **mesuré et imprimé à chaque run**, jamais masqué, mais ne bloque pas :
une faille dans une dépendance d'ESLint ne s'exécute pas en production. C'est la
doctrine déjà écrite en tête d'`audit-classify.mjs`.

### Le job, avant / après

```diff
-      - name: pnpm audit (moderate+)
-        run: pnpm audit --audit-level=moderate          # ← portait le verdict
-
-      - name: Dependency audit — classement prod / dev
-        continue-on-error: true                          # ← ne bloquait rien
-        run: pnpm audit:classify
+      - name: Dependency audit — cliquet sur la dette atteignant le code livré
+        run: pnpm audit:classify --fail-on-new           # ← bloque, sans continue-on-error
```

Une seule étape, et **elle bloque**. Il n'y a plus de `continue-on-error` du tout
dans ce job.

**Ce n'est pas un assouplissement.** Avant : 112 advisories, verdict rouge en
permanence, **zéro** advisory nouvelle détectable — indiscernable du bruit de
fond. Après : une seule advisory prod high+ hors baseline fait rougir le job. Le
garde passe de « toujours rouge, donc muet » à « rouge quand quelque chose a
changé ».

Ce n'est pas non plus un renoncement à la phase 3 : `--fail-on-prod` (zéro
advisory prod high+, sans baseline) reste dans le script, intact, comme cible.

### Régénérer la baseline

```
node scripts/audit-classify.mjs --write-baseline
```

Le fichier est versionné : toute acceptation se lit dans le diff de la PR, par un
humain. Aucun script de `package.json` n'a été ajouté (chemin gelé) — `pnpm
audit:classify --fail-on-new` passe le drapeau au script existant.

### Vérification

- baseline propre → `exit 0`, « aucune dette NEUVE atteignant le code livré » ;
- une entrée retirée de la baseline (simulation d'une advisory neuve) →
  `exit 1`, `deepmerge-ts :: GHSA-ggr8-5vv4-36mx : couple NEUF (+1)` ;
- 8 tests ajoutés dans `__tests__/security/audit-classify.test.ts`, dont le
  remplacement à total constant et le passage dev → prod.

---

## G4 — All Security Gates Passed (CASCADE)

**Non modifié.** Le job, ses `needs`, son `if: always()` et son script de
vérification sont byte-identiques. Il repasse vert par la seule guérison de ses
parents — c'est sa définition.

> **Constat qui contredit une prémisse de la mission.** La mission le décrit comme
> « le job surveillé par la branch protection ». **Il ne l'est pas.** `main` n'a
> pas de branch protection classique (`/branches/main/protection` → 404 *Branch
> not protected*). Elle est portée par le ruleset `protect-main` (id 16637172),
> dont les règles sont : `deletion`, `non_fast_forward`, `pull_request`
> (0 approbation requise), `required_linear_history`. **Aucune règle
> `required_status_checks`** — donc aucun check n'est requis pour merger, ni
> celui-là ni un autre. Le rendre required est un réglage à poser, pas un état de
> fait. À arbitrer une fois le signal vert.

---

## G5 — Vercel / `interligens-web` — les 4 prémisses sont CONFIRMÉES

Diagnostic read-only.

**(a) Le check en échec appartient bien à `interligens-web`.** C'est le seul
*commit status* legacy sur `main` (tout le reste est en *check runs*) :

```
$ gh api repos/INTERLIGENS/interligens-app/commits/e82d640/status
failure
Vercel | failure | https://vercel.com/davidpandoraparis-2892s-projects/interligens-web/4bTvupHPbZMKZQBogkqgQsnwrBps
```

**(b) `interligens-web` n'est pas le chemin de déploiement de prod.** Le dépôt est
lié à `interligens-app` (`.vercel/project.json` → `prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ`,
`projectName: interligens-app`), et la prod part de `npx vercel --prod` depuis
l'arbre de travail. `interligens-web` est un projet créé le **2026-05-27** (101 j),
resté branché sur le dépôt GitHub, qui **redéploie à chaque push** et échoue.

**(c) `interligens-app` reste le projet de prod autoritaire.**

```
  Project Name          Latest Production URL                                                Updated
  interligens-web       https://interligens-web-davidpandoraparis-2892s-projects.vercel.app  4m
  interligens-app       https://app.interligens.com                                          8d
```

`app.interligens.com` est servi par `interligens-app`, et lui seul.

**(d) Le check n'est requis par rien.** Le ruleset `protect-main` ne déclare aucun
`required_status_checks` (cf. G4). Aucun flux de production ne le consomme : la
prod ne passe pas par GitHub.

### Le geste — hors périmètre repo, à faire par David

Rien dans le dépôt ne pilote cette intégration : `vercel.json` (chemin **gelé**)
ne contient que les `crons`, aucune configuration git. **Non forcé**, comme
demandé. Deux options, par ordre de préférence :

1. **Débrancher le dépôt Git du projet `interligens-web`** (recommandé) —
   dashboard Vercel → projet `interligens-web` → *Settings* → *Git* →
   **Disconnect**. Le projet et ses déploiements passés survivent ; il cesse de
   construire et de publier un statut sur chaque commit du dépôt.
2. **Supprimer le projet `interligens-web`** s'il est un doublon mort — *Settings*
   → *Advanced* → *Delete Project*. Plus radical, à ne faire qu'après avoir
   confirmé que l'URL `interligens-web-…vercel.app` n'est référencée nulle part.

À défaut, désactiver la seule remontée de statut : *Settings* → *Git* →
**Ignored Build Step**, ou *GitHub* → décocher les *Deployment Checks*.

> **Point à noter, hors mandat.** `interligens-web` déploie l'application entière
> sur une URL `*.vercel.app` publique à chaque push, et embarque le même
> `vercel.json` — donc les mêmes 15 déclarations de cron. Les déploiements
> échouent actuellement, ce qui les désarme de fait ; un jour où ils
> réussiraient, ce projet aurait ses propres crons. L'option 1 ou 2 ferme aussi
> ça.

---

## Ce que le chantier a révélé sans le corriger

### Le cliquet de lint ne compare rien en CI, aujourd'hui

L'étape `CI Ratchet` tourne bien sur l'évènement `pull_request`, et la correction
G2 fonctionne — `BASE_REF: main` est résolu, `"origin/$BASE_REF"` est passé cité.
Mais le journal de la #242 montre ceci :

```
> node scripts/ratchet-check.mjs origin/main
fatal: invalid object name 'origin/main'.
[ratchet] aucune baseline sur origin/main — premier passage, rien à comparer.
```

`actions/checkout` clone par défaut avec `fetch-depth: 1` : la ref `origin/main`
n'existe pas sur le runner. `ratchet-check.mjs` traite ce cas comme un premier
passage et rend 0. **Le cliquet de lint est donc un no-op en CI depuis son
câblage** — il ne l'a jamais été autrement.

Ce n'est **pas** corrigé ici, délibérément :

- ce n'est pas dans le mandat des cinq gates — G2 ne demandait que la suppression
  de la finding shell-injection, faite et vérifiée ;
- l'étape est en `continue-on-error` (phase 1 = mesure), donc le no-op n'a jamais
  masqué de verdict bloquant ;
- le réparer (`fetch-depth: 0` sur le checkout du job `quality`) ferait passer le
  cliquet de « rend toujours 0 » à « compare réellement », ce qui peut le faire
  échouer pour la première fois. C'est un changement de comportement, pas un
  correctif d'infrastructure — et le durcissement du cliquet est nommé « phase 3 »
  dans le dépôt, une décision distincte.

À arbitrer avec la phase 3. Le correctif tient en une ligne, mais il appartient à
cette décision-là.

---

## Fichiers touchés

| Fichier | Gelé | Objet |
|---|---|---|
| `.github/workflows/security.yml` | **oui** | G1 env de job · G2 `BASE_REF` · G3 verdict au cliquet |
| `scripts/audit-classify.mjs` | non | `--fail-on-new`, `--write-baseline`, réutilise `compare()` |
| `audit-baseline.json` | non | 25 advisories prod high+ acceptées, versionnées |
| `__tests__/security/audit-classify.test.ts` | non | 8 tests du cliquet d'audit |
| `src/lib/shill-correlation/__tests__/exclusion-persistence.test.ts` | non | `VetVerdict` complété (régression `e4d66a5`) |

Plus, sur les deux branches de maintenance du guard : `scripts/guard-offline.sh`,
ouvert puis refermé **byte-identique** (`ce13d0c0…3e50`).

Non touchés, volontairement : `src/lib/config/env.ts`, `scripts/ratchet-check.mjs`,
`eslint-suppressions.json`, le job `all-gates-passed`, `package.json`,
`vercel.json`, l'environnement Vercel de production.

---

## Ce qu'il reste à faire, et par qui

1. **David — éteindre le check Vercel parasite.** Dashboard Vercel → projet
   `interligens-web` → *Settings* → *Git* → **Disconnect**. C'est le dernier
   statut rouge sur `main`, et le seul geste hors périmètre repo.
2. **À arbitrer — rendre `All Security Gates Passed` required.** Maintenant que le
   job est vert, le ruleset `protect-main` peut enfin le déclarer en
   `required_status_checks` : c'est ce qui transformera un signal lisible en
   signal qui protège. Aujourd'hui il n'y a aucun check requis (cf. G4).
3. **À arbitrer avec la phase 3** — `fetch-depth: 0` pour que le cliquet de lint
   compare réellement, et `--fail-on-prod` pour l'audit.
