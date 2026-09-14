# T1-TSA-RECONNAISSANCE — rapport de fenêtre, 2026-09-14

Lecture seule intégrale : aucune écriture, aucun DDL, aucune configuration modifiée, aucun appel réseau vers une TSA. Le watchdog n'a pas été lu au-delà de son bloc « TSA pending » (lignes 480 à 507) et de son chargeur d'éligibilité (lignes 107 à 115). Les 34 pièces n'ont pas été auditées : une seule requête agrégée, par statut, sans identifiant.

Contexte mesuré : main = c157be3, production 22 claims / 10 sources / 6 décisions, `evidence_provenance_journal` posée. EvidenceItem : 1104 lignes, 1070 avec token, 34 sans.

## Question 1 — ce que l'architecture prévoit déjà

### a) Où vit le routage, et qui décide « non configurés »

- Le routage vit dans `src/lib/evidence-chain/tsa.ts`. La configuration est lue par `tsaRoutingFromEnv` (lignes 145 à 155) ; l'ordre d'appel est construit par `timestampWithRouting` (lignes 165 à 189).
- La ligne qui décide : `tsa.ts:173` teste `order.length === 0` et `tsa.ts:174` émet « aucune TSA routée (primary/fallback non configurés) ». `order` ne reçoit la primaire que si la criticité est P0 (`tsa.ts:171`), et le repli s'il existe (`tsa.ts:172`).
- Le job d'horodatage appelle ce routage avec `criticality: "OTHER"` (`src/scripts/evidence-chain/stamp-pending.ts:57`). Conséquence prouvée par `tsa.ts:171` : **pour ce job, la primaire n'est jamais dans l'ordre d'appel**. Une primaire configurée sans repli laisserait le message inchangé. Ce qui arme le job, c'est le repli, et lui seul.
- Un second message existe, « aucune TSA configurée — horodatage sauté » (`tsa.ts:118`), dans `requestTimestampWithRetry` quand ni `tsaUrl` ni `TSA_URL` n'existent. Il n'est pas atteint par le job : `timestampWithRouting` passe toujours `tsaUrl` explicitement (`tsa.ts:181`).

### b) Variables attendues, par nom

Lues dans `tsaRoutingFromEnv` (`tsa.ts:146-153`) et documentées dans `docs/EVIDENCE_CHAIN.md:19-21` :

| Rôle | Variable | Lecture |
|---|---|---|
| primaire (P0 seulement) | `TSA_URL_PRIMARY` | `tsa.ts:146` |
| racine CA de la primaire | `TSA_CA_URL_PRIMARY` | `tsa.ts:147` |
| repli (toute criticité) | `TSA_URL_FALLBACK` | `tsa.ts:148` |
| racine CA du repli | `TSA_CA_URL_FALLBACK` | `tsa.ts:149` |
| repli hérité, si `TSA_URL_FALLBACK` absent | `TSA_URL` et `TSA_CA_URL` | `tsa.ts:150` |
| anti-rafale avant la primaire | `TSA_COMMERCIAL_MIN_DELAY_MS` (défaut 15000) | `tsa.ts:153` |
| vérification en ligne ad hoc | `TSA_CA_FILE` | `tsa.ts:219` |

Où le job les lit : `stamp-pending.ts:23-24` charge `.env.local` par dotenv, depuis le répertoire de travail fixé par le plist (`com.interligens.evidence-stamp.plist`, `WorkingDirectory` = le dépôt ; `ProgramArguments` fait `cd` dans le dépôt puis lance tsx). Le plist ne définit que `PATH` dans `EnvironmentVariables`.

État réel : **`.env.local` ne contient aucune variable dont le nom comporte `TSA`**, ni active ni commentée (grep sur les noms, valeurs non lues). Aucun fichier `.env.example` ne les liste non plus. C'est la cause unique et suffisante du message : `primary = null`, `fallback = null`, `order` vide.

