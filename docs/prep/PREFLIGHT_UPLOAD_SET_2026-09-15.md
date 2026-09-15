# PREFLIGHT — L'ENSEMBLE EXPÉDIÉ DEVIENT LE PÉRIMÈTRE · 2026-09-15

> A deployment preflight governs the actual upload set, not the Git index;
> ignored and untracked files are part of the security boundary whenever the
> deployment client can transmit them.

Fenêtre `T2-PREFLIGHT-UPLOAD-SET`. Aucun déploiement, aucune rotation, aucune
purge, aucune lecture du contenu de `.env`. Le stockage R2 et les variables
`R2_*` n'ont pas été touchés.

---

# 0. LE CLASSEMENT RC, ÉCRIT SANS L'ADOUCIR

```
Source input integrity      : PROVEN
Build reproducibility/SLSA  : NOT ESTABLISHED
Served deployment binding   : provider-asserted unless independently attestable
```

Ces trois lignes sont aussi écrites **dans la donnée**, au champ `attestation`
du marqueur, et un test les y épingle mot pour mot. C'est délibéré : une prose
adjacente à un contrôle n'est jamais l'autorité de ce contrôle. Si le marqueur
est un jour lu par un tiers sans ce document, il porte quand même sa propre
limite.

On ne ferme pas (d). On le nomme.

---

# 1. `.vercelignore` — AVANT / APRÈS

Mesure hors ligne, en rejouant `getVercelIgnore2` sur **l'arbre qui déploie**
(`~/dev/interligens-web`), avec l'ancien filtre puis le nouveau.

| | ensemble expédié | refus du vocabulaire |
|---|---|---|
| **AVANT** (`origin/main`) | **2023** | **2** — `.env`, `.env.example` |
| **APRÈS** | **1999** | **0** |

**24 fichiers sont sortis de l'ensemble expédié**, et ce sont exactement les 24
mesurés hors commit sur le déploiement servi :

```
   8  packages/widget/dist/
   4  .wrangler/state/
   3  .claude/
   3  public/tiger/*.mp4
   1  .env                      ← l'hémorragie
   1  .env.example
   1  AGENTS.md
   1  check_demo_restore.sh
   1  next-env.d.ts
   1  tsconfig.tsbuildinfo
```

## La forme, pas l'instance

`.vercelignore` nommait `.env.localanthropic`, `.env.prod`, `.env.vercel.local`
— trois instances, pas la forme. Et la liste codée en dur du CLI ne couvre que
`.env.local` et `.env.*.local`. **Le `.env` nu n'était couvert par rien.**

