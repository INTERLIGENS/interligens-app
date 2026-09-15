# P0 — LE CRON DE RÉFÉRENCE, ET LA PROCÉDURE D'ACTIVATION POUR LE FONDATEUR

**2026-09-15 · fenêtre INCIDENT ROTATION · LECTURE SEULE · aucune activation faite ici**

Suite de `RUNTIMES_HISTORIQUES_P0_2026-09-15.md` (CC-OFFLINE-219, mergé 15:24 UTC).
T2 a établi l'inventaire et la primitive. Ce document établit **l'instrument de mesure** de
l'étape 5 — le cron de référence — et la **procédure écran par écran** de l'étape 2.

---

## 1. LE CRON DE RÉFÉRENCE

### Retenu : `/api/cron/shill-feed`

| | |
|---|---|
| **Cadence** | `0 * * * *` — **horaire**, la plus courte des 18 crons du projet |
| **Prochain passage** | **16:00 UTC** (18:00 CEST) · Pro ⇒ invoqué **dans la minute** `16:00:00`–`16:00:59` |
| **Mécanisme** | `vercel.json` → `GET` émis par Vercel, `user-agent: vercel-cron/1.0`, en-tête `Authorization: Bearer $CRON_SECRET` |
| **Hôte visé** | `interligens-9u9u343yk-davidpandoraparis-2892s-projects.vercel.app` |

**Pourquoi celui-là.** C'est le seul cron horaire ; les 17 autres sont quotidiens ou
hebdomadaires. Il emprunte exactement le même mécanisme que les 17 autres — même déclencheur,
même hôte, même forme d'authentification — donc ce qu'il démontre vaut pour tous. Attendre un
cron quotidien coûterait jusqu'à 24 h ; attendre celui-ci coûte au plus 60 minutes.

**Les 18 crons, cadence et prochaine occurrence UTC** — lus sur le plan de contrôle
(`crons.definitions`, projet `prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ`), pas dans `vercel.json` :

| Cadence | Chemin | Prochaine occurrence |
|---|---|---|
| `0 * * * *` | `/api/cron/shill-feed` | **16:00 UTC — RETENU** |
| `0 1 * * *` | `/api/intelligence/ingest/ofac` | 01:00 UTC J+1 |
| `30 1 * * *` | `/api/intelligence/ingest/scamsniffer` | 01:30 UTC J+1 |
| `0 2 * * *` | `/api/cron/daily-flow` | 02:00 UTC J+1 |
| `30 2 * * *` | `/api/cron/reaper` | 02:30 UTC J+1 |
| `0 3 * * *` | `/api/cron/process-events` | 03:00 UTC J+1 |
| `0 4 * * *` | `/api/cron/helius-scan` | 04:00 UTC J+1 |
| `0 5 * * *` | `/api/cron/retail-process-queue` | 05:00 UTC J+1 |
| `0 6 * * *` | `/api/cron/watcher-v2` | 06:00 UTC J+1 |
| `30 6 * * *` | `/api/cron/watcher-bridge` | 06:30 UTC J+1 |
| `0 7 * * *` | `/api/cron/intel-rss`, `/api/cron/shill-shadow` | 07:00 UTC J+1 |
| `30 7 * * *` | `/api/cron/intel-summarize` | 07:30 UTC J+1 |
| `0 8 * * *` | `/api/cron/watch-alerts`, `/api/cron/watch-rescan` | 08:00 UTC J+1 |
| `0 9 * * *` | `/api/cron/mm-batch-scan` | 09:00 UTC J+1 |
| `0 8 * * 1` | `/api/cron/weekly-digest`, `/api/intelligence/ingest/amf` | lundi 08:00 UTC |

> `vercel.json` déclare 18 crons et le plan de contrôle en enregistre 18, tous rattachés au
> canonique `dpl_G5ZUd253utxE8Sfo7Wfn9KgvYhhm`, `crons.enabledAt = 2026-03-07T17:18:43Z`,
> `disabledAt = null`, `updatedAt = 2026-09-15T14:28:50Z` (la promotion du canonique d'aujourd'hui).
> La note de mémoire « 15 crons déclarés » est périmée : **18**.

### ⚠️ CE QUE LE PLAN DE CONTRÔLE RÉVÈLE, ET QUE LA RECONNAISSANCE NE POUVAIT PAS DIRE

`crons.definitions[].host` vaut, pour les 18 :

```
interligens-9u9u343yk-davidpandoraparis-2892s-projects.vercel.app
```

