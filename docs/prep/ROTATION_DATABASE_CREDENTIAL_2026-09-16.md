# BASE DE PRODUCTION — FERMETURE DU CREDENTIAL COMPROMIS À L'AUTORITÉ NEON

**2026-09-16 · CC-OFFLINE-228 · dernière fenêtre sécurité · coupure assumée et mesurée**

Le mot de passe Neon de production était vivant simultanément sur le poste et en Vercel Production,
et présent dans des octets de déploiement retenus. Il ne l'est plus.

```
DATABASE COMPROMISED CREDENTIAL = CLOSED_AT_NEON_AUTHORITY
ENSEMBLE FERMÉ = { DATABASE_URL } · identité ep-square-band-ag2lxpz8
SECONDE IDENTITÉ ep-bold-sky-aluqhpj7 = HORS PÉRIMÈTRE, NOT_ESTABLISHED, BACKLOG
```

**La famille DB n'est pas fermée.** Une seule identité l'est.

---

## 1. LE PÉRIMÈTRE A ÉTÉ RÉDUIT PAR UNE MESURE, PAS PAR UNE HYPOTHÈSE

Huit variables de Production portent un mot de passe de base. T2 les a comparées par identité
d'hôte et de mot de passe — **CAS B** :

| Variable | Hôte | Même mot de passe que `DATABASE_URL` |
|---|---|---|
| `DATABASE_URL` | `ep-square-band-ag2lxpz8` | *(référence)* |
| `DATABASE_URL_UNPOOLED` | `ep-bold-sky-aluqhpj7` | **NO MATCH** |
| `POSTGRES_URL` | `ep-bold-sky-aluqhpj7` | NO |
| `POSTGRES_PRISMA_URL` | `ep-bold-sky-aluqhpj7` | NO |
| `POSTGRES_URL_NON_POOLING` | `ep-bold-sky-aluqhpj7` | NO |
| `POSTGRES_URL_NO_SSL` | `ep-bold-sky-aluqhpj7` | NO |
| `POSTGRES_PASSWORD` | — | NO |
| `PGPASSWORD` | — | NO |

**Deux identités distinctes en Production.** Le reset de `ep-square-band` ferme `DATABASE_URL` et
rien d'autre. Quatre des sept autres sont lues à chaque requête des 18 routes cron, mais uniquement
pour **dériver un hôte** via `resolveTargetProdDbHost(env)` : aucune n'ouvre de connexion.

```
ENSEMBLE DES VARIABLES PRODUCTION PORTANT L'IDENTITÉ COMPROMISE = { DATABASE_URL }
```

Sans cette mesure, la fenêtre aurait traité huit variables et touché une identité **non compromise**.
La seconde identité est classée `NOT_ESTABLISHED` et reste au backlog : ne pas élargir.

---

## 2. L'INSTRUMENT, ET LA DISTINCTION QUI LE FAIT TENIR

`scripts/rotation/sonde-db-auth.mjs`, fichier **neuf**. Les trois sondes du dépôt sont HTTP et aucune
ne parle à une base ; aucune n'est mutée — la règle qui les a préservées quatre fois depuis le 15/09.

Objet unique : établir si une paire (identité, mot de passe) est **ACCEPTED** ou **REFUSED** par
l'autorité Neon. Une requête bornée, `SELECT 1`, pilote `pg`, connexion fermée explicitement,
délai 10 s. Aucune lecture de table, aucune écriture, aucune transaction, aucune inspection de schéma.

> **`REFUSED` n'est rendu que sur un SQLSTATE de classe 28** — un refus d'authentification prononcé
> par le serveur lui-même. Délai, DNS, TLS, transport, base inexistante : **INCONCLUSIVE**. Sans cette
> distinction, débrancher le Wi-Fi « prouverait » qu'un credential est révoqué. C'est la règle HTTP
> des fenêtres précédentes — *un refus d'intermédiaire n'est pas une mesure* — transposée au
> protocole de base.