Ce n'est pas un oubli : `docs/prep/RAPPORT_B3_EVIDENCE_OBSERVABILITE.md:49-51` et `:172-176`, puis `docs/prep/RAPPORT_SYNTHESE_AOUT_2026.md:215-219` et `:237-238`, disent que `TSA_URL_FALLBACK` n'a pas été posée délibérément, « ni aucune variable TSA_* », tant que le compteur de pièces sans octets n'était pas mesuré : « un jeton TSA valide sur un contenu absent est pire qu'une pièce sans horodatage ». La décision d'activer y est déclarée ouverte.

### c) Le repli existe-t-il déjà ? OUI

- Prévu par la configuration : `tsa.ts:148-150`.
- Prévu par l'ordre d'appel : `tsa.ts:172` ajoute le repli après la primaire, `tsa.ts:177-187` bascule sur échec (« échec — bascule », ligne 186).
- Prévu par la doc : `docs/EVIDENCE_CHAIN.md:20` cite l'exemple `https://freetsa.org/tsr` + `.../files/cacert.pem`.
- Éprouvé : l'en-tête `tsa.ts:13` note « Fallback authority tested GRANTED 2026-07-30: freetsa.org », et le test live `src/lib/evidence-chain/__tests__/evidence-chain.test.ts:116` porte la constante `FREETSA` avec ces deux URL, injectée en routage à la ligne 127.

Rien à construire. Il manque deux valeurs dans `.env.local`.

### d) Protocole et vérification

- RFC 3161 par l'outil `openssl ts` : requête `-query -digest … -sha256 -cert` (`tsa.ts:43`), réponse lue par `-reply … -text` avec exigence `Status: Granted` (`tsa.ts:100-101`), jeton extrait par `-reply -token_out` puis `pkcs7 -print_certs` (`tsa.ts:59-60`). Seul le hash est envoyé, jamais les octets (`tsa.ts:3`, `:81-90`).
- Le client sait **demander** (`requestTimestampOnce`, `tsa.ts:78-110`) et **vérifier** : `verifyTimestampOffline` (`tsa.ts:194-213`) exécute `openssl ts -verify -digest <sha256> -in <tsr> -CAfile <chaîne archivée>` (`tsa.ts:204`), sans réseau, et rend `ok:false` si la chaîne archivée est vide (`tsa.ts:197`). La vérification offline exigée par le gate **existe déjà**.
- Elle est exercée par `verifyManifest` (`src/lib/evidence-chain/manifest.ts:220-223`) et par la CLI `src/scripts/evidence-chain/verify-manifest.ts` (100 % offline, `--no-tsa` pour la désactiver).
- Elle n'est prouvée que sous drapeau : le seul test qui l'exécute est le bloc `describe.runIf(EVIDENCE_TSA_LIVE === "1")` (`evidence-chain.test.ts:115-154`), jamais joué en CI (`evidence-chain.test.ts:4`). Ce bloc contient déjà la vérification positive (`:134-135`) et le mutant digest négatif (`"0".repeat(64)`, `:136-137`).
- Condition matérielle de la vérification : la chaîne archivée doit contenir la racine, que le jeton n'embarque pas. `captureCertChain` (`tsa.ts:53-76`) va la chercher à `caUrl` au moment de l'horodatage ; sans `TSA_CA_URL_FALLBACK`, la chaîne est archivée « sans racine » (`tsa.ts:68`, `:70`) et `openssl ts -verify -CAfile` n'a pas d'ancre de confiance. **`TSA_CA_URL_FALLBACK` est donc requise par le gate, pas optionnelle.**
- Outil sur Host-001 : `/opt/homebrew/bin/openssl` = OpenSSL 3.6.1, sous-commande `ts` présente (mesuré) ; le plist place `/opt/homebrew/bin` en tête de `PATH`.

## Question 2 — le gate est-il atteignable avec ce qui existe ?

