# ROTATION CRON_SECRET — FENÊTRE BORNÉE, ET LE FAIT QU'ELLE A ÉTABLI

**2026-09-15 · CC-OFFLINE-222 · fenêtre close · AUCUN DÉPLOIEMENT**

Fenêtre ouverte sur un seul credential — `CRON_SECRET` — et refermée sur un état qui n'est pas
celui qu'on venait chercher. Elle n'a **rien fermé**. Elle a **mesuré** une chose que le dossier
tenait jusqu'ici d'un précédent emprunté, et qui gouverne les trois rotations qui suivent.

Ce qui a été fait : deux poses à l'autorité de configuration Vercel Production (la nouvelle valeur,
puis l'ancienne reposée), trois sondes vers le runtime canonique servi, une lecture d'environnement
Preview en bac temporaire. Ce qui n'a **pas** été fait : aucun déploiement, aucun scheduler touché,
`vercel.json` intact, aucun handler modifié, aucune DDL, aucune valeur de secret affichée,
journalisée ou écrite, aucun fichier à la racine du dépôt.

---

## 1. LE FAIT CENTRAL

> **LE RUNTIME CANONIQUE SERVI NE CONSOMME PAS LA NOUVELLE CONFIGURATION SANS DÉPLOIEMENT.**

Mesuré sur ce projet, sur ce credential, à cet instant — plus déduit du précédent `ADMIN_TOKEN` du
matin. C'est l'acquis de la fenêtre, et c'est ce qui rend les trois rotations restantes planifiables :
poser une valeur dans Vercel ne révoque rien tant qu'un déploiement n'a pas repris l'instantané.

La distinction qui gouverne tout le dossier, et qu'aucune ligne ne doit fusionner :

| | |
|---|---|
| **AUTORITÉ DE CONFIGURATION** | ce que le panneau Vercel contient. Change en une seconde. |
| **AUTORITÉ SERVIE** | ce que le runtime accepte réellement. Ne change qu'au déploiement. |

« Valeur changée » ne vaut pas révocation. La fenêtre l'a vérifié dans le sens strict : la valeur a
changé, et **l'ancienne ouvrait toujours la porte**.

---

## 2. LES TROIS SONDES, DANS L'ORDRE, À LA MILLISECONDE

Horodatages relevés sur la **ligne de requête** (`vercel logs --query "requestPath:/api/cron/shill-feed"`),
convertis en UTC. Ce n'est pas la ligne de journal : `/api/cron/shill-feed` n'émet aucun `console.*`,
et une capture de flux y est structurellement aveugle (cf. `CRON_REFERENCE_P0_2026-09-15.md` §1.1).

| UTC | Événement | Hôte | Statut |
|---|---|---|---|
| `16:00:35.49` | cron de référence — passage N | `interligens-9u9u343yk-…` | **200** |
| `16:49:56.44` | sonde `--avant` [0] — aucune authentification | `app.interligens.com` | **401** |
| `16:49:56.86` | sonde `--avant` [1] — candidat A, `.env` | `app.interligens.com` | **401** |
| `16:49:57.06` | sonde `--avant` [2] — candidat B, `.env.local` | `app.interligens.com` | **200** — `created=0 alreadyPresent=4` |
| `17:00:35.51` | cron de référence — passage N+1, **avant la pose** | `interligens-9u9u343yk-…` | **200** |
| `~17:03` | **pose de la NOUVELLE valeur** — `env rm` + `env add` (stdin, Trousseau) | autorité de configuration | — |
| `17:05:12.43` | sonde `--apres` [1] — aucune authentification | `app.interligens.com` | **401** |
| `17:05:12.65` | sonde `--apres` [2] — **ANCIEN** `CRON_SECRET` | `app.interligens.com` | **200** — `created=0 alreadyPresent=4` |
| `17:05:13.59` | sonde `--apres` [3] — **NOUVEAU** `CRON_SECRET` | `app.interligens.com` | **401** |
| `~17:12` | **repose de l'ANCIENNE valeur** — décision de l'architecte | autorité de configuration | — |

La colonne « hôte » n'est pas décorative : les crons frappent l'**URL générée** du canonique, les
sondes frappent `app.interligens.com`. Les deux sont des alias de `dpl_G5ZUd253utxE8Sfo7Wfn9KgvYhhm`
— **même déploiement, donc même instantané d'environnement**. C'est ce qui autorise à lire la sonde
comme parlant de ce que le cron rencontre.

