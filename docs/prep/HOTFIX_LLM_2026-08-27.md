# HOTFIX LLM — modèle retiré, et le silence qui a suivi
## 2026-08-27 · branche `hotfix/llm-model-retire-2026-08-27`

**RIEN N'EST MERGÉ NI DÉPLOYÉ.** Un commit local, un patch non appliqué, et cette
demande d'exemption. J'attends le GO.

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `vitest run` | **326 fichiers · 3 809 tests verts · 0 échec** (2 `expected fail` documentés, 2 ignorés) |
| `eslint` | **0 erreur** |
| `guard-offline.sh` | ✅ aucun chemin interdit modifié |
| Écritures DB / migrations | **aucune** — Neon jamais sollicité |
| Sonnet 5 · centralisation · autres identifiants | **non touchés**, comme demandé |

Commit : **`0aec987`** — 4 fichiers, +329/−4.
Patch en attente : `docs/prep/patches/HOTFIX_LLM_cron_intel_summarize_2026-08-27.patch`

---

# 1. TEST RED — l'incident reproduit avant d'être corrigé

Deux fichiers, parce que les mocks de module vitest sont hoistés sur tout le
fichier : mocker `llm.service` pour tester le cron aurait aussi mocké le service
qu'on veut tester.

## Moitié A — `__tests__/security/llm-typed-errors.test.ts`

**Avant le correctif : 14 tests rouges sur 14.** Le service ne savait dire
*aucune* cause — `errorKind` n'existait pas.

## Moitié B — `__tests__/security/llm-cron-never-green.test.ts`

**La preuve littérale de l'incident**, capturée avant tout changement :

```
× échec total (modèle 404 sur tous les items) → jamais ok:true
  AssertionError: expected true not to be true

× la réponse remonte la CAUSE, pas qu'un compteur
  AssertionError: expected '{"ok":true,"processed":2,"succeeded":0,"failed":2}'
                  to match /MODEL_NOT_FOUND/
```

Deux items sur deux en échec, `succeeded: 0` — et `ok: true`. C'est le corps de
réponse exact qui a laissé la supervision au vert pendant deux mois.

Deux autres tests du même fichier **passent déjà** et le disent : le cron
*mesure* correctement (`processed: 2, succeeded: 0, failed: 2`) et *écrit*
correctement (`lastSummaryError`, `summaryAttempts`, deux appels). **Le défaut
n'est pas dans la mesure. Il est dans ce que la route affirme.**

---

# 2. DISPONIBILITÉ — un identifiant, rien d'autre

```diff
- const ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
+ const ANTHROPIC_MODEL = "claude-sonnet-4-5"
```

