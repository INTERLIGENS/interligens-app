# BUILD 13 — PROTOCOLE DE VÉRIFICATION DE LA FENÊTRE P0

**Rôle : vérificateur indépendant. T2 exécute, je confronte.**

⛔ **Rien n'est exécuté.** Aucune sonde sur la production n'a été faite, et aucune
ne le sera avant que la fenêtre soit ouverte et que tu me le dises — une mesure
anticipée fausserait le différentiel. Tout ce qui suit est établi par **lecture
de code locale** et par les mesures déjà en main.

---

# 0. DEUX CHOSES À RÉGLER AVANT, ET ELLES CHANGENT LE PROTOCOLE

## 0.1 La classe d'appelant du « avant » doit être connue — sinon le différentiel est nul

Les trois surfaces ne sont pas gardées de la même façon. Mesuré dans le code :

| surface | gate | classes d'appelant qui passent |
|---|---|---|
| `/api/watchlist` | proxy, **gate nominatif** (`NOMINATIVE_EXACT`) | admin_session · admin_token · **beta_session** · partner_key · mobile_token |
| `/api/explorer` | proxy, **gate nominatif** (`NOMINATIVE_EXACT`) | les mêmes cinq |
| `/api/investigators/network-graph` | **handler seul** — `enforceInvestigatorAccess()` | **admin_session** ou **session investigateur validée en base**. Ni partner_key ni mobile_token |

> **Un différentiel n'est valide que si la classe d'appelant est IDENTIQUE des
> deux côtés.** Ce qui est servi dépend de l'appelant : confronter un « après »
> capturé en `partner_key` à un « avant » capturé en session investigateur
> mesurerait la différence d'audience, pas l'effet du correctif.

**Ce dont j'ai besoin de toi :**
1. **Le fichier `TEMOIN-AVANT-P0-mesure-en-session-authentifiee-2026-09-12`** — il
   n'est pas dans le dépôt, je ne l'ai pas.
2. **La classe d'appelant exacte** qui l'a produit, par surface. « Session
   authentifiée » ne suffit pas : cinq classes différentes passent sur deux des
   trois surfaces.

Pour `network-graph`, la réponse est déjà contrainte : seules la session admin ou
la session investigateur ouvrent. **Je ne peux pas produire ce « après » avec les
identifiants que j'ai** (`ADMIN_TOKEN` en en-tête n'est pas `admin_session` en
cookie). Si le « avant » vient d'une session investigateur, **il me faut la même
session**, ou c'est T2 qui capture et moi qui confronte.

## 0.2 `network-graph` n'a qu'UNE couche, pas deux — et ça se vérifie pendant la fenêtre

Le matcher du proxy compte 22 entrées. **Aucune ne couvre `/api/investigators/`**
(pluriel) : `"/api/investigator/:path*"` est au **singulier**, et le fourre-tout
final exclut explicitement `api`. La branche `isInvestigatorApi` du proxy, qui
attraperait le pluriel par `startsWith`, **ne s'exécute donc jamais** sur ce
chemin.

La route est bien gardée — mais **par son handler seul**. `watchlist` et
`explorer` en ont deux ; `network-graph` en a une.

**Ce n'est pas un défaut à ouvrir aujourd'hui**, et je ne l'affirme pas comme
mesure : c'est une lecture de code, et la journée entière a montré que la chaîne
servie est la seule autorité. **Mais c'est gratuit à confirmer pendant la
fenêtre**, et le §2 l'y intègre.

*Note de méthode, parce qu'elle vaut plus que le constat :* mon premier balayage
comptait les « marqueurs d'auth » par grep de **noms** (`validateSession`,
`requireAdmin`, …) et a rendu `auth=0` sur cette route. Faux négatif : elle
appelle `enforceInvestigatorAccess()`, que ma liste ne contenait pas. **Un
inventaire par nom échoue**, le jour même où on l'a écrit trois fois. Corrigé en
lisant le fichier.

---

# 1. ÉTABLIR LA VERSION SERVIE — avant toute mesure

