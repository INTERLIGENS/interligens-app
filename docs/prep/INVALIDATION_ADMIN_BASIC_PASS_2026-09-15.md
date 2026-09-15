# ADMIN_BASIC_PASS — INVALIDATION SERVIE SUR LE RUNTIME CANONIQUE

**2026-09-15 · CC-OFFLINE-224 · fenêtre close · déploiement gouverné exécuté**

`ADMIN_BASIC_PASS` n'avait **jamais** été roté : créé il y a 192 jours, matériellement présent dans
des octets de déploiement retenus. Critère C — credential compromise encore exploitable. Il est
consommé par `checkBasicAuth` dans `src/proxy.ts`, sur le **préfixe** `/api/admin` tout entier, comme
l'un des deux chemins d'acceptation :

```js
const ok = verifyAdminSession(req) || checkBasicAuth(req);
```

Sa compromission était donc celle d'un préfixe, pas d'une route.

**État final :**

```
ADMIN_BASIC_PASS = CLOSED_ON_CANONICAL_SERVED_RUNTIME
```

Pas « CLOSED ». Les 91 runtimes Production historiques continuent d'accepter l'ancienne valeur ; la
clôture est bornée au runtime canonique servi, et la formulation porte la borne.

---

## 1. LA DÉMONSTRATION EST UN COUPLE, PAS UNE MESURE

C'est le point de méthode de cette fenêtre, et il a été imposé avant le déploiement.

Après bascule, `OLD → REFUSED` **ne prouve rien seul**. Si le fichier portant l'ancienne valeur est
mal résolu — clé absente, fichier vide, mauvais chemin — la sonde rend `REFUSED` et l'on croit avoir
fermé alors qu'on n'a rien mesuré. Un harnais qui ne sait pas échouer ne mesure pas ; **un harnais
qui ne sait pas réussir ne mesure pas davantage.**

D'où une **ligne de base exécutée contre le runtime servi AVANT tout déploiement**, sur le même
instrument et les mêmes entrées. Elle établit que l'instrument sait rendre `ACCEPTED` sur la valeur
servie, et `REFUSED` sur celle qui ne l'est pas. Ensuite seulement, l'inversion des deux jambes fait
preuve.

| | NO CREDENTIAL | OLD | NEW |
|---|---|---|---|
| **Ligne de base** — `18:01:17 UTC`, `dpl_G5ZUd…` | REFUSED (401) | **ACCEPTED (404)** | **REFUSED (401)** |
| **Preuve** — `18:03:46 UTC`, `dpl_EUm7cR…` | REFUSED (401) | **REFUSED (401)** | **ACCEPTED (404)** |

Horodatages relevés sur la **ligne de requête** du plan de contrôle, convertis en UTC :

```
18:01:17.26  401      18:03:45.93  401     ← NO CREDENTIAL
18:01:17.39  404      18:03:46.47  401     ← OLD
18:01:17.53  401      18:03:46.76  404     ← NEW
```

La ligne de base précède de **12 secondes** la création du déploiement (`18:01:29 UTC`). Les deux
jambes s'inversent, sur le même instrument, les mêmes fichiers d'entrée, la même cible. **C'est ce
couple qui démontre, pas la seconde mesure isolée.**

---

## 2. LA CIBLE, ET SUR QUELLE AUTORITÉ

```
https://app.interligens.com/api/admin/sonde-7b7a724e
```

Un chemin **sans gestionnaire**. Le garde n'est pas sur une route : `src/proxy.ts` s'exécute **avant
le routage**, sur `/api/admin/:path*`. Mauvaise paire → **401** du garde ; bonne paire → **404** de la
page statique inerte. Dans les deux branches : aucune écriture, aucune lecture en base, aucun appel
facturé — **aucun code applicatif ne s'exécute**.

Un 404 après franchissement du garde est une **acceptation pleine** : c'est le garde qu'on mesure,
pas le routage.