Le nouveau filtre couvre la forme générale : `.env*`, `.envrc`, le matériel
cryptographique (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.asc`, `*.gpg`),
les clés SSH, `.npmrc` / `.netrc` / `.pgpass` / `.htpasswd`, les répertoires
`.aws/ .ssh/ .gnupg/ .docker/ .kube/`, et l'état local de poste `.claude/`,
`.wrangler/`, les historiques de shell.

*Rappel de ce qui rend ce fichier critique :* `.gitignore` figure dans la liste
codée en dur du CLI — il est **exclu du téléversement**, jamais lu comme règle.
Le suivi git n'a **aucun** effet sur ce qui part. `.vercelignore` est le seul
filtre.

---

# 2. LE VOCABULAIRE CLOS, ET SES MUTANTS

`scripts/preflight/vocabulary.mjs`. **Deux** vocabulaires qui ne fusionnent
jamais :

| | rôle |
|---|---|
| `SECRET_FORMS` (8 formes) | porteuses de credentials → **REFUS** |
| `AMBIGUOUS_FORMS` (1 forme) | voisinage non résolu → **REFUS pour INDÉCIDABILITÉ** |

**L'asymétrie est la clef, et c'est celle du guard :** une forme peut REFUSER,
aucune forme ne peut AUTORISER. Il n'y a donc **pas d'allowlist de secrets**, et
il ne peut pas y en avoir : on ne fait pas passer un fichier en l'inscrivant
quelque part, on le fait passer en **cessant de l'expédier**. C'est ce qui
empêche ce vocabulaire de redevenir un système d'exemptions — il n'a aucune
porte de sortie. Un test vérifie qu'aucun identifiant du genre `SECRET_ALLOW`
n'existe dans le fichier.

`AMBIGUOUS_FORMS` n'est pas « une heuristique qui devine » : elle ne rend jamais
de verdict positif. Elle dit « je ne sais pas », et le preflight traite « je ne
sais pas » comme un refus.

## La borne mesurée du domaine ambigu

Premier jet du vocabulaire, appliqué à l'ensemble expédié réel — il a rougi sur
`tests/lib/mm/fixtures/concentrated-token.json` et
`tests/lib/mm/fixtures/asymmetric-price-token.json`. **Dans ce dépôt, « token »
est un nom métier de premier plan** : un jeton crypto, pas un jeton d'auth. Un
contrôle qui rougit sur le métier est un contrôle qu'on finit par désarmer.
`token` n'est donc retenu que collé à un mot d'authentification
(`auth|access|refresh|bearer|api|session`), ce qui garde `auth-token.json` et
laisse passer `concentrated-token.json`. Le domaine est en outre borné aux
porteurs de données — jamais au code source.

C'est le genre d'erreur qu'on ne trouve pas en raisonnant. Elle est venue de la
mesure, et le test la fige.

## Les mutants, exécutés EN VIF — pas seulement écrits

Une suite verte ne prouve pas que le mécanisme est correct, seulement que la
règle écrite est celle testée. Les trois mutants ont donc été **appliqués au
code source**, la suite relancée, puis le code restauré :

| mutant | résultat |
|---|---|
| retirer la forme `dotenv` de `SECRET_FORMS` | **2 tests rouges** ✅ |
| `executerPreflight` rend `ok:true` quand le calcul échoue | **1 test rouge** ✅ |
| `PROJET_PRODUCTION` accepte `interligens-t2` | **2 tests rouges** ✅ |

Restauration vérifiée (`git diff --quiet scripts/`), 36/36 au retour.

## Fail-closed, et sans porte dérobée

Refusent : `.nowignore` concurrent (comme le CLI), répertoire illisible, lien
symbolique dans l'ensemble expédié (cible indécidable), `git ls-tree` vide,
paquet `ignore` introuvable, version du CLI indéterminable, exception non
rattrapée (sortie 2). **Il n'y a pas de `--force`** : un preflight contournable
par un drapeau est une recommandation, pas un contrôle. Un test lit le code
— commentaires exclus — et vérifie que `argv` ne connaît que `--emit-marker` et
`--json`.

---

# 3. `GENERATED_ALLOWED` — CHAQUE CANDIDAT, EXCLU OU AUTORISÉ

Prédicat appliqué, mot pour mot :

```
manifeste d'upload − GENERATED_ALLOWED  ==  exactement HEAD filtré
ET aucun fichier de HEAD attendu après filtre n'est absent
```

## La doctrine appliquée : exclure d'abord

| candidat | décision | pourquoi |
|---|---|---|
| `tsconfig.tsbuildinfo` | **EXCLU** | cache incrémental de `tsc` (754 Ko). Un build distant part d'un cache vide : il ne le lit pas. Consigne explicite. |
| `next-env.d.ts` | **EXCLU** | **réécrit** par `next build`, jamais lu en entrée. |
| `packages/widget/dist/*` (8) | **EXCLU** | mesuré : aucune référence dans `src/`, `next.config.ts`, `package.json`, `pnpm-workspace.yaml`. |
| `public/tiger/{green,orange,red}.mp4` | **EXCLU** | `git grep` sur tout le dépôt : **zéro occurrence**. 30 Mo dans chaque déploiement. |
| `.env` | **EXCLU** | secret. |
| `.claude/*`, `.wrangler/state/*` | **EXCLU** | état local de poste. |
| `AGENTS.md`, `check_demo_restore.sh` | **EXCLU** | documents de travail, durables — exclusion nominative. |
| `AUDIT_CLOSURE_…_2026-08-17.md`, `_mut_backup` | **NI L'UN NI L'AUTRE** | fichiers ponctuels non suivis : le prédicat les fait rougir, et l'opérateur les commite ou les supprime. Les inscrire dans `.vercelignore` serait exactement le fluage d'exemptions à éviter. |
| `public/tiger/analyst.png` | **NI L'UN NI L'AUTRE** | voir §3.2 — c'est le constat, pas un défaut. |
| `public/.well-known/source-set.json` | **AUTORISÉ** | seul membre. Voir §3.1. |

**`GENERATED_ALLOWED` compte exactement 1 membre.**

## 3.1 Le seul membre, et sa démonstration

```
path        public/.well-known/source-set.json
generator   scripts/preflight-deploy.mjs --emit-marker
provedBy    produit par le preflight lui-même, juste avant l'upload ;
            exclu de sa propre racine
```

Il est classé **GENERATED**, pas « ignoré » : il *est* la sortie du preflight, et
il doit être dans l'ensemble expédié pour être servi.

## 3.2 `public/tiger/analyst.png` — le preflight reste ROUGE, et c'est correct

Ce fichier est **référencé par `src/components/TigerRevealCard.tsx:109`**
(`src="/tiger/analyst.png?v=3"`) et n'existe **dans aucun commit**.

- L'**autoriser** ferait passer pour un artefact de build un contenu dont la
  production dépend. Ce n'est pas un artefact généré, et il n'est démontré
  nécessaire à aucun build : il est nécessaire au **runtime**.
- L'**exclure** casserait l'image en silence.

Les deux issues sont mauvaises, donc aucune n'est prise ici. **La production
sert aujourd'hui une image qui n'est dans aucun commit** — c'est précisément la
défaillance de provenance que cette fenêtre existe pour rendre visible.
Résolution possible sans toucher au guard : `git add -f public/tiger/analyst.png`
(le chemin `public/` n'est pas gelé ; `.gitignore` l'est, mais `-f` n'en a pas
besoin). Je ne l'ai pas fait : le binaire de 568 Ko ne vit que dans l'arbre de
travail de T1, qui travaille en parallèle.

## 3.3 Ce qui empêche l'allowlist de s'élargir en silence

Cinq contraintes, toutes vérifiées par `__tests__/preflight/` :

1. **Chemins EXACTS** — égalité de chaîne. Aucun joker, aucune ancre, aucun
   préfixe de répertoire : la même règle que les chemins d'une lease du guard.
   `packages/*/dist/` est **impossible à écrire** ici.
2. **Cardinalité épinglée dans le test** — le test énumère l'ensemble ATTENDU.
   Ajouter un membre sans toucher au test est **rouge** : il faut deux
   modifications explicites, dans deux fichiers, pour élargir.
3. **Quatre champs obligatoires** dont `generator` et `provedBy`. Un champ vide
   est rouge.
4. **Aucun secret, aucune config, aucune source métier** — un membre qui tombe
   sous le vocabulaire, ou qui vit sous `src/`, ou qui porte une extension de
   code, est rouge.
5. Un test vérifie que les 24 fichiers mesurés **ne sont pas** dans l'allowlist.

---

# 4. LA LIAISON DE PROJET, ET SON CAS NÉGATIF RÉEL

Sur le chemin production, **seul `interligens-app` est autorisé**. `projectId`
**et** `projectName` sont comparés : l'identifiant est l'autorité — un nom se
renomme, un `prj_` non — et une divergence entre les deux est déjà une anomalie.

Le cas négatif n'est pas fabriqué. **Ce worktree est lié à `interligens-t2`**, et
le preflight le refuse :

```
❌ Liaison de projet
      projectId   prj_pW53otiwqBpwD6kZYPPDWAOLlQyS ≠ prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ
      projectName interligens-t2 ≠ interligens-app
      Sur le chemin production, seul interligens-app est autorisé. FAIL CLOSED.
```

Refusent aussi : `.vercel/project.json` absent, ou illisible. Le mutant qui
accepte `interligens-t2` fait rougir 2 tests.

---

# 5. L'ÉPINGLAGE DU CLI — ET SA MOITIÉ NON VERROUILLABLE

La version est obtenue **sans réseau** : on lit le `package.json` du CLI sur le
disque — variable `VERCEL_CLI_PACKAGE_JSON`, puis `node_modules` du dépôt, puis
les installations globales, puis le cache `npx`. On ne l'exécute pas et on
n'interroge pas le registre. Introuvable ⇒ **REFUS**.

Mesuré ici : `vercel@51.7.0 (installation globale)` — la version dont
`HARDCODED_IGNORES` est la copie verbatim. Divergence ⇒ refus, avec les deux
issues nommées : installer 51.7.0, ou remesurer `getVercelIgnore2` sur la
nouvelle version et mettre à jour la liste.

## Le moteur `ignore` : démontré immatériel, pas supposé

Le CLI embarque sa propre copie du paquet `ignore` ; celle que nous résolvons
peut différer en version (ici 5.3.2, via eslint — `ignore` n'est pas hissé et
`package.json` est gelé). Plutôt que de le supposer sans effet, un test calcule
l'ensemble expédié avec **5.3.2 et 7.0.5** sur le `.vercelignore` réel et exige
qu'ils soient **identiques**.

## ⚠️ La moitié qui n'est PAS verrouillable, dite franchement

`npx vercel --prod` — la commande de `CLAUDE.md` — résout la **dernière version
publiée au moment de l'appel**. Tant que la commande de déploiement reste
celle-là, l'épinglage est **structurellement impossible** : le preflight
certifierait le CLI du disque pendant que `npx` en téléchargerait un autre.

La porte garantit *« le CLI présent sur ce poste est la version rejouée »*. Elle
**ne peut pas** garantir *« c'est cette version qui déploiera »*. Cela exige que
le déploiement soit invoqué en **nommant** la version :

```
npx vercel@51.7.0 --prod
```

C'est une consigne, pas un verrou, et elle est écrite comme telle. Le verrou
demanderait de remplacer la commande de déploiement — donc `CLAUDE.md`, voire un
script gelé. Question ouverte au §7.

---

# 6. LE MARQUEUR

Arbre de Merkle binaire sur les feuilles `(chemin, sha1)` **triées** :

```
feuille = sha256("leaf\0" + chemin + "\0" + sha1(contenu))
nœud    = sha256("node\0" + gauche + droite)
impair  = promu tel quel
```

Les préfixes de domaine séparent feuilles et nœuds — sans eux, un nœud peut se
faire passer pour une feuille.

Le `sha1` est celui du **contenu brut**, c'est-à-dire exactement le `uid` que
Vercel rend sur `GET /v6/deployments/{id}/files` — reproduit et vérifié le
2026-09-14 sur deux fichiers du déploiement servi. La racine est donc
confrontable, après coup, à ce que Vercel dit avoir reçu.

**La racine exclut son propre fichier.** Sinon elle ne peut pas exister : le
marqueur contient la racine, donc son `sha1` dépendrait de la racine qui
dépendrait de son `sha1`. Un test le prouve en changeant le contenu du marqueur
et en vérifiant que la racine **ne bouge pas**.

Servi statiquement depuis `public/` — donc **sans toucher à `src/app/api/`**, qui
est gelé par le guard.

## Ce que la racine ferme, et ce qu'elle ne ferme pas

Elle ferme l'**identification** : un auditeur n'a plus à croire Vercel sur
« quel déploiement sert l'alias », puisque le servi se nomme lui-même par son
entrée.

Elle **ne ferme pas** l'intégrité : elle prouve de quel input le build est
parti, pas que le build n'a rien fait d'autre. La transformation entrée→sortie
reste le build de Vercel — non reproductible localement, sans attestation
exposée. D'où la ligne `NOT ESTABLISHED` du §0, qui n'est pas une précaution de
style.

---

# 7. CE QUI RESTE OUVERT

1. **`.env` : rotation.** 16 clés vives — `DATABASE_URL`, `ADMIN_TOKEN`,
   `ADMIN_BASIC_PASS`, `CRON_SECRET`, `RESEND_API_KEY`, `ETHERSCAN_API_KEY`,
   `X_CT0_1/2` — sont dans la source de chaque déploiement conservé,
   récupérables par tout accès lecture au projet. **Action du fondateur, pas la
   mienne.** Le contenu du fichier n'a pas été lu. La purge des déploiements
   reste en HOLD : elle neutraliserait des credentials en détruisant
   l'historique forensic.
2. **`public/tiger/analyst.png`** — §3.2. Bloque le prédicat tant qu'il n'est
   pas commité ou déréférencé.
3. **`AUDIT_CLOSURE_…_2026-08-17.md` et `_mut_backup`** — non suivis à la racine
   de l'arbre qui déploie. À commiter ou supprimer.
4. **Le preflight n'est pas encore *appelé* par le chemin de déploiement.** Il
   refuse quand on l'invoque ; rien ne force à l'invoquer. Le câbler exige
   `package.json` (`predeploy`) — **gelé par le guard** — ou un script de
   déploiement dédié. Tant que ce n'est pas fait, le contrôle est disponible,
   pas imposé. Il faut le dire ainsi et ne pas s'en satisfaire.
5. **`scripts/preflight/` n'est pas gelé par le guard.** Le vocabulaire et
   l'allowlist peuvent être modifiés sans la voie de maintenance. Les ajouter à
   `FORBIDDEN_PATTERNS` demande une PR `hotfix/guard-*` avec le système de garde
   seul dans le diff.
6. **`tests/` (sans underscores) est expédié** alors que `__tests__/` est exclu.
   Sans effet sur la sécurité mesurée ici, mais c'est de la surface inutile.

---

# 8. COMMENT ON S'EN SERT

```bash
node scripts/preflight-deploy.mjs --target production
node scripts/preflight-deploy.mjs --target production --emit-marker
node scripts/preflight-deploy.mjs --target production --json
```

Sortie `0` = les quatre portes sont vertes. Toute autre sortie = REFUS.