Le message du pilote n'est **jamais lu** : il porte couramment l'hôte, l'utilisateur, parfois la
chaîne de connexion entière. Ne sortent que le SQLSTATE ou le code système. Crible anti-fuite avant
impression. Le marqueur d'hôte de production est **extrait** de `prodWriteGuard.ts` et jamais recopié.

**Huit chemins fail-closed exercés** sur valeurs factices : `SONDE_ATTENDU` absent · aucune source ·
deux sources · fichier vide · entrée non analysable · URL sans mot de passe · **hôte hors périmètre
(`ep-bold-sky`)** · Trousseau inexistant. Les huit refusent de partir. L'élargissement à la seconde
identité est donc fermé **par construction**, pas seulement par consigne.

### Le canari

Chaque passe commence par la **même URL dont le seul mot de passe est remplacé par un aléa de 32
octets généré en mémoire**. Il doit être `REFUSED`. Sans lui, un refus ne se distingue pas d'une
autorité en panne, et une acceptation ne prouve pas que l'instrument sait échouer. Il est passé
`REFUSED · 28P01` dans **chacune** des quatre passes de cette fenêtre.

---

## 3. LA CAPTURE — DEUX ÉCHECS SILENCIEUX AVANT LE BON

Une capture de l'ancienne valeur **devait** exister avant le reset : après, il est définitivement
trop tard, et « OLD → REFUSED » deviendrait indémontrable. C'est pourquoi la vérification a été
placée avant le geste irréversible — et elle a servi.

**Premier échec — 2 octets pour 144.** L'entrée du Trousseau ne contenait pas une URL tronquée ou
encadrée de guillemets : elle ne contenait presque rien. Cause :

```
security add-generic-password ... -w -U      ← FAUX
```

`-w` **consomme l'argument suivant** comme valeur du mot de passe : la chaîne littérale `-U` a été
stockée. Deux octets, exactement l'écart mesuré. L'aide de `security` l'énonce : *« Specify -w as the
last option to be prompted. »* Forme correcte :

```
security add-generic-password -a "$USER" -s <service> -U -w      ← -U AVANT -w, -w EN DERNIER
```

**Second échec — 128 octets pour 144.** Ordre corrigé, l'écriture aboutit mais **tronque**. Cause non
investiguée : la fenêtre n'a pas été bloquée sur un détail de transport.

**Bascule fichier — MATCH du premier coup.** Écriture directe en `0600`, relecture, comparaison octet
à octet : 144/144.

> **Le Trousseau est le transport PRÉFÉRÉ, jamais le transport OBLIGATOIRE.** Il évite de matérialiser
> un secret en clair sur le disque — c'est une vraie qualité —, mais il ne vaut pas de retarder une
> rotation. Le fichier est supprimé à la clôture de la fenêtre, comme `~/.interligens-abp` l'a été.

Et la leçon qui vaut au-delà de ce cas : **une capture non vérifiée ne vaut rien.** Les deux écritures
dégénérées ont réussi du point de vue du shell — code de sortie 0, aucune erreur. Seule la relecture
octet à octet les a démasquées. L'outil de capture relit désormais systématiquement ce qu'il écrit,
**dans les deux sens** : il a servi pour l'ancienne valeur comme pour la nouvelle.

Note : une entrée de Trousseau dégénérée a été **supprimée** plutôt que laissée en place. Un faux
témoin qui traîne est pire que pas de témoin.

---

## 4. LIGNE DE BASE, PUIS PREUVE — MÊME INSTRUMENT, SEULE L'AUTORITÉ A CHANGÉ

| Passe | Canari | Sous test |
|---|---|---|
| **Ligne de base** `08:13 UTC` · `.env.local` | REFUSED · 28P01 | **ACCEPTED** |
| **Capture vérifiée** `08:25 UTC` · `~/.interligens-db-url-ancien` | REFUSED · 28P01 | **ACCEPTED** |
| **Preuve** `08:35 UTC` · `~/.interligens-db-url-nouveau` | REFUSED · 28P01 | **ACCEPTED** |
| **Preuve** `08:35 UTC` · `~/.interligens-db-url-ancien` | REFUSED · 28P01 | **REFUSED · 28P01** |

