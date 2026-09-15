# HISTORICAL_ONLY_PROTECTION — instruction unique, lecture seule

CC-OFFLINE-221 · fenêtre INCIDENT ROTATION · 2026-09-15 · aucun changement Vercel, aucune requête runtime,
aucun ticket support, aucun secret. Documentation courante uniquement (pages datées `last_updated: 2026-08-28`
et `2026-08-21`).

Question posée, et une seule :

> Peut-on protéger les 91 generated deployment URLs HISTORIQUES tout en laissant accessible la generated
> deployment URL du CANONIQUE COURANT ?

---

## HISTORICAL_ONLY_PROTECTION = NOT_ESTABLISHED

Pas NO. Une primitive existe dont la description *nomme* la distinction cherchée. Mais la documentation
courante de Vercel se contredit sur le point exact qui décide, la primitive est absente de la table
Usage & Pricing, et deux pages Vercel officielles ne s'accordent pas sur la valeur d'API qui l'active.
Ces trois défauts portent tous sur la même charnière ; aucun ne se lève par lecture.

Conformément au cadrage, NOT_ESTABLISHED est traité comme NO : on ne laisse pas les 91 runtimes
exploitables en attendant que Vercel clarifie sa propre documentation.

---

## 1. La primitive candidate, et pourquoi elle n'est pas établie

**`(Legacy) Standard Protection`** — c'est le seul objet de tout le catalogue Vercel dont la portée est
énoncée en termes d'**ancienneté** d'un déploiement et non de **classe d'URL**.

Les quatre portées documentées aujourd'hui (`/docs/deployment-protection`, « Choose which URLs to protect ») :

| Portée (UI) | Valeur d'API | Ce que la doc en dit, mot pour mot |
| --- | --- | --- |
| Standard Protection | `all_except_custom_domains` (voir §3) | « Protects all deployments **except** production domains » |
| All Deployments | `all` | « Protects **all** URLs, including production domains » |
| (Legacy) Standard Protection | `prod_deployment_urls_and_all_previews` (voir §3) | « Protects all preview URLs and deployment URLs. **All up-to-date production URLs remain unprotected.** » |
| (Legacy) Pre-Production Deployments | `preview` | « Protects only preview URLs. **Does not protect past production deployments.** » |

Deux de ces quatre lignes emploient le vocabulaire *past* / *up-to-date*. C'est exactement la frontière
que nous cherchons, et c'est pour cela que la réponse ne peut pas être un NO sec.

Le changelog qui a introduit cette portée s'intitule d'ailleurs, littéralement,
**« Protect past Production Deployments with Deployment Protection »** (2 novembre 2023) — et la
Knowledge Base Vercel décrit le comportement par défaut ainsi :

> « By default, Vercel Authentication is automatically enabled for all deployments **with the exception of
> the most recent production deployment**. »

Une exception portant sur *un déploiement* (le plus récent), pas sur une classe d'URL. Si cette phrase est
exacte et courante, la réponse à la question de la fenêtre est YES.

### La contradiction qui bloque

Le même corpus dit aussi, sur la même portée, l'inverse :

- Le changelog du 2 novembre 2023, deux phrases plus bas que son titre :
  « Standard Protection **restricts access to the production generated deployment URL.** » — singulier,
  sans qualificatif d'ancienneté.
- Le nom même de la valeur d'API : `prod_deployment_urls_and_all_previews` — « les URL de déploiement de
  prod » **et** tous les previews. Aucune notion de courant/passé.
- La doc de portée : « Protects all preview URLs and **deployment URLs** », où *deployment URLs* pointe
  vers `/docs/deployments/generated-urls`, c'est-à-dire précisément la classe `<project>-<hash>-<scope>.vercel.app`
  — celle des 91, et celle du canonique courant, indistinctement.

Il existe une lecture qui réconcilie tout, et elle est plausible : « up-to-date production URLs » ne
désignerait pas l'URL à hash du déploiement canonique, mais les **alias qui pointent vers lui** —
`<project>-<scope>.vercel.app` et `<project>-git-<branch>-<scope>.vercel.app`. Cette lecture est appuyée
par le changelog du 14 juillet 2025 (« More Secure Deployment Protection »), qui explique que la
*nouvelle* Standard Protection a précisément ajouté à la protection « the production branch git domain,
for example `project-git-main.vercel.app` » — ce qui n'a de sens que si l'ancienne le laissait ouvert.