`src/lib/llm/llm.service.ts:50` (+ le commentaire d'en-tête l.7).

`claude-sonnet-4-20250514` = Claude Sonnet 4, **retiré le 2026-06-15**.
`claude-sonnet-4-5` est **actif**, et c'est déjà l'identifiant des trois autres
appels Anthropic du dépôt (`scan/ask`, `mobile/ask`, `osint/vision`) — ce
changement les aligne au lieu de créer une quatrième variante.

**Aucun autre identifiant touché.** `claude-sonnet-4-5` (×3 sites) et
`claude-haiku-4-5-20251001` sont vivants ; y toucher aurait été du bruit.

Un test le verrouille : *« l'identifiant épinglé n'est plus le modèle retiré »*
— il lit le `model` réellement transmis au SDK, pas la constante.

---

# 3. OBSERVABILITÉ — six causes, six noms

```ts
export type LLMErrorKind =
  | "MODEL_NOT_FOUND"   // l'identifiant est mort        → changer le code
  | "AUTH"              // clé absente/invalide/sans droit → changer la config
  | "RATE_LIMIT"        // quota atteint                  → réessayer plus tard
  | "TIMEOUT"           // réseau ou délai dépassé        → réessayer
  | "INVALID_REQUEST"   // requête refusée telle quelle   → changer les paramètres
  | "UPSTREAM_ERROR"    // panne amont, ou cause inconnue → réessayer, surveiller
```

**Six, parce que le caller n'a que six réactions possibles.** Pas une taxonomie —
une table de décision.

`classifyLLMError()` teste d'abord les classes d'erreur du SDK
(`NotFoundError`, `AuthenticationError`, `RateLimitError`, …), puis **retombe sur
le code HTTP** (404/401/403/429/408/400/422), puis sur le nom de l'erreur. Un
renommage côté SDK dégrade la précision **sans jamais faire perdre la
distinction**. Une cause inconnue reste `UPSTREAM_ERROR` — jamais vide.

Trois détails qui comptent :
- **`error` est conservé** à côté de `errorKind`. Le nom sert à décider, le
  message à diagnostiquer ; un test vérifie que le message d'origine survit.
- **`errorKind` apparaît dans la ligne de log** `[llm] …` — c'est là que la
  supervision regarde en premier.
- **Clé absente → `AUTH`**, pas un échec anonyme. Ce chemin ne passait même pas
  par le `catch`.

Ce qui n'a **pas** été fait, volontairement : aucune classe d'erreur maison,
aucun `Result<T,E>`, aucune couche de transport. Un champ, une fonction pure,
un point d'appel.

---

# 4. LE CRON — correctif prêt, **NON appliqué** (chemin gelé)

`src/app/api/cron/intel-summarize/route.ts` est couvert par `^src/app/api/`
dans `scripts/guard-offline.sh`. **Je ne me suis pas auto-autorisé.** Le
correctif est livré en patch, vérifié applicable (`git apply --check` ✅), puis
retiré de l'arbre de travail.

## Le comportement proposé

```
rien à faire, ou tout réussi → ok:true   · status "ok"      · HTTP 200
succès partiel               → ok:false  · status "partial" · HTTP 200
échec total                  → ok:false  · status "failed"  · HTTP 500
```

Plus un champ `errorKinds` (`{"MODEL_NOT_FOUND": 2}`) quand il y a des échecs,
et `lastSummaryError` préfixé par la cause.

**Le 500 sur échec total est le point à valider.** C'est le seul signal que le
tableau de bord Vercel affiche en rouge : un `ok:false` en HTTP 200 reste
invisible pour qui ne lit pas le corps — c'est exactement ce qui a permis
l'incident. Contrepartie : Vercel peut consigner le cron comme échoué et,
selon la configuration, le réessayer. Si tu préfères éviter ça, dis-le et je
repasse en 200 partout — `ok:false` + `status:"failed"` suffit à casser le
faux vert, avec un signal plus discret.

`processed: 0` (rien à résumer) reste `ok:true` : ne rien avoir à faire **est**
un succès.

## Vérifié avant retrait

Le patch a été appliqué localement le temps de le mesurer : `tsc` propre, et les
**4 tests du fichier cron passent** (les deux `it.fails` deviennent des `it`
normaux qui réussissent). Puis `git checkout --` sur les deux fichiers.

## Les deux tests restent épinglés en `it.fails`

Tant que le patch n'est pas appliqué, les deux assertions de comportement sont
marquées `it.fails` : la suite reste verte **et** le défaut est consigné. Le jour
où le patch passe, `it.fails` vire au **rouge** — ce qui force la conversion en
`it` normal. Le patch contient cette conversion. Impossible d'appliquer l'un
sans l'autre.

## Bloc d'exemption à valider — à coller dans `scripts/guard-offline.sh`

Calqué sur les exemptions cron existantes (`xapi-usage-cron`,
`watcher-window-fix`). **C'est ta décision, pas la mienne.**

```sh
# Exceptions pour le hotfix LLM (modèle retiré → silence du cron de veille).
# Le cron intel-summarize répondait {ok:true} même quand zéro item avait été
# résumé : le modèle épinglé était retiré depuis le 2026-06-15 et la
# supervision est restée au vert deux mois. Doctrine C4 — ne jamais affirmer
# une propriété différente de celle mesurée.
# Additif : le verdict (ok / status / code HTTP) se déduit désormais des
# compteurs déjà calculés, plus un champ errorKinds. Aucune écriture DB
# nouvelle, aucune migration, aucun appel supplémentaire, aucune autre logique
# du cron modifiée (auth, prodWriteGuard, batch, cap de tentatives inchangés).
# Autorisation humaine explicite (David) — voir PR description.
# Exemption ciblée UNIQUEMENT sur la route cron intel-summarize ;
# ne couvre PAS le reste de src/app/api/.
if [[ "$BRANCH" == "hotfix/llm-model-retire-2026-08-27" ]]; then
    EXEMPT_LLM_CRON_PATTERNS=(
        "^src/app/api/cron/intel-summarize/route\.ts$"
    )
fi
```

> ⚠️ `scripts/guard-offline.sh` est **lui-même gelé** (`^scripts/guard-offline\.sh$`).
> Poser ce bloc passe par la voie de maintenance déclarée : branche dédiée, le
> guard seul dans le diff. Je ne l'ai pas fait.

---

# 5. TESTS

| Fichier | Contenu | État |
|---|---|---|
| `llm-typed-errors.test.ts` | 8 causes → 8 `errorKind` · un modèle mort ≠ un timeout · cause inconnue nommée · clé absente → AUTH · succès sans `errorKind` · message d'origine conservé · **identifiant retiré banni** | **14 verts** |
| `llm-cron-never-green.test.ts` | le cron mesure juste · écrit juste · **+2 `it.fails`** en attente du patch | **2 verts + 2 épinglés** |

Suite complète : **326 fichiers, 3 809 tests verts, 0 échec.**

> **Une note d'honnêteté sur la suite.** Lors d'un enchaînement de plusieurs
> `vitest run` complets d'affilée, `ratchet.test.ts` et
> `prisma-migrate-target-lock.test.ts` ont échoué une fois : ces deux tests
> lancent `eslint` et `prisma generate` en sous-processus (~7 s chacun) et
> souffrent de la contention CPU. Rejoués isolément : **20/20 verts**. Deux runs
> complets consécutifs à froid : **326 fichiers, 3 809 verts** les deux fois.
> C'est de la flakiness de charge, sans rapport avec ce hotfix — mais elle
> existe, et elle mérite d'être dite plutôt que découverte en CI.

Le mock du SDK reproduit la **forme** des classes d'erreur (`name` + `status`)
plutôt que d'importer les vraies : la classification doit tenir sur ce que le SDK
expose publiquement, pas sur ses internes.

---

# 6. CE QUE JE N'AI PAS FAIT

- **Pas de Sonnet 5.** Le diagnostic montrait qu'il aurait cassé le cron
  autrement : `temperature: 0.2` passe par ce même service, et Sonnet 5 rejette
  `temperature` non-défaut en **400**. Le symptôme se serait déplacé de 404 à 400.
- **Pas de centralisation.** Les cinq constantes de modèle restent où elles sont.
- **Pas touché aux quatre autres identifiants** — tous actifs.
- **Pas touché au cron** — patch + demande d'exemption.
- **Pas touché au guard** — bloc fourni, à poser par toi.
- **Aucune écriture DB, aucune migration, aucun appel API émis.**

---

# 7. CE QUI RESTE OUVERT — après ton GO

1. **Trancher le HTTP 500** sur échec total (§4) — c'est le seul arbitrage réel
   du patch.
2. **Les trois autres consommateurs de `llm.service` ne lisent pas encore
   `errorKind`.** `assistant/route.ts` et `ai-summary/route.ts` renvoient toujours
   un `ai_call_failed` générique — le service sait maintenant pourquoi, eux ne le
   disent pas encore. Les deux routes sont **gelées** ; c'est un second lot, pas
   ce hotfix.
3. **`DECISIONS.md:142`** porte encore l'action *« Verify Claude model ID »*. Elle
   est faite pour `llm.service.ts` ; la ligne mérite d'être mise à jour plutôt
   que laissée à traîner une troisième fois.
4. **Le repli annoncé n'existe toujours pas.** `llm.service.ts:7` promet une
   architecture de repli OpenAI/Mistral ; les deux souches retournent
   `provider_not_implemented`. Hors périmètre, mais à ne pas oublier : quand
   Anthropic tombe, il n'y a rien derrière.

---

---

# 8. FINITION — CI propre + alerte (2e passe)

## 8-a. Quels checks BLOQUENT le merge de #164 ? — **aucun**

`main` n'a **pas** de protection de branche classique (`/branches/main/protection`
→ 404). La protection passe par le **ruleset `protect-main`** (actif), qui impose
exactement quatre choses :