**L'ancienne identité passe de `ACCEPTED` à `REFUSED`, sur le même instrument, la seule chose ayant
changé étant l'autorité Neon.** C'est la comparaison qui démontre, pas la seconde mesure isolée.

Les deux captures faisaient **144 octets chacune**. Cette égalité de longueur ne tranchait rien — elle
était compatible avec « Neon génère des longueurs fixes » comme avec « l'édition n'a pas été
enregistrée et la seconde capture a relu l'ancienne ». **La sonde a tranché ce que la longueur ne
pouvait pas dire.**

---

## 5. LA COUPURE — ASSUMÉE, BORNÉE, MESURÉE

Contrairement aux fenêtres `CRON_SECRET` et `ADMIN_BASIC_PASS`, **il n'existait ici aucun geste
indivisible.** Un reset Neon invalide l'ancien mot de passe **immédiatement, du côté de l'autorité** —
avant toute écriture Vercel, avant tout déploiement. Le runtime servi porte alors une URL morte. La
coupure n'est pas un effet de bord évitable : elle est la forme même d'une rotation de credential de
base.

```
~08:25:48 UTC   l'ancienne identité est encore ACCEPTED — le reset lui est postérieur
~08:33    UTC   reset du mot de passe, console Neon, rôle neondb_owner, branche production
 08:35    UTC   sonde : nouvelle ACCEPTED, ancienne REFUSED 28P01
 08:36    UTC   écriture de configuration Vercel
 08:37:20 UTC   déploiement gouverné créé
 08:38:27 UTC   déploiement READY
 08:41:28 UTC   GET /api/health → 200 · db:"ok" · version 38a57a1
```

**Aucun passage cron n'est tombé dans la coupure** : le précédent était à 08:00:35, le suivant à
09:00:35. Durée effective de l'ordre de huit minutes, dont une pour le déploiement lui-même.

---

## 6. LE DÉPLOIEMENT GOUVERNÉ

| | |
|---|---|
| `deploymentId` | `dpl_EzE3MgcT9ZZzv2Re1reFtRWGkh9j` |
| `commit` | `38a57a1d247c4ddfd9b1bb9edc3419f3156121f9` (`main`) |
| `source` | **`cli`** |
| `readyState` | `READY` · `target: production` |

```
racine certifiée ≡ racine réelle  84c5f258854fcb545d90ce5e2b30e922abab0bb9f8a586b03889ffd8161987aa
delta ⊆ { public/.well-known/source-set.json }
fichiers .env* téléversés : AUCUN
```

`meta.gitDirty = 1` porte sur les fichiers **non suivis** du répertoire — ce n'est pas un fait
d'upload-set, la porte 4 ayant établi `upload-set ≡ HEAD filtré`. Relevé, pas un arrêt.

### Le témoin de santé, et pourquoi c'est une mesure et non une inférence

`GET /api/health` : `checkDb()` exécute `prisma.$queryRaw\`SELECT 1\`` via `src/lib/prisma.ts` — l'une
des quatre voies de consommation mesurées par T2 — et `ok = (db === "ok")` **seul** décide du statut.
Le 200 *est* un verdict de base. `dynamic = "force-dynamic"` et `Cache-Control: no-store` interdisent
qu'un 200 périmé se fasse passer pour vivant. Le `version` rendu est le sha du commit servi, ce qui
**attache la santé à CE runtime** et pas à un précédent.

Un runtime portant encore l'ancienne URL rendrait `db:"fail"` et 503 — l'ancienne identité est refusée
par Neon depuis 08:35. Le `db:"ok"` sur le sha `38a57a1` établit donc que l'instantané d'environnement
servi porte une URL vivante, et la seule URL vivante est la nouvelle.

Limite tenue droite : la route **avale** l'erreur (`catch { return "fail" }`). `db:"fail"` ne
distinguerait pas un refus d'authentification d'une panne réseau. Elle est le témoin de **santé**,
jamais l'instrument de **révocation** — celui-ci reste la sonde, sur SQLSTATE 28. Deux instruments,
deux rôles.

---

## 7. NON-RÉGRESSION — LE CRON DE RÉFÉRENCE

