# BUILD 10 / P1 — qualification de `amf` et `fca`

`0 write prod · 0 DDL · 0 collecte déclenchée · 0 Helius · 0 RPC · aucun
armement.` `main` non touché, aucun merge. `goplus` non branché.

---

## STATUS

### Inventaire des chemins gelés — 1 fichier, et il est indivisible

| fichier requis pour armer | verdict | raison d\'indivisibilité |
|---|---|---|
| **`vercel.json`** | **GELÉ** — `^vercel\.json$` | l\'armement d\'un cron Vercel **est** une entrée dans ce fichier. Il n\'existe aucun autre point de déclaration : la route générique `/api/intelligence/ingest/[slug]` accepte déjà les deux slugs, le registre les déclare déjà. Un cron ne s\'arme nulle part ailleurs. |

Tout le reste est **LIBRE** — et rien d\'autre n\'est requis. **Je n\'ai rien ouvert.**

### Les six points

| # | point | `amf` | `fca` |
|---|---|---|---|
| 1 | **collecteur réel** | **OUI** — `src/lib/intelligence/sources/amf.ts`, 3 581 o | **OUI** — `sources/fca.ts`, 3 774 o |
| 2 | **armement** | **1 entrée cron** dans `vercel.json` | 1 entrée cron **+ 2 variables d\'environnement** |
| 3 | **coût / provider** | **API publique, aucune authentification** | **compte FCA requis** — `FCA_AUTH_EMAIL` + `FCA_AUTH_KEY`, **absentes de `.env.local`** |
| 4 | **cadence** | `0 8 * * 1` — hebdomadaire, déjà déclarée au registre | `30 7 * * *` — quotidienne, déjà déclarée au registre |
| 5 | **format** | **entre dans le schéma existant**, aucun mapping à écrire | **idem** |
| 6 | **impact verdict** | **ZÉRO sur le score** | **ZÉRO sur le score** |

### Le point 6 est le résultat qui commande la décision

Les deux sources n\'émettent que `DOMAIN` et `PROJECT` :

```ts
// amf.ts — deux émissions, et deux seulement
entityType: "DOMAIN"   riskClass: "SANCTION"  jurisdiction: "FR"
entityType: "PROJECT"  riskClass: "SANCTION"  jurisdiction: "FR"
```

Or le chemin de scoring interroge une **adresse** :

```ts
// engine.ts:513
const signal = await lookupValue(address, chain);

// matcher.ts:84-90 — guessEntityTypes
0x[0-9a-f]{40}          → ["ADDRESS","CONTRACT","TOKEN_CA"]
[1-9A-HJ-NP-Za-km-z]{32,44} → ["ADDRESS","CONTRACT","TOKEN_CA"]
```

**Pour une adresse crypto, `DOMAIN` et `PROJECT` ne sont jamais essayés.** Armer
`amf` et `fca` ne peut donc modifier **aucun** verdict TigerScore, ni déclencher
le floor 15, ni changer un tier.

### Sujets concernés sur le corpus actuel

| type | entités | source dominante |
|---|---|---|
| `DOMAIN` | **338 532** | `scamsniffer` (tier 2) |
| `CONTRACT` | 2 530 | `scamsniffer` |
| `ADDRESS` | 869 | `ofac` |
| **`PROJECT`** | **0** | — |

**Zéro entité `PROJECT` existe aujourd\'hui.** La moitié `PROJECT` des deux
collecteurs alimenterait un type que rien n\'a jamais peuplé.

Sur `DOMAIN`, l\'apport serait réel mais **hors chemin de verdict** : seules deux
routes acceptent une valeur libre et pourraient donc atteindre ces données —
`/api/intelligence/match` et `/api/scan/intelligence`. Ce sont des points de
consultation, pas le calcul du score.

---

## DECISION NEEDED

### `amf` — armable avec l\'architecture existante

| critère | verdict |
|---|---|
| nouveau provider | **non** — `https://geco.amf-france.org/api/v1/liste-noire?language=fr`, publique, sans clef |
| budget | **non** |
| changement d\'architecture | **non** — route, registre et carte `SOURCES` déjà câblés |
| changement méthodologique | **non** — `riskClass: "SANCTION"`, `sourceTier: 1`, schéma inchangé |
| **coût de l\'armement** | **une ligne dans `vercel.json`** — chemin gelé, donc une fenêtre d\'exemption |

**Selon ton critère, `amf` est armable dans BUILD 10.** J\'attends ton GO, et
l\'ouverture de `vercel.json` que je ne fais pas seul.