L'autorité n'est pas un grep — *une occurrence textuelle ne prouve pas qu'une route est protégée*.
Elle est double :

1. `__tests__/security/sonde-basic-auth.test.ts`, **25/25 verts rejoués à HEAD** avant la fenêtre :
   le matcher contient `/api/admin/:path*` ; il n'existe **aucun** segment dynamique de premier
   niveau sous `src/app/api/admin/` (recompté : 0) ni aucune route attrape-tout ; `not-found.tsx` est
   inerte.
2. **La jambe `NO CREDENTIAL` elle-même**, qui exige un 401 porteur de
   `WWW-Authenticate: Basic realm="INTERLIGENS Admin"` — seul refus du dépôt portant cet en-tête
   (`basicAuthFail()`). Sans elle, un 401 et un 404 ne se distinguent plus d'un garde éteint, et la
   sonde se déclare NULLE.

Le repli `GET /api/admin/kol/<handle>/proceeds/status` a été **refusé** : deux `SELECT`, un
`PrismaClient` propre, et un 500 à deux causes possibles. Un instrument qui coûte et qui est ambigu
n'est pas un instrument.

---

## 3. RÈGLES D'INTERPRÉTATION

- **401 est le seul refus d'authentification admissible**, et il doit porter le défi Basic. Un 401
  sans cet en-tête vient d'ailleurs (`requireAdminApi`) : **INCONCLUSIVE**.
- **3xx, 403 et 5xx sont INCONCLUSIFS, jamais « passage ».** À noter pour le dossier sans que cela
  change le verdict : un 403 sous `/api/admin` signifie que l'authentification a **réussi** et qu'un
  garde applicatif a refusé ensuite. Un 3xx n'est pas un accès accordé.
- `auth/login` est **exempté du garde par conception** (`isAdminLoginSurface`) : il ne mesure pas ce
  garde et ne peut pas être la cible. La sonde refuse de partir si l'URL le vise.

---

## 4. L'INSTRUMENT

`scripts/rotation/sonde-admin-basic.mjs`. Entrées par **chemins de fichiers**, jamais par valeurs :
`SONDE_USER_FILE`, `SONDE_PASS_OLD_FILE`, `SONDE_PASS_NEW_FILE`, `SONDE_TARGET_URL`. Deux formes de
fichier acceptées — fichier d'environnement portant la clé, ou fichier à valeur unique — pour
**n'obliger à recopier aucun secret sur disque**.

En-tête `Authorization` construit **en mémoire** : jamais d'argv (`curl -u` inscrirait le mot de
passe dans la table des processus), jamais d'interpolation dans une URL, jamais de journalisation.
Corps des réponses **jamais lu**. Un nonce distinct par requête interdit qu'un cache serve à l'une la
réponse d'une autre. Crible anti-fuite sur la sortie complète avant impression.

**Fail-closed, cinq chemins exercés sur des valeurs factices** : variables absentes · cible
`auth/login` · cible hors `/api/admin` · fichier vide · ancienne ≡ nouvelle. Les cinq refusent de
partir. La sonde ne produit jamais un vert par défaut.

### Une limite de l'instrument, consignée plutôt que corrigée

La sonde n'a **pas de mode « ligne de base »** : son verdict et son code de sortie sont écrits pour
la lecture d'après-déploiement. Une ligne de base **conforme** — `OLD → ACCEPTED` — y apparaît donc
sous un « ⛔ ANCIENNE VALEUR ENCORE ACCEPTÉE » et un code 1, qui sont ici le **résultat attendu**.

Elle n'a pas été corrigée entre les deux mesures : modifier l'instrument entre la ligne de base et la
preuve aurait invalidé la comparaison, qui est toute la démonstration. Le défaut est nommé ici ; il
se corrige hors fenêtre de mesure. **BACKLOG.**

### Pourquoi un fichier neuf et non une adaptation de `sonde-basic-auth.mjs`