| Preuve exigée | Ce que le code permet | Ce qui manque |
|---|---|---|
| 1. un témoin contrôlé reçoit un token vérifiable | `ingestFile` avec `tsa.enabled` (`ingest.ts:243-257`) ou `timestampWithRouting` direct ; le test live le fait sur un fichier temporaire et un store SQLite en mémoire (`evidence-chain.test.ts:118-131`), zéro écriture prod | `TSA_URL_FALLBACK` et `TSA_CA_URL_FALLBACK` ; et une **décision sur la nature du témoin** : test live en mémoire (aucune trace en production) ou pièce réelle via `src/scripts/evidence-chain/ingest-capture.ts` (écriture EvidenceItem + R2 + access log, et question de son statut probatoire) |
| 2. le hash soumis correspond aux bytes persistés | Le job soumet `EvidenceItem.sha256` lu en base (`stamp-pending.ts:44`, `:57`) ; rien ne relit les octets avant de les horodater. `verifyManifest` recalcule le hash de fichiers **locaux** (`manifest.ts:211`). Le module R2 de la chaîne ne sait que Put, Head, Delete (`r2.ts:14`, `:59-77`), pas Get. Une lecture R2 existe ailleurs : la méthode `get(key)` de `src/lib/storage/evidenceStorage.ts:31-39` (`GetObjectCommand`, bucket fixe de ce module) | Un chemin **relecture R2 → `sha256Buffer` → égalité avec la colonne** pour le témoin. Pas dans `evidence-chain/`. Petit, mais absent |
| 3. vérification offline positive | `verifyTimestampOffline` (`tsa.ts:194-213`), `verify-manifest.ts` | Une chaîne archivée **avec racine**, donc `TSA_CA_URL_FALLBACK` ; et pour un témoin en production, un bundle local des octets (voir preuve 2) ou un appel direct sur `tsaToken` + `tsaCertChain` lus en base |
| 4. mutant digest négatif | Déjà écrit : `evidence-chain.test.ts:136-137` | Rien, si le témoin est le test live. Pour un témoin en production : une commande ad hoc, une ligne |

Réponse courte : les quatre preuves sont **atteignables avec le code existant**, sous trois conditions nommées : deux variables d'environnement, une décision sur le témoin, et une relecture R2 pour la preuve 2 si le témoin est en production.

Un cinquième point, hors gate mais bloquant pour l'armement, sort de la question 3.

## Question 3 — 31 contre 34 : réponse A, univers différents

Les deux prédicats, lus dans le code :

- `stamp-pending.ts:44-45` : `SELECT … FROM "EvidenceItem" WHERE "tsaToken" IS NULL ORDER BY "ingestedAt" ASC LIMIT $1` (limite 500, `stamp-pending.ts:37`). Le « 34 » est `pending.length` (`:49`) puis `échecs` (`:58`, `:75`) et « restant » (`:72-73`, même prédicat sans limite).
- `watcher-health.mjs:492-493` : `SELECT count(*)::int … FROM "EvidenceItem" WHERE "tsaToken" IS NULL AND ${eligible}`, où `eligible` = `eligibleStatusSqlClause("evidentiaryStatus")` (`:487-488`), chargé depuis `src/lib/evidence-chain/eligibility.ts` (`:107-115`). La liste blanche ne contient que `null` (`eligibility.ts:14-19`) ; la clause rendue est donc `"evidentiaryStatus" IS NULL` (`eligibility.ts:53`).

Différence textuelle : `AND "evidentiaryStatus" IS NULL`. Le job compte toutes les pièces sans token ; le watchdog ne compte que celles encore éligibles à la chaîne active.

Preuve par une requête agrégée unique, lecture seule, exécutée à 18:26 UTC (ni l'une ni l'autre des deux requêtes) :

| evidentiaryStatus | pièces sans token | ingestedAt |
|---|---|---|
| NULL (éligibles) | 31 | toutes au même instant, 2026-08-19 13:36:03 UTC |
| BYTES_LOST | 1 | 2026-08-19 13:36:03 UTC |
| EXCLUDED | 2 | 2026-08-14 |

31 + 1 + 2 = 34. Les deux compteurs sont exacts, chacun sur son univers.

Pourquoi ni B ni C. B est exclu par la lecture : les prédicats diffèrent, ce n'est pas un défaut de mesure. C est exclu par les données : la pièce sans token la plus récente date du 2026-08-19, rien n'entre dans cet univers entre 08:30 et 09:00 depuis 26 jours. Les journaux le confirment : le watchdog affiche 34 jusqu'au rapport du 2026-09-09 et 31 depuis celui du 2026-09-10 ; le filtre d'éligibilité est entré dans le watchdog par le commit 6c88bef du 2026-09-09. Le job, lui, affiche 34 sur 22 runs consécutifs (avant : 2 runs à 0, 5 runs à 2).

