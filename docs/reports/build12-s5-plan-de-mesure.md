# BUILD 12 · S5 — PLAN DE MESURE PROD, PRÊT À EXÉCUTER

Préparé par T2, lecture seule. Base `main = 83266b0`, prod `interligens-cmtbqrdfv`
aliasée sur `app.interligens.com`. Guard `ce13d0c0…3e50`, 0 exemption.

**Toutes les cibles ci-dessous ont été mesurées en production le 2026-09-09**,
sur `/api/v1/score`, en GET non authentifié. Aucune n'est inventée.

---

## 0 · LIMITES DE MESURE — à déclarer, pas à contourner

**Trois surfaces ne sont pas mesurables depuis un terminal.** Un code de refus
n'est pas une preuve : il ne dit rien du comportement de la surface.

| surface | ce qu'on obtient | pourquoi |
|---|---|---|
| `/api/partner/v1/*` | **HTTP 401** `{"error":"unauthorized","code":"INVALID_PARTNER_KEY"}` | exige l'en-tête `X-Partner-Key` ; `partnerAuth` lit `PARTNER_API_KEY_V2` \|\| `PARTNER_API_KEY` |
| surfaces admin | **HTTP 401** | l'`ADMIN_TOKEN` de `.env.local` n'est pas celui de production |
| ce worktree | — | **aucun `.env.local`** : aucune mesure authentifiée n'est possible d'ici |

Conséquence directe pour S5 : **la rétrocompatibilité partenaire ne peut pas
être prouvée par requête depuis un terminal sans la clé de production.** Deux
voies honnêtes, au choix de T1 :

1. exécuter les requêtes du §3 depuis un contexte détenant `PARTNER_API_KEY_V2` ;
2. à défaut, s'en tenir à la preuve statique — le corpus `7e7a0f7` épingle déjà
   les clés et les domaines de valeurs depuis le source.

**Ne comptez jamais un 401 comme une mesure.** Il prouve que la gate d'auth
fonctionne, rien d'autre.

---

## 1 · LES QUATRE CIBLES RÉELLES

Mesurées le 2026-09-09 sur `https://app.interligens.com/api/v1/score?mint=…`.

| # | mint | mesuré aujourd'hui | ce qu'elle exerce |
|---|---|---|---|
| **A** | `BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb` | `score=70` `verdict=RED` `phantom=BLOCK` `topHolderSource=helius` | **STOP → BLOCK.** Seule cible dont la concentration est réellement mesurée. |
| **B** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `score=20` `verdict=GREEN` `phantom=ALLOW` `topHolderSource=null` | jeton établi, **mais mesure de concentration EN ÉCHEC** |
| **C** | `So11111111111111111111111111111111111111112` | `score=0` `verdict=GREEN` `phantom=ALLOW` `topHolderSource=null` | **DÉGRADÉ** — `helius: Too many accounts requested (10000000 pubkeys)` + `solana_public_rpc: HTTP 429` |
| **D** | `1111111111111111111111111111111111111111111` | `score=0` `verdict=GREEN` `phantom=ALLOW` | **43 caractères, base58 valide, NON RÉSOLVABLE** — `Invalid param: WrongSize` sur les deux providers |

```bash
for M in BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb \
         EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
         So11111111111111111111111111111111111111112 \
         1111111111111111111111111111111111111111111 ; do
  curl -s "https://app.interligens.com/api/v1/score?mint=$M" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["mint"][:12],d["score"],d["verdict"],d["phantom_warning_level"],d["topHolderSource"],repr(d["topHolderUnavailableReason"])[:60])'
done
```

### Ce que ces mesures disent déjà

**La phase 1 de T1 est servie et visible.** Le `phantom_disclaimer` de la cible D
est désormais : *« No critical signal was returned. The completeness of the
checks behind this result is not established — this is not a confirmation that
the token is safe. »* La prose ne rassure plus.

**Mais le NIVEAU, lui, n'a pas encore bougé.** Les cibles **C** et **D** sont
servies `phantom_warning_level: "ALLOW"` :

- **C** : les deux providers de concentration ont échoué — c'est une mesure
  dégradée, elle doit projeter `WARN` ;
- **D** : le mint n'est résolvable par aucun provider — l'identité n'est pas
  établie, elle doit projeter `WARN`, jamais `ALLOW`.

Ce sont les deux lignes de la table que S2 doit faire basculer. **Elles sont
observables en production, aujourd'hui, sans authentification.**