Ce n'est **ni** `app.interligens.com`, **ni** `interligens-app.vercel.app`. C'est **l'URL générée
du déploiement de production** — précisément et nommément la surface que Standard Protection
restreint :

> « When you enable Standard Protection, the production **generated deployment URL** becomes
> restricted. » — *docs/deployment-protection*

Croisé avec la page *Cron Jobs* — « Vercel makes an HTTP GET request to your project's
**production deployment URL** » — l'inconnu signalé par T2 n'est plus un inconnu vague : **la
cible du cron est exactement la classe d'URL que la portée retenue protège.** Aucune des deux
pages ne dit que les invocations de cron sont exemptées ; aucune ne dit qu'elles ne le sont pas.
Le risque reste un inconnu, mais il est désormais **cadré et nommé**, et il n'est pas faible.

**Deux mécanismes documentés qui gouvernent l'étape 5 — à lire avant d'interpréter quoi que ce soit :**

1. **« Cron jobs do not follow redirects. When a cron-triggered endpoint returns a 3xx redirect
   status code, the job completes without further requests. »**
   Or Vercel Authentication répond à un appelant anonyme par une redirection vers
   `vercel.com/sso-api`. Si l'invocation n'est pas exemptée, **le cron ne s'exécute pas** — il ne
   plante pas, il se termine sur la redirection. C'est le mécanisme de défaillance attendu.

2. **« Note that when cron jobs respond with a redirect or a cached response, they will not be
   shown in the logs. »**
   ⚠️ **Un cron cassé par la protection ne produit AUCUNE ligne de journal.** À l'étape 5,
   *l'absence de trace est un FAIL, pas une mesure non concluante.* Ne pas lire le silence comme
   un succès. C'est le piège central de cette observation.

À quoi s'ajoute, hors protection : « Cron job delivery is best effort… occasional transient
network errors can prevent a request from reaching your function. In those cases, your function
does not execute, and **no runtime log is created** for that scheduled run. » Un unique silence
est donc ambigu entre *protection* et *aléa de livraison* — **ce qui le tranche est la
répétition** : deux, puis trois passages horaires silencieux d'affilée ne sont plus un aléa.
C'est un argument de plus pour un cron horaire plutôt que quotidien.

---

## 1.1 LE PASSAGE DE RÉFÉRENCE — le « avant », CONSTATÉ

**Huit passages horaires consécutifs, tous HTTP 200, sous `ssoProtection: null`.**
Lus le 2026-09-15 à 16:05 UTC, sans émettre aucune requête vers un runtime :

```
vercel logs --environment production --no-branch --no-follow --since 8h \
            --query "requestPath:/api/cron/shill-feed"
```

| Occurrence (UTC) | Statut | Hôte invoqué |
|---|---|---|
| **2026-09-15 16:00:35** | **200** | `interligens-9u9u343yk-…` ← canonique actuel |
| 2026-09-15 15:00:35 | 200 | `interligens-9u9u343yk-…` |
| 2026-09-15 14:00:35 | 200 | `interligens-668bg3zus-…` |
| 2026-09-15 13:00:35 | 200 | `interligens-668bg3zus-…` |
| 2026-09-15 12:00:35 | 200 | `interligens-668bg3zus-…` |
| 2026-09-15 11:00:35 | 200 | `interligens-668bg3zus-…` |
| 2026-09-15 10:00:35 | 200 | `interligens-668bg3zus-…` |
| 2026-09-15 09:00:35 | 200 | `interligens-668bg3zus-…` |

**Le cron N = 16:00:35 UTC, HTTP 200.** C'est le point de comparaison de l'A/B. Il est daté de
quelques minutes avant la rédaction de cette ligne, sur le déploiement canonique actuel, dans
l'état `ssoProtection: null` relevé au §3. La condition posée par l'architecte — « constate un
passage RÉUSSI récent, sous `ssoProtection: null` » — est remplie.

**Trois faits que cette série donne en plus :**

1. **L'invocation tombe à `:00:35`**, pas à `:00:00`. La fenêtre d'observation de l'étape 5 doit
   donc s'ouvrir jusqu'à `:01:30` au moins avant de conclure au silence.
2. **La bascule d'hôte à 15:00 UTC** (`668bg3zus` → `9u9u343yk`) suit exactement la promotion du
   canonique (14:27:14) et la mise à jour du registre des crons (14:28:50). Cela **confirme par
   l'observation** ce que `crons.definitions[].host` annonçait : les crons suivent l'URL générée
   du canonique **du moment**.