CC-OFFLINE-218 a livré une sonde Basic dont le raisonnement de cible est repris ici intégralement.
Elle est couverte par `__tests__/security/sonde-basic-auth.test.ts`, qui vérifie ses trois prémisses
de cible. La faire muter pour changer son interface d'entrée aurait cassé un témoin anti-régression
au milieu d'une fenêtre de mesure. Le raisonnement est réutilisé ; le fichier éprouvé reste intact.

---

## 5. LE DÉPLOIEMENT GOUVERNÉ

### La commande — tranchée avant d'agir

La mission prescrivait `npx vercel --prod`. `CLAUDE.md` l'interdit, et `scripts/deploy-production.mjs`
existe précisément pour la remplacer : *« un contrôle correct qu'on peut ne pas exécuter n'est pas un
garde »*. Trois conséquences concrètes ont emporté la décision :

1. l'exigence « `.env` non téléversé » n'est **structurelle** qu'avec le wrapper — le CLI n'y est pas
   *spawné* tant que le preflight n'a pas rendu 0 ; avec `npx vercel --prod`, un preflight joué à côté
   n'est qu'un avis, et rien ne lie ce qui a été certifié à ce qui part ;
2. `npx vercel --prod` résout une version **flottante**, donc un moteur d'ignore potentiellement
   différent de celui qui vient de certifier l'upload-set ;
3. la consigne venait d'`AGENTS.md`, non suivi et jamais commité, qui contredit `CLAUDE.md`.

La question a été posée à l'humain plutôt que la commande substituée d'autorité. **Retenu :
`pnpm deploy:prod`.**

### Les quatre portes, vertes avant tout upload

```
✅ CLI épinglé          vercel@51.7.0 (installation globale)
✅ Liaison de projet    interligens-app (prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ)
✅ Secret-bundle        2025 fichiers, vocabulaire clos, aucun refus
✅ Upload-set exact     2024 ≡ HEAD filtré · 1 GENERATED (source-set.json)
```

### Le déploiement

| | |
|---|---|
| `deploymentId` | `dpl_EUm7cRyEP6TpggzLadPG6veh3cvK` |
| `commit` | `8768f6d5578a40cfb045e2b3666e9f78902512e0` (`main`) |
| `source` | **`cli`** — exigé |
| `readyState` | `READY` · `target: production` |
| créé | `2026-09-15 18:01:29 UTC` · alias `app.interligens.com` |

`meta.gitDirty = 1` : le CLI observe l'**état git** du répertoire, où 63 fichiers non suivis
subsistent (61 sous `docs/prep/`, `AGENTS.md`, le marqueur). Ce n'est **pas** un fait d'upload-set —
la porte 4 a établi l'égalité `upload-set ≡ HEAD filtré`, et aucun de ces fichiers n'est expédié.

### L'invariant de delta — corrigé avant la mesure, pas après

L'invariant n'est **pas** « zéro fichier différent » : le marqueur `public/.well-known/source-set.json`
est **régénéré** à chaque déploiement (nouveaux `commit` et `generatedAt`), donc son sha1 change
nécessairement. L'invariant correct :

> **racine Merkle INCHANGÉE** (elle exclut le marqueur par construction, `excludesSelf`)
> **ET delta ⊆ { `public/.well-known/source-set.json` }**

Mesuré :

```
racine AVANT : a88fc71df2ae61742720c2f21bc5605812d22227c87c93a3fe57e80194ac1a06
racine APRÈS : a88fc71df2ae61742720c2f21bc5605812d22227c87c93a3fe57e80194ac1a06
apparus : aucun · disparus : aucun · modifiés : [public/.well-known/source-set.json]
fichiers d'environnement dans l'ensemble expédié : AUCUN
```