| Règle | Paramètre |
|---|---|
| `pull_request` | `required_approving_review_count: 0`, threads de revue à résoudre, approbation supplémentaire pour changements non attribués |
| `required_linear_history` | rebase ou squash, pas de commit de merge |
| `non_fast_forward` | pas de force-push |
| `deletion` | pas de suppression |

**Il n'existe aucune règle `required_status_checks`.** Aucun check CI ne bloque
le merge — ni Quality Gates, ni Dependency Audit, ni SAST, ni Paths/branch-guard.

**Conséquence directe : `--admin` n'a jamais été nécessaire.** Je l'ai utilisé sur
la PR #163 (exemption guard) ; c'était superflu, le merge serait passé sans. Sur
le code, comme demandé, il ne sera pas utilisé — et il n'y a rien à contourner.

**Rien ne bloque donc, mais tout n'est pas vert.** Distinction à garder :

| Check | Avant | Après le correctif lint | Bloquant ? |
|---|---|---|---|
| **Paths / branch guard** | ✅ | ✅ | non — mais c'est le seul qui juge ce hotfix |
| Quality Gates — étape **Lint** | ❌ **3 erreurs** | ✅ **0 erreur** (219 avertissements) | non |
| Quality Gates — étape **Build** | ❌ | ❌ **inchangé** | non |
| Secret Scanning | ✅ | ✅ | non |
| Dependency Audit | ❌ 108 vulns | ❌ inchangé | non |
| SAST (Semgrep) | ❌ | ❌ inchangé | non |
| Vercel Preview | ❌ | ❌ inchangé | non |