3. **Corollaire qui borne le risque** : les 91 déploiements historiques **ne sont la cible
   d'aucun cron**. Neutraliser les 91 ne peut pas casser les crons *par les 91*. Le seul chemin
   par lequel la protection peut les casser est le **collatéral assumé** — la restriction de
   l'URL générée du canonique. C'est le risque unique, et il est nommé.

### ⚠️ L'INSTRUMENT — et le piège dans lequel il ne faut pas tomber

`/api/cron/shill-feed` n'émet **aucun `console.*`** (vérifié : 0 occurrence dans la route,
0 dans `forwardBridge.ts`, 0 dans `prodWriteGuard.ts`). Une capture du **flux de lignes de
journal** est donc **structurellement aveugle** à cette route : elle ne verra rien même quand le
cron réussit. Mesuré ici en vif — une capture continue de 15:58:32 à 16:03:23 UTC, qui a bien
rendu d'autres lignes pendant la fenêtre, n'a rien montré du passage de 16:00:35 qui avait
pourtant lieu et renvoyait 200.

**L'instrument correct est la ligne de requête, pas la ligne de journal.** Les journaux
d'exécution sont « grouped as per request » et portent une ligne par invocation avec son code de
statut, indépendamment de toute sortie applicative. C'est ce que rend `vercel logs --query
"requestPath:…"`, et c'est ce que montre l'écran *Logs* du tableau de bord (filtre
`requestType: cron`).

Ce choix d'instrument est ce qui rend l'A/B possible, et il faut voir pourquoi :

- **avant** = une ligne de requête `200` à `HH:00:35` ;
- **après, PASS** = la même ligne `200` ;
- **après, FAIL** = **aucune ligne du tout** — car « when cron jobs respond with a redirect […]
  they will not be shown in the logs ».

Le FAIL se lit donc comme la **disparition d'une ligne qui existait**, pas comme l'apparition
d'une erreur. C'est lisible **uniquement** parce que le « avant » a été établi comme une ligne
`200` présente et régulière. Sans les huit lignes ci-dessus, l'observation d'après ne vaudrait
rien — ce qui est exactement ce que l'architecte avait posé.

> Note de rétention : plan **Pro ⇒ 1 jour** de journaux d'exécution. La série ci-dessus est
> conservée jusqu'au 2026-09-16 ~16:00 UTC. Au-delà, elle n'est plus rejouable — d'où son report
> intégral ici.

### FENÊTRE D'OBSERVATION DE L'ÉTAPE 5

Première occurrence après activation : **le premier `HH:00:35 UTC` qui suit le Save du fondateur.**
Si le Save a lieu avant 17:00 UTC, c'est **17:00:35 UTC** (19:00:35 CEST).

```
vercel logs --environment production --no-branch --no-follow --since 2h \
            --query "requestPath:/api/cron/shill-feed"
