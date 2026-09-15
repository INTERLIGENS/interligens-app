# SONDE D'INVALIDATION — Basic Auth admin servi

**2026-09-15 · fenêtre INCIDENT ROTATION · LECTURE SEULE · sonde ÉCRITE, NON EXÉCUTÉE**

**Aucune requête sortante n'a été émise pour produire ce document.** Rien n'a été roté, créé, révoqué ni
invalidé. Aucun fichier d'environnement modifié. Aucune écriture en base. Aucun déploiement. Aucun
déploiement purgé. `ipHash.ts`, les deux sels et le périmètre evidence/storage n'ont pas été touchés.

Tout ce qui suit est mesuré dans le code **au commit servi `9ee790c`**, lu depuis l'objet git, pas depuis
l'arbre de travail. Contrôle de dérive : entre `9ee790c` et `origin/main`, `src/proxy.ts`,
`src/lib/security/adminAuth.ts` et `src/lib/config/env.ts` sont **inchangés** ; le seul fichier d'auth qui a
bougé est `src/app/api/admin/intake/route.ts` (PR #448), hors du chemin de la sonde.

Distinction qui gouverne cette fenêtre :

| | |
|---|---|
| **CONFIGURED_CURRENT** | ce que Vercel contient. Établi par la cartographie : `ADMIN_BASIC_PASS` exposée **≠** courante, au poste comme en Production. |
| **SERVED_CURRENT** | ce que le runtime servi utilise réellement. **Non établi** — c'est l'objet de cette sonde. |

`ADMIN_BASIC_PASS` est auto-émis : aucune autorité externe ne le détient, il n'existe aucun écran où le
révoquer. Sa seule branche de fermeture est la **démonstration de non-opérationnalité**, et une
démonstration exige l'autorité servie, pas le contenu d'un panneau de configuration.

---

## 1. OÙ LA PAIRE EST LUE, ET QUEL ENDPOINT CONVIENT

### 1.1 — Les 8 occurrences dans 7 fichiers, nommées

La cartographie comptait « 8 lectures dans 7 fichiers ». Le compte est exact, **mais il compte des
occurrences textuelles de `process.env.ADMIN_BASIC_PASS`, pas des lectures exécutées.** L'une des huit est
une ligne commentée. Il faut le dire avant de s'appuyer dessus.

| # | Fichier : ligne | Ce que ça fait | Vérifie la paire Basic ? |
|---|---|---|---|
| 1 | `src/proxy.ts:21` | `checkBasicAuth()` — **LE garde**, exécuté avant le routage sur tout `/api/admin/:path*` | **OUI** — user + pass |
| 2 | `src/app/api/admin/auth/login/route.ts:47` | `POST` — compare le mot de passe, puis **frappe deux cookies** (`admin_session`, `admin_token`) | Le mot de passe seul, pas l'utilisateur |
| 3 | `src/app/api/admin/kol/[handle]/proceeds/route.ts:13` | `POST` **uniquement** — écrit des données forensiques | OUI, en plus du garde |
| 4 | `src/app/api/admin/kol/[handle]/proceeds/status/route.ts:34` | `requireAdminBasic()` — utilisé par `GET` (lecture) **et** `POST` (écriture d'un statut de publication) | OUI, en plus du garde |
| 5 | `src/app/api/admin/kol/[handle]/proceeds/status/route.ts:10` | **ligne commentée** — documente le défaut `?? ""` corrigé (les deux variables absentes fabriquaient le secret devinable `Basic Og==`) | non : ne s'exécute pas |
| 6 | `src/app/investigators/mm/page.tsx:36` | Copie en ligne de `computeAdminSessionToken()` — **HMAC**, pas une vérification Basic | non |
| 7 | `src/lib/config/env.ts:26` | Recopie dans l'objet `env` (+ `requireInProd("ADMIN_BASIC_PASS")` ligne 18, qui lit par `process.env[key]` et **échappe au comptage**) | non — garde de démarrage |
| 8 | `src/lib/security/adminAuth.ts:190` | `computeAdminSessionToken()` = `HMAC-SHA256(ADMIN_BASIC_PASS, clé = ADMIN_TOKEN)` | non — frappe/valide le cookie |

Pour `ADMIN_BASIC_USER`, même exercice : 5 occurrences dans 4 fichiers — `proxy.ts:20`,
`proceeds/route.ts:12`, `proceeds/status/route.ts:33` (+ `:9`, commentée), `env.ts:25`.

### 1.2 — Verdict sur les trois critères : **aucun endpoint existant ne les satisfait**

C'est la réponse demandée, et elle est négative. Passage en revue :

| Candidat | Critère 1 — atteignable | Critère 2 — ne modifie rien | Critère 3 — aucune action | Verdict |
|---|---|---|---|---|
| `POST /api/admin/auth/login` | oui, **exempté du garde** | non — c'est un `POST` | non — **frappe deux cookies**, donc émet un credential | ❌ |
| `POST /api/admin/kol/[h]/proceeds` | oui | non — `POST` | non — **écrit en base** | ❌ |
| `GET /api/admin/kol/[h]/proceeds/status` | oui | oui — deux `SELECT` | **presque** : deux requêtes en base | ⚠️ voir §1.4 |
| `GET /api/admin/kol/network` | oui | oui | non — sert un graphe nominatif entier ; et son gestionnaire lit `Authorization` comme **Bearer `ADMIN_TOKEN`** | ❌ |
| `GET /api/admin/kol/publishability` | oui | oui | même double sémantique de l'en-tête `Authorization` | ❌ |
| `GET /api/admin/security/threats` et les autres GET gardés par `requireAdminApi` | oui | oui | oui — **mais** `requireAdminApi` exige `x-admin-token` : la bonne paire Basic rend quand même un 401 | ❌ contrôle positif impossible |
| `src/app/investigators/mm` | oui | oui | oui — mais **cookie uniquement**, ne teste pas Basic | ❌ hors sujet |

**Aucun gestionnaire existant ne convient.** Soit il écrit, soit il lit des données, soit il exige un second
secret qui rend le contrôle positif impossible.

### 1.3 — Ce que cette impasse révèle, et la cible qui en découle

Le garde Basic **n'est pas sur un endpoint**. Il est sur un **préfixe de chemin** :

```
matcher: ["/admin/:path*", "/api/admin/:path*", …]         // src/proxy.ts
if (isAdminApiRoute) {
  const ok = verifyAdminSession(req) || checkBasicAuth(req);
  if (!ok) return basicAuthFail();                          // 401 + défi Basic
}
```

`src/proxy.ts` s'exécute **avant le routage**, pour tout chemin qui match — y compris un chemin **sans
gestionnaire**. D'où la cible :

> **`GET https://app.interligens.com/api/admin/<segment tiré au sort>`**

* **mauvaise paire → 401** : le garde refuse ; aucun gestionnaire n'existe, donc aucun ne tourne ;
* **bonne paire → 404** : le garde laisse passer, Next ne trouve aucune route, la page 404 statique répond.

Les trois critères sont satisfaits **strictement** : aucune action métier, aucune écriture, aucune lecture en
base, aucun envoi, aucun document, aucun appel facturé — parce qu'**aucun code applicatif ne s'exécute**. Et
les deux issues sont **deux codes HTTP distincts**, ce qui évite d'avoir à inspecter un corps ou un en-tête.

Trois prémisses rendent ce raisonnement valide. Elles sont **vérifiées par test** contre les fichiers réels
(`__tests__/security/sonde-basic-auth.test.ts`), et non supposées :

1. le matcher contient bien `"/api/admin/:path*"` ;
2. il n'existe **aucun segment dynamique** au premier niveau sous `src/app/api/admin/`, et **aucune route
   attrape-tout** (`[...slug]`) nulle part sous `src/app/api` — un chemin tiré au sort n'atteint donc rien ;
3. `src/app/not-found.tsx` est **inerte** : aucun `prisma`, aucun `fetch`, aucun `await`.

Si l'une de ces prémisses tombe un jour, le test rougit **avant** que la sonde ne devienne ininterprétable.

### 1.4 — L'option de repli, si l'architecte exige un 200

`GET /api/admin/kol/[handle]/proceeds/status` avec un handle inexistant rendrait `200 {found:false}`. C'est
le seul endpoint dont le succès dépend de la paire Basic **et** qui ne modifie rien.

Son coût, écrit sans adoucissement : il exécute **deux `SELECT`** sur `KolProceedsSummary` et
`KolProceedsEvent`, il instancie son propre `PrismaClient`, et surtout **un `500` y serait ambigu** — il peut
venir de `requireAdminBasic` (une des deux variables vide ⇒ 500 délibéré) **ou** d'une erreur de base. Un
code qui a deux causes n'est pas une mesure. C'est pourquoi il est le repli et non le choix.

---

## 2. LE CONTRAT DE REFUS EXACT

Mesuré dans `src/proxy.ts` au commit servi :

```js
function basicAuthFail() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="INTERLIGENS Admin"' },
  });
}
```

**401**, en-tête `WWW-Authenticate: Basic realm="INTERLIGENS Admin"`, corps texte `Unauthorized`.

C'est le **seul** refus du dépôt qui porte `WWW-Authenticate`. Table de distinction, pour que la sonde ne
confonde jamais un refus d'authentification avec autre chose :

| Observé | Origine | Lecture |
|---|---|---|
| **401 + `WWW-Authenticate: Basic …`** | `basicAuthFail()`, `src/proxy.ts` | **refus du garde Basic** — c'est la mesure recherchée |
| 401 JSON, `detail: "Missing x-admin-token header."` | `requireAdminApi()` | garde **traversé**, refus du gestionnaire sur un second secret |
| 403 JSON, `detail: "Invalid admin token."` | `requireAdminApi()` | idem, `x-admin-token` présent mais faux |
| 401 JSON, `code: "NOMINATIVE_ACCESS_REQUIRED"` | `nominativeAccessDenied()` | garde nominatif — ne s'applique pas à `/api/admin` |
| 500 JSON, `"Server misconfiguration"` | `requireAdminApi()` sans `ADMIN_TOKEN` | configuration, pas authentification |
| 500 JSON, `"admin basic credentials not set"` | `requireAdminBasic()` de `proceeds/status` | une des deux variables vide |
| **404** | aucune route derrière le garde | **garde traversé** — c'est le contrôle positif |
| 3xx | gate de page (`/admin` → `/admin/login`) ou gate beta (→ `/access`) | ne doit pas arriver sur `/api/admin` ; **n'est pas un accès accordé** |
| 5xx, pas de réponse | indisponibilité | **pas une mesure** |

Le garde est **fail-closed** : `if (!user || !pass) return false` — une variable absente **ou vide** ferme,
elle n'ouvre pas. Et il n'a **aucune branche `NODE_ENV`** (durcissement Sprint 8, vérifié par test) : il n'y
a pas de mode où il s'efface.

---

## 3. LA FORME DE LA COMPARAISON, ET LES CHEMINS QUI LA CONTOURNENT

### 3.1 — La comparaison

```js
const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
const [u, ...rest] = decoded.split(":");
return u === user && rest.join(":") === pass;
```

Deux remarques, la seconde importe :

* le découpage `split(":")` puis `rest.join(":")` traite correctement un mot de passe **contenant des
  deux-points** (la sonde le vérifie par test) ;
* la comparaison est un **`===` de chaînes**, donc **non constante en temps**. Tous les autres gates du
  dépôt utilisent `timingSafeEqual` — `requireAdminApi`, `requireAdminBasic` de `proceeds/status`, le login
  admin, la vérification du cookie de session. **Le garde le plus exposé du produit est le seul qui ne le
  fait pas.** Ce n'est pas un obstacle à la sonde et ce n'est pas l'objet de cette fenêtre : c'est un écart
  de doctrine à inscrire, à traiter hors incident, et à ne pas corriger en passant ici.

### 3.2 — Contournement n°1 : le cookie de session

`verifyAdminSession(req) || checkBasicAuth(req)` — **un cookie `admin_session` valide dispense entièrement
de Basic Auth.** Une sonde qui enverrait un cookie mesurerait le cookie, pas la paire. La sonde n'utilise
donc aucun magasin de cookies et n'envoie que l'en-tête `Authorization`.

### 3.3 — Contournement n°2 : `ADMIN_TOKEN` — **et il change l'interprétation du résultat**

La question posée était : *`ADMIN_TOKEN` peut-il servir d'alternative à Basic Auth sur le même endpoint ?*

**Sur le même endpoint, non.** Le garde n'accepte que le cookie `admin_session` ou Basic ; un
`x-admin-token` seul ne le franchit pas.

**Par un endpoint voisin, oui — et complètement.** `POST /api/admin/auth/login` est **exempté du garde**
(`isAdminLoginSurface`), et accepte, par compatibilité ascendante :

```js
if (!matched && legacyToken) matched = constantTimeEqual(legacyToken, expectedToken)  // expectedToken = ADMIN_TOKEN
…
setAdminSessionCookie(res);  setAdminCookie(res);
```

Or `ADMIN_TOKEN` est **🔴 exposé ET encore vivant** — c'est l'un des cinq de la cartographie.

> **Conséquence à inscrire au ledger : quiconque détient les octets exposés peut obtenir une session admin
> complète — les deux cookies — sans jamais connaître `ADMIN_BASIC_PASS`.** Un refus de cette sonde ferme
> **une** des deux serrures de la porte admin. L'autre est grande ouverte, et elle ouvre plus largement que
> Basic Auth, puisque le cookie `admin_token` satisfait aussi `requireAdminApi` sur les **138 fichiers de route**
> (sur 151) qui l'appellent sous `/api/admin`.
>
> La sonde reste utile : elle est la seule démonstration possible pour `ADMIN_BASIC_PASS`, et le critère de
> fermeture s'applique credential par credential. Mais **son succès ne doit jamais être lu comme « la
> surface admin est fermée »**. Elle ne le dira pas, et personne ne doit le déduire.

Note sur le cookie : `admin_session = HMAC-SHA256(ADMIN_BASIC_PASS, clé = ADMIN_TOKEN)`. L'ancien mot de
passe plus le jeton vivant ne permettent **pas** de forger le cookie courant — il faut le mot de passe
*courant*. Cela ne change rien à ce qui précède : la voie `login` + `token` suffit, et ne demande aucun HMAC.

### 3.4 — Deux routes où l'en-tête `Authorization` a une seconde vie

`GET /api/admin/kol/network` et `GET /api/admin/kol/publishability` lisent
`req.headers.get('authorization')?.replace('Bearer ', '')` et le comparent à `ADMIN_TOKEN`. Le même en-tête
y porte donc deux sémantiques successives : **Basic** pour le garde, **Bearer** pour le gestionnaire. Une
sonde Basic y récolterait un 401 du gestionnaire même après avoir franchi le garde. C'est une raison de plus
de ne pas les viser — et un signe de plus que l'autorité admin est éclatée entre deux secrets.

---

## 4. LA SONDE — écrite ici, exécutée par le fondateur

Livrée : `scripts/rotation/sonde-basic-auth.mjs`. **Elle n'a pas été exécutée contre la production.**

### 4.1 — Pourquoi trois requêtes et pas deux

L'ordre demandé — ancienne paire puis paire actuelle — est conservé. Une requête le précède, et elle n'est
pas décorative : **elle ferme un piège qui aurait transformé la sonde en fausse alarme maximale.**

Si le garde ne s'exécutait pas (proxy absent du déploiement servi, matcher modifié), les **deux** requêtes
rendraient 404 — et le 404 de l'ancienne paire se lirait « ancienne paire acceptée », donc STOP du bloc
Admin, pour une raison entièrement fausse. La première requête part donc **sans aucune authentification** et
**doit** rendre 401. Si elle ne le fait pas, la sonde se déclare NULLE et rien d'autre n'est interprété.

| # | Requête | Attendu |
|---|---|---|
| 1 | `GET /api/admin/sonde-<nonce>-c` — **aucune** authentification | **401** — prouve que le garde tourne |
| 2 | `GET /api/admin/sonde-<nonce>-a` — **ANCIENNE** paire, lue dans les octets exposés | **401** — le refus recherché |
| 3 | `GET /api/admin/sonde-<nonce>-b` — paire **ACTUELLE**, lue dans `.env.local` | **404** — le contrôle positif |

Les trois chemins sont **distincts** et tirés au sort à chaque exécution : aucun cache intermédiaire ne peut
servir à l'une la réponse d'une autre, et un 401 mis en cache ne peut pas se faire passer pour un refus.

### 4.2 — Ce que le fondateur tape

```
cd ~/dev/interligens-web
node scripts/rotation/sonde-basic-auth.mjs --sans-reseau
```

Répétition à blanc : lit les deux paires, imprime le plan, **n'émet aucune requête**. Ce qu'il doit voir se
termine par `→ --sans-reseau : AUCUNE requête émise.`

Puis la sonde réelle :

```
node scripts/rotation/sonde-basic-auth.mjs
```

Sortie attendue, dans le cas où l'ancienne paire est bien refusée :

```
    [1/3] porte vive (aucune authentification)        attendu 401   obtenu 401  ✅   défi Basic : oui
    [2/3] ANCIENNE paire (octets exposés)             attendu 401   obtenu 401  ✅   défi Basic : oui
    [3/3] paire ACTUELLE (poste) — contrôle positif   attendu 404   obtenu 404  ✅   défi Basic : non

  VERDICT : ✅ REFUS ÉTABLI — l'autorité servie refuse l'ancienne paire et accepte l'actuelle
```

**Aucune valeur n'apparaît, nulle part.** Le fondateur ne tape et ne colle aucun secret : la sonde lit les
deux paires dans les fichiers, construit l'en-tête `Authorization` **en mémoire** et le passe à `fetch`.
C'est délibéré et c'est une protection réelle : un `curl -u "$user:$pass"` aurait inscrit le mot de passe
dans la table des processus, où n'importe quel utilisateur de la machine peut le lire avec `ps`.

Le corps des réponses n'est **jamais lu** — il pourrait porter des données. Seuls sortent un code HTTP, une
étiquette, et un booléen disant si le défi Basic était présent. La sortie complète passe ensuite par le même
crible anti-fuite que la cartographie : si une valeur y figurait, la sonde le dirait et rendrait le code 3.

Option `--empreinte-version` : ajoute un `GET` public sur `/api/health`, qui rend le sha court du commit
servi — de quoi attacher le résultat à une version précise de `SERVED_CURRENT`. **Hors périmètre minimal** :
cette route interroge la base (`SELECT 1`) et ping Redis. À activer en connaissance de cause, ou pas du tout.

### 4.3 — Table d'interprétation, exhaustive

| [1] vive | [2] ancienne | [3] actuelle | Verdict | Suite |
|---|---|---|---|---|
| ≠ 401 | — | — | **SONDE NULLE** — le garde ne tourne pas sur ce chemin | Ne rien conclure. Vérifier le déploiement servi. |
| 401 | **404 ou 2xx** | — | **⛔ ANCIENNE PAIRE ENCORE ACCEPTÉE** | **STOP du bloc Admin.** Ne roter aucun autre credential admin avant celui-ci. |
| 401 | 3xx, 403, 5xx | — | **NON CONCLUANT** — ni refus Basic, ni passage | Une redirection n'est pas un accès accordé ; un 500 n'est pas une mesure. |
| 401 | 401 | **401** | **NON CONCLUANT — divergence** : le runtime refuse aussi la paire du poste | `CONFIGURED_CURRENT ≠ SERVED_CURRENT`. Les deux paires sont refusées : on ignore laquelle est servie. |
| 401 | 401 | ≠ 404 et ≠ 401 | **NON CONCLUANT** — contrôle positif manqué | Sans contrôle positif, un refus ne se distingue pas d'une auth cassée. |
| 401 | 401 | **404** | **✅ REFUS ÉTABLI** | Lire le §5 avant d'en tirer quoi que ce soit. |
| une requête sans réponse | | | **NON CONCLUANT** | Aucun verdict ne se rend sur une requête qui n'a pas abouti. |

La sonde rend le code de sortie **1** dans le seul cas STOP, **0** sinon, **2** si elle refuse de partir,
**3** si son propre crible détecte une fuite.

### 4.4 — Les deux cas où la sonde refuse de partir

* une des quatre valeurs est **absente ou vide** dans l'un des deux fichiers → arrêt, code 2. Sans ancienne
  paire il n'y a rien à distinguer ; sans paire actuelle il n'y a pas de contrôle positif ;
* l'ancienne paire et la paire actuelle sont **identiques** → arrêt, code 2. Le credential serait alors
  exposé *et* vivant : **il se rote, il ne se sonde pas.**

---

## 5. CE QUE LA SONDE NE PROUVERA PAS

Écrit sans adoucissement, parce que c'est ici qu'un incident se ferme sur le papier.

**Un refus prouve que CETTE paire est refusée par CE runtime, sur CE chemin, à CET instant.** Rien de plus.
En particulier :

1. **Rien sur les autres déploiements retenus.** Les déploiements conservés ne sont pas purgés — décision de
   l'architecte, et elle est bonne. Chacun reste joignable sur **sa propre URL**, avec l'environnement qui
   était le sien. Un déploiement antérieur à la réécriture peut parfaitement **servir encore l'ancienne
   paire**. `app.interligens.com` ne dit rien d'eux. Les sonder un par un est un travail distinct, qui
   n'existe pas encore.

2. **Rien sur `ADMIN_TOKEN`** — §3.3. La porte admin a deux serrures ; la sonde n'en teste qu'une, et
   l'autre est exposée, vivante, et plus large.

3. **Rien sur les autres usages de l'ancienne valeur.** Si ce mot de passe a été réutilisé ailleurs — autre
   service, autre projet, gestionnaire de mots de passe partagé — la sonde ne le voit pas.

4. **Rien sur le passé.** Elle ne dit pas si l'ancienne paire a été **utilisée** entre l'exposition et
   maintenant. Cela se lit dans des journaux d'accès, pas dans un code HTTP.

5. **Rien sur l'avenir.** Une variable peut être re-posée, un déploiement peut repartir d'un environnement
   différent. Le verdict est daté ; il n'est pas un état permanent.

6. **Rien sur la valeur elle-même.** Elle n'établit pas que l'ancienne valeur est « détruite » : rien ne se
   détruit dans un secret auto-émis. Elle établit qu'elle **n'ouvre plus cette porte-là**. C'est exactement
   ce que la branche « démonstration de non-opérationnalité » demande — et c'est tout ce qu'elle demande.

7. **Elle ne prouve rien si elle n'est pas complète.** Un 404 seul, sans la requête de vivacité, est
   compatible avec un garde éteint. Les trois requêtes forment une seule mesure : en retirer une ne donne
   pas un résultat plus faible, elle donne un résultat **faux**.

---

## 6. CE QUE CETTE FENÊTRE N'A PAS FAIT

- La sonde n'a **pas** été exécutée. Aucune requête sortante, authentifiée ou non.
- Aucun credential roté, créé, révoqué ou invalidé.
- Aucun fichier d'environnement modifié, aucune valeur affichée, journalisée ou écrite.
- Aucune écriture en base, aucune DDL, aucun déploiement. **NO PROD DEPLOY.**
- Aucun déploiement purgé.
- `ipHash.ts`, `VAULT_AUDIT_SALT`, `OSINT_RETAIL_IP_SALT` et le périmètre evidence/storage : non touchés.
- L'écart de doctrine du §3.1 (comparaison non constante en temps dans `checkBasicAuth`) est **signalé, pas
  corrigé**. Corriger le garde servi pendant une fenêtre de mesure invaliderait la mesure.