Vocabulaire de preuve : la **ligne de requête**, jamais la ligne de journal applicative —
`/api/cron/shill-feed` n'émet aucun `console.*`.

Passage de `09:00:35 UTC`, premier après le déploiement : **VERIFIED_HEALTHY**.

```
09:00:35.48  interligens-3v28w63mi-…vercel.app   GET /api/cron/shill-feed   200
```

L'hôte est l'URL générée du nouveau canonical. Ce témoin dit **plus** que `/api/health` : `shill-feed`
lit `social_post_candidates`, joint `ShillEvent` et **écrit** par `createMany` — il exerce donc la
nouvelle identité en lecture *et* en écriture, par le chemin Prisma de production, et non par un
`SELECT 1`. Les 18 crons empruntent le même mécanisme et la même variable ; ce passage vaut pour eux
sans que chacun ait été mesuré.

---

## 8. CE QUE CETTE FENÊTRE N'ÉTABLIT PAS

1. **Rien sur la seconde identité `ep-bold-sky-aluqhpj7`.** Sept variables la portent ; ce reset ne
   l'a pas touchée. `NOT_ESTABLISHED`, hors périmètre, **BACKLOG**.
2. **Rien sur les 91 runtimes Production historiques.** Ils portent leurs propres octets ; hors
   fenêtre. Ils ne peuvent toutefois plus ouvrir la base avec l'identité fermée ici — c'est une
   conséquence de la fermeture **à l'autorité**, pas une mesure faite sur eux.
3. **Rien sur le passé.** Elle ne dit pas si l'ancienne paire a été utilisée entre l'exposition et
   maintenant. Cela se lit dans des journaux d'accès, pas dans un SQLSTATE.
4. **Rien sur la chronologie exacte à la minute** des écritures de configuration. Elle n'en a pas
   besoin : la mesure tranche là où la chronologie est floue (§6).
5. **Rien sur l'avenir.** Le verdict est daté.

---

## 9. CLASSÉ — consigné, non instruit

- **`VERCEL_CLI_VERSION_DIVERGENCE`** — `--no-sensitive` **n'existe pas** dans la CLI épinglée
  `51.7.0` ; il n'apparaît qu'en `59.x`. L'écriture de configuration passe donc par `npx`, qui a
  résolu `59.19.0` — comme pour `CRON_SECRET` et `ADMIN_BASIC_PASS`. **Le chemin gouverné de
  déploiement reste inchangé** et exécute le binaire certifié `51.7.0`, mesuré en appelant
  `resolveDeployCommand()`. La divergence est structurelle — préserver le type `Config` exige un
  drapeau que la version épinglée ignore — et elle reste confinée aux écritures de configuration.
  **BACKLOG P1.**
- Troncature du Trousseau à 128 octets (§3), cause non investiguée. **BACKLOG.**
- `SONDE_ADMIN_BASIC_NO_BASELINE_MODE`, `DEPLOY_COMMAND_DOCUMENTATION_DRIFT`,
  `ENV_VARIABLE_TYPE_POSTURE`, `DB_CREDENTIAL_FAMILY_WIDER_THAN_TWO` — périmètre inchangé.

---

## 10. FIN DE L'INCIDENT CREDENTIAL CANONICAL

Trois fenêtres, trois credentials, trois fermetures **bornées au runtime ou à l'autorité mesurés** :

```
ADMIN_BASIC_PASS                = CLOSED_ON_CANONICAL_SERVED_RUNTIME   (15/09)
CRON_SECRET                     = CLOSED_ON_CANONICAL_SERVED_RUNTIME   (16/09)
                                  ALL HELD PRE-ROTATION CANDIDATES REFUSED
DATABASE COMPROMISED CREDENTIAL = CLOSED_AT_NEON_AUTHORITY             (16/09)
                                  { DATABASE_URL } · ep-square-band-ag2lxpz8

91 HISTORICAL PRODUCTION RUNTIMES = KNOWN P0 RESIDUAL / OPEN / DOCUMENTED
```

Aucune de ces trois formulations ne dit « fermé ». Chacune porte sa borne, et la borne fait partie du
verdict.