```

| Lecture | Verdict |
|---|---|
| ligne `200` à `HH:00:35` | **PASS** → `HISTORICAL_DEPLOYMENT_PUBLIC_REACHABILITY = CLOSED` |
| **aucune ligne** à `HH:00:35` | **FAIL présumé** — cause attribuable à Vercel Authentication (redirection non suivie). Rendre le constat et s'arrêter |
| ligne avec un statut `3xx` | **FAIL** — la redirection est visible, cause directement attribuable |
| ligne `401`/`500` | **hors sujet** — défaillance applicative, pas la protection. Ne pas imputer à l'activation |

⚠️ Un **unique** silence reste ambigu : la livraison des crons est « best effort » et un aléa
réseau produit lui aussi une absence de ligne. **Ce qui tranche est la répétition** — deux, puis
trois `:00:35` silencieux d'affilée ne sont plus un aléa. C'est la raison décisive d'avoir retenu
un cron horaire : le doute se lève en une heure, pas en un jour.

---

## 2. PROCÉDURE D'ACTIVATION — POUR LE FONDATEUR, DANS L'INTERFACE

> **Aucun agent n'exécute ce geste.** Il est fait par le fondateur, à l'écran, et par lui seul.

### Avant de cliquer — les trois interdits

1. **Ne pas utiliser la CLI.** `vercel project protection enable interligens-app --sso`
   **ne nomme aucune portée**. Une activation muette peut retomber sur *All Deployments* et
   **éteindre `app.interligens.com`**. La CLI est interdite pour ce geste — non parce qu'elle est
   dangereuse en soi, mais parce qu'elle ne permet pas de **voir** la portée avant de valider.
2. **Ne pas ouvrir `Settings → Security` (*Build Logs and Source Protection*).** Voisin du bon
   écran, rétroactivité **opposée** : « None of your existing deployments will be affected when
   you toggle this setting… the only option is to delete these deployments. » Sa page pousse vers
   la suppression. Ce n'est pas le bon écran et il n'a rien à y faire.
3. **N'activer aucune voie de contournement** sur la page : ni *Protection Bypass for Automation*,
   ni *Shareable Links*, ni *Deployment Protection Exceptions*, ni *OPTIONS Allowlist*. Chacune
   rouvrirait globalement ce que le geste vient de fermer.

### Le geste — écran par écran

| # | Où | Ce qu'il fait | Ce qu'il doit VOIR |
|---|---|---|---|
| 1 | `vercel.com` → équipe `davidpandoraparis-2892` → projet **`interligens-app`** | ouvrir le projet | le bandeau du projet indique `app.interligens.com` |
| 2 | **Settings** (barre latérale) → **Deployment Protection** | ouvrir l'écran | le titre de la page est bien **Deployment Protection**, **pas** *Security* |
| 3 | Section **Vercel Authentication** | basculer sur activé | la section porte **Vercel Authentication** — pas *Password Protection* (20 $/mois, inutile ici) |
| 4 | Sélecteur de portée, dans cette même section | choisir **Standard Protection** | l'écran décrit la portée comme protégeant tous les déploiements **sauf les domaines de production** (« Protects all deployments **except** production domains ») |
| 5 | **Save** | valider | — |

### À quoi il reconnaît qu'il s'est trompé

| Signe à l'écran | Ce que c'est | Conduite |
|---|---|---|
| La portée dit « **All** URLs, including your production domain » ou nomme `app.interligens.com` | **All Deployments** — cela éteint le site | **ne pas Save.** Repasser sur *Standard Protection* |
| La page parle de **source code** ou de **build logs**, ou mentionne « delete these deployments » | mauvais écran (*Security*) | quitter sans rien toucher |
| Un prix apparaît (**20 $/mois**) | **Password Protection**, pas Vercel Authentication | revenir sur *Vercel Authentication* |
| Un **secret** est proposé à la génération | *Protection Bypass for Automation* | **ne pas générer.** Ce serait une route autour de la frontière |
| La portée dit « **Legacy** » | portées héritées — *(Legacy) Standard* laisse les URLs de production à jour non protégées, *(Legacy) Pre-Production* ne protège pas les productions passées : **ni l'une ni l'autre ne couvre les 91** | choisir la **Standard Protection** non-legacy |

### Après Save — ce qu'il dit, et rien d'autre

Qu'il confirme simplement : **« activé, portée Standard Protection »**. L'agent reprend à
l'étape 3 et mesure. Le fondateur n'a rien à vérifier lui-même.

---

## 3. ÉTAT DE DÉPART, RELEVÉ AVANT TOUTE ACTION

Lu sur le plan de contrôle le 2026-09-15, sans émettre une seule requête vers un runtime :

```
ssoProtection        : null          ← aucune protection active
passwordProtection   : null
trustedIps           : null
protectionBypass     : {}            ← aucune voie de contournement armée
```

Et, dans les 96 variables d'environnement Production, `VERCEL_AUTOMATION_BYPASS_SECRET` est
**ABSENTE** — la confirmation, côté projet et non plus côté inventaire de poste, qu'aucun bypass
n'existe. `CRON_SECRET` est **présente** (nom seul ; aucune valeur lue).

**Les deux domaines de production du projet**, tous deux vérifiés :

- `app.interligens.com`
- `interligens-app.vercel.app`

Les deux sont des **domaines de production**, donc **exclus** de Standard Protection. Cela lève
au passage la réserve de non-régression n°2 de T2 : le repli
`src/app/en/kol/[handle]/class-action/page.tsx:22` vise `https://interligens-app.vercel.app`,
qui est un domaine de production et restera joignable. `NEXT_PUBLIC_APP_URL` est de toute façon
présente en Production.

Ce que cela n'établit pas : que ces deux domaines restent joignables **en pratique** après le
geste. Cela reste à mesurer — c'est le témoin n°4 (et un témoin n°4-bis désormais disponible).

---

## 4. TÉMOINS RETENUS POUR L'ÉTAPE 3

Inventaire refait indépendamment de T2, par pagination complète de
`GET /v6/deployments?target=production` : **92 déploiements Production, 92 READY**. Concordant.

