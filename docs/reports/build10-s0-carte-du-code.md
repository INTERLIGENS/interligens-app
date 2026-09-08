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