### Ce que le plan ne couvre pas, faute de cible

`WAIT` et `VERIFY` projettent tous deux sur `WARN`, et je n'ai identifié
**aucune** cible publique produisant l'un ou l'autre de façon reproductible :
`/api/v1/score` ne sert pas de verdict REFLEX. Les distinguer restera une preuve
de test unitaire (`7e7a0f7`, critère `P3`), pas une preuve de production. **À
déclarer comme tel dans le rapport S5** plutôt qu'à combler par une cible
approximative.

---

## 2 · LE DISCRIMINANT APPARIÉ

Le motif qui a fonctionné en phase 1 : une branche qui **doit** changer, une qui
**doit** rester intacte au mot près. Sans la seconde, un changement observé ne
prouve pas qu'il est ciblé.

| branche | cible | attendu APRÈS |
|---|---|---|
| **DOIT CHANGER** | **D** (non résolvable) | `phantom_warning_level` : `ALLOW` → `WARN` |
| **DOIT CHANGER** | **C** (dégradé) | `phantom_warning_level` : `ALLOW` → `WARN` |
| **DOIT RESTER IDENTIQUE, AU MOT PRÈS** | **A** (BOTIFY, RED) | `score=70` `verdict=RED` `phantom_warning_level=BLOCK` `topHolderSource="helius"` — **inchangés** |

**A est le témoin.** C'est la seule cible dont la mesure aboutit réellement : si
son `phantom_warning_level` ou son `score` bouge, la migration a débordé de son
périmètre et ce n'est plus une projection, c'est un changement de scoring.

```bash
# À exécuter AVANT le déploiement, puis APRÈS. Comparer les deux fichiers.
for M in BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb \
         So11111111111111111111111111111111111111112 \
         1111111111111111111111111111111111111111111 ; do
  curl -s "https://app.interligens.com/api/v1/score?mint=$M" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);d.pop("timestamp",None);d.pop("cached",None);d.pop("communityScans",None);print(json.dumps(d,sort_keys=True))'
done > /tmp/score-AVANT.json    # puis /tmp/score-APRES.json
diff /tmp/score-AVANT.json /tmp/score-APRES.json
```

`timestamp`, `cached` et `communityScans` sont retirés de la comparaison : ils
varient d'un appel à l'autre sans rapport avec la migration. **Tout le reste
doit être expliqué**, ligne par ligne.

Note : `cached: true` a été observé sur la cible D. Purger ou attendre
l'expiration du cache avant la mesure APRÈS, sinon la comparaison mesure le
cache et non le code.

---

## 3 · CE QUI DOIT ÊTRE IDENTIQUE AVANT/APRÈS

### `/api/v1/score` — 21 clés, mesurées

```
api_version · cached · communityScans · freezeAuthority · liquidityUsd · mint
mintAuthority · name · pairAgeDays · phantom_disclaimer · phantom_warning_level
score · signals · sources · symbol · timestamp · topHolderPct · topHolderSource
topHolderUnavailableReason · verdict · website
```

**Aucune clé ne disparaît, aucune ne s'ajoute** sans décision explicite. Seules
`phantom_warning_level` et `phantom_disclaimer` ont le droit de changer de
valeur, et uniquement sur C et D.

### `/api/partner/v1/*` — forme et domaines de valeurs

Sous réserve du §0 : ces requêtes exigent `X-Partner-Key`.

| endpoint | clés à comparer | domaines qui ne changent pas |
|---|---|---|
| `transaction-check` | `recommendation` `reason` `score_to` `score_from` `verdict_to` `chain` `version` `powered_by` | `Verdict = SAFE\|WARNING\|AVOID` · `Recommendation = ALLOW\|WARN\|BLOCK` |
| `score-lite` | `address` `score` `verdict` `tier` `signals_count` `cache_hit` `as_of` `version` `powered_by` | `Verdict` · `Tier = GREEN\|ORANGE\|RED` |
| `batch-score` | item nominal : `address` `score` `verdict` `tier` · item en erreur : `address` `error` | idem |

```bash
K="$PARTNER_API_KEY_V2"
curl -s -H "X-Partner-Key: $K" \
  "https://app.interligens.com/api/partner/v1/score-lite?address=BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sorted(d.keys()));print({k:d[k] for k in ("score","verdict","tier")})'
```

