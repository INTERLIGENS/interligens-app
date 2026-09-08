# BUILD 11 · REFLEX V2 — S0 : LA VERTICALE, ET OÙ L'ÉTAT DE MESURE MEURT

Lecture seule. Base : `main = a8850edf187cf596b32a07adaf94fdcdb854888c`.
Guard : `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50`.
0 write, 0 DDL, 0 RPC, 0 fenêtre. Aucun audit horizontal : tout ce qui suit est
constaté **sur la verticale REFLEX**, pas cherché ailleurs.

Statut gelé/libre **vérifié en extrayant les 45 motifs de `FORBIDDEN_PATTERNS`
du guard** et en testant chaque fichier contre eux — pas d'après mémoire.

---

## 1 · PÉRIMÈTRE EXACT

**39 fichiers. 7 gelés, 32 libres.** Le moteur de décision est entièrement libre.

### ENTRYPOINTS

| fichier | statut | entre → sort |
|---|---|---|
| `src/app/api/reflex/route.ts` | **GELÉ** | POST `{input, locale, mode}` → verdict localisé |
| `src/app/api/reflex/[id]/route.ts` | **GELÉ** | GET id → vue complète (session investigateur) ou **rédigée** |
| `src/app/api/reflex/[id]/watch/route.ts` | **GELÉ** | abonnement, TTL 30 j |
| `src/app/api/reflex/[id]/proof-pack/route.ts` | **GELÉ** | export de preuve |
| `src/app/api/admin/reflex/[id]/flag-fp/route.ts` | **GELÉ** | marquage faux positif |

### INPUTS

`inputRouter.ts` (`classify`) — libre. Puis un **bundle d'enrichissement**
construit **dans la route gelée** : `buildTigerInputForReflex`, `offChainInput`
depuis URL/handle. `narrativeText` : **jamais construit** (« deferred until a
URL/X fetcher exists »).

### DECISION ENGINE — `src/lib/reflex/` · **32 fichiers, tous LIBRES**

`orchestrator.ts` (fan-out 8 adaptateurs) → `verdict.ts` (`decide`) →
`confidence.ts` → `persistence.ts`. Adaptateurs : `tigerscore`, `offchain`,
`coordination`, `knownBad`, `intelligenceOverlay`, `recidivism`,
`casefileMatch`, `narrative`.

### UI

| fichier | statut |
|---|---|
| `src/components/reflex/investigator/{DetailPage,ListPage}.tsx` | **GELÉ** |
| `src/app/{en,fr}/investigator/reflex/**` (4 pages) | libre |
| `src/app/admin/reflex/calibration/**` (2 fichiers) | libre |

---

## 2 · TROIS FAITS DE PÉRIMÈTRE À CONNAÎTRE AVANT S2

**a) Il n'existe AUCUNE surface retail.** `grep` sur les appelants de
`/api/reflex` hors `src/app/api/reflex` rend **zéro résultat**. Les seules UI
sont Investigator et la calibration admin. L'objectif « action retail
déterministe » n'a pas de point de sortie aujourd'hui — la verticale s'arrête à
l'API. C'est un manque, pas un défaut : à cadrer, pas à corriger en S2.

