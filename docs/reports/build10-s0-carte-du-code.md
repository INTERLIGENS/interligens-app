# BUILD 10 · S0 — CARTE DU CODE

**Reconnaissance en LECTURE SEULE.** 0 write, 0 DDL, 0 collecte, 0 RPC, 0 provider.
Aucun chemin gelé franchi. Aucune correction proposée : on nomme et on classe.

Base : `main = 4d5cdcccb4b4977bf676ffd33bbfe62fd7d8c4c7`, guard
`ce13d0c0…13e50`, aucune exemption ouverte — les trois vérifiés, pas supposés.

---

## LES SIX CATÉGORIES

| catégorie | ce qu'elle veut dire |
|---|---|
| `DATA_ABSENT` | la donnée pourrait exister, elle n'est pas là |
| `NOT_MEASURABLE` | rien dans le système ne peut la produire |
| `PIPE_NOT_CONNECTED` | source et surface existent, le câble entre les deux, non |
| `COLLECTOR_MISSING` | aucun collecteur ne remplit la source |
| `BUG` | le comportement contredit son propre contrat |
| `INTENTIONALLY_NOT_SHOWN` | retiré par décision, et la décision est traçable |

Un **BLANC SILENCIEUX** est signalé à part, quelle que soit sa catégorie : un
champ vide qui ne dit pas qu'il est vide. Un « — » explicite est acceptable ;
un vide muet ne l'est pas.

---

## 1 · ÉNUMÉRATION DES SURFACES — MESURÉE, NON PRÉSUMÉE

| famille | compte | mesure |
|---|---|---|
| pages publiques (locales fusionnées) | **98** routes distinctes / 135 fichiers | `find src/app -name page.tsx`, hors `admin/` |
| pages admin | **62** routes distinctes | idem, `admin/` |
| routes API | **365** `route.ts` | dont **182** hors `admin/` et `cron/`, **157** admin, **26** cron |
| PDF / exports | **21** producteurs | `application/pdf`, `text/csv`, `PutObjectCommand` |
| extensions navigateur | **2** | `interligens-guard/`, `packages/chrome-guard/` |
| e-mail / notification | **1 chaîne** identifiée | `src/lib/security/email/digest.ts` + routes d'envoi |

### Le gate de requêtes change l'ordre de lecture

`src/proxy.ts` place **quasiment toute page publique derrière un cookie
`investigator_session` validé** (hash SHA-256, `revokedAt: null`,
`expiresAt > now`, accès actif, fail-closed).

Ce qui est atteignable **sans session** :

```
/access*  ·  /simulator*  ·  /legal/*  ·  /<loc>/legal/*
/health   ·  /sitemap.xml ·  /robots.txt  ·  assets statiques
/api/*    → exempté du gate beta, chaque route porte sa propre garde
```

Conséquence pour l'ordre : un lecteur Investor/Counsel **sans session** ne voit
que le flux d'accès et les pages légales. Avec session, il ouvre les dossiers.
Les deux cas sont traités, dans cet ordre de valeur.

---

## 2 · ORDRE DE TRAITEMENT

Ordonné par ce qu'un lecteur Investor/Counsel ouvre en premier. Je descends
cette liste ; si le contexte s'épuise, ce qui compte est fait.

| # | surface | pourquoi ce rang |
|---|---|---|
| 1 | `/<loc>/cases/lab`, `/cases/cbex`, `/cases/botify`, `/cases` | le dossier lui-même — la sortie de BUILD 9 |
| 2 | `/api/casefile/public` · `/api/casefile/pdf` | le PDF, ce que counsel emporte |
| 3 | `/shared/case/[token]` | le lien qu'on transmet à un tiers |
| 4 | `/<loc>/kol/[handle]` | surface NOMINATIVE — le risque juridique le plus direct |
| 5 | `/<loc>/methodology/*` · `/dataroom/score` | « comment ce score est-il fait » |
| 6 | `/<loc>/transparency` · `/<loc>/investors` | ce que l'entreprise affirme d'elle-même |
| 7 | `/<loc>/explorer` · `/explorer/[caseId]` | la navigation dans le corpus |
| 8 | `/<loc>/watchlist` · `/watchlist/signals/[id]` | le flux vivant |
| 9 | `/legal/*` | atteignable SANS session — un régulateur commence souvent là |
| 10 | extensions + e-mail | surfaces distribuées, hors navigateur |