**Correction d'une affirmation trop rapide de ma part.** Le correctif lint a bien
fait son travail — le job passe désormais l'étape *Lint* (`✖ 219 problems
(0 errors, 219 warnings)`) — mais **`Quality Gates` reste rouge** : il échoue une
étape plus loin, au *Build*, sur

```
Error: [env] Missing required env var in prod: ADMIN_TOKEN
Failed to collect page data for /api/admin/ingest/pdf
```

C'est un **trou de configuration CI**, pas un défaut de code : `ADMIN_TOKEN` n'est
pas exposé aux GitHub Actions. Vérifié préexistant — `main` échoue à
l'identique sur `5fe79b7`, un commit qui ne contient qu'un fichier `.sh`. C'est
aussi la cause de l'échec du déploiement Vercel Preview. Je n'y ai pas touché :
c'est du secret d'environnement, et la consigne exclut `vercel env pull`.

`Dependency Audit` et `SAST` restent rouges pour des raisons également
**préexistantes et sans rapport** (108 vulnérabilités de dépendances
transitives, dont `undici` via `jsdom`).

Aucun de ces checks ne bloque, puisqu'aucun n'est requis — mais **ils resteront
rouges après ce merge**. Ce qui reste à trancher, et qui ne m'appartient pas :
faut-il rendre certains checks requis (ça touche le ratchet CI), et faut-il
donner `ADMIN_TOKEN` à la CI pour que le Build passe ? Signalé, pas décidé.

## 8-b. Les 3 erreurs lint — corrigées

`src/lib/intelligence/__tests__/ingestStaleReconciliation.test.ts` portait trois
`Unexpected any` (l. 22, 26, 48), introduites par le merge stale `12c66b9` et
rougissant `main`. Remplacées par `Record<string, unknown>` et un cast nominal
`{ __tx: Record<string, Mock> }`. Les 11 tests du fichier passent toujours.

**Le dépôt entier repasse à `0 errors`** (222 avertissements subsistent, sans
effet sur le gate).

## 8-c. Alerte « modèle OFF » sur le digest Telegram

**Aucune exemption nécessaire** : le watchdog vit dans `src/scripts/watchdog/`,
qui n'est pas un chemin gelé (le guard le dit lui-même, l. 360).

Nouveau check n°7 dans `watcher-health.mjs`, sur le canal existant, à côté de
« source intel périmée » et « evidence orpheline ». La logique vit dans
`src/lib/watchdog/llmVeilleProbe.ts` — pur, testé — le `.mjs` ne porte que la
requête, **un SELECT**. Même découpage que la sonde C4.

### Ce qu'on mesure, et pourquoi pas « le dernier run »

Il n'existe **aucun journal de run** pour ce cron : `FounderIntelItem` n'a pas de
colonne de mise à jour, et en ajouter une demanderait une migration — exclue.

On lit donc la **trace durable que le cron laisse déjà**, item par item :
`lastSummaryError`, effacée à chaque succès, réécrite à chaque échec. L'état
décrit la **file**, pas un run isolé, et la ligne le dit ainsi. Affirmer un
« dernier run FAILED » qu'on n'observe pas aurait refait exactement le défaut
qu'on corrige.

### Deux formats d'erreur, et pourquoi les deux comptent

Depuis le correctif, un échec de modèle s'écrit `MODEL_NOT_FOUND: …`. Mais **247
lignes sont déjà en base au format d'avant** (`Error:404 …`) — mesuré en lecture
seule sur `ep-square-band`. Ne reconnaître que le format neuf aurait affiché vert
sur un échec mesuré. La sonde reconnaît `^(MODEL_NOT_FOUND|NotFoundError|Error:404)`,
ancré en début de chaîne pour ne pas attraper un « 404 » cité au milieu d'un
message. Une mutation le vérifie.

### Preuve — dry-run réel sur la production, lecture seule

```
🔴 MODÈLE LLM INDISPONIBLE — 247 item(s) de veille en échec MODEL_NOT_FOUND.
   Le modèle épinglé dans llm.service.ts ne répond plus : plus aucun résumé
   n'est produit, et l'assistant de dossier comme les synthèses passent par
   le même service. Vérifier l'identifiant de modèle.