Sous cette lecture, `(Legacy) Standard Protection` protège **aussi** l'URL à hash du canonique courant, et
ne laisse ouverts que ses alias. Ce qui change tout pour nous, car :

> « To trigger a cron job, Vercel makes an HTTP GET request to your project's **production deployment URL** …
> An example endpoint … might be: `https://*.vercel.app/api/cron`. » — `/docs/cron-jobs`

Le cron vise bien une URL générée `*.vercel.app` et non le domaine custom — ce qui recoupe la mesure de
l'autre terminal (bascule d'hôte à 15:00 UTC quand le déploiement de remédiation est devenu canonique).
Une bascule d'hôte à chaque changement de canonique n'est compatible qu'avec l'URL **à hash**, pas avec un
alias stable. Si l'URL à hash du canonique est dans l'ensemble protégé, `(Legacy) Standard Protection`
casse le cron exactement comme la Standard globale, et n'apporte rien.

**Les deux lectures sont textuellement soutenues, par des pages Vercel courantes, et elles s'excluent sur
le seul point qui décide.** Établir laquelle est vraie demande une requête vers un runtime — interdite
dans cette fenêtre, et de toute façon non concluante tant que la portée n'est pas activée.

---

## 2. Disponibilité sur le plan Pro : NON ÉNONCÉE

La table `/docs/deployment-protection/usage-and-pricing` (`last_updated: 2026-08-21`) énumère douze
lignes : Vercel Authentication, Standard Protection, All Deployments, Password Protection, Passport,
Trusted IPs, Only Production Deployments, Deployment Protection Exceptions, Protection Bypass for
Automation, OPTIONS Allowlist, Shareable Links, Protected Source Maps.

**`(Legacy) Standard Protection` n'y figure pas.** Ni `(Legacy) Pre-Production Deployments`. Ni, comme
relevé à la fenêtre précédente, Trusted Sources.

Même diagnostic, donc, que pour Trusted Sources : une portée décrite dans la page conceptuelle mais
absente de la matrice plan/prix. Rien n'énonce qu'un projet Pro qui n'est pas *déjà* sur cette portée
puisse la sélectionner. Le changelog du 14 juillet 2025 précise que les projets existants n'ont **pas** été
migrés et peuvent « update to this new behavior » — une migration décrite dans un seul sens, du legacy vers
le nouveau. Aucune source ne documente le trajet inverse ni une sélection *ab initio*.

Une primitive dont la disponibilité n'est pas énoncée n'est pas une primitive disponible.

---

## 3. Défaut de documentation sur la syntaxe d'activation elle-même

Deux pages Vercel courantes donnent deux mappages incompatibles de la même valeur :

- `/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication` liste trois valeurs et
  annonce : `prod_deployment_urls_and_all_previews` **= Standard Protection**.
- La référence REST (`update-an-existing-project`) expose **quatre** valeurs :
  `all`, `preview`, `prod_deployment_urls_and_all_previews`, `all_except_custom_domains`.

Or la page conceptuelle définit Standard Protection comme « all deployments except production domains »,
ce qui correspond à `all_except_custom_domains`, et range `prod_deployment_urls_and_all_previews` sous
*(Legacy)*. La page Vercel Authentication est donc restée au mappage d'avant juillet 2025.

Conséquence directe : même si l'architecte tranchait sur la sémantique, **la doc ne permet pas d'affirmer
sans présumer quelle valeur poser pour obtenir quelle portée.** Le cadrage interdit de présumer un nom
d'option ou une syntaxe. On s'arrête ici.

---

## 4. Les autres primitives, qualifiées sans complaisance

Aucune n'exprime la différence historique / canonique.

**Deployment Protection Exceptions** (incluse sur Pro). Granularité = **un domaine**, et la confirmation
UI exige de taper `unprotect my domain`, après quoi « All your existing and **future** deployments for that
domain will be unprotected ». La doc précise : « designed for **Preview Deployment** domains ». Trois
disqualifications cumulées :
1. elle ouvre, elle ne protège pas — c'est une primitive de bypass ;
2. l'URL à hash du canonique change à chaque déploiement : « le canonique courant » n'est pas un domaine
   stable, donc pas exprimable comme exception ; il faudrait réécrire l'exception à chaque `deploy` ;