Le reste (admin, investigateurs, mm, guard, intégrations) vient après : ce ne
sont pas les surfaces qu'un lecteur externe ouvre.

---

## 3 · LES COLLECTEURS — CE QUI TOURNE, ET CE QUI N'EST PAS ARMÉ

Premier passage transversal, parce qu'il conditionne **toutes** les surfaces :
un champ dont le collecteur ne tourne pas est vide partout à la fois.

### 3.a · Crons armés

**17 crons déclarés dans `vercel.json`, et les 17 ont un handler.**

> **Correction d'une erreur de ma première mesure.** J'avais compté
> `/api/intelligence/ingest/ofac` et `/api/intelligence/ingest/scamsniffer`
> comme « crons sans handler » : mon `find` était scopé sur `src/app/api/cron`
> et ne voyait pas la route **dynamique** `ingest/[slug]/route.ts`, qui les
> capte. Vérifié : les deux slugs sont dans `SOURCES`.

### 3.b · Onze handlers cron ORPHELINS

Handler présent dans le code, **aucun cron déclaré** dans `vercel.json`.

| handler | autres références au chemin |
|---|---|
| `api/cron/mm-calibration` | **0** |
| `api/cron/onchain/sync` | **0** |
| `api/cron/signals/run` | **0** |
| `api/cron/social/capture` | **0** |
| `api/cron/social/discover` | **0** |
| `api/cron/alerts/deliver` | 1 |
| `api/cron/corroboration` | 1 |
| `api/cron/intake-watch` | 1 |
| `api/cron/digest` | 2 |
| `api/cron/price-cache-refresh` | 2 |
| `api/cron/security-weekly-digest` | 5 |

**Catégorie provisoire : `PIPE_NOT_CONNECTED`** — le collecteur EXISTE, il
n'est pas déclenché. À confirmer surface par surface : un handler orphelin
n'est un trou que si une surface attend ce qu'il produit. Les cinq à zéro
référence sont les plus suspects.

*Chiffre non vérifié :* je n'ai pas mesuré si un déclencheur externe
(GitHub Actions, appel manuel, autre plateforme) les appelle. Le comptage
porte sur le dépôt seul.

### 3.c · Sources d'intelligence déclarées mais NON armées

`src/lib/intelligence/sources/registry.ts` déclare six sources **avec leur
horaire**. `vercel.json` n'en arme que deux.

| source | horaire déclaré au registre | armé |
|---|---|---|
| `ofac` | `0 6 * * *` | **oui** (à `0 1 * * *`) |
| `scamsniffer` | `0 7 * * *` | **oui** (à `30 1 * * *`) |
| `amf` | `0 8 * * 1` | **non** |
| `fca` | `30 7 * * *` | **non** |
| `forta` | `0 */6 * * *` | **non** |
| `goplus` | `realtime` | **non** |

Deux constats distincts, à ne pas confondre :

1. **quatre sources sur six ne sont jamais collectées** — `COLLECTOR_MISSING`
   du point de vue de toute surface qui les attendrait ;
2. **les horaires du registre et ceux de `vercel.json` divergent** pour les
   deux qui tournent. Le registre déclare un horaire qui n'est pas celui qui
   s'applique : c'est une deuxième source de vérité sur la cadence.

À instruire : quelles surfaces citent `amf`, `fca`, `forta`, `goplus` ? Si une
UI les annonce, l'écart est un blanc silencieux. Si aucune ne les cite, c'est
un registre en avance sur le produit — pas un trou.

