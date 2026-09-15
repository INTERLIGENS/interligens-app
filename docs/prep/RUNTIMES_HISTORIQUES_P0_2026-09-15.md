# P0 — JOIGNABILITÉ DES RUNTIMES HISTORIQUES VERCEL

**2026-09-15 · fenêtre INCIDENT ROTATION · RECONNAISSANCE READ-ONLY · T2 mesure, T1 exécutera**

## RÉPONSE À LA QUESTION DE L'ARCHITECTE : **OUI**

Une primitive fournisseur permet de supprimer la joignabilité publique des 91 runtimes historiques
**sans rien détruire** : **Vercel Authentication** appliquée avec la portée **Standard Protection**.
Elle est documentée, gratuite sur tous les plans, réversible, et elle s'applique **rétroactivement aux
déploiements existants**. Elle ne touche pas le déploiement canonique servi sur `app.interligens.com`.

DELETE et PURGE ne sont pas nécessaires. Aucun arbitrage supplémentaire n'est requis pour agir.

---

## LIVRABLE

### COUNT

**91 déploiements Production non canoniques**, tous `READY`, tous retenus, tous joignables.

- Projet `interligens-app` (`prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ`) : **92** déploiements Production au total,
  **tous en état `READY`** — aucun `ERROR`, aucun `CANCELED`, aucun expiré. Inventaire complet obtenu par
  pagination (`vercel ls --environment production --format json --next …`, 5 pages), pas par la première
  page de 20 : l'estimation « au moins 20 » était la taille d'une page, pas celle de l'ensemble.
- Moins le canonique ⇒ **91 dans l'ensemble**.
- **Depuis quand** : du **2026-05-19 10:12 UTC** au **2026-09-14 13:56 UTC**.
  Par mois : mai 8 · juin 5 · juillet 6 · août 32 · septembre 40.
- **Sur quelles URLs** : chacun n'est joignable que par son URL générée
  `https://interligens-<hash>-davidpandoraparis-2892s-projects.vercel.app`. **Aucun ne porte d'alias de
  domaine** — les trois alias du projet sont sur le canonique.