**Le passage de `18:00:35` n'a pas été observé.** La fenêtre a été close avant, l'architecte ayant
jugé la mesure acquise : « il n'y a aucune valeur RC à attendre volontairement le passage de
18:00:35 ». La configuration ayant été reposée à `~17:12`, elle est de nouveau égale à ce que le
runtime sert — la question que ce passage aurait tranchée (quel côté l'émetteur lit) reste **non
mesurée**, et elle n'est pas rouverte.

---

## 3. LA DISCRIMINATION `--avant`, ET POURQUOI ELLE ÉTAIT INDISPENSABLE

C'est la découverte de méthode de cette fenêtre, et elle vaut **au-delà de `CRON_SECRET`**.

Le plan initial disait : « ancien secret lu dans les octets exposés du `.env` → refus attendu ».
Mesuré avant d'y toucher : `.env` et `.env.local` portent deux valeurs **différentes**, et `.env` a
été modifié le jour même à 12:08 UTC. La cartographie l'avait déjà écrit — *« ce que l'instrument
appelle exposé est une borne inférieure »*.

Présenter la valeur du `.env` après rotation aurait donc rendu un 401… qu'on aurait inscrit comme
**« OLD REFUSED »**. Or ce 401 était déjà là **avant** toute rotation : `16:49:56.86`. Refuser une
valeur qui n'a jamais ouvert la porte ne démontre rien. La preuve aurait été **vide**, et elle aurait
eu exactement la forme d'une preuve pleine.

D'où la règle, à porter aux fenêtres suivantes :

> **Avant de roter, établir lequel des exemplaires détenus est celui que le runtime sert — par un
> contrôle positif, pas par provenance présumée.** Un exemplaire « réputé exposé » n'est pas un
> exemplaire vivant. Un seul candidat doit rendre 200 ; s'il n'y en a aucun, la valeur vivante n'est
> détenue nulle part et roter détruirait le dernier exemplaire, rendant la révocation **définitivement**
> indémontrable.

Résultat de la discrimination : **exactement un** candidat accepté. `LIVE_OLD_CRON_SECRET = .env.local`.
Capturé au Trousseau sous `interligens-cron-secret-prod-ancien` avant tout écrasement, valeur jamais
affichée — c'est cette capture qui a permis, à `17:12`, de reposer l'ancienne valeur en une minute.

---

## 4. TROIS CORRECTIONS D'INTERPRÉTATION, RATIFIÉES

Apportées au cadre avant exécution, contre le code réel du handler servi. Sans elles, la table de
lecture aurait produit un verdict faux.

| Ce que le cadre posait | Ce que le code dit | Conséquence |
|---|---|---|
| « un 500 signifierait que `CRON_SECRET` n'est pas configurée » | `route.ts:43-44` — `if (!secret) return false` ⇒ **401**. Le 500 de cette route vient de l'invariant snowflake ou de la base (`route.ts:151-159`) | vrai d'autres crons (`watch-alerts`, `watcher-v2`, `intelligence/ingest/[slug]`), **faux du témoin** |
| un 403 est un refus | `prodWriteGuardResponse` rend 403 **après** l'authentification (`route.ts:79-80`, garde `prodWriteGuard.ts:314`) | **un 403 est une ACCEPTATION**. Le lire comme un refus inverserait le verdict |
| le faux vert est un 500 | sur ce handler, un secret absent et un mauvais secret rendent le **même** 401 | **le faux vert, c'est LES DEUX JAMBES EN 401.** Seul le contrôle positif le tranche |

---

## 5. POURQUOI LA SIGNATURE OBTENUE EST PLUS FORTE QUE CELLE ATTENDUE

La signature prévue pour `SERVED_INVALIDATION_PENDING` était **les deux jambes en 401**. Elle aurait
laissé planer une alternative : *ou bien le runtime n'a pas la nouvelle valeur, ou bien
l'authentification est cassée.*

La signature obtenue est son image miroir — **ancien accepté (200), nouveau refusé (401)** — et elle
ne laisse aucune alternative. Une authentification cassée ne rend pas 200. Le runtime servi tient un
instantané, et cet instantané porte nommément l'ancienne valeur. Preuve **positive**, là où l'autre
n'aurait été qu'une preuve par absence.

---

## 6. CE QUE CETTE MESURE N'ÉTABLIT PAS

1. **La jambe [3] ne discrimine pas.** Un 401 sur la nouvelle valeur est compatible avec « l'instantané
   n'a pas la nouvelle valeur » **et** avec « la valeur posée diffère de celle du Trousseau ». C'est
   **[2] = 200** qui établit la divergence, seul. [3] ne la contredit pas ; il ne la démontre pas non plus.

2. **Rien sur le `CRON_SECRET` historiquement exposé.** Le 401 du `16:49:56.86` dit que la valeur
   présente **aujourd'hui** dans `.env` — fichier modifié à 12:08 UTC — est refusée par ce runtime.
   Il ne dit rien des octets réellement partis dans les déploiements retenus. **Borne inférieure.**

3. **Rien sur les 91 runtimes historiques de Production.** Ils ne sont la cible d'aucun cron et
   n'ont pas été sollicités. Ils restent ce qu'ils étaient.

4. **Rien sur le comportement de l'émetteur.** Quel côté le planificateur lit — configuration
   courante ou instantané — aurait été tranché par le passage de `18:00:35`. Il n'a pas été observé.

5. **Rien sur l'avenir.** Le verdict est daté. Une variable peut être reposée, un déploiement peut
   repartir d'un environnement différent.

---

## 7. ADMIN_TOKEN, CIBLE PREVIEW — MESURE BORNÉE, DU MÊME BLOC

Un candidat **critère C** avait été signalé à l'étape 1 : l'entrée `ADMIN_TOKEN` de cible Preview,
âgée de 31 jours, n'était pas couverte par la rotation Production du matin. Posé comme candidat,
**levé par la mesure**.

Méthode : celle de CC-OFFLINE-215, importée et non réécrite — `creerBac`/`effacerBac` (bac 0700 hors
dépôt, fichiers écrasés puis supprimés, nettoyage armé sur `SIGINT`/`SIGTERM`/`SIGHUP`/exception),
`nouveauNonce`/`empreinte` (HMAC-SHA256 salé par un nonce de session), `extraireOctets`/`indexer`,
`chercherFuite`. Le `vercel env pull --environment preview` s'est fait avec `--cwd` sur une **copie**
du lien de projet : le `.env.local` du dépôt n'a pas été touché — c'est le piège que `CLAUDE.md`
signale. Comparaison **octet à octet**, jamais de chaînes : c'est la comparaison de chaînes qui avait
produit le faux négatif de `DATABASE_URL_UNPOOLED`.

Trois exemplaires, trois valeurs distinctes. La cible Preview porte une **troisième** valeur : ni
l'ancienne credential exposée, ni celle du poste.

```
ADMIN_TOKEN_PREVIEW = CLOSED          (selon la portée mesurée)
PREVIEW CONFIG     != EXPOSED ADMIN_TOKEN
```

Portée exacte, et elle ne s'étend pas : **la CONFIGURATION Preview n'est pas la credential exposée.**
Aucun runtime Preview n'a été sollicité — l'arbre de décision court-circuite là, et la fenêtre
interdisait d'aller plus loin. `RUNTIME REACHABLE = NOT_ESTABLISHED`, `OLD ACCEPTED = NOT_TESTED`.

---

## 8. ÉTAT FINAL — LES LIGNES QUI NE SE FUSIONNENT PAS

```
CRON_SECRET = OPEN / ROTATION PREPARED / DEPLOYMENT REQUIRED FOR SERVED INVALIDATION

CRON_SECRET (servi)                = ancienne valeur, acceptée
CRON_SECRET (configuration)        = ancienne valeur, reposée — cohérente avec le servi
91 HISTORICAL PRODUCTION RUNTIMES  = KNOWN P0 RESIDUAL / OPEN / DOCUMENTED
ADMIN_TOKEN_CANONICAL              = CLOSED
ADMIN_TOKEN_PREVIEW                = CLOSED (configuration mesurée)
```

⛔ **`CRON_SECRET` n'est PAS `CLOSED`.** Rien n'a été révoqué. La nouvelle valeur est prête, conservée
au Trousseau sous `interligens-cron-secret-prod` pour la fenêtre suivante ; l'ancienne y est sous
`interligens-cron-secret-prod-ancien`.

La repose est prouvée par l'**autorité de configuration** — `vercel env ls production` montre l'entrée
mise à jour — et non par un test comportemental : l'architecte l'a explicitement écarté, « pas de
nouveau test comportemental inutile si l'autorité de configuration permet de prouver la repose sans
exposer la valeur ».

**Une seule autorité était nécessaire, et une seule a été touchée** : projet Vercel `interligens-app`,
cible **Production**. Mesuré : `CRON_SECRET` n'existe ni en Preview ni en Development ; aucun workflow
CI ne le présente ; aucun présentateur hors `/api/*`. Aucun tiers à prévenir, aucun scheduler externe.

---

## 9. BACKLOG — consigné, non instruit

- `src/lib/ops/prodWriteGuard.ts:6-9` décrit un scope Preview **périmé** : `CRON_SECRET` n'y est plus,
  seules `DATABASE_URL`/`_UNPOOLED` y subsistent. La raison d'être du garde est entière, sa
  justification écrite ne l'est plus. **BACKLOG.**
- Les déploiements Preview antérieurs à la pose d'il y a 31 jours portent leur **propre instantané**,
  non mesuré. **BACKLOG / KNOWN UNMEASURED** — ne se fond pas dans les 91, qui sont des runtimes
  Production.

---

## 10. INSTRUMENTS

Les deux sondes vivent **hors dépôt**, dans le bac de session : tout fichier écrit à la racine
entrerait dans l'ensemble expédié et ferait échouer la porte 4 du preflight. Elles n'impriment aucune
valeur, aucune empreinte de valeur, aucun en-tête brut, aucun corps de réponse — à la seule exception
de `created` et `alreadyPresent`, qui sont la preuve d'exécution. Un crible anti-fuite relit la sortie
complète avant affichage.

L'exécution métier a été dite plutôt que sous-entendue : la jambe refusée n'exécute rien, le refus
précède le handler ; la jambe acceptée **exécute réellement** `/api/cron/shill-feed`, écriture
comprise. Assumé, et seulement parce que la route est idempotente **par la base** — watermark dérivé
jamais stocké, recouvrement de 30 minutes délibéré, `@@unique(kolHandle, tweetId, tokenMint)` +
`skipDuplicates`. Les deux exécutions l'ont **constaté** plutôt que supposé : `created=0`,
`alreadyPresent=4` les deux fois. Aucune ligne nouvelle n'a été écrite par cette fenêtre.