> Un vert local n'est pas un vert. Une mesure sur une version qu'on n'a pas
> établie n'est pas une mesure.

## 1.1 Le marqueur, et ce qu'il ne prouve pas

`GET /api/health` (anonyme, hors gate nominatif, `no-store`) rend :

```json
{ "ok": true, "version": "<7 caractères de VERCEL_GIT_COMMIT_SHA>", "timestamp": "…" }
```

**`version` nomme un COMMIT, pas des OCTETS.** `npx vercel --prod` déploie
**l'arbre de travail**, pas le commit : un arbre sale porterait un `version`
qui ment. C'est exactement le `P1 SERVED STATE PROVENANCE` déjà ouvert, et je ne
le referme pas ici — je le contourne en croisant trois signaux.

## 1.2 La procédure, en cinq temps

| # | geste | ce qu'il établit |
|---|---|---|
| 1 | **Avant le déploiement** : `GET /api/health` → noter `version` **et l'en-tête `x-vercel-id`** | l'identité du déploiement SORTANT |
| 2 | T2 déploie. Pré-vol de déploiement : `git status` propre, HEAD = commit de merge, marqueur du correctif présent dans l'arbre | l'arbre déployé est bien le commit |
| 3 | **Après** : `GET /api/health` en boucle jusqu'à ce que **`version` == 7 premiers caractères du commit de merge** ET que **`x-vercel-id` ait changé** | la version servie est la nouvelle |
| 4 | **Les mesures du §2** | — |
| 5 | **`GET /api/health` À NOUVEAU**, et comparer à l'étape 3 | **aucun redéploiement n'a eu lieu pendant la mesure** |

L'étape 5 est celle qu'on oublie : sans elle, une mesure faite à cheval sur deux
déploiements est un mélange de deux états, et rien ne le signalerait.

**Si `version` ne bascule pas** : on ne mesure pas. Un `x-vercel-id` différent
avec un `version` inchangé signifie un nouveau déploiement du **même** code —
donc le correctif n'est pas parti, et c'est un STOP, pas une nuance.

---

# 2. LES SURFACES — différentiel avant / après

Trois requêtes, **même classe d'appelant qu'au « avant »**, réponses conservées
brutes, puis confrontation champ par champ.

## 2.1 `/api/watchlist`

| à vérifier | forme de l'assertion |
|---|---|
| `isPublished` **disparu de la charge** | absent de **toutes** les entrées, pas d'au moins une |
| les quatre séparateurs parfaits disparus | `riskFlag` · `rugCount` · `totalProceeds` · `behaviorFlagsCount` |

**Et la borne d'anti-vacuité, obligatoire :** le « avant » doit prouver que ces
champs étaient **présents et non vides**. Un champ qui valait déjà `null` partout
disparaîtrait sans que rien ne change — et « absent » serait indiscernable de
« n'a jamais rien porté ». **Le nombre d'entrées doit aussi être identique** : si
la charge a rétréci, ce n'est plus un retrait de champs, c'est un retrait de
lignes, et c'est un autre effet.

## 2.2 `/api/explorer`

| à vérifier | forme |
|---|---|
| les huit champs absents | **sur 14 / 14** items — le dénominateur est l'assertion |
| `linkedActors` absent | sur les **quatre** items de type `case` |
| non-régression | **14 items** avant et après, mêmes identifiants |

## 2.3 `/api/investigators/network-graph`

| à vérifier | forme |
|---|---|
| `notes` absent | sur les **41 nœuds**, 41/41 |
| les six libellés `wallet_family` disparus | les six nommément, pas « au moins un » |
| non-régression | **41 nœuds** avant et après, mêmes identifiants |

**Plus la mesure du §0.2, qui ne coûte rien** : la même requête, **en anonyme**.

- `401` → le handler garde, la couche unique suffit. **Constat clos.**
- `200` → la surface est servie sans authentification, et le différentiel P0
  devait alors être vérifié sur **l'audience la plus large**, pas seulement sur la
  session. Ce serait un constat à part entière, et il change la portée de P0.

