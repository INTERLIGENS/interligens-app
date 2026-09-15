# CC-OFFLINE-220 — Existe-t-il un accès cron natif et *scoped* à travers Standard Protection ?

Fenêtre INCIDENT ROTATION. **Lecture seule.** Aucun secret créé, aucun réglage Vercel modifié,
aucune requête émise vers un runtime, `vercel.json` non touché. Reconnaissance documentaire
uniquement, sur la documentation Vercel courante (pages datées `last_updated` 2026-08-04 à 2026-08-28).

---

## VERDICT

```
NATIVE SCOPED CRON ACCESS THROUGH STANDARD PROTECTION = NO
```

La primitive de traversée existe — **Protection Bypass for Automation** — mais elle n'est pas scopée :
elle accorde l'accès à **quiconque détient une valeur**, sur **n'importe quelle URL du projet**, y
compris rétroactivement sur les 91 déploiements historiques que nous cherchons précisément à fermer.
C'est le cas explicitement disqualifié par l'architecte.

La seule primitive Vercel qui soit réellement scopée à un **acteur identifié** — **Trusted Sources**
(OIDC) — n'est documentée nulle part comme couvrant l'invocation cron. Sur ce point précis, et
uniquement sur ce point, l'état est `NOT_ESTABLISHED` (§ candidat 2).

Le contrat `MECHANISM / SCOPE / …` n'est donc pas rempli : il n'est dû que sur un `YES`.

---

## Ce que la documentation courante confirme du diagnostic de l'autre terminal

1. **La collision est documentée côté Vercel, pas seulement mesurée côté plan de contrôle.**
   « When you enable Standard Protection, the production [generated deployment URL](…) becomes
   restricted. » — *Deployment Protection on Vercel*, § How to migrate to Standard Protection.
   C'est exactement la classe d'URL que `crons.definitions[].host` porte pour les 18 crons.

2. **La protection s'exécute avant le code applicatif.**
   « Protection runs at Vercel's edge, before your application code. It intercepts every request,
   including Routing Middleware, CORS preflights, server-to-server calls, and static file requests,
   before your route handlers run. » — KB *How do I add password protection…*
   Corollaire : `CRON_SECRET`, qui est comparé **dans le route handler**, n'est jamais atteint. La
   défense applicative des crons est hors-jeu, en aval de la frontière.

3. **L'échec est silencieux.**
   « Cron jobs do not follow redirects. When a cron-triggered endpoint returns a 3xx redirect status
   code, the job completes without further requests. » et « when cron jobs respond with a redirect or
   a cached response, they will not be shown in the logs » — *Managing Cron Jobs*.
   Vercel Authentication répond par « a Vercel login redirect » (*Restrict access to deployments with
   Vercel Authentication*). Le cron se terminerait sans s'exécuter et sans trace.

4. **La liste des porteurs d'accès est énumérée et fermée — le cron n'y figure pas.**
   *Who can access protected deployments?* (page Vercel Authentication) énumère six entrées : membres
   d'équipe connectés, membres de projet, membres d'un access group, utilisateurs à qui l'accès a été
   accordé, détenteurs d'un Shareable Link, outils utilisant l'en-tête de protection bypass.
   Aucune mention du planificateur cron, ni d'un trafic interne Vercel.

---

## Qualification candidat par candidat

Question qui décide, posée à chaque candidat : **acteur identifié, ou quiconque détient une valeur ?**

### 1. Protection Bypass for Automation — EXISTE, NON SCOPÉ → disqualifié

- **Plan** : inclus sur Hobby, Pro, Enterprise (*Usage & Pricing for Deployment Protection*).
- **Portée** : « You can use each available secret to bypass Deployment Protection on **all
  deployments in a project** until the secret is revoked. » — donc rétroactif sur les 91 runtimes
  historiques, qui sont l'objet même du P0.
- **Porteur** : en-tête `x-vercel-protection-bypass` **ou paramètre de requête** de même nom. Vercel
  documente lui-même l'usage en query param pour Slack/Stripe/GitHub, et avertit : « the secret
  appears in the URL. URLs are often logged by proxies, CDNs, and server access logs. »
- **Réponse à la question qui décide** : **quiconque détient une valeur**. Aucune identité n'est
  prouvée, aucune origine n'est vérifiée. C'est une porte dérobée réutilisable, pas une séparation
  d'autorité.