**b) `WATCH` n'est pas un verdict.** `ReflexVerdict = "STOP" | "WAIT" |
"VERIFY" | "NO_CRITICAL_SIGNAL"` — quatre valeurs. `WATCH` existe uniquement
comme **abonnement** (`/[id]/watch`, `WATCH_DEFAULT_TTL_DAYS = 30`). Les cinq
actions du cadrage supposent donc soit de réutiliser l'abonnement, soit de
créer un cinquième verdict — **décision produit, je ne la prends pas.**

**c) La fraîcheur n'existe pas.** `grep -riE 'stale|freshness' src/lib/reflex/`
= **0**. Aucun champ de `ReflexEngineOutput` ne porte d'instant d'observation.
La situation « stale » du corpus S1 n'est pas seulement non testée : elle est
**non représentable**. Défaut de modèle, pas de rédaction.

---

## 3 · OÙ L'ÉTAT DE MESURE EST PERDU

L'état est **correctement produit** puis **jeté au point de consommation**.
C'est la forme exacte de « le défaut est son absence au point de consommation ».

| étage | l'état y est-il ? | verdict |
|---|---|---|
| adaptateurs | **OUI** — les 7 `catch` posent `ran:false` **et** `error` | sain |
| manifeste (`projectEngine`) | **partiel** — garde `ran`, **jette `error`** | perte 1 |
| hash de dédup | `ran` est dans le hash → pas de faux dédup panne/propre | sain |
| `decide(engines)` | **NON** — ne lit que `e.signals` | **perte 2, centrale** |
| `computeGlobalConfidence` | **NON** — `!ran` et `ran+0 signal` → tous deux `null` | **perte 3** |
| `ReflexVerdictResult` | **NON** — aucun champ de couverture | perte 4 |
| réponse API | **NON** — ni `engines`, ni `ran`, ni `error` | perte 5 |
| UI investigateur | manifeste brut en `<pre>` — `ran` lisible, `error` absent | dernier recours |

### Le point exact

`confidence.ts` · `engineContribution` :

```ts
if (!e.ran) return null;            // provider tombé
if (e.signals.length === 0) return null;   // moteur propre, rien trouvé
```

**Deux situations opposées, une seule sortie.** « Pas de signal » et « signal
absent parce que non mesuré » sont ici littéralement le même `null`.

`verdict.ts` · `decideBranch` — `NO_CRITICAL_SIGNAL` est la **branche par
défaut**, atteinte par épuisement. Huit moteurs en panne produisent zéro signal,
donc aucune branche ne matche, donc le produit répond « aucun signal critique
trouvé » — alors que rien n'a été cherché avec succès. **C'est l'invariant
central violé, à la sortie produit.**

---

## 4 · COERCITIONS, SENTINELLES, GARANTIES DÉCLARÉES-NON-TENUES

**Aucun `?? 0`, `|| 0`, `?? false` ni `COALESCE` sur le chemin de décision.**
Les 20 occurrences de `??` dans `src/lib/reflex/` sont toutes des `?? null`
corrects. Le défaut n'est **pas** une coercition d'écriture — il est structurel,
ce qui est plus difficile à voir et plus facile à re-créer.

Deux exceptions, réelles :

**Sentinelle numérique.** `computeGlobalConfidence` rend `{ score: 0, label:
"LOW" }` quand aucun moteur n'a contribué. `0` est indistinguable d'une
confiance mesurée à zéro, et il traverse jusqu'à `confidenceScore` dans la
réponse API. La dégradation voyage **dans** le nombre, jamais à côté.

**Garantie déclarée sans implémentation.** `GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD
= 0.5` est documentée dans `constants.ts` comme *« NO_CRITICAL_SIGNAL: minimum
global confidence required to emit »*. Elle est **importée par `verdict.ts`
(l. 31) et jamais lue**. L'en-tête de `confidence.ts` décrit en outre un
comportement qui n'existe pas : *« The verdict layer's NO_CRITICAL_SIGNAL
branch handles a LOW score by surfacing the disclaimer with the caveat that
coverage was the only thing we could vouch for »* — il n'y a **aucun caveat**
dans `decide()`, le disclaimer est plat quel que soit le score.

**Fail-open assumé et écrit.** `src/app/api/reflex/route.ts` l. 111 :
*« Failures here downgrade gracefully: REFLEX still produces a verdict from the
DB-backed engines. »* Le `catch` de `buildTigerInputForReflex` n'émet qu'un
`console.warn`. Une panne TigerScore est invisible pour l'appelant.

**Deux absences confondues à la source.** `NOOP_ENGINE` (orchestrator) rend
`ran:false` **sans `error`** quand l'enrichissement manque ; un provider tombé
rend `ran:false` **avec `error`**. La distinction est correctement posée, puis
perdue au manifeste.

---

## 5 · AUTORITÉ DUPLIQUÉE OU LEGACY — CONSTAT

**Aucune sur cette verticale.** Verdict, raisons et action sortent tous de
`decide()`, donc de la **même autorité**. `ACTION_WORDING[verdict]` est une
table indexée par le verdict lui-même : elle ne peut pas diverger.
`investigator-copy.ts` / `admin-copy.ts` ne portent que du chrome d'interface.
Je ne suis pas allé en chercher ailleurs.

---

## 6 · ENVELOPPE

S0 + S1 tiennent dans l'enveloppe. Rien à classer en BLOCKER / CREEP /
RESEARCH / DEBT au titre du dépassement.

Trois éléments sont **hors S0/S1 par nature** et relèvent du cadrage S2, pas
d'un débordement : l'absence de surface retail (a), le statut de `WATCH` (b),
et l'absence de modèle de fraîcheur (c). Les trois demandent une décision
produit avant toute ligne de code.
