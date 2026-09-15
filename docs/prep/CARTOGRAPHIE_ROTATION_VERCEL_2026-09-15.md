# CARTOGRAPHIE VERCEL PRODUCTION — instrument, procédure, ordre de rotation

**2026-09-15 · fenêtre INCIDENT ROTATION · LECTURE SEULE**

**Statut : PRÉPARATION. Rien n'a été roté, créé, révoqué ni invalidé pendant la fenêtre qui a produit ce
document.** Aucun fournisseur n'a été appelé avec un credential. Aucun fichier d'environnement n'a été
modifié. Aucun déploiement n'a été purgé. Aucune écriture en base. Aucun déploiement de production.

Ce document accompagne `scripts/rotation/cartographie-vercel.mjs` — l'instrument que **le fondateur exécute
lui-même**, et qui ne fait transiter aucune valeur par un assistant, par un log, ou par un fichier resté sur
le disque.

Il fait suite à `docs/prep/ROTATION_INVENTORY_2026-09-15.md` (PR #443), dont le §8.1 nommait l'angle mort :
l'environnement de production Vercel n'avait jamais été consulté. L'architecte a tranché — cet angle mort se
lève **avant** la rotation générale, parce qu'une rotation faite uniquement depuis le poste peut déclarer
l'incident clos en laissant des credentials actifs dans Vercel.

---

## 1. CE QUE L'INSTRUMENT ÉTABLIT

Pour chaque credential, cinq colonnes :

| | Colonne | Source de la mesure |
|---|---|---|
| ① | présent dans Vercel Production ? | `vercel env ls production` — liste de **noms**, aucune valeur décryptée |
| ② | identique à la valeur exposée ? | empreinte de `vercel env pull` contre empreinte des octets exposés |
| ②′ | identique à la valeur du poste ? | empreinte `.env.local` contre octets exposés — **mesurable sans Vercel** |
| ③ | alias ou doublon d'une autre variable ? | index inverse empreinte → noms, plus la détection des redéfinitions |
| ④ | consommateur(s) dans le code ? | une passe `git grep` sur `process.env.*`, comptée par fichier |
| ⑤ | mécanisme de révocation côté fournisseur ? | registre `AUTORITES` dans l'instrument, ou **INCONNU** nommé comme tel |

### Les quatre règles de forme, et où elles vivent dans le code

**Comparaison par empreinte, jamais par valeur.** `empreinte()` — HMAC-SHA256 tronqué à 12 hexets. Le rapport
ne contient aucune valeur, aucun préfixe, aucun suffixe, aucune longueur de secret individuelle.

**Empreinte salée par un nonce de session.** `nouveauNonce()` — 32 octets aléatoires, en mémoire, jamais
écrits, perdus à la sortie du processus. Pas d'attaque par dictionnaire : le HMAC est clé. **Et deux
exécutions ne sont pas comparables** : le même secret donne deux empreintes différentes d'un rapport à
l'autre. Un rapport se relit, il ne se diffe pas. C'est le prix payé pour qu'une empreinte publiée ne vaille
rien — il est assumé, il est écrit en tête de chaque rapport.

**Extraction depuis les octets, pas depuis un parseur dotenv.** `extraireOctets()` découpe le Buffer sur
`0x0A` et ne décode jamais une valeur avant de l'empreinter. Une ligne non conforme — sans `=`, ou avec un
nom invalide — est **comptée, mesurée, empreintée et signalée, jamais imprimée**. La ligne 18 du `.env`
exposé est la raison d'être de cette règle : du texte qu'aucun parseur ne charge, qui n'apparaît dans aucune
liste de variables, et qui est pourtant parti verbatim.

**Aucun fichier de secrets abandonné.** `creerBac()` / `effacerBac()`. Le `vercel env pull` écrit dans un bac
temporaire hors du dépôt ; l'instrument l'écrase puis le supprime lui-même en sortie normale, en cas
d'erreur, et sur interruption (`SIGINT`/`SIGTERM`/`SIGHUP`). Le rapport final **refuse d'être écrit à
l'intérieur du dépôt** — c'est exactement l'incident qu'on est en train de fermer.

### Deux protections que l'instrument s'impose à lui-même

**Le CLI ne peut pas atteindre le `.env.local` du poste.** `vercel env pull` est lancé avec `--cwd` pointant
sur un répertoire du bac qui ne contient qu'une **copie** de `.vercel/project.json`. Même si le CLI ignorait
le nom de fichier demandé et retombait sur son défaut, il écrirait dans le bac. Cette précaution n'est pas
théorique : `vercel env pull` est déjà connu pour avoir fait disparaître `ADMIN_TOKEN` du fichier du poste.

**Le rapport est prouvé vide de valeurs avant d'exister.** `chercherFuite()` cherche chaque valeur connue
dans le texte rendu ; si une seule s'y trouve, l'instrument **avorte sans rien écrire** (code 3). Ce n'est pas
une intention, c'est une porte.

> La première exécution en vif a fait avorter l'instrument — sur `NODE_ENV`, `VERCEL_ENV` et
> `VERCEL_TARGET_ENV`, dont la valeur est le mot « production », qui figure évidemment dans un rapport
> intitulé « CARTOGRAPHIE VERCEL PRODUCTION ». Le crible avait raison sur la lettre et tort sur le fond. La
> correction est une **liste close** de valeurs littérales non discriminantes (`VALEURS_NON_DISCRIMINANTES`),
> pas une heuristique d'entropie : une heuristique se discute au cas par cas et finit par tout excuser. Le
> seul trou de la liste close est explicite — un credential dont la valeur serait exactement « production »
> échapperait au crible, et ne protégerait rien de toute façon.

### La variante qui se déguise

Une comparaison de chaînes rend un **faux négatif** sur le credential le plus grave. `decomposerValeur()`
décompose les URL et compare **composant par composant**, l'hôte exclu — parce que c'est l'hôte qui mentait.

Et le verdict par composant **remonte jusqu'à la ligne d'inventaire**. Sans cette remontée, `DATABASE_URL`
resterait marquée « différente », donc 🟠, donc non urgente, pendant que la section des variantes affiche son
mot de passe identique. L'instrument reproduirait le faux négatif qu'il existe pour corriger.

Un cran plus loin : l'index des composants vivants est **transversal**. Un secret parti sous un nom peut
survivre sous un autre, et une comparaison nom à nom ne le voit pas.

---

## 2. CE QUE LA RÉPÉTITION À BLANC A DÉJÀ ÉTABLI — sans Vercel, aujourd'hui

Exécution réelle du 2026-09-15 avec `--sans-vercel`, sur les octets du poste. Aucune valeur n'a été affichée.

- **226 variables inventoriées** · 16 affectations dans le fichier exposé · **102** dans `.env.local`.
- **5 credentials exposés sont encore vivants** : `ADMIN_TOKEN`, `ADMIN_BASIC_USER`, `ETHERSCAN_API_KEY`,
  `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
- **2 composants critiques exposés sont encore vivants**, et l'un d'eux est transversal :

  | Variable exposée | Composant | Encore vivant sous |
  |---|---|---|
  | `DATABASE_URL` | mot de passe | `DATABASE_URL` (poste) |
  | `DATABASE_URL_UNPOOLED` | mot de passe | **`DATABASE_URL`** (poste) |

  Le second est celui qu'une rotation nom par nom manquerait : `DATABASE_URL_UNPOOLED` **n'existe même pas**
  sous ce nom avec cette valeur sur le poste, et son mot de passe exposé est pourtant toujours celui qui
  ouvre la base de production. **La rotation doit traiter le SECRET, pas le nom de variable.**

### Une mesure qu'il faut lire avant toute conclusion

Le fichier exposé porte aujourd'hui **16 affectations et ZÉRO ligne non conforme**. L'inventaire du matin
même en mesurait **16 + 1 ligne orpheline**. Le fichier a donc été modifié depuis l'exposition — c'est le
traitement de `X_BEARER_TOKEN` (régénéré côté fournisseur, reposé, ligne nue supprimée), et c'est une bonne
nouvelle.

> **Conséquence à ne pas manquer : ce que l'instrument appelle « exposé » est une BORNE INFÉRIEURE.**
> Il mesure ce que le fichier contient *aujourd'hui*, pas ce que les déploiements retenus contiennent. Tout
> ce qui a été retiré du fichier depuis est invisible à cette mesure, et reste pourtant dans les octets
> déployés. Pour mesurer les vrais octets exposés, il faut pointer `--expose` sur le fichier **tel qu'il est
> dans un déploiement retenu** (onglet *Source* d'un déploiement, téléchargement — aucune purge, l'architecte
> veut les preuves conservées). Tant que ce n'est pas fait, une variable absente de l'inventaire n'est pas
> une variable non exposée : c'est une variable **non mesurée**.

---

## 3. PROCÉDURE — ce que le fondateur tape, dans quel ordre, et ce qu'il doit voir

Écrite pour être suivie sans rien connaître au code. **À aucun moment il ne vous sera demandé de montrer,
copier ou lire une valeur de secret.**

### Avant de commencer — les trois règles

1. **Ne collez jamais dans une conversation le contenu d'un fichier d'environnement.** Ni `.env`, ni
   `.env.local`, ni le fichier téléchargé depuis Vercel. Le rapport produit par l'instrument, lui, est sûr :
   il ne contient aucune valeur, et l'instrument refuse de l'écrire s'il en contenait une.
2. **N'exécutez rien d'autre pendant ce temps** : pas de script, pas de déploiement.
3. **Cet instrument ne change rien.** Il lit. Vous pouvez l'arrêter à tout moment avec `Ctrl+C` : il nettoie
   derrière lui avant de mourir.

### Étape 1 — se placer dans le dossier du projet

```
cd ~/dev/interligens-web
```

### Étape 2 — vérifier que la session Vercel est ouverte

```
vercel whoami
```

**Ce que vous devez voir :** votre identifiant de compte Vercel, sur une ligne.
**Si vous voyez une erreur ou une demande de connexion :** tapez `vercel login`, suivez la connexion dans le
navigateur, puis refaites `vercel whoami`.

### Étape 3 — répétition à blanc, sans toucher à Vercel

```
node scripts/rotation/cartographie-vercel.mjs --sans-vercel
```

**Ce que vous devez voir**, dans cet ordre :

```
CARTOGRAPHIE VERCEL PRODUCTION v1.0.0 — LECTURE SEULE
  dépôt          : /Users/…/interligens-web
  octets exposés : /Users/…/interligens-web/.env
  valeurs poste  : /Users/…/interligens-web/.env.local
  bac temporaire : /var/folders/…/rotation-cartographie-XXXXXX

  → Vercel NON interrogé (--sans-vercel). Répétition à blanc.
  → Mesure des consommateurs dans le code…

  ✅ Crible anti-fuite : … valeur(s) discriminante(s) cherchée(s), 0 trouvée(s) dans le rapport.
  ✅ Rapport écrit     : /Users/…/interligens-attestations/rotation/cartographie-….md

  RÉSUMÉ
    …

  NETTOYAGE
    bac temporaire : /var/folders/…/rotation-cartographie-XXXXXX
    état           : SUPPRIMÉ
    vérification   : ls "/var/folders/…"  → doit répondre « No such file or directory »
    nonce de session : détruit avec le processus.
```

Les deux ✅ sont la preuve que rien n'a fuité et que le rapport existe. **Si vous voyez `❌ AVORTEMENT`,
arrêtez-vous et signalez-le : aucun rapport n'a été écrit, et c'est un défaut de l'instrument, pas une
erreur de votre part.** Ne le contournez pas.

### Étape 4 — la vraie exécution, avec Vercel

```
node scripts/rotation/cartographie-vercel.mjs
```

C'est la même chose, plus deux lectures de Vercel. **Ce que vous devez voir en plus :**

```
  → Lecture de Vercel Production (vercel env ls, puis vercel env pull)…
     noms lus : 60 · valeurs relues : 58 · erreurs : 0
```

Les deux nombres n'ont **aucune raison d'être égaux** : Vercel ne relit jamais une variable marquée
« sensible ». Un nom compté en « noms lus » mais pas en « valeurs relues » apparaîtra dans le rapport comme
**« présente mais NON RELISIBLE »** — ce qui veut dire *présente*, pas *absente*.

**Si vous voyez `erreurs : 1` ou plus :** le rapport est quand même écrit, et il dit lui-même quelles
colonnes valent INCONNU. Lisez la section « Lecture Vercel incomplète » en tête du rapport.

### Étape 5 — vérifier que l'instrument a bien nettoyé derrière lui

Copiez le chemin affiché après `bac temporaire :` et tapez :

```
ls "/var/folders/…/rotation-cartographie-XXXXXX"
```

**Ce que vous devez voir :** `No such file or directory`.
**Si le dossier existe encore**, l'instrument vous l'aura déjà dit en rouge, et vous le supprimez à la main
avec la commande qu'il affiche (`rm -rf "…"`).

Puis vérifiez qu'aucun fichier de secrets n'est resté dans le projet :

```
git status --short
```

**Ce que vous devez voir :** rien, ou uniquement des fichiers que vous étiez déjà en train de modifier.
**Aucun fichier commençant par `.env` ne doit apparaître.**

### Étape 6 — lire le rapport

```
open ~/interligens-attestations/rotation/
```

Ouvrez le fichier le plus récent. **Ce rapport peut être partagé** : il ne contient que des noms, des
compteurs et des empreintes salées par un nonce déjà détruit.

Ce que vous cherchez, dans l'ordre :

1. Les lignes **🔴** — exposées et encore vivantes. Ce sont elles qui décident de l'urgence.
2. La section **« Secrets transversaux »** — un même secret sous plusieurs noms.
3. La section **« Ce que cette exécution N'ÉTABLIT PAS »** — chaque case INCONNU y est nommée, avec ce qu'il
   faut pour la trancher.

### Étape 7 — la seule chose que l'instrument ne peut pas faire à votre place

Ouvrez **Vercel → projet `interligens-app` → Settings → Environment Variables → Production** et comparez la
liste affichée à l'écran avec la colonne ① du rapport. Si un nom est à l'écran mais absent du rapport, c'est
que `vercel env ls` ne l'a pas renvoyé : ajoutez-le à la main dans vos notes. **Ne recopiez aucune valeur.**

---

## 4. ORDRE DES ROTATIONS — tel que l'architecte l'a arbitré

L'ordre n'est pas une préférence : il place en premier ce qui est déjà fait, puis ce qui exige un geste chez
un fournisseur, et en dernier ce qui coupe tout.

### 1 — `X_BEARER_TOKEN` — ✅ FAIT

Régénéré côté fournisseur (portail développeur X), reposé, ligne nue supprimée du fichier. **Constaté par
mesure indépendante** : le fichier exposé ne porte plus aucune ligne non conforme, et le jeton n'apparaît
plus parmi les credentials exposés vivants.

Reste à faire pour fermer proprement : vérifier dans le portail X que le jeton **précédent** n'est plus
listé. La régénération invalide l'ancien — c'est le mécanisme du portail, pas une déduction — mais la
fermeture demande la constatation, pas la confiance.

### 2 — Sessions X — **avec RÉVOCATION CÔTÉ FOURNISSEUR**

`X_CT0_1`, `X_CT0_2`, `X_AUTH_TOKEN_1`, `X_AUTH_TOKEN_2`.

> **La réécriture ne révoque rien.** Coller un nouveau cookie dans Vercel laisse l'ancien valide côté X.
> Ce sont des cookies de session d'un compte réel, pas des clés d'API.

Séquence obligatoire, dans cet ordre :

1. Compte X → Paramètres → Sécurité → **Applications et sessions** → **déconnecter toutes les sessions**
   (un changement de mot de passe du compte produit le même effet).
2. Se reconnecter.
3. Relever les nouveaux cookies.
4. Les écrire dans Vercel.

Faire (4) sans (1) donne l'illusion d'une rotation. Placé tôt parce que ces valeurs ouvrent un compte réel.

### 3 — Clés d'API indépendantes — ROLLING, aucune coupure

`ETHERSCAN_API_KEY` 🔴 · `RESEND_API_KEY` 🟠 · `ANTHROPIC_API_KEY` · `HELIUS_API_KEY` · `STRIPE_SECRET_KEY` ·
`STRIPE_WEBHOOK_SECRET` · `UPSTASH_REDIS_REST_TOKEN` · `TURNSTILE_SECRET*` · `TELEGRAM_BOT_TOKEN` (via
`/revoke`, qui fait les deux gestes d'un coup) · `GOOGLE_APPS_SCRIPT_URL` (URL-capacité : l'URL **est** le
secret).

Pour chacune : **créer la nouvelle clé → l'écrire dans Vercel → redéployer → vérifier → seulement ensuite
supprimer l'ancienne chez le fournisseur.** L'ancienne reste valide pendant tout l'intervalle : aucune
interruption. **Ne pas sauter la dernière étape — c'est elle, et elle seule, qui éteint l'exposition.**

`RESEND_API_KEY` est 🟠 et non 🔴 : la valeur exposée a été remplacée ici. **Cela ne dit rien de ce que Resend
accepte encore.** Elle se traite comme les autres.

### 4 — `CRON_SECRET` et credentials admin — **APRÈS le traitement du sel IP**

`ADMIN_TOKEN` 🔴 · `ADMIN_BASIC_USER` 🔴 · `ADMIN_BASIC_PASS` 🟠 · `CRON_SECRET` 🟠 · `LEGAL_PDF_TOKEN` ·
`MOBILE_API_TOKEN` · `MM_API_TOKEN` · `PARTNER_API_KEY*` · `TELEGRAM_WEBHOOK_SECRET`.

> ⛔ **Verrou de séquence.** `ADMIN_TOKEN` a une seconde vie de **sel cryptographique** : quand
> `OSINT_RETAIL_IP_SALT` est absente, le hachage des IP retail retombe sur `ADMIN_TOKEN`. Le roter re-clé
> silencieusement tout l'historique haché — rien ne casse, rien n'alerte, la corrélation cesse simplement
> d'être vraie. **L'autre terminal traite ce périmètre ; cette fenêtre n'y touche pas.** L'étape 4 ne
> commence qu'une fois ce traitement confirmé.

`CRON_SECRET` : le faire **hors de l'heure pleine**, sinon le cron horaire échoue sur la bascule.
`PARTNER_API_KEY*` est remis à des tiers : prévenir avant, sinon leur intégration casse.
`TELEGRAM_WEBHOOK_SECRET` exige une **redéclaration du webhook** chez Telegram, sans quoi le nouveau secret
n'est jamais envoyé.

### 5 — `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — fenêtre dédiée, en dernier

Section 5 ci-dessous. En dernier parce que c'est la seule rotation qui coupe tout en même temps, et parce
qu'il faut que le reste soit déjà prouvé : si quelque chose casse après, on sait que c'est la base.

### Après — hygiène, hors urgence

Les quatre paires de clés **R2**, dans Cloudflare → R2 → *Manage API Tokens*. ROLLING : créer puis supprimer,
deux gestes séparés.

> **Cas particulier posé par l'architecte, et traité tel quel.** Les credentials R2 entrent dans l'inventaire
> **selon leur exposition réelle**. Mesure du jour : **aucune variable R2 ne figure dans les octets exposés
> mesurables**. Le credential Evidence créé aujourd'hui, après l'incident, est **actif — pas exposé**, et il
> ne doit pas être traité comme s'il avait nécessairement figuré dans l'ancien `.env`. Distinguer ce qui est
> exposé de ce qui est simplement actif est tout l'objet de la colonne « Exposition ».
>
> Deux réserves, écrites sans adoucissement : (a) cette mesure porte sur le fichier **d'aujourd'hui**, pas
> sur les octets des déploiements retenus (§2) ; (b) la portée réelle d'un jeton R2 est **reçue, jamais
> mesurée** — un jeton nommé `_RO` peut parfaitement porter des droits d'écriture, et le credential Evidence
> a déjà été observé porteur de WRITE + READ + DELETE.

---

## 5. FENÊTRE BASE DE DONNÉES

> # « Ne jamais considérer variable mise à jour comme preuve de révocation. »

C'est la phrase qui gouverne cette section entière. Une variable réécrite dit ce que *notre* système
présente ; elle ne dit rien de ce que *le fournisseur* accepte encore.

**Pourquoi cette fenêtre est la plus grave.** Le mot de passe de la base de production est parti en clair
dans chaque déploiement retenu, et il est **toujours valide** — mesuré deux fois, aujourd'hui encore. Il est
parti sous **deux noms** (`DATABASE_URL` et `DATABASE_URL_UNPOOLED`), et une comparaison de chaînes le
déclare éteint dans les deux cas.

**Fenêtre recommandée : 10:00–00:00 UTC.** Le cron le plus tardif tombe à 09:00 UTC, le plus matinal à 01:00
UTC ; seul le flux horaire tourne à chaque heure pleine.

### Séquence, telle que l'architecte l'a posée

1. **Arrêter les scripts et opérations en vol.** Aucun script long ne doit tourner : une opération
   interrompue au milieu laisse un état partiel, et cette fenêtre n'a pas le droit d'écrire en base pour le
   réparer. Vérifier aussi qu'aucun cron n'est sur le point de partir.
2. **Changer le password Neon** — console Neon, rôle applicatif de `ep-square-band`, *Reset password*.
   C'est le seul cas de toute la campagne où **réécrire et invalider sont le même geste** : le reset est
   instantané et sans période de grâce.
3. **Mettre à jour TOUS les consommateurs, pooler ET direct, avec le même nouveau credential.** C'est le
   point où l'incident se referme ou se rouvre. Le mot de passe est **un seul secret porté par plusieurs
   variables** : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, et toute variable `POSTGRES_*`/`PG*` qui porte le
   même mot de passe. En oublier une laisse un consommateur cassé — ou, pire, laisse croire que le
   changement est complet.
4. **Smoke DB.** Une page publique qui lit la base doit répondre **200 avec des données**. Un `401`, un
   `500` ou un timeout ne sont pas des mesures : exiger un 200 explicite et traiter tout le reste comme non
   concluant.
5. **Crons.** **Attendre un vrai passage de cron.** Un déclenchement manuel ne prouve pas que Vercel enverra
   le bon secret ; seul un passage réel le prouve.
6. **Watchdog.** Le watchdog a sa propre lecture de `DATABASE_URL`, hors du runtime Vercel. Vérifier qu'il
   **reparle**. Un watchdog muet ressemble à un watchdog satisfait — c'est le piège de cette étape.
7. **Révoquer ou constater l'invalidité de l'ancien.** Tenter une connexion avec l'**ancien** mot de passe :
   elle doit être **refusée**. Consigner la date, l'heure et le refus. Sans cette constatation, l'étape 2 est
   une intention, pas une preuve.

**Après la fenêtre :** mettre à jour `.env.local` du poste, et **supprimer le fichier `.env`** — la source de
tout l'incident.

---

## 6. CRITÈRE DE FERMETURE

> **For every credential materially exposed in retained deployment bytes, either the credential has been
> independently invalidated at its authority, or it has been demonstrated non-operational; replacing a local
> or deployment value alone does not close exposure.**

Deux branches, et une seule question par credential : **laquelle, et par quelle mesure concrète ?**

- **Invalidation chez l'autorité** — le fournisseur détient le credential et peut le refuser. La preuve est
  chez lui : la clé ne figure plus dans sa liste, la session n'est plus listée, le mot de passe a été
  réinitialisé.
- **Démonstration de non-opérationnalité** — aucune autorité externe ne détient le credential (nous l'avons
  émis, notre propre code le vérifie). Il n'existe aucun écran où le révoquer. La preuve est alors un
  **essai délibéré avec l'ancienne valeur, qui doit être refusé**, daté et consigné.

> ⚠️ Les essais de la colonne « mesure concrète » se font **par le fondateur, après rotation, contre notre
> propre système ou notre propre compte chez un fournisseur**. Jamais contre un tiers, jamais depuis cette
> fenêtre, qui n'appelle aucun fournisseur.

### Branche retenue, credential par credential

**Exposés et encore vivants — 🔴, mesuré aujourd'hui**

| Credential | Branche | Mesure concrète qui ferme |
|---|---|---|
| `DATABASE_URL` | **invalidation** | Reset du mot de passe du rôle dans Neon, puis **connexion refusée** avec l'ancien mot de passe, datée. |
| `DATABASE_URL_UNPOOLED` | **invalidation** | Le même reset le couvre — même rôle, même secret. À vérifier explicitement : la connexion refusée doit être constatée **sur les deux points de terminaison**, pooler et direct. |
| `ADMIN_TOKEN` | **démonstration** | Aucun fournisseur ne le détient. Après rotation : requête admin présentant l'**ancien** jeton → doit être **refusée**. ⛔ Ne rien faire avant le traitement du sel IP (§4.4). |
| `ADMIN_BASIC_USER` | **démonstration** | Idem : l'ancien couple Basic doit être refusé par le gate de requêtes. |
| `ETHERSCAN_API_KEY` | **invalidation** | Suppression de l'ancienne clé dans *My API Keys* — constatée par son **absence de la liste**, pas par la présence de la nouvelle. |

**Exposés, remplacés depuis — 🟠, statut fournisseur INCONNU**

| Credential | Branche | Mesure concrète qui ferme |
|---|---|---|
| `ADMIN_BASIC_PASS` | **démonstration** | Ancien mot de passe Basic refusé par le gate. |
| `CRON_SECRET` | **démonstration** | Appel de route de cron présentant l'ancien secret → refusé. Puis un **vrai passage de cron** doit réussir. |
| `RESEND_API_KEY` | **invalidation** | Ancienne clé **supprimée** dans Resend → absente de la liste. Remplacée ici ≠ morte là-bas. |
| `X_CT0_1`, `X_CT0_2` | **invalidation** | Sessions terminées **depuis le compte X**. Aucune réécriture ne ferme cette ligne. Complément recommandé : une capture avec l'ancien cookie doit échouer. |
| `ETHERSCAN_RATE_PER_SEC`, `NITTER_BASE_URL`, `ONCHAIN_SYNC_BATCH_WALLETS`, `PDF_STORAGE_ENABLED`, `SOCIAL_*`, `TURBO_*` | **sans objet** | Réglages, pas des credentials : rien à révoquer. À confirmer d'un coup d'œil, pas à supposer. |

**Déjà traité — `X_BEARER_TOKEN`**

| Credential | Branche | Mesure concrète qui ferme |
|---|---|---|
| `X_BEARER_TOKEN` | **invalidation** — geste ✅ fait, constatation ⏳ due | Régénéré au portail X. Reste à **constater** que le précédent n'y est plus listé. |

> L'instrument le classe aujourd'hui **⚪ non exposé** — non pas parce qu'il ne l'a jamais été, mais parce que
> la ligne nue a été retirée du fichier. C'est la démonstration vivante de la borne inférieure du §2 : un
> credential traité disparaît de la mesure, alors que ses octets restent dans les déploiements retenus. **Ne
> jamais lire « non exposé » comme « n'a jamais été exposé ».**

**Actifs mais non exposés — ⚪**

Aucune branche n'est due au titre de cet incident. Leur rotation est de l'hygiène, et elle se décide
séparément. Cela vaut explicitement pour **le credential R2 Evidence créé aujourd'hui** : actif, non exposé.

**Sels — `VAULT_AUDIT_SALT`, `OSINT_RETAIL_IP_SALT`, `IP_HASH_SALT`**

**Sans objet, et à ne pas roter.** Un sel n'est pas une clé : le roter re-clé tout l'historique haché et
détruit une continuité de données sans le dire. Ils n'étaient pas exposés.

---

## 7. CE QUE CETTE CARTOGRAPHIE NE POURRA PAS ÉTABLIR

Un inventaire qui comble ses trous par supposition ferme l'incident sur le papier et le laisse ouvert en
vrai. Voici les trous, nommés, avec ce qu'il faudrait pour les combler.

1. **Les octets réellement exposés.** L'instrument mesure le `.env` d'aujourd'hui, qui a déjà changé (§2).
   **Pour trancher :** pointer `--expose` sur le fichier tel qu'il figure dans un déploiement retenu.
   Aucune purge — les preuves restent conservées, leur sort se décide séparément.

2. **L'historique du fichier.** Le `.env` n'est pas suivi par git. Rien ne dit quelles valeurs il portait lors
   des déploiements **antérieurs**. Des valeurs plus anciennes des mêmes noms ont pu être exposées et rester
   valides. **Pour trancher :** supprimer chez chaque fournisseur *toutes* les clés antérieures, pas
   seulement la courante.

3. **Les variables marquées « sensibles » dans Vercel.** Elles apparaîtront en ① comme présentes et en ②
   comme **NON RELISIBLE**. Vercel ne les relit jamais. **Pour trancher :** les re-poser avec une valeur
   neuve — ce qui rend la question sans objet — ou accepter l'inconnu et roter par précaution.

4. **La liste des déploiements retenus.** Établir *quels* déploiements portent le fichier exige d'interroger
   Vercel déploiement par déploiement. Non fait. **Non établi.**

5. **Le caractère ROLLING ou COUPURE de plusieurs fournisseurs** (Helius, Upstash, Turnstile, et toutes les
   clés marquées *(à confirmer)* dans le rapport) : déduit de la pratique courante, **pas mesuré**.
   **Pour trancher :** ouvrir l'écran et vérifier de visu si l'ancienne valeur survit à la création de la
   nouvelle.

6. **La portée réelle des jetons R2.** Reçue, jamais mesurée. La seule vérification possible est une
   tentative d'écriture avec le jeton dit « lecture seule » — hors du périmètre de cette fenêtre.

7. **Les variables sans autorité connue.** Le rapport les liste avec la mention INCONNU et la marche à
   suivre : ouvrir le consommateur mesuré en colonne ④ et lire **à qui** la valeur est présentée. Une
   variable sans consommateur mesuré et sans autorité connue ne se supprime pas sur cette seule base —
   « aucun consommateur mesuré » et « mesure impossible » ne sont pas la même chose, et le rapport les
   distingue.

---

## 8. CE QUE CETTE FENÊTRE N'A PAS FAIT

- Aucun credential roté, créé, révoqué ou invalidé.
- Aucun appel à un fournisseur avec un credential. Aucune requête authentifiée sortante.
- Vercel n'a pas été ouvert : l'instrument est fait pour que **le fondateur** l'exécute.
- Aucune valeur affichée, journalisée ou écrite.
- Aucun fichier d'environnement modifié.
- Aucun déploiement purgé.
- Aucune écriture en base, aucune DDL, aucun déploiement de production. **NO PROD DEPLOY jusqu'à fermeture
  de la rotation.**
- `ipHash.ts` et le périmètre du sel n'ont pas été touchés — l'autre terminal y travaille.