- **De surcroît, inutilisable par le cron** : le planificateur émet un `GET` dont les seuls en-têtes
  documentés sont le user agent `vercel-cron/1.0`, `x-vercel-cron-schedule`, et `Authorization:
  Bearer $CRON_SECRET`. Rien ne permet d'y ajouter un en-tête. La seule forme concevable serait
  d'embarquer le secret en query string dans `crons[].path` — ce qui (a) exigerait de modifier
  `vercel.json`, non autorisé dans cette fenêtre, (b) écrirait le secret en clair dans le dépôt,
  (c) n'est documenté nulle part comme supporté (`path` — « Must start with `/` », longueur max 512 ;
  aucune mention de query string).

**→ NO au sens exact de la consigne : la primitive existe mais elle n'est pas scopée, elle rouvre
globalement ce qu'on ferme.**

### 2. Trusted Sources (OIDC) — SCOPÉ, mais couverture cron NON ÉTABLIE

C'est le seul candidat de la bonne forme, et il mérite d'être décrit précisément car il satisfait
l'invariant de l'architecte pour *d'autres* principaux machine.

- « Trusted Sources control which workloads can reach this project's protected deployments: this
  project itself, other Vercel projects in the same team, and external services like GitHub Actions
  or GitLab CI. Every authorized caller authenticates with a **short-lived OIDC token signed by its
  own identity provider**, so you don't share a static secret **or open the deployment to the public
  internet**. »
- Porteur : en-tête `x-vercel-trusted-oidc-idp-token`. Vercel vérifie la signature contre le JWKS de
  l'émetteur, vérifie chaque claim configurée, et vérifie que l'environnement cible est autorisé par
  la règle `from`/`to`. Trois contrôles, échec → la requête retombe sur la protection normale.
- Accès par défaut : « This project can always call its own deployments within the same environment:
  Production calls production… »

**Pourquoi ce n'est pas encore une réponse `YES` :** la documentation est explicite sur *qui attache
le jeton*, et c'est toujours le code de l'appelant.

> « The **calling project's function** forwards its Vercel OIDC token »
> « In the calling project's function, read the OIDC token with `getVercelOidcToken()` … and forward
> it on the request »
> « The external service must **attach its OIDC token to each outgoing request** in the
> `x-vercel-trusted-oidc-idp-token` header. »

Et le jeton OIDC d'un projet est décrit comme disponible *dans* un build (`VERCEL_OIDC_TOKEN`) ou
*dans* une fonction en cours d'exécution (`x-vercel-oidc-token` sur l'objet `Request`) — c'est-à-dire
pour des appels **sortants**. Le planificateur cron n'est pas une fonction du projet : c'est de
l'infrastructure Vercel qui émet une requête **entrante**. Aucune page ne dit que cette requête porte
un jeton OIDC, et la signature documentée de la requête cron (§ 1) ne l'inclut pas.

- **Plan** : Trusted Sources **n'apparaît pas** dans la table *Usage & Pricing for Deployment
  Protection*, qui liste pourtant les dix autres fonctions ligne à ligne. La disponibilité sur Pro
  n'est donc pas documentée — à confirmer avant toute conception qui s'appuierait dessus.

**→ `NOT_ESTABLISHED` sur ce candidat seul.** Trancher demanderait soit une confirmation écrite du
support Vercel, soit d'armer la protection sur la production pour observer — exactement ce que
l'architecte a interdit.

### 3. Deployment Protection Exceptions — l'inverse de ce qu'on cherche

« When you add a domain to Deployment Protection Exceptions, it becomes **publicly accessible** and is
no longer covered by Deployment Protection features. » Vercel double l'avertissement dans *Automated &
Agent Access* : « Deployment Protection Exceptions make the specified domain accessible to **anyone**,
not only your automated systems. » Conçu pour des domaines de preview ; pour la production, la doc
renvoie à *Only Production Deployments*, c'est-à-dire Trusted IPs, **Enterprise**.
**→ Disqualifié : rouvre anonymement la surface qu'on ferme.**

### 4. OPTIONS Allowlist — hors sujet par la méthode

Ne s'applique qu'aux requêtes de méthode `OPTIONS` (préflight CORS). L'invocation cron est un `GET`.
**→ Inapplicable.**

### 5. Shareable Links — hors sujet par le principal

Accès humain externe à la dernière livraison d'une branche, via un paramètre de requête, pour voir et
commenter. **→ Inapplicable, et non scopé à un acteur.**