Ce que ça implique pour l'armement, et que GPT doit voir avant jeudi. Le prédicat du job n'a pas de filtre d'éligibilité. Une fois le repli routé, `stamp-pending` horodatera **les 34**, dont la pièce BYTES_LOST : un jeton valide sur un contenu absent, exactement ce que la doctrine de B3 interdit. Et les 2 EXCLUDED, écartées de la chaîne par S4. Le compteur global du job est une télémétrie ; il ne dit rien de l'état de cycle de vie de chaque pièce, et le job agit pourtant sur tout ce qu'il compte. Ce n'est pas corrigé ici.

Deux observations annexes, lues dans les journaux sans les auditer :

- Le watchdog n'alerte qu'à partir de 50 pièces (`watcher-health.mjs:496-497`) ; 31 pièces pendantes depuis 26 jours n'ont jamais produit de problème, seulement une ligne d'information.
- Le journal du job compte 29 résumés et 4 `FATAL PrismaClientInitializationError` (base injoignable), dont le dernier run, celui du 14 septembre : ce matin le job n'a pas atteint sa requête. `launchctl list` donne un dernier code de sortie 1 pour `com.interligens.evidence-stamp`, 0 pour le watchdog. Aucune de ces deux conditions n'est remontée ailleurs que dans un fichier de log.

## CE QUI MANQUE POUR ARMER, du plus court au plus long

1. **Deux variables dans `.env.local` de Host-001** : `TSA_URL_FALLBACK` et `TSA_CA_URL_FALLBACK` (la racine est requise pour la vérification offline, `tsa.ts:53-76`, `:204`). La primaire est sans effet pour le job (`tsa.ts:171`, `stamp-pending.ts:57`). Une minute, et une décision sur l'autorité : freetsa.org est la seule éprouvée (`tsa.ts:13`, test `:116`) ; l'en-tête `tsa.ts:10-13` rappelle qu'un usage forensique garanti exige une TSA payante ou eIDAS.
2. **Jouer le test live une fois** : `EVIDENCE_TSA_LIVE=1` sur `evidence-chain.test.ts:117-154`. Il produit les preuves 1, 3 et 4 sur un témoin en mémoire, sans toucher la production, et il exige une chaîne archivée avec `BEGIN CERTIFICATE` (`:131`). Un appel réseau vers la TSA, donc hors de cette fenêtre.
3. **Décider le témoin de production** : si le gate exige une pièce réelle, `ingest-capture.ts` sait l'ingérer avec TSA (`ingest-capture.ts:2-14`), mais c'est une écriture EvidenceItem, R2 et access log, et la pièce doit recevoir un statut qui dit qu'elle est un témoin. À décider, pas à improviser.
4. **La preuve 2 pour un témoin de production** : une relecture des octets depuis R2 et un recalcul `sha256Buffer` comparé à `EvidenceItem.sha256`. Le module `evidence-chain/r2.ts` n'a pas de Get ; `evidenceStorage.ts:31` en a un (`get`), sur son propre bucket. Une fonction courte, à écrire et à tester, pas à bricoler dans la fenêtre d'armement.
5. **Le prédicat du job** : `stamp-pending.ts:44-45` doit dériver son univers de `eligibleStatusSqlClause`, comme le watchdog le fait déjà (`watcher-health.mjs:487-493`), sinon l'armement horodate une pièce BYTES_LOST et deux EXCLUDED. C'est un correctif de code avec test, et une décision de GPT sur ce qu'il advient des 3 pièces non éligibles sans token (elles resteront pendantes pour toujours dans le compteur du job si le filtre est posé sans les traiter).
6. **La remontée de l'état du job** : 4 crashs de connexion en 33 runs, dont celui de ce matin, invisibles hors du fichier de log ; et un seuil d'alerte à 50 qui rend 31 pièces pendantes silencieuses. À traiter dans la fenêtre watchdog de jeudi, pas avant, conformément à la consigne.

Rien de tout cela n'a été fait ici.