**Réserve à peser avant de dire oui** : l\'armement n\'améliore aucun verdict.
Il ferme un `NOT_ARMED` réglementaire et alimente deux routes de consultation.
C\'est un gain de posture et de couverture, pas un gain de score. Je le dis pour
que le GO se donne en connaissance de cause.

### `fca` — STOP

`fetchFca` exige deux en-têtes d\'authentification :

```ts
"X-Auth-Email": process.env.FCA_AUTH_EMAIL ?? "",
"X-Auth-Key":   process.env.FCA_AUTH_KEY   ?? "",
```

**Les deux variables sont absentes de `.env.local`.** Obtenir des identifiants
FCA est un **nouveau provider** au sens de ton critère. Je ne décris pas ce que
coûte ce compte — je n\'ai pas mesuré, et je ne le suppose pas.

**`fca` ne peut pas être armé dans BUILD 10 sans franchir la ligne que tu as
tracée.** Je la décris, je ne la déplace pas.

> Sans les variables, `fetchFca` n\'échoue pas bruyamment : il envoie deux
> en-têtes vides, log un `console.warn` sur `!res.ok`, et rend un tableau vide.
> Un armement de `fca` sans identifiants produirait donc des runs `success` à
> zéro enregistrement — exactement le motif que la sonde corrigée sait maintenant
> nommer (`UNKNOWN`), mais qu\'il vaut mieux ne pas créer.

---

## PROOF

### Règle active — une surface présente bien l\'absence comme un contrôle

Tu demandais de signaler ce cas. **Il existe.**

`src/app/api/scan/intelligence/route.ts:50-58` et
`src/app/api/intelligence/match/route.ts:40` rendent :

```json
{ "match": false, "matchCount": 0, "hasSanction": false }
```

`hasSanction: false` est une **affirmation booléenne**. La réponse ne dit pas
quelles sources ont été consultées, ni lesquelles sont armées. Un consommateur
lit « pas de sanction » là où la mesure exacte est « aucune correspondance parmi
les sources armées, dont deux listes réglementaires TIER 1 ne le sont pas ».

**Même motif que les trois blancs déjà mesurés** — `on_chain.distribution`,
l\'âge des sources, et l\'invisibilité des sources sans observation. C\'est la
quatrième occurrence de *absence → réassurance*, et la première sur un champ qui
porte explicitement le mot « sanction ».

`amf` et `fca` restant `NOT_ARMED`, **aucune absence de match sur ces sources ne
peut aujourd\'hui être présentée comme un contrôle effectué.** La surface le fait.

### Ce qui est mesuré, et comment

| affirmation | preuve |
|---|---|
| collecteurs réels | `amf.ts` 3 581 o, `fca.ts` 3 774 o, avec URL, `fetch`, timeout et normalisation |
| câblés | `ingest.ts:65-66` — `amf: fetchAmf`, `fca: fetchFca` dans `SOURCES` |
| route disponible | `/api/intelligence/ingest/[slug]`, `slug in SOURCES`, gardée par `CRON_SECRET` |
| aucun cron | `vercel.json` : 17 crons, ni `amf` ni `fca` |
| aucun run | `intel_ingestion_batches` : slugs présents = `ofac`, `scamsniffer`, **et rien d\'autre** |
| AMF sans authentification | `amf.ts:11` — URL publique, `fetch` sans en-tête d\'auth |
| FCA avec authentification | `fca.ts:29-30` — `X-Auth-Email` / `X-Auth-Key` |
| variables absentes | `.env.local` — `FCA_AUTH_EMAIL` et `FCA_AUTH_KEY` introuvables |
| impact nul sur le score | `engine.ts:513` interroge une adresse · `matcher.ts:84-90` n\'essaie jamais `DOMAIN`/`PROJECT` sur une adresse |
| 0 entité `PROJECT` | `intel_canonical_entities`, comptage par `type` |

---

## NEXT

1. **`amf`** — j\'attends ton GO **et** l\'ouverture de `vercel.json`. Une entrée
   cron, cadence `0 8 * * 1` déjà déclarée au registre. Je n\'ouvre rien seul.
2. **`fca`** — bloqué sur provider. Rapporté, non tranché.
3. **`hasSanction: false`** — à arbitrer. La correction consisterait à faire
   voyager l\'état à côté du booléen (quelles sources armées, lesquelles
   consultées), exactement la règle de conception ratifiée. **Hors périmètre de
   P1**, et je ne l\'ouvre pas : les deux fichiers sont sous `^src/app/api/`,
   gelés.
4. **`goplus`** — laissé `NOT_ARMED`, derrière `amf` et `fca`, non touché.