**La règle qui gouverne cette comparaison** : la rétrocompatibilité porte sur la
**forme** et le **domaine de valeurs**, pas sur la **condition d'émission**. Le
jeton `SAFE` doit rester dans le domaine — le retirer casserait des partenaires.
Ce qui change légitimement, c'est **quand** il sort.

---

## 3bis · MESURE APRÈS LA PHASE 2 — et une prédiction fausse, la mienne

Mesuré le 2026-09-09 sur `interligens-b65i0gatb`, cache froid (`cached:false`) :

| cible | avant | après | attendu par ce plan |
|---|---|---|---|
| **A** BOTIFY | `70 / RED / BLOCK` | `70 / RED / BLOCK` | **identique — tenu ✓** |
| **D** non résolvable | `0 / GREEN / ALLOW` | `0 / ORANGE / **WARN**` | **bascule — tenue ✓** |
| **C** wSOL | `0 / GREEN / ALLOW` | `0 / GREEN / ALLOW` | bascule attendue — **NON, et j'avais tort** |
| **B** USDC | `20 / GREEN / ALLOW` | `20 / GREEN / ALLOW` | idem |

**Le témoin A tient au mot près et la branche identité a basculé** : le
discriminant apparié a fait son travail.

**Ma prédiction sur C et B était fausse, et le produit a raison.**
`/api/v1/score` exclut délibérément `holders` du dénominateur attendu, avec le
raisonnement écrit dans la route : la capacité est éteinte des deux côtés —
filtre Helius trop large, 429 sur le RPC public — donc la compter mettrait
`degraded: true` sur **toute** réponse SOL. C'est le précédent `narrative` de
BUILD 11.1 : *un signal d'alerte allumé en régime normal n'alerte plus, il
devient le fond.* Présent à l'inventaire, absent du dénominateur.

J'avais lu `topHolderSource: null` comme une dégradation. C'est une capacité
hors contrat, et la distinction est exactement celle que AA a posée.

**Une seule observation subsiste, et c'est une question de vocabulaire, pas un
défaut.** Le motif attaché est `NOT_REQUESTED_BY_CONTRACT` alors que la cause
observée est un refus de provider. La décision est juste — ne pas dégrader —
mais le jeton dit « hors contrat » là où la cause est « tenté et échoué ». Sur
l'axe mesure ratifié, ce sont deux états distincts. À arbitrer, ou à laisser
tel quel en le sachant.


---

# ██ RECLASSIFICATION DU 2026-09-10 — TAXONOMIE GPT

« For EVERY changed S5 expectation, classify: RATIFIED CONTRACT CHANGE · BUG
FIX · STALE ASSUMPTION. Do NOT merely rewrite snapshots to green. »

Ma révision d'hier disait « tient / périmée ». Ce n'est pas cette taxonomie.
Reclassé, avec une QUATRIÈME case que les trois ne couvrent pas.

| attente | classe | pourquoi |
|---|---|---|
| A byte-identique sur toute la charge utile | **RATIFIED CONTRACT CHANGE** | S3 a ajouté `intelligenceCoverage` — champ ADDITIF, aucune clé disparue |
| rétrocompat partenaire sur la valeur émise | **RATIFIED CONTRACT CHANGE** | S4/#361 a changé la CONDITION d'émission de `SAFE` ; forme et domaine intacts |
| D `ALLOW`, « doit basculer » | **BUG FIX** | le fail-open d'identité est fermé, D sert `ORANGE/WARN` |
| les deux formes se contredisent | **BUG FIX** | #355 |
| A, B, C inchangées | — | rien n'a changé, rien à classer |
| **« les 21 clés sont invariantes »** | **██ DÉFAUT DU PLAN** | FAUX DÈS L'ORIGINE : B/C/D servent 20 clés, `name` et `symbol` sont conditionnels au jeton résolu. Ce n'était vrai aucun jour. Trouvé par T1. |
| **« C et B doivent basculer en WARN »** | **██ DÉFAUT DU PLAN** | FAUX DÈS L'ORIGINE : `holders` était déjà hors du dénominateur quand j'ai écrit le plan. J'avais prédit une bascule que le code interdisait déjà. |

**La quatrième case est nécessaire** : un défaut du plan n'est ni un changement
de contrat, ni un correctif, ni une hypothèse devenue fausse. C'est une
assertion qui n'a jamais été vraie, et la distinguer importe — les trois
premières se corrigent en suivant le code, celle-ci se corrige en admettant
qu'on avait mal regardé.

---

# ██ POINT 3 — LA PRÉMISSE `holders`, TRANCHÉE PAR LA MESURE