---

*Document écrit au fil de l'eau. Les surfaces suivent, une section par surface.*

---

# SURFACE 1 · LES PAGES DE DOSSIER

`/<loc>/cases`, `/<loc>/cases/lab`, `/<loc>/cases/cbex`, `/en/cases/botify/evidence`

## 1.1 · La chaîne, mesurée

```
UI  TokenCasefileView  ──→  page.tsx (lab | cbex)
                            ├─ prisma.tokenCaseFile.findUnique(ref)   ← bloc legacy
                            └─ loadPublicProjection(ref)              ← bloc canonique
                                 └─ CaseFileClaim + CaseFileSource
```

### Le writer de l'autorité canonique

**Il n'existe aucun writer applicatif de `token_casefiles`.**

| ref | ce qui l'écrit |
|---|---|
| `IL-PND-LAB-001` | `prisma/seed-lab.ts` — un **seed**, 38 champs, `upsert` |
| `IL-PON-CBEX-001` | `prisma/seed-cbex.ts` — un **seed** |
| `IL-SHILL-BOTIFY-001` | aucun seed ; SQL rendu à la main (`docs/prep/patches/BUILD9/`) |
| `IL-SHILL-VINE-001` | idem |

Un seul `tokenCaseFile.upsert` dans tout `src/` + `prisma/` : celui de
`seed-lab.ts`. Les pages, l'API, le lecteur canonique et l'audit **lisent**.

**Catégorie : `COLLECTOR_MISSING`** — au niveau de la table entière. Aucun
pipeline ne crée ni ne rafraîchit un dossier. Ce n'est pas un défaut de
qualité des données : c'est l'absence de chaîne d'alimentation. Tout dossier
futur naîtra d'un seed écrit à la main ou d'un SQL exécuté en console.

*Conséquence directe :* les colonnes de marché (`ath`, `atl`, `fdvPeakUsd`,
`marketCapMinUsd/MaxUsd`, `circulatingSupply`) sont figées à la valeur du seed.
Rien ne les rafraîchit. Une page de dossier affiche donc un instantané dont
**la date n'est pas rendue**.

### Huit colonnes qu'aucun writer applicatif ne pose

`insiderExitNotionalValueUsd` · `insiderExitNotionalValueUsdNature` ·
`insiderExitNotionalBasis` · `claimedRaiseUsdNature` ·
`estimatedRetailHarmUsdNature` · `rowNature` · `createdAt` · `updatedAt`

`createdAt`/`updatedAt` ont un défaut base — hors sujet. Les six autres sont
posées par des **packs SQL exécutés à la main** (S3, S5, S6, W2). Un dossier
créé demain par un seed les aurait à `NULL`.

**Catégorie : `PIPE_NOT_CONNECTED`.** La colonne existe, la surface la rend
(`insiderExitNotionalValueUsd` est affiché par la fiche), aucun code ne la
remplit.

## 1.2 · Comportement quand un champ est absent — la mesure

Croisement de la nullabilité du schéma avec les gardes réelles du rendu.

**Aucun champ scalaire non gardé n'est nullable.** Les 9 champs sans garde
(`ref`, `codename`, `ticker`, `title`, `family`, `subtype`, `primaryChain`,
`status`, `verdict`) sont tous `NOT NULL`. Les nullables ont tous un repli
explicite. **Zéro blanc silencieux sur les scalaires.**

En revanche, sur les **listes**, le même composant se comporte de deux façons :