• Veille LLM : FAILED — 6401 en attente, 560 résumés, 248 en erreur
  (247 MODEL_NOT_FOUND), 86 abandonné(s)
```

Aux côtés des lignes existantes (`🔴 EVIDENCE ORPHELINE`, `⚠️ forta 141j`).
Telegram court-circuité par `WATCHDOG_DRY_RUN=1` — **aucun message envoyé**.
**Que des compteurs** : jamais de titre, jamais de résumé, jamais d'URL.

### Tests — 19, dont deux mutations vérifiées

| Groupe | Ce qui casserait |
|---|---|
| échec total | marqueur 🔴 absent · un seul item ne suffirait plus · l'alerte ne nommerait pas `llm.service.ts` ni la portée réelle |
| autres états | erreurs sans modèle mort promues en critique · file saine qui alerte |
| **jamais silencieuse** | une ligne de résumé manquante dans l'un des 4 états · compteurs absents |
| deux formats | `Error:404` non reconnu · un 400 ou un quota pris pour un modèle mort · un « 404 » au milieu d'un message compté |
| la requête | autre chose qu'un SELECT · entiers pg non normalisés · ligne absente devenant un silence |

| Mutation | Effet |
|---|---|
| marqueur rouge retiré | **3 rouges** |
| ancien format `Error:404` non reconnu | **2 rouges** |

---

## STOP — j'attends le GO

Rien n'est mergé, rien n'est déployé. **`--admin` ne sera pas utilisé sur le
code — et n'est pas nécessaire, aucun check n'étant requis.**

Trois choses à valider : le contenu des 4 commits, le HTTP 500 du cron, et le
fait d'assumer `Dependency Audit` + `SAST` rouges au merge (préexistants, non
requis, sans rapport).