Question posée : le contrat SOL attend-il `holders`, ou l'implémentation le
tente-t-elle en bonus ?

**Mesuré : le contrat l'ATTEND.** `api/v1/score/route.ts` :

```
expected: 3                                    ← dénominateur codé en dur
solManquants : market · holders · scam_lineage ← exactement trois moteurs
expectedMeasured: 3 - (entrées de motif FAILURE)
```

`holders` est **l'un des trois** du dénominateur. Ce qui l'empêche de dégrader
n'est pas son absence d'`expected` — il y est — c'est son MOTIF :
`NOT_REQUESTED_BY_CONTRACT` figure dans `HORS_CONTRAT`, donc il ne décrémente
pas et ne déclenche pas `estDegrade`.

**Donc le motif est faux quelle que soit la condition d'émission**, et pour une
raison plus nette que celle que j'avançais hier : la ligne est simultanément
**dans le dénominateur** (comptée dans les 3) et **hors contrat** (par son
motif). Les deux ne peuvent pas être vrais ensemble.

C'est **le motif qui fait le travail de l'appartenance**. La forme correcte
n'exige aucun état nouveau : sortir `holders` d'`expected` — le dénominateur
passe à 2 — et lui laisser son état observé, `FAILURE`, qui est la réalité
causale mesurée en prod (`Too many accounts requested`, `HTTP 429`). Le refus
est d'ailleurs DÉJÀ dit sur l'autre axe, `topHolderUnavailableReason`.

Je ne l'implémente pas : décision de contrat, et le dénominateur qui passe de
3 à 2 change ce que « couverture complète » veut dire.

---

# ██ RÉVISION DU 2026-09-09 — CE PLAN ÉTAIT PÉRIMÉ

Écrit avant S3, S3.1, S3.2 et S4. Je lui applique le filtre que j'ai érigé en
réflexe par défaut : **un plan de mesure qui épingle un contrat périmé est une
assertion périmée à l'échelle du build.** Tout ce qui suit est re-mesuré sur la
prod servie, pas relu.

## 1 · LES QUATRE CIBLES — ce qui tient, ce qui tombe

| cible | plan | mesuré ce jour | verdict |
|---|---|---|---|
| **A** BOTIFY | `70 / RED / BLOCK`, témoin byte-identique | `70 / RED / BLOCK`, `topHolderSource: helius` | **TIENT sur la décision · TOMBE sur « byte-identique »** |
| **B** USDC | `20 / GREEN / ALLOW`, bascule attendue | `20 / GREEN / ALLOW` | **TIENT** — et ma prédiction de bascule était fausse, déjà corrigée |
| **C** wSOL | `0 / GREEN / ALLOW`, bascule attendue | `0 / GREEN / ALLOW` | **TIENT**, même correction |
| **D** non résolvable | `0 / GREEN / ALLOW` → attendu `WARN` | `0 / ORANGE / WARN` | **PÉRIMÉE** — la bascule a eu lieu, l'assertion épinglait le défaut |

**Cible D est le quatrième cas du motif.** Le plan la décrivait comme « doit
basculer » ; elle a basculé. Reformulée en anti-régression : *D reste `WARN`,
et repasser à `ALLOW` est une régression d'identité.*

## 2 · LE TÉMOIN A — la clause d'arrêt doit être RE-PORTÉE, pas abandonnée

Mesuré : **une clé ajoutée, aucune disparue.**

```
servies 22 · plan 21 · AJOUTÉE: intelligenceCoverage · DISPARUE: aucune
```

Donc **A n'est plus byte-identique sur la charge utile entière** — et il ne le
sera plus jamais, puisque S3 a enrichi le contrat de tous les scans.

**La clause d'arrêt reste valide, re-portée sur les champs de DÉCISION** :

> `score` · `verdict` · `phantom_warning_level` · `topHolderSource`
> Si l'un des quatre bouge sur A, ce n'est plus une projection mais un
> changement de scoring, et on s'arrête.

C'est la formulation d'origine — *« si son SCORE bouge »* — et c'est elle qui
survit. Le « byte-identique sur tout l'objet » était ma sur-spécification :
il confondait le témoin avec le contrat, et il aurait déclenché un arrêt sur
l'ajout légitime d'`intelligenceCoverage`. **Il faut le savoir avant de
mesurer, et c'est fait.**

## 3 · LA COMPARAISON AVANT/APRÈS — deux postulats morts