### 6. Trusted IPs — indisponible, et récusé par Vercel pour ce cas

« Available on the **Enterprise** plan » (compte en Pro → primitive inaccessible, donc pas une
primitive). Vercel écrit par ailleurs, à propos de l'automatisation : « automated systems running on
cloud infrastructure … typically have rotating or unpredictable IP addresses. Maintaining an IP
allowlist for these systems is impractical and error-prone. » Aucune plage d'IP du planificateur cron
n'est publiée. **→ Inapplicable.**

### 7. Passport — hors sujet par le principal

Enterprise, et fondé sur l'authentification de **visiteurs** auprès d'un fournisseur d'identité.
**→ Inapplicable.**

### 8. Exemption cron de l'Attack Challenge Mode — le faux ami, et la preuve par l'absence

Vercel **sait** identifier son propre trafic cron de façon authentique, et l'a déjà exempté une fois,
explicitement : les Vercel Cron Jobs sont « exempt from challenges when running in the same account »,
traités comme « trusted internal traffic », et ces user agents « are validated to be authentic and
cannot be spoofed ».

Mais cette exemption est documentée pour l'**Attack Challenge Mode** (pare-feu), pas pour la
Deployment Protection. C'est le point le plus fort du dossier négatif : là où l'exemption cron existe,
Vercel la documente nommément. Elle n'existe nulle part pour la Deployment Protection, dont la liste
des porteurs d'accès est par ailleurs énumérée et close (§ 4 plus haut).

---

## Deux faits à verser au dossier avant que (c) ne soit préparée

Signalés comme constats, sans élargissement : la voie (c) n'est pas autorisée dans cette fenêtre.

1. **Le host des crons n'a pas de réglage documenté.** « To trigger a cron job, Vercel makes an HTTP
   GET request to **your project's production deployment URL**, using the `path` provided in your
   project's `vercel.json` » ; l'objet cron n'accepte que `path` et `schedule`. Aucune primitive
   documentée ne permet de désigner le domaine visé. « Faire pointer les crons vers un domaine de
   production public » n'a donc pas de levier de configuration connu à ce stade — à établir avant de
   dimensionner le second déploiement borné.

2. **Standard Protection, dans sa définition courante, laisse les domaines de production publics** :
   « Protects all deployments **except** production domains » (clé API `ssoProtection.deploymentType =
   prod_deployment_urls_and_all_previews`). À ne pas confondre avec *(Legacy) Standard Protection*,
   qui protège « all preview URLs and deployment URLs » en laissant publiques les URL de production à
   jour. Les deux existent encore dans l'interface ; ce ne sont pas les mêmes frontières.

---

## Sources

Documentation Vercel, consultée le 2026-09-15 :

- `/docs/deployment-protection` (last_updated 2026-08-28)
- `/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication` (2026-08-28)
- `/docs/deployment-protection/methods-to-bypass-deployment-protection` (2026-08-21)
- `/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation` (2026-08-28)
- `/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources` (2026-08-28)
- `/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions` (2026-08-28)
- `/docs/deployment-protection/automated-agent-access` (2026-08-21)
- `/docs/deployment-protection/usage-and-pricing` (2026-08-21)
- `/docs/errors/trusted_sources_environment_mismatch`
- `/docs/oidc` (2026-08-04)
- `/docs/cron-jobs` (2026-08-11) et `/docs/cron-jobs/manage-cron-jobs` (2026-08-11)
- `/docs/project-configuration/vercel-json` § crons (2026-08-14)
- `/changelog/trusted-sources-for-deployment-protection`
- `/changelog/attack-challenge-mode-now-allows-verified-bots-and-vercel-cron-jobs`
- `/kb/guide/how-do-i-add-password-protection-to-my-vercel-deployment`
- `/kb/guide/troubleshooting-vercel-cron-jobs`

## État inchangé à la sortie de la fenêtre

| Objet | État |
| --- | --- |
| Standard Protection | HOLD — non activée |
| Protection Bypass for Automation | non armé (`protectionBypass` = `{}`, `VERCEL_AUTOMATION_BYPASS_SECRET` absente des 96 variables Production) |
| `CRON_SECRET` | HOLD, non roté |
| `vercel.json` | non modifié |
| Réglages Vercel | aucun |
| Déploiement | aucun |