3. chaque exception laissée en place devient, au déploiement suivant, **une URL historique définitivement
   non protégée** — soit exactement le P0 qu'on ferme, reproduit à la cadence des déploiements.
   À l'épreuve du critère de l'architecte : l'accès n'est accordé ni à un acteur identifié ni même à un
   détenteur de valeur — il est accordé à **tout le monde**.

**Protection Bypass for Automation** — déjà disqualifiée deux fois, confirmée ici : « generates a **secret** …
to bypass protection features for **all deployments in a project** », header ou query param. Quiconque
détient la valeur, sur n'importe quelle URL, rétroactivement sur les 91.

**Shareable Links** — secret dans une query string, portée « specific branch deployments ». Même
disqualification.

**OPTIONS Allowlist** — ne s'applique qu'aux requêtes `OPTIONS` de préflight CORS. Le cron émet un `GET`.
Sans objet.

**Trusted IPs / Only Production Deployments** — « **only available on the Enterprise plan** », confirmé par
la table Usage & Pricing (Pro : *Not available*). Inaccessibles sur ce compte.

**Protection par déploiement individuel** — n'existe pas. La Deployment Protection est énoncée partout
comme un réglage **de projet** (« Vercel Authentication is managed on a **per-project** basis »). Ce qui
existe au niveau d'un déploiement va dans l'autre sens : accorder un accès (Shareable Link, access request),
jamais en retirer un. Il n'y a donc aucun moyen documenté de viser les 91 nommément.

---

## 5. Ce qui ferait basculer vers YES, et ce que ça coûterait

Un seul fait manque, et il est binaire :

> Sous `prod_deployment_urls_and_all_previews`, l'URL à hash `<project>-<hash>-<scope>.vercel.app` du
> déploiement **actuellement canonique** est-elle protégée ou ouverte ?

Il n'est pas établissable par lecture : les deux réponses sont écrites, dans la doc courante, par Vercel.
Il n'est établissable que par une activation bornée suivie d'une mesure — donc par ce que cette fenêtre
interdit, et dans un ordre que l'architecte devrait arbitrer : on activerait avant de savoir.

À noter pour cet arbitrage éventuel : même un YES sur cette charnière laisserait un second inconnu ouvert
(§2, la sélectabilité de la portée sur un projet Pro qui n'y est pas déjà) et un troisième (§3, la valeur
d'API à poser). Trois inconnus en série sur le chemin critique d'Octobre 20.

---

## 6. Ce que cette fenêtre n'a pas fait

Aucun réglage Vercel touché. Aucune exception créée. Aucun secret créé ni affiché. Aucune requête vers un
runtime, historique ou canonique. Aucun déploiement, `vercel.json` inchangé. Aucun ticket support ouvert.
`CRON_SECRET` non rotée. Aucun contact base.

---

## Sources

Toutes consultées le 2026-09-15.

- https://vercel.com/docs/deployment-protection — portées, « Choose which URLs to protect », (Legacy) Standard, (Legacy) Pre-Production, Only Production Deployments (`last_updated: 2026-08-28`)
- https://vercel.com/docs/deployment-protection/usage-and-pricing — table plan/prix, 12 lignes, sans les portées legacy (`last_updated: 2026-08-21`)
- https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication — mappage à trois valeurs, per-project basis
- https://vercel.com/docs/rest-api/reference/endpoints/projects/update-an-existing-project — enum à quatre valeurs de `ssoProtection.deploymentType`
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection — les quatre méthodes de bypass
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions — granularité domaine, « designed for Preview Deployment domains »
- https://vercel.com/docs/deployments/generated-urls — classes d'URL générées, URL à hash vs alias de branche vs URL de projet
- https://vercel.com/docs/cron-jobs — « HTTP GET request to your project's production deployment URL … `https://*.vercel.app/api/cron` »
- https://vercel.com/changelog/protect-past-production-deployments-with-deployment-protection — 2 novembre 2023
- https://vercel.com/changelog/more-secure-deployment-protection — 14 juillet 2025, projets existants non migrés
- https://vercel.com/kb/guide/locking-down-deployments — « with the exception of the most recent production deployment »