- **« 21 clés invariantes »** → mort. Le contrat en porte 20 à 22 selon le
  jeton (`name`/`symbol` absents sur un mint non résolu), plus
  `intelligenceCoverage`. La comparaison doit **ignorer les clés ajoutées** et
  n'exiger l'invariance que sur les 21 d'origine, dont aucune n'a disparu.
- **Rétrocompat partenaire** → mort dans sa forme. S4 a changé la **condition
  d'émission** du jeton `SAFE`. La forme et le domaine de valeurs restent
  invariants — c'est la règle que j'avais posée et elle tient — mais tout
  contrôle qui comparerait la *valeur émise* avant/après sur un périmètre
  incomplet verrait un changement **voulu**, pas une régression.

## 4 · MA RÉSERVE OUVERTE — je la tranche

`src/app/api/v1/score/route.ts:357` :

```ts
...(holders.available ? [] : [{ engine: "holders", reason: "NOT_REQUESTED_BY_CONTRACT" }])
```

Le motif est posé **conditionnellement à l'échec du provider**, et la cause
observée en prod est un refus : `helius: Too many accounts requested` +
`solana_public_rpc: HTTP 429`.

**Tranche : le jeton est juste sur l'axe DÉNOMINATEUR et faux sur l'axe CAUSE,
et un seul champ porte les deux.**

- La **décision** — ne pas dégrader — est correcte et ratifiée : `holders` est
  hors du dénominateur attendu, en permanence, parce que la capacité est
  éteinte des deux côtés. Précédent `narrative`.
- Mais « le contrat ne l'a pas demandé » est une propriété **stable**, alors
  que le code ne l'écrit que **quand le provider a refusé**. Si `holders`
  redevenait disponible, la ligne disparaîtrait entièrement : le contrat ne
  dit donc jamais « non demandé », il le déduit d'un échec.

**La forme correcte n'exige aucun état nouveau** — elle existe déjà dans
`IntelligenceCoverage`, qui sépare `expected` (appartenance au dénominateur) de
`reason` (état observé de la tentative). Transposée ici : `holders` reste hors
d'`expected`, et son état observé vaut `FAILURE`. L'appartenance gouverne la
dégradation ; le motif décrit la cause. Aujourd'hui le motif fait le travail de
l'appartenance.

Je ne l'implémente pas : c'est une décision de contrat, et elle appartient à
T1 et à GPT.

## 5 · LES LIMITES — elles restent, et elles restent visibles

- **Un 401 n'est jamais une mesure.** Les routes partenaires exigent
  `X-Partner-Key` ; il n'y a aucun `.env.local` ici. Toute preuve les
  concernant porte sur le **mécanisme**, jamais sur la production.
- **`WAIT` et `VERIFY` n'ont aucune cible publique.** `/api/v1/score` ne sert
  pas de verdict REFLEX. Leur distinction restera une preuve unitaire — celle
  du critère `P3` de S4 — et doit être déclarée comme telle dans le rapport S5.
- **Le cache.** Les quatre cibles répondent `cached: true`. Toute mesure
  APRÈS doit purger ou attendre l'expiration, sinon elle mesure le cache.

## 6 · ORDRE D'EXÉCUTION RÉVISÉ

1. Constater les limites du §5, les écrire dans le rapport.
2. Capturer l'AVANT sur les 4 cibles, **en ne retenant que les 21 clés
   d'origine** et les 4 champs de décision de A.
3. Déployer. Purger le cache ou attendre.
4. Capturer l'APRÈS, `diff`, **expliquer chaque ligne**.
5. Vérifier que A n'a pas bougé **sur ses quatre champs de décision**. S'il a
   bougé : arrêt.
6. Vérifier que D est resté `WARN` — anti-régression, plus une bascule attendue.
7. Partenaires : forme et domaine de valeurs seulement, et dire si la clé n'est
   pas disponible.

## 4 · ORDRE D'EXÉCUTION (version d'origine, conservée)

1. §0 — constater les limites, écrire dans le rapport ce qui ne sera pas mesuré.
2. §1 — capturer l'état AVANT sur les 4 cibles.
3. Déployer.
4. Purger le cache ou attendre son expiration.
5. §2 — capturer l'APRÈS, `diff`, expliquer chaque ligne.
6. §3 — comparer les clés ; si la clé partenaire n'est pas disponible, le dire.
7. Vérifier que la cible **A** est byte-identique. Si elle a bougé, **s'arrêter**.