**Et un fait établi AVANT de déployer** : le marqueur du déploiement servi (commit `84aa358`) portait
**la même racine** `a88fc71d…`. Entre le commit servi et HEAD, le diff ne touche que `docs/`, exclu du
bundle par `.vercelignore`. Ce déploiement n'a donc expédié **aucune source nouvelle** — il n'a repris
qu'un **instantané d'environnement frais**. C'est exactement ce qu'on attend d'une fenêtre de rotation,
et c'était mesurable avant, pas seulement constatable après.

---

## 6. CE QUE CETTE FENÊTRE N'A PAS TOUCHÉ

**Les crons.** `CRON_SECRET` portait l'ancienne valeur en configuration au moment du déploiement : le
nouveau runtime embarque donc la même valeur `CRON_SECRET` que le précédent. Les 18 crons ne sont pas
concernés. Leur rotation est une fenêtre distincte.

Hors périmètre et non touchés : rotation DB, reprovisionnement X, Standard Protection, VINE,
classification, Product Spine, et la comparaison non constante en temps de `checkBasicAuth` (P1 connu,
signalé en CC-OFFLINE-218, **non corrigé** — corriger le garde servi pendant une fenêtre de mesure
l'invaliderait).

---

## 7. CE QUE CETTE MESURE N'ÉTABLIT PAS

1. **Rien sur les 91 runtimes Production historiques.** Chacun reste joignable sur sa propre URL avec
   l'environnement qui était le sien, et **continue d'accepter l'ancienne valeur**. `KNOWN P0
   RESIDUAL / OPEN / DOCUMENTED`.
2. **Rien sur `ADMIN_TOKEN`.** La porte admin a deux serrures. `POST /api/admin/auth/login` est
   exempté du garde et accepte `ADMIN_TOKEN` en jeton hérité, puis frappe deux cookies. Un refus de
   cette sonde ferme **une** des deux serrures. Le succès de cette fenêtre **ne doit jamais se lire**
   comme « la surface admin est fermée ».
3. **Rien sur les autres usages de l'ancienne valeur** — autre service, autre projet, gestionnaire de
   mots de passe partagé.
4. **Rien sur le passé.** Elle ne dit pas si l'ancienne paire a été utilisée entre l'exposition et
   maintenant. Cela se lit dans des journaux d'accès, pas dans un code HTTP.
5. **Rien sur la valeur elle-même.** Un secret auto-émis ne se détruit pas. Elle établit qu'il
   **n'ouvre plus cette porte-là**, sur ce runtime, à cet instant.

---

## 8. CLASSÉS P1 — consignés, non instruits

- **`DEPLOY_COMMAND_DOCUMENTATION_DRIFT`** — `AGENTS.md` contredit `CLAUDE.md` sur la commande de
  déploiement, et n'est de surcroît pas suivi par git. **BACKLOG P1.**
- **`VERCEL_CLI_VERSION_DIVERGENCE`** — le dépôt épingle `vercel@51.7.0` ; l'écriture de configuration
  `ADMIN_BASIC_PASS` de ce soir a été faite via `npx`, qui a résolu `vercel@59.17.0`. Sans effet
  attendu sur une écriture de configuration, mais la divergence est réelle. **BACKLOG P1.**
- La sonde sans mode « ligne de base » (§4). **BACKLOG.**

Ne pas investiguer, ne pas corriger, ne pas aligner.

---

## 9. MESURE ACQUISE CE SOIR, À NE PAS REPERDRE

> **`vercel env ls` affiche toujours `created = 192d` APRÈS un override réussi.**

Un remplacement en place **préserve l'horodatage de création**. La colonne `created` n'est donc **pas**
un témoin de rotation, et rien ne doit jamais s'en conclure. **La CLI fait autorité sur l'écriture ;
la sonde fait autorité sur le service.**

C'est le même enseignement que la fenêtre `CRON_SECRET` du même jour, pris par l'autre bout :
là, la configuration avait changé sans que le service suive ; ici, l'affichage de la configuration
n'avait pas changé alors que l'écriture avait eu lieu. Dans les deux cas, **seule une sonde contre le
runtime servi mesure une révocation.**