| champ liste | comportement quand vide |
|---|---|
| `secondaryChains`, `backers`, `exchanges`, `exitExchanges`, `linkedTokens` | rend **« — »** — explicite |
| `founders` | **la section disparaît** |
| `keyWallets` | **la section disparaît** |
| `sources` (sources de l'investigation) | **la section disparaît** |
| bloc canonique (claims + retraits) | **le bloc disparaît** |

**Quatre blancs silencieux**, dans un composant qui sait pourtant écrire « — »
cinq lignes plus haut. Le plus lourd est `sources` : un dossier sans sources
d'investigation listées ne se distingue pas d'un dossier dont la section
n'existe pas. Pour `keyWallets`, BOTIFY porte `[]` de façon **ratifiée** — la
section s'évanouirait sans dire pourquoi.

Le bloc canonique est **mon propre choix de conception** (BUILD 9) : « ne pas
afficher une section vide qui donnerait à croire qu'on a cherché et rien
trouvé ». Sous la lentille de BUILD 10, l'intention n'est pas visible du
lecteur — je le classe comme les autres.

## 1.3 · `/en/cases/botify/evidence` — une TROISIÈME autorité CaseFile

`/en/cases/botify` **redirige** vers `/en/cases/botify/evidence`. Cette page ne
lit ni `token_casefiles`, ni le lecteur canonique, ni même le JSON : elle porte
**ses propres constantes**, `CASE`, `CLAIMS`, `WALLETS`, `EDGES`, avec le
commentaire « Static data from data/cases/botify.json ».

BUILD 9 a supprimé deux autorités concurrentes. Celle-ci n'a jamais été
inventoriée, parce qu'elle n'était pas dans la carte des surfaces CaseFile.

| constat | mesure | catégorie |
|---|---|---|
| 8 claims dupliqués en dur | copies des titres canoniques, sans lien | `PIPE_NOT_CONNECTED` |
| tous rendus `CONFIRMED` (× 9) | l'autorité canonique les porte en `ATTACHED`, aucun n'est `PUBLIC` | `BUG` — contredit la doctrine des trois états sur une surface publique |
| `mint` publié = **clé synthétique 43 car.** | canonique = 44 car. (`…UnZac**i**ja4…`) ; la page publie `…UnZacja4…` | `BUG` |
| « rug-pull » × 1, `rug_pull` × 1 | mot **interdit** par le contrat de wording du PDF, rendu ici | `BUG` |
| 7 adresses tronquées de démonstration | `7xKQ…mN2u`, `4xZ9…kQMM`, `9Th6…BYZ9`, `DezX…PB26`, `RAY…mmLP`, `5KJe…xFG2` — dont deux sont des fragments du **mint**, pas des wallets | `DATA_ABSENT` maquillé en donnée |
| 8 arêtes de graphe à montants non quantifiés | `"— SOL"`, `"Equal"`, `"~90s window"` présentés dans une colonne « amount » | `DATA_ABSENT` maquillé en donnée |

> **Le containment de BUILD 9 ne couvrait pas cette page.** Il scannait `src/`
> pour les **valeurs exactes** retirées du PDF. Ces marqueurs-ci sont d'autres
> chaînes, sur une autre surface. Le test de non-réintroduction est donc vrai
> et insuffisant : il protège des valeurs, pas d'une classe.

## 1.4 · Asymétrie de locale

`botify` n'existe que sous `en/`. Il n'y a pas de `src/app/fr/cases/botify/`.
Un lecteur francophone qui suit un lien `/fr/cases/botify` obtient un 404.

`lab`, `cbex` et l'index existent dans les deux locales.

**Catégorie : `DATA_ABSENT`** (la page fr n'a pas été écrite), et **blanc
silencieux** au sens du produit : rien n'indique au lecteur fr que le dossier
existe en anglais.

## 1.5 · L'index `/cases`

Liste `platformCaseFile` et `tokenCaseFile` filtrés sur
`publishStatus: "published"`. Le filtre est explicite et fail-closed : un
dossier non publié n'apparaît pas — comportement correct, pas un blanc.

*Non mesuré :* combien de lignes portent `publishStatus = "published"` en base.
Je n'ai pas de connexion ; le chiffre ne peut pas être avancé ici.