- **Avec quel commit** : liste exhaustive des 91 en **annexe A** (date UTC · hash d'URL · sha · sujet).

**Joignabilité actuelle — mesurée sur le plan de contrôle, sans émettre une seule requête vers un runtime :**

```
$ vercel project protection --format json
{ "projectId": "prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ", "name": "interligens-app",
  "ssoProtection": null, "skewProtectionMaxAge": 43200, "gitForkProtection": true }
```

`ssoProtection: null` ⇒ **aucune protection de déploiement n'est active**. Les 92 sont publiquement
joignables. C'est la cause, côté fournisseur, du témoin positif relevé par T1 sur `668bg3zus`, et cela le
confirme sans le rejouer.

**Octets du `.env` exposé — la distinction demandée, qui s'avère ne rien discriminer :**

Le filtre `.vercelignore` couvrant la forme `.env*` est entré par le commit `c451ad5` (2026-09-15 09:24).
Test d'ascendance sur les 92 : **un seul** déploiement contient `c451ad5` — le canonique. Donc
**91 sur 91 des déploiements de l'ensemble sont antérieurs à la fermeture du filtre et portent les octets
du `.env`.** La distinction est portée au dossier comme l'architecte l'a demandée ; elle ne réduit pas la
portée, elle la confirme : la portée large et la portée « porteurs des octets » sont **le même ensemble**.

> Réserve de méthode : c'est une inférence d'ascendance de commit croisée avec l'état du filtre, pas une
> lecture du manifeste de chacun des 91. Ce qui la trancherait déploiement par déploiement : l'onglet
> **Source** (`/_src`) de chaque déploiement, ou `GET /v6/deployments/{id}/files`. Non fait — cela
> exigerait de créer un jeton d'API, donc un credential, ce que cette fenêtre s'interdit.

**Surface adjacente — mesurée, et elle est vide :**

| Projet | Déploiements Production | États | Runtime joignable ? |
|---|---|---|---|
| `interligens-app` | 92 | 92 READY | **oui — c'est l'ensemble** |
| `interligens-web` | 160 | **160 ERROR** | non — aucun build n'a abouti |
| `interligens-t2` | 1 | **1 ERROR** | non |

Les deux projets parasites nés des worktrees n'ajoutent **aucun** runtime exploitable. Cinq autres projets
existent sous le même scope (`masaja-beach-club`, `interligens-landing`, `interligens-dataroom`,
`interligens`, `jet-ski-mandalika-app`) : **non inventoriés**, parce qu'ils ne sont pas construits depuis ce
dépôt. Ce qui le trancherait : un `vercel ls --environment production` par projet, deux minutes, à faire si
l'architecte veut la certitude plutôt que l'inférence.

### CANONICAL EXCLUDED

**`dpl_G5ZUd253utxE8Sfo7Wfn9KgvYhhm`** — confirmé par `vercel inspect`, pas supposé :

- URL générée : `interligens-9u9u343yk-davidpandoraparis-2892s-projects.vercel.app`
- commit `84aa358` · créé 2026-09-15 14:27 UTC
- **alias** : `app.interligens.com` · `interligens-app.vercel.app` ·
  `interligens-app-davidpandoraparis-2892s-projects.vercel.app`

`app.interligens.com` est un **domaine de production**. Standard Protection « protège tous les déploiements
**sauf les domaines de production** » — l'exclusion du canonique n'est donc pas une précaution d'exécution à
respecter à la main, elle est **la définition même de la portée choisie**. C'est la raison pour laquelle
c'est cette portée, et pas une autre, qui est retenue.

⚠️ **Collatéral accepté et nommé d'avance :** la même portée restreint aussi l'**URL générée** du canonique
(`interligens-9u9u343yk-…vercel.app`) — la documentation le dit explicitement : « When you enable Standard
Protection, the production generated deployment URL becomes restricted. » Le site reste servi sur
`app.interligens.com`. Aucun code du dépôt ne lit `VERCEL_URL` ni `VERCEL_BRANCH_URL` (vérifié :
`git grep` ne rend qu'un commentaire dans `src/lib/ops/prodWriteGuard.ts`), donc la migration décrite par
Vercel ne s'applique pas ici. Un seul point à surveiller : `src/app/en/kol/[handle]/class-action/page.tsx:22`
retombe sur `https://interligens-app.vercel.app` **si** `NEXT_PUBLIC_APP_URL` est absente.

### PRIMITIVE

**Vercel Authentication, portée Standard Protection.**

Nom et syntaxe **cités, pas présumés** — API REST, *Update an existing project* :

```json
{ "ssoProtection": { "deploymentType": "prod_deployment_urls_and_all_previews" } }
```

où la documentation donne la correspondance : `prod_deployment_urls_and_all_previews` = Standard Protection ·
`all` = All Deployments · `preview` = Only Preview Deployments · `null` = désactivé.

Plan : « Vercel Authentication can protect preview and production deployments **on all plans at no
additional cost**. » Le compte est Pro : la primitive est accessible.

> ⛔ **Ne pas utiliser `vercel project protection enable interligens-app --sso`.** La commande existe, mais
> son aide **ne nomme aucune option de portée**. Une activation dont la portée n'est pas énoncée peut
> retomber sur `all` et protéger `app.interligens.com` — c'est-à-dire éteindre le site. La portée doit être
> **choisie explicitement**, donc par le tableau de bord ou par l'API. C'est la seule raison pour laquelle la
> procédure du §2 passe par l'écran et non par la CLI.

### WHAT IT CHANGES

Toute requête vers une URL de déploiement du projet est arrêtée **à la périphérie de Vercel, avant le code
applicatif** — la documentation le pose : la protection « runs at Vercel's edge, before application code », et
« Deployment Protection requires authentication for all requests, **including those to Routing Middleware** ».

Conséquence directe pour cet incident : **`src/proxy.ts` ne s'exécute plus** sur ces URLs pour un appelant
anonyme. Le porteur de l'ancien `ADMIN_TOKEN` n'atteint plus le gestionnaire qui le compare. Ce n'est pas
une mise en retrait de la visibilité, c'est une **coupure au niveau de l'identité**, en amont de tout code.

Ce qui subsiste, et qu'il faut écrire : la protection reste franchissable par les **quatre voies documentées**,
qui sont toutes à configuration explicite, aucune active par défaut —

| Voie | État sur ce projet | Ce qu'il faut pour qu'elle existe |
|---|---|---|
| Protection Bypass for Automation (`x-vercel-protection-bypass`) | **aucun indice d'activation** — `VERCEL_AUTOMATION_BYPASS_SECRET` n'apparaît dans aucun des 226 noms de l'inventaire du poste | l'activer génère un secret ; **ne pas l'activer** |
| Shareable Links | non mesuré | génération explicite par un membre |
| Deployment Protection Exceptions | non mesuré | ajout explicite d'un domaine de preview |
| OPTIONS Allowlist | non mesuré | ajout explicite de chemins ; ne vaut que pour la méthode `OPTIONS` |

**À inscrire dans la procédure : n'activer aucune de ces quatre voies.** Chacune rouvrirait, globalement,
ce que l'action vient de fermer. Les trois « non mesuré » se lisent à l'écran *Deployment Protection* au
moment d'agir.

### WHAT IT PRESERVES

**Tout. Aucun artefact n'est touché.**

| Pièce | Après Standard Protection | Par où elle reste consultable |
|---|---|---|
| Octets de la source (le `.env` expédié) | **conservés** | `/_src` du déploiement — déjà réservé aux membres authentifiés de l'équipe **par défaut**, et l'onglet **Source** du tableau de bord |
| Logs de build | **conservés** | `/_logs` — même régime, et l'onglet **Building** |
| Logs d'exécution | **conservés** | section **Logs** du projet |
| Variables d'environnement de l'époque | **conservées** | attachées au déploiement, lisibles dans son résumé |
| Date, commit, auteur, métadonnées | **conservés** | `vercel inspect`, `vercel ls`, tableau de bord |

Le point qui décide, et qui répond mot pour mot à la question posée : **cette primitive ne rend les octets
inconsultables pour personne qui pouvait déjà les consulter.** `/_src` et `/_logs` sont, par défaut,
« accessed by you and authenticated members of your Vercel team ». Standard Protection place la même
exigence devant la même porte. Le public perd un runtime ; l'équipe ne perd pas une preuve.

> C'est exactement ce qui fait la valeur de cette primitive pour l'incident. Le `.env` du poste **a été
> modifié depuis l'exposition** (traitement de `X_BEARER_TOKEN`, mesuré en CC-OFFLINE-215). **Les 91
> déploiements retenus sont aujourd'hui le seul endroit où les octets exposés existent tels qu'ils ont été
> expédiés.** Une primitive qui les détruirait détruirait la mesure de notre propre exposition.

### REVERSIBLE?

**Oui, entièrement, et en un geste.** `"ssoProtection": null` remet l'état exact d'aujourd'hui. La
documentation le pose sans ambiguïté : « Disabling Vercel Authentication renders all existing deployments
unprotected. »

Deux propriétés à connaître avant d'agir, documentées, ni l'une ni l'autre bloquante :

1. **Rétroactivité** — « Vercel Authentication now protects all your **existing and future** deployments for
   the project. » C'est ce qui fait que les 91 sont couverts sans action individuelle.
2. **Rémanence des cookies à la réactivation** — « When you re-enable it, previously authenticated users can
   maintain access without a new login, provided they already authenticated to the specific deployment. » Le
   jeton est lié à **une seule URL** et n'est pas transférable. Sans objet ici : personne n'a jamais
   authentifié Vercel sur ces 91 URLs, puisque la protection n'a jamais été active.

> **Piège à ne pas confondre avec celle-ci.** Le réglage *Build Logs and Source Protection*, dans **Security**
> et non dans *Deployment Protection*, porte cette phrase : « **None of your existing deployments will be
> affected when you toggle this setting.** If you'd like to make the source code or logs private on your
> existing deployments, the only option is to delete these deployments. » Deux réglages voisins, **deux
> rétroactivités opposées**. Celui qu'il faut est *Deployment Protection* ; celui-là ne ferait rien sur
> l'existant, et sa page pousse vers la suppression. Ne pas ouvrir cet écran.

### DELETE?

**Non. Et ce n'est pas nécessaire.**

`DELETE /v13/deployments/<id>` (ou le menu **…** → **Delete**) supprime le déploiement. Ce geste :

- **rend le runtime non joignable** — oui ;
- **détruit les artefacts** — la source, les logs de build, les logs d'exécution et le déploiement lui-même
  disparaissent avec lui. **Les octets du `.env` exposé disparaissent aussi.** C'est-à-dire qu'il détruit
  la pièce probatoire de l'incident, en plus d'empêcher l'*instant rollback* et de casser les liens
  d'intégration ;
- **est irréversible**.

Il reste **STOP**, conformément à l'arbitrage — et il est ici superflu, puisqu'une primitive non destructive
existe et couvre l'objectif.

La **Deployment Retention Policy** est la même destruction, programmée : elle supprime automatiquement les
déploiements passé un délai. Même verdict, **STOP**, et elle ne doit pas être touchée dans cette campagne —
elle détruirait les 91 pièces à retardement.

### PROOF AFTER ACTION

*Préparée, non exécutée.* Cinq témoins, choisis pour couvrir chacun une manière différente de se tromper,
plus l'inventaire fournisseur.

| # | Témoin | Pourquoi celui-là |
|---|---|---|
| 1 | `interligens-668bg3zus-…` (2026-09-14, `9ee790c`) | **Le seul qui ait un « avant » mesuré.** C'est le témoin positif de T1 : même URL, même chemin, avant = le runtime a répondu. C'est la seule comparaison stricte du dossier. |
| 2 | `interligens-n9ujur82j-…` (2026-05-19, `1a5e27e`) | **Le plus ancien de l'ensemble.** Prouve que la protection porte sur toute la fenêtre de rétention et pas seulement sur les récents. |
| 3 | `interligens-mn2lqsqy4-…` (2026-07-07) | **Un point médian**, dans le creux de juillet. Écarte l'hypothèse d'un effet de bord aux deux extrémités. |
| 4 | `https://app.interligens.com` | **Le contrôle négatif, et il est indispensable.** Sans lui, « tous les témoins sont coupés » ne se distingue pas de « le site est tombé ». Attendu : **200 public**. |
| 5 | `interligens-9u9u343yk-…` (URL générée du canonique) | **Le collatéral assumé**, mesuré plutôt que découvert. Attendu : protégé. S'il ne l'est pas, la portée appliquée n'est pas celle qu'on croit. |

**Forme de la mesure : anonyme, sans aucun credential.** La protection s'exécutant avant le code applicatif,
aucun jeton ne peut la franchir : **envoyer l'ancien `ADMIN_TOKEN` n'ajouterait aucune information et
rejouerait une exposition.** Un simple `GET` sans en-tête suffit, et il est lisible grâce au discriminant
déjà établi en CC-OFFLINE-218 :

> sur un chemin sous `/api/admin/`, **« 401 **avec** `WWW-Authenticate: Basic realm="INTERLIGENS Admin"` »
> signifie que le code applicatif a répondu** — donc que la périphérie a laissé passer. Toute autre réponse
> (défi Vercel, redirection vers `vercel.com/sso-api`) signifie que la périphérie a intercepté.

La sonde de CC-OFFLINE-218 devient ainsi l'instrument de mesure de CC-OFFLINE-219, sans être modifiée et
sans transporter de secret.

**Inventaire fournisseur, à joindre aux témoins :**

```
vercel project protection --format json
  → attendu : "ssoProtection": { "deploymentType": "prod_deployment_urls_and_all_previews" }

vercel ls --environment production --format json   (les 5 pages)
  → attendu : 92 déploiements, tous READY — RIEN n'a été supprimé
```

Le second n'est pas décoratif : il est la preuve que la neutralisation **n'a pas été une destruction**.

---

## 1. TOUTES LES PRIMITIVES, ET LES TROIS QUESTIONS POSÉE À CHACUNE

| Primitive | Réellement non atteignable, ou seulement moins visible ? | Détruit-elle quelque chose ? | Réversible ? | Retenue |
|---|---|---|---|---|
| **Vercel Authentication + Standard Protection** | **Réellement.** Arrêt à la périphérie, avant le code applicatif et avant le middleware. | **Rien.** Source, logs, env, métadonnées intacts et consultables par l'équipe. | **Oui**, `ssoProtection: null`. | ✅ **OUI** |
| Vercel Authentication + All Deployments | Réellement — **y compris `app.interligens.com`**. | Rien. | Oui. | ❌ atteint le canonique |
| Vercel Authentication + Only Preview | Ne couvre pas les déploiements de production. | Rien. | Oui. | ❌ hors cible |
| Password Protection | Réellement, même couche. | Rien. | Oui. | ❌ **20 $/mois/projet** sur Pro — payant sans rien apporter de plus |
| Passport (IdP) | Réellement. | Rien. | Oui. | ❌ **Enterprise** — inaccessible, donc pas une primitive |
| Trusted IPs | Réellement, et c'est la seule voie « production seule ». | Rien. | Oui. | ❌ **Enterprise** — inaccessible |
| Retrait d'alias | **Seulement moins visible.** Les 91 **n'ont aucun alias** : il n'y a rien à retirer, et leur URL générée resterait de toute façon joignable. | Rien. | Oui. | ❌ sans effet sur la cible |
| *Build Logs and Source Protection* | Ne touche **pas** le runtime — protège `/_src` et `/_logs`, déjà protégés par défaut. | Rien, mais **sans effet rétroactif** et sa page recommande la suppression. | Oui. | ❌ hors sujet, écran à ne pas ouvrir |
| **Suppression du déploiement** | Réellement. | **OUI — détruit la source, les logs, les octets du `.env`.** | **NON.** | ⛔ **STOP** |
| **Deployment Retention Policy** | Réellement, à terme. | **OUI**, la même destruction, différée. | Non pour ce qui est déjà supprimé. | ⛔ **STOP** |
| WAF / règle de pare-feu par hôte | **Non vérifié.** La page consultée ne donne ni la disponibilité par plan des règles personnalisées, ni l'existence d'un critère portant sur l'hôte. | — | — | ❌ non retenue : non vérifiée, et filtrer devant un runtime vivant est plus faible que couper à l'identité |

**Il n'existe aucune primitive « désactiver un déploiement ».** La page *Managing Deployments* n'offre que :
supprimer, redéployer, promouvoir, revenir en arrière — et protéger, qui est un réglage **de projet**, pas de
déploiement. C'est pourquoi l'action est nécessairement globale au projet, et pourquoi le choix de la portée
est le seul point de vigilance de l'exécution.

---

## 2. PROCÉDURE POUR T1 — à suivre sans interprétation

> **T2 n'exécute rien de ce qui suit.** Cette procédure est écrite pour T1. Un seul opérateur modifie Vercel.

### Avant

1. Ne pas ouvrir l'écran **Settings → Security** (*Build Logs and Source Protection*). Ce n'est pas le bon
   écran et sa page pousse vers la suppression.
2. Ne pas utiliser `vercel project protection enable … --sso` : cette commande ne nomme pas la portée.
3. Relever l'état de départ, à joindre au dossier :
   ```
   vercel project protection --format json
   ```
   Attendu : `"ssoProtection": null`.

### L'action — un seul geste

1. Tableau de bord Vercel → projet **`interligens-app`** → **Settings** → **Deployment Protection**.
2. Section **Vercel Authentication** : activer.
3. **Portée : choisir explicitement « Standard Protection »** — décrite à l'écran comme protégeant tous les
   déploiements **sauf les domaines de production**. **Ne pas choisir « All Deployments »** : cela
   protégerait `app.interligens.com` et éteindrait le site.
4. **Save**.

Variante scriptable, si T1 la préfère à l'écran — elle nomme la portée, donc elle est acceptable :

```
PATCH https://api.vercel.com/v9/projects/interligens-app
{ "ssoProtection": { "deploymentType": "prod_deployment_urls_and_all_previews" } }
```

> Cette variante exige un jeton d'API Vercel. **En créer un est une création de credential** : si T1 n'en
> possède pas déjà un, passer par l'écran plutôt que d'en émettre un pendant une fenêtre d'incident.

### Immédiatement après — les cinq témoins, anonymes

Dans cet ordre, sans aucun credential, sans cookie :

1. `GET https://app.interligens.com/` → **attendu 200**. *Si ce n'est pas 200, arrêter tout et revenir en
   arrière : la portée appliquée n'est pas la bonne.*
2. `GET https://interligens-668bg3zus-davidpandoraparis-2892s-projects.vercel.app/api/admin/<segment tiré au sort>`
   → attendu : **plus de `WWW-Authenticate: Basic realm="INTERLIGENS Admin"`**, et un défi Vercel à la place.
3. Même chose sur `interligens-n9ujur82j-…` (le plus ancien).
4. Même chose sur `interligens-mn2lqsqy4-…` (le point médian).
5. `GET https://interligens-9u9u343yk-…vercel.app/` → attendu : protégé (collatéral assumé du §CANONICAL).

Puis l'inventaire fournisseur :

```
vercel project protection --format json          → deploymentType = prod_deployment_urls_and_all_previews
vercel ls --environment production --format json → 92 déploiements, tous READY, aucun supprimé
```

### Vérifications de non-régression, dans les 24 h

1. **Les crons.** Vercel déclenche les crons par un `GET` sur *l'URL de déploiement de production*. **La
   documentation ne dit pas si ces invocations sont exemptées de la protection de déploiement** — ni qu'elles
   le sont, ni qu'elles ne le sont pas. **C'est un INCONNU, et il ne doit pas être comblé par une supposition.**
   Ce qui le tranche : **attendre un vrai passage de cron** et lire son journal (*Settings → Cron Jobs → View
   Logs*). Un déclenchement manuel ne prouve rien — c'est déjà la règle du dossier.
   *Si les crons tombent :* revenir à `ssoProtection: null` (un geste, immédiat), et rapporter. **Ne pas**
   activer Protection Bypass for Automation pour compenser : cela créerait un secret de contournement global
   et rouvrirait précisément ce qu'on vient de fermer.
2. **Le lien de repli** `src/app/en/kol/[handle]/class-action/page.tsx:22` : vérifier que
   `NEXT_PUBLIC_APP_URL` est bien posée en Production, sinon cette page pointerait vers
   `interligens-app.vercel.app`, désormais restreinte.
3. **Aucune des quatre voies de contournement** ne doit être activée : Protection Bypass for Automation,
   Shareable Links, Deployment Protection Exceptions, OPTIONS Allowlist. Profiter de l'écran pour constater
   leur état — les trois dernières n'ont pas été mesurées par T2.

### Ce que cette action NE ferme PAS

- Elle ne rote aucun credential. Les 91 runtimes **détiennent toujours**, dans leur environnement figé, les
  anciennes valeurs — dont une `DATABASE_URL` dont le mot de passe est encore valide. La protection leur
  retire des visiteurs, pas leurs secrets.
- Elle ne dit rien des credentials exposés utilisés **ailleurs** qu'en frappant ces URLs.
- Elle ne dit rien de ce qui a pu être fait avant elle. Les journaux d'exécution des 91 sont conservés ; ils
  sont le seul endroit où cette question se lit.

---

## 3. POURQUOI C'EST P0, EN UNE PHRASE MESURÉE

Un runtime historique n'est pas une page ancienne : c'est **une surface d'administration complète, avec son
environnement de l'époque**. Les 91 portent l'ancien `ADMIN_TOKEN` *et* l'ancienne `DATABASE_URL`, dont le
mot de passe est toujours valide sur `ep-square-band`. Le témoin de T1 montre qu'on y entre. Ce n'est pas
une fuite de contenu statique, c'est un **accès administrateur à la base de production, réparti sur 91 URLs
publiques**.

Et la frontière ratifiée par l'architecte dit pourquoi l'ordre compte :

> *Credential rotation is incomplete while a publicly reachable retained runtime continues to accept the
> compromised credential.*

Tourner `CRON_SECRET` puis la base sur le seul déploiement canonique, sans neutraliser les 91, reproduirait
l'incident à chaque credential — et le reproduirait **91 fois**.

Une nuance mesurée qui borne le risque sans le réduire : les crons ne s'exécutent que sur le déploiement de
production courant, et un retour arrière ne les déplace pas. **Les 91 ne sont pas des acteurs programmés ;
ce sont des portes ouvertes.** Elles n'agissent que si on les pousse — mais n'importe qui détenant les
octets exposés peut les pousser.

---

## 4. CE QUE CETTE FENÊTRE N'A PAS FAIT

- **Aucune neutralisation, aucune protection, aucune désactivation, aucun retrait d'alias.** T2 a mesuré ;
  T1 exécutera. Un seul opérateur sur Vercel.
- **Aucune suppression, aucune purge**, sous aucune forme.
- **Aucune requête vers un déploiement**, ni authentifiée ni anonyme. Le témoin `ADMIN_TOKEN` n'a pas été
  rejoué, et aucun autre n'a été ajouté. La joignabilité a été établie **sur le plan de contrôle**
  (`ssoProtection: null`), ce qui est une mesure plus forte qu'une requête et n'expose rien.
- Aucun credential créé, roté, révoqué. **Aucun jeton d'API Vercel émis.**
- Aucune valeur de secret affichée, journalisée ou écrite. Aucun fichier d'environnement modifié.
- Aucun `CRON_SECRET`, aucune session X, aucune base. Aucun autre audit intercalé.
- Aucun déploiement. Aucune écriture en base, aucune DDL.
- Toutes les commandes Vercel employées sont en lecture : `whoami`, `ls`, `inspect`, `alias ls`,
  `project ls`, `project protection` **sans action** (la forme sans `enable`/`disable` est l'affichage).

---

## ANNEXE A — les 91, dans l'ordre des dates

Ensemble exact : Production · retenu · `READY` · joignable · non canonique.
Hash d'URL = segment variable de `https://interligens-<hash>-davidpandoraparis-2892s-projects.vercel.app`.

| Date UTC | Hash d'URL | Commit | Sujet |
|---|---|---|---|
| 2026-09-14 13:56 | `668bg3zus` | `9ee790c` | feat(casefile): SPINE-00 — l'exécuteur gouverné : fo |
| 2026-09-13 15:10 | `6av5wl8j7` | `db09942` | chore(guard): referme la fenêtre S1-B — guard byte-i |
| 2026-09-13 14:23 | `1pdx079o5` | `04b7316` | fix(cases): containment de l'index public — la carte |
| 2026-09-13 11:46 | `r0myrenyo` | `adb543b` | chore(guard): referme la fenêtre E-RC-A — guard byte |
| 2026-09-12 18:21 | `nsntzwkvp` | `9cfa03a` | fix(p0): l'artefact portable ne porte plus l'oracle  |
| 2026-09-12 17:03 | `o29v2m90y` | `dff3bb3` | fix(governance): le refus est une CLÉ ABSENTE, jamai |
| 2026-09-12 16:41 | `2cwzytoth` | `5fd6611` | chore(guard): referme la fenêtre W9 — guard byte-ide |
| 2026-09-12 13:15 | `9oztnn51x` | `80fb708` | chore(guard): referme la fenêtre S3 — guard byte-ide |
| 2026-09-10 13:18 | `o5b0295ce` | `df031b3` | chore(guard): referme la fenêtre S1 — guard byte-ide |
| 2026-09-10 08:20 | `71w6l9il7` | `b35d30c` | chore(guard): referme la fenêtre S8 — guard byte-ide |
| 2026-09-10 08:18 | `de1ywsgwg` | `b35d30c` | chore(guard): referme la fenêtre S8 — guard byte-ide |
| 2026-09-09 19:32 | `3wdolykv4` | `4607b7b` | Le correctif est mergé (#363). La fenêtre se referme |
| 2026-09-09 18:36 | `ja7440yhy` | `cd28d13` | Le correctif est mergé (#358). La fenêtre n'a plus d |
| 2026-09-09 16:21 | `3m2ctoop6` | `2188d5d` | fix(intelligence): S3.1 — la forme sanctions portait |
| 2026-09-09 15:41 | `e57xq6173` | `3864314` | chore(guard): fermeture de la fenêtre S3 — retour à  |
| 2026-09-09 14:14 | `g5nv5ezir` | `d0e8bae` | fix(methodology): on n'annonce pas une source qui n' |
| 2026-09-09 13:14 | `qq7kj586h` | `42d0ab2` | fix(intelligence): un jeton n'est pas une chaîne — l |
| 2026-09-09 12:45 | `o8r5vzxfj` | `6c88bef` | fix(evidence,intelligence): le périmètre du watchdog |
| 2026-09-09 12:07 | `krbs4f7hq` | `21c26b6` | fix(prebuy): les six conditions d'attestation, en un |
| 2026-09-09 11:46 | `bclh4i1r4` | `51402ff` | chore(guard): refermeture byte-identique — 0 exempti |
| 2026-09-09 11:10 | `4l5w3jw90` | `6de02d9` | chore(guard): refermeture byte-identique — 0 exempti |
| 2026-09-09 10:07 | `fqn7bf5du` | `e4d8577` | chore(guard): refermeture byte-identique — 0 exempti |
| 2026-09-09 09:48 | `dk8brko7d` | `9b45351` | chore(guard): refermeture byte-identique — 0 exempti |
| 2026-09-09 06:47 | `b65i0gatb` | `e74ddf2` | chore(guard): refermeture byte-identique — 0 exempti |
| 2026-09-08 20:19 | `cmtbqrdfv` | `83266b0` | fix(prebuy): le défaut du chemin pré-achat était l'a |
| 2026-09-08 19:39 | `hxtw1y4wn` | `7e759c9` | fix(reflex): une cause connue cesse de se présenter  |
| 2026-09-08 18:38 | `k84hdclas` | `6fdbf83` | guard: refermeture de la fenêtre — P0 Agave tx v1 |
| 2026-09-08 17:57 | `nfliat3gu` | `f41ab1f` | fix(reflex): la relecture ne réeffondre plus l'axe d |
| 2026-09-08 17:47 | `2xwsnwa9q` | `57914a0` | guard: refermeture de la fenêtre BUILD 11 / REFLEX V |
| 2026-09-08 15:26 | `33i2m23om` | `a8850ed` | guard: refermeture de la fenêtre — P0 SECURITY, ADMI |
| 2026-09-08 14:49 | `aqk23u3o8` | `5bd6b25` | guard: refermeture de la fenêtre — P0 cross-case con |
| 2026-09-08 13:48 | `19bwpi88g` | `715d3b2` | guard: refermeture de la fenêtre — P0 free-text mone |
| 2026-09-08 13:11 | `od38w3uv8` | `02954f4` | guard: refermeture de la fenêtre BUILD 10 / FENÊTRE  |
| 2026-09-08 11:47 | `1201jcrze` | `4607d28` | guard: refermeture de la fenêtre BUILD 10 / P0 PUBLI |
| 2026-09-07 19:18 | `mjyo7j3xe` | `c80a4a9` | docs(build9): gate final — classement de /generate,  |
| 2026-09-07 18:20 | `bq91lp0pz` | `6b9df7f` | guard: refermeture de l'exemption BUILD 9 étape 7 —  |
| 2026-09-07 12:16 | `5kbspp268` | `8377feb` | guard: refermeture de l'exemption POINT 5 — retour b |
| 2026-09-07 11:55 | `5gkg6x483` | `d4cec90` | docs(build8): clôture — 8 points sur 9, le 5 ne pass |
| 2026-09-07 11:03 | `br2036r28` | `a4cff7c` | docs(build8): clôture E2/E1 — 10 points conformes, 3 |
| 2026-09-07 09:54 | `7a18jsiz0` | `b4642fc` | docs(build8): clôture des étapes 1 à 6 — fenêtre 14  |
| 2026-08-28 09:28 | `2e3v8gmqk` | `4cb4919` | docs: rapport de mise en shadow V3 |
| 2026-08-28 08:59 | `909yp3l8o` | `4cb4919` | docs: rapport de mise en shadow V3 |
| 2026-08-28 04:59 | `n1452mawp` | `4cb4919` | docs: rapport de mise en shadow V3 |
| 2026-08-27 20:04 | `2pida1t63` | `2217cbc` | docs: rapport du correctif d'alerte veille LLM |
| 2026-08-27 19:45 | `qkbhwsrkj` | `5162273` | docs(hotfix): correction — Quality Gates passe le Li |
| 2026-08-26 19:53 | `4x0j66hk5` | `12c66b9` | fix(intelligence): la rétraction tourne enfin pour l |
| 2026-08-26 19:02 | `obhzu3sfz` | `cbc3278` | fix(evidence): la route de commit OSINT signale enfi |
| 2026-08-26 17:46 | `pzavuha9p` | `211da11` | feat(intelligence): invariant de couverture publié p |
| 2026-08-26 16:53 | `rhknp7ib2` | `0b64cd2` | perf(intelligence): 1705 -> 116 allers-retours Neon  |
| 2026-08-26 15:09 | `8m7fmqp9u` | `e960e4f` | fix(intelligence): compteurs d'ingestion honnêtes +  |
| 2026-08-26 11:55 | `cxri66eeo` | `42fd978` | fix(intelligence): le risque courant ne se dérive qu |
| 2026-08-26 04:45 | `ngsl3454j` | `eb7df81` | fix(intelligence): ferme les 3 voies de promotion RE |
| 2026-08-25 13:19 | `gj6maby68` | `0642206` | feat(watcher-v2): la route journalise chaque run dan |
| 2026-08-24 19:39 | `ccyvvu77z` | `088bfef` | docs(prep): rapport de déploiement du reaper + confi |
| 2026-08-24 19:11 | `brime8793` | `088bfef` | docs(prep): rapport de déploiement du reaper + confi |
| 2026-08-21 12:03 | `kkkb9f1s6` | `6182975` | docs(prep): rapport de merge du reaper + cron dédié  |
| 2026-08-21 07:01 | `eqhutpf6z` | `eccd1a0` | chore(guard): retrait de la fenêtre P0-GUARD gates d |
| 2026-08-20 22:21 | `j1kxbhwba` | `ee754b0` | fix(security): les gates de page VALIDENT la session |
| 2026-08-20 22:14 | `q2fsnuvt1` | `ee754b0` | fix(security): les gates de page VALIDENT la session |
| 2026-08-20 20:17 | `bzksd6dvh` | `8fc9725` | fix(security): le gate nominatif VALIDE la session,  |
| 2026-08-20 20:12 | `gdcrnk5ph` | `8fc9725` | fix(security): le gate nominatif VALIDE la session,  |
| 2026-08-20 20:06 | `qqphcnwcs` | `8fc9725` | fix(security): le gate nominatif VALIDE la session,  |
| 2026-08-19 14:19 | `ickbndq5e` | `139580d` | docs: relevé de l'état AVANT déploiement — la passe  |
| 2026-08-16 19:20 | `188ise42d` | `c78ba46` | fix(scoring): un compte de programme n'est pas un dé |
| 2026-08-16 10:56 | `gas9c95e0` | `1178ab8` | feat(admin): bouton de dépublication + rapport de cl |
| 2026-08-16 05:37 | `69nks5vtr` | `3de3d3d` | chore(guard): retrait de l'exemption feat/cc-offline |
| 2026-08-15 20:48 | `67pog0rwg` | `d3ad228` | fix(test): typecheck vert sur le test d'alignement d |
| 2026-08-15 13:05 | `ln1gxlp1n` | `63e423b` | docs(isolation): le §3 devient un compte rendu, pas  |
| 2026-08-14 19:28 | `678o57w5p` | `5b362e8` | chore(guard): retrait des exemptions des 4 chantiers |
| 2026-08-14 13:50 | `3lzy0v5wq` | `b1db566` | chore(guard): retrait de la dernière exemption de la |
| 2026-08-14 13:08 | `inxhyohvn` | `b1db566` | chore(guard): retrait de la dernière exemption de la |
| 2026-08-14 12:23 | `pjdvyhycp` | `b1db566` | chore(guard): retrait de la dernière exemption de la |
| 2026-07-29 19:43 | `3jgk7oxub` | `536bfbb` | fix(xapi): authoritative X usage guard (posts, 21-21 |
| 2026-07-29 18:42 | `k2psc0bly` | `1d834b8` | fix(watchdog): add DB connection retry (3 attempts,  |
| 2026-07-07 09:43 | `r7s6uhpk3` | `f255a7a` | fix(test): repair scan-resolve mock ($queryRawUnsafe |
| 2026-07-07 07:22 | `mn2lqsqy4` | `38b6b5e` | fix(security): redact cashout bucket on non-publishe |
| 2026-07-06 08:45 | `6pwqgxc62` | `886d349` | test(osint): cc-offline-48 — TEST 3 retail dedup gat |
| 2026-07-06 06:42 | `d175u1qmk` | `81b528c` | Merge cc-offline-47: multi-token OSINT vision extrac |
| 2026-06-30 07:30 | `fv7kse8ge` | `f8e77c1` | feat(osint): Sprint C1 — porte retail OSINT, constru |
| 2026-06-30 05:57 | `8qc8s51r4` | `bcac302` | feat(osint): Sprint B — Review UI + Observabilité (s |
| 2026-06-30 05:39 | `8ya6zm9id` | `8caef9a` | feat(bridge): Sprint 4.5 — threshold hardening (requ |
| 2026-06-26 11:19 | `hws6d0vpz` | `ad71cb8` | feat(watcher-v2): hard monthly X API budget cap ($10 |
| 2026-06-26 09:51 | `bwdxbicco` | `9196ff1` | feat(scan): resolve real tickers via DexScreener wit |
| 2026-05-27 14:16 | `78k9ik8zx` | `97a61b1` | feat: LAB token casefile — first token_casefiles ent |
| 2026-05-20 07:11 | `ew7118h24` | `97a61b1` | feat: LAB token casefile — first token_casefiles ent |
| 2026-05-19 19:27 | `h3c9bm3rg` | `9675915` | fix: nav horizontal scroll (min-width:0) + decouple  |
| 2026-05-19 19:09 | `i0x0n3a11` | `b5e6a6a` | fix: tighten field grid spacing in PlatformCasefileV |
| 2026-05-19 19:02 | `eiym206ww` | `e978299` | fix: widen PlatformCasefileView to 1200px with 2-col |
| 2026-05-19 18:31 | `ajvj24raz` | `255012d` | fix: align PlatformCasefileView container width with |
| 2026-05-19 16:19 | `5pf1m7qi2` | `704afc5` | fix: embed bodyMarkdown in seed-cbex to remove local |
| 2026-05-19 10:12 | `n9ujur82j` | `1a5e27e` | feat: methodology pages updated with complete platfo |
_91 lignes. Le canonique `9u9u343yk` (`84aa358`) est absent de ce tableau : c'est sa définition._