| # | Témoin | Créé (UTC) | Rôle |
|---|---|---|---|
| 1 | `interligens-668bg3zus-…` | 2026-09-14 13:56:58 | la veille — **le seul à disposer d'un « avant » mesuré** |
| 2 | `interligens-n9ujur82j-…` | 2026-05-19 10:12:52 | **le plus ancien** de l'ensemble |
| 3 | `interligens-mn2lqsqy4-…` | 2026-07-07 | **point médian** (retenu de T2 ; le médian par rang de l'inventaire refait tombe sur `qkbhwsrkj`, 2026-08-27 — l'un ou l'autre convient, on garde celui de T2 pour la continuité du dossier) |
| 4 | `https://app.interligens.com` | — | **contrôle négatif** — sans lui, « tout est coupé » ne se distingue pas de « le site est tombé » |
| 5 | `interligens-9u9u343yk-…` | 2026-09-15 14:27:14 | **URL générée du canonique** — collatéral assumé, attendu protégé |

Forme : **`GET` anonyme, aucun en-tête d'authentification, aucun cookie.** Discriminant établi en
CC-OFFLINE-218 : sur `/api/admin/…`, un **401 portant `WWW-Authenticate: Basic realm="INTERLIGENS
Admin"`** signifie que *notre* proxy a répondu — donc que la périphérie fournisseur n'a pas
intercepté. C'est exactement ce qu'on ne veut plus voir.

Aucun ancien credential n'est envoyé : la protection s'exécutant avant le code applicatif, un
jeton n'ajouterait aucune information et rejouerait une exposition.

---

## 5. CONDUITE EN CAS DE FAIL — déjà tranchée, non improvisée

1. Rollback à `ssoProtection: null` — un geste, immédiat, même écran.
2. Vérifier que le cron retrouve son fonctionnement **au passage suivant** (`HH:00:35 UTC`), par
   la même requête de journaux. Un déclenchement manuel ne prouverait rien.
3. **STOP** sur la neutralisation des 91, et retour à l'architecte avec la preuve du mécanisme
   de défaillance.

⛔ **Aucun bypass, sous aucune forme.** Ni *Protection Bypass for Automation*, ni *Shareable
Links*, ni *Exceptions*, ni *OPTIONS Allowlist*. « Un bypass global réintroduirait précisément
une route autour de la frontière que nous essayons d'établir. » Si les crons tombent, on ne les
répare pas en rouvrant.

---

## 6. CE QUE L'ÉTAPE 1 N'ÉTABLIT PAS

- **Elle n'établit pas que la protection cassera les crons, ni qu'elle ne les cassera pas.**
  Elle établit que la cible du cron est nommément la classe d'URL que la portée restreint, et que
  les deux pages de documentation sont muettes sur l'exemption. L'inconnu reste un inconnu ; il
  est seulement cadré. **Rien ici ne doit être lu comme une prédiction du résultat de l'A/B.**
- **Elle n'établit rien sur les 17 autres crons individuellement.** Elle établit qu'ils empruntent
  le même mécanisme et le même hôte, ce qui rend `shill-feed` représentatif — pas que chacun
  passera. Un cron qui échouerait pour une cause applicative propre ne serait pas imputable à
  l'activation.
- **Elle n'établit pas la joignabilité actuelle des 91 par la mesure directe.** Elle la tient de
  `ssoProtection: null` sur le plan de contrôle, comme T2, sans émettre une requête vers un
  runtime — c'est un fait de configuration, pas un témoin de réponse.
- **Elle n'établit pas que `app.interligens.com` et `interligens-app.vercel.app` resteront
  joignables après le geste.** Elle établit qu'ils sont enregistrés comme domaines de production
  et donc, par définition de la portée, exclus. La mesure reste à faire : c'est le témoin n°4.
- **Elle n'établit rien sur les quatre voies de contournement.** `protectionBypass` est vide et
  `VERCEL_AUTOMATION_BYPASS_SECRET` est absente des variables Production — les deux autres voies
  (*Shareable Links*, *Deployment Protection Exceptions*) ne sont toujours **pas mesurées** ;
  elles se lisent à l'écran au moment d'agir.
- **Elle ne dit rien de l'exposition des octets du `.env`** au-delà de ce que T2 a porté au
  dossier : l'appartenance des 91 à l'ensemble des porteurs reste une **inférence d'ascendance de
  commit**, pas une lecture du manifeste de chacun.
- **Elle ne clôt rien.** `HISTORICAL_DEPLOYMENT_PUBLIC_REACHABILITY` reste **OUVERT** jusqu'à
  l'activation par le fondateur, les cinq témoins, l'inventaire 92/92 et le cron N+1.