À faire **après** les mesures authentifiées, jamais avant : un 401 n'est pas une
mesure, mais un 200 inattendu en serait une, et on ne la veut pas au milieu du
différentiel.

---

# 3. LA VÉRIFICATION DE FERMETURE

| # | contrôle | critère |
|---|---|---|
| 1 | **guard byte-identique** | `sha256(scripts/guard-offline.sh)` sur `origin/main` == **`525e94b5e554f77c`** |
| 2 | **leases résiduelles** | l'état `LEASES=()` est **vide** — 0 enregistrement, `OPEN` comme `CLOSED` |
| 3 | **preuve positive, sens 1** | le nom naguère **sujet** de la lease, rejoué sur le même chemin exact → **BLOQUÉ** |
| 4 | **preuve positive, sens 2** | une branche **conforme mais jamais sujette** (`feat/cc-offline-<n>-quelconque`), même chemin → **BLOQUÉE** |
| 5 | non-régression | un chemin **libre** sur la même branche → **PASSE** |
| 6 | voie de fermeture | `hotfix/guard-*`, guard seul → **PASSE** |

Les contrôles 3 et 4 sont **les deux formes**, et il en faut deux : le 3 seul
laisserait croire que la fermeture a marché alors qu'une erreur de comparaison
bloquerait tout ; le 4 seul ne dirait rien du sujet. Ensemble, ils séparent
« la lease est fermée » de « le guard refuse tout ».

**Tous sont joués sur le guard extrait d'`origin/main`**, jamais sur une copie
locale. C'est la leçon de #383 → #387, et elle vaut pour la vérification comme
pour la livraison.

---

# 4. LA DURÉE RÉELLE — la mesure qui alimente la borne

**Horodatage en UTC, aux deux bouts, depuis `origin`, pas depuis un souvenir :**

```
ouverture  = committerDate (%cI) du merge de la PR qui POSE la lease
fermeture  = committerDate (%cI) du merge de la PR qui la RETIRE
durée      = fermeture − ouverture
```

`committerDate` et non `authorDate` : c'est l'instant où le commit a atterri sur
`main`, pas celui où il a été écrit. C'est la méthode exacte qui a produit les 64
fenêtres et leur médiane de 12 minutes — **la mesure reste comparable**.

À rapporter, dans cette forme :

| | |
|---|---|
| ouverture · fermeture | `…Z` · `…Z` |
| **durée mesurée** | `… mn` |
| estimation annoncée | 12 mn |
| lease accordée | 40 mn |
| borne du mécanisme | **45 mn** |
| marge consommée | `durée / 45` |
| merges tiers dans l'intervalle | `git log --first-parent <ouv>..<ferm>` |

**Ce que ce chiffre vaudra, et ce qu'il ne vaudra pas.** C'est **une** fenêtre :
il confirme ou infirme le modèle sur un cas, il ne le valide pas
statistiquement. S'il dépasse 12 mn sans dépasser 40, le modèle tient et
l'estimation était optimiste — ce n'est pas la même chose. S'il approche 40, la
borne à 45 était juste et la marge est mince : à dire. **Le vide mesuré entre 30
et 127 minutes sur 64 fenêtres reste l'argument principal** ; cette fenêtre-ci en
est le premier point après la pose du mécanisme.

---

# 5. CE QUE JE NE FERAI PAS

Aucune sonde avant l'ouverture. Aucune exécution avant ton signal. Je ne capture
pas le « avant » — il existe, je le **confronte**. Je ne touche à rien du
périmètre de T2. Aucune remédiation storage, E reste ACTIVE. La garde
commentaire ↔ code reste non construite, `P1 SERVED STATE PROVENANCE` reste
ouvert et non instruit.

Et si une mesure manque — classe d'appelant inconnue, session indisponible,
version servie non établie — **je le dis au lieu de la déduire**. Une case vide
dans ce protocole est une réponse ; une case remplie par raisonnement n'en est
pas une.
