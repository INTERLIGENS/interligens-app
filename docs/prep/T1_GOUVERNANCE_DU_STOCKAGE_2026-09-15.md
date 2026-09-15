# T1-GOUVERNANCE-DU-STOCKAGE — points 2 et 5

Fenêtre lecture seule côté production : aucune écriture, aucun DDL, aucun déploiement,
**aucun appel à l'API Cloudflare**. Le garde est construit et éprouvé avec un client
INJECTÉ ; il tournera tel quel le jour où le crédentiel aura la permission de lecture.

Suite complète : **505 fichiers, 7 329 tests verts**, `tsc --noEmit` propre.

---

## 1 — LE GARDE : LES TROIS ÉTATS, ET COMMENT `CANNOT_MEASURE` FAIT ÉCHOUER

`src/lib/storage/retention/lifecycleGuard.ts`. Trois **valeurs distinctes du type**, pas
un booléen et un `catch` :

```ts
export type EtatDeConservation =
  | "NO_DELETE_RULE"       // le stockage a RÉPONDU, aucune règle ne supprime
  | "DELETE_RULE_PRESENT"  // le stockage a RÉPONDU, au moins une supprime
  | "CANNOT_MEASURE"       // le stockage n'a PAS répondu. → ÉCHEC
```

Un booléen aurait forcé à choisir un défaut, et le défaut choisi aurait été
« pas de règle » — le mensonge confortable. C'est pourquoi le troisième état est une
valeur, pas l'absence des deux autres.

### Comment `CANNOT_MEASURE` fait échouer

`mesurerCompartiment` ne rend `NO_DELETE_RULE` sur une exception que dans **un seul
cas** : `NoSuchLifecycleConfiguration`, qui est une **réponse** du stockage disant qu'il
n'y a pas de configuration. Tout le reste — 403, 5xx, timeout, une chaîne nue qui n'est
même pas une `Error` — tombe en `CANNOT_MEASURE` avec l'obstacle **nommé**.

`jugerConservation` transforme ensuite tout `CANNOT_MEASURE` sur un compartiment
**probatoire** en échec de cause `CONSERVATION_NON_MESURABLE`. Le verdict n'est pas un
silence : `rendreVerdict` imprime `VERDICT : ÉCHEC` et la phrase
*« la politique de conservation de « X » n'a PAS pu être lue »*.

Deux décisions qui vont dans le même sens :

- un statut de règle **illisible** (`UNKNOWN`) échoue **avec** `ENABLED`. Un statut qu'on
  ne sait pas lire n'est pas une permission.
- une règle **plus profonde** que le préfixe probatoire (`reports/GordonGekko/`) échoue
  aussi : `prefixeAtteint` est **symétrique**. N'en retenir qu'un sens était le trou.

### Ce que le garde dit de l'état réel

| état du compartiment | verdict |
|---|---|
| `auto-delete-30d` ENABLED sur `reports/` (l'état d'août) | **ÉCHEC** |
| `auto-delete-30d` DISABLED (l'état d'hier) | **passe**, mais **SIGNALÉE et NOMMÉE** |
| Default Multipart Abort Rule seule (l'état de ce matin) | **passe**, `NO_DELETE_RULE`, aucun signalement |
| 403 `AccessDenied` (ce que rend le crédentiel aujourd'hui) | **ÉCHEC** |

La ligne 2 est le cœur du ruling : *désactivée n'est pas absente*. Le rapport la nomme, et
c'est à ça qu'on la verra revenir.

La ligne 3 est le point (e) : la **Default Multipart Abort Rule** n'abandonne que des
chargements incomplets — des fragments qui n'ont jamais formé un objet. `supprime` et
`abandonneMultipart` sont **deux champs**, jamais fondus. La compter comme une suppression
ferait échouer le garde sur tous les compartiments R2 du compte, et un garde qui crie
toujours ne se lit plus.

---

## 2 — LE PÉRIMÈTRE EST DÉRIVÉ, PAS RECOPIÉ

**Les préfixes** sont l'objet `PREFIXES_PROBATOIRES` de `registre/identite.ts` —
la seule autorité du dépôt sur la question. Pas une copie : le témoin vérifie l'**identité
référentielle** (`toBe`, pas `toEqual`), qu'une copie ne passerait pas. Et le garde ne
contient **aucun littéral** : ni `"reports/"`, ni `"evidence/"`, ni `interligens-`.

**Les compartiments** sont dérivés des variables qui *nomment les autorités de stockage de
l'application* :

```
perimetreProbatoire({ R2_BUCKET_NAME })                          → ["interligens-reports"]
perimetreProbatoire({ R2_BUCKET_NAME, R2_EVIDENCE_BUCKET_NAME }) → ["interligens-evidence", "interligens-reports"]
```

Conséquence voulue, sans qu'aucune liste en dur ait à le dire : **`interligens-static` et
`interligens-vaults` n'entrent pas dans le périmètre**, parce qu'aucune autorité de
l'application ne les désigne. La décision du fondateur de laisser `interligens-static`
ouvert — sept fichiers servis, dont le pack Chromium de cinq routes PDF — n'a donc pas
besoin d'une exception : elle tombe du périmètre dérivé.

La preuve de dérivation qui compte n'est pas le `toBe` mais celle-ci : on juge avec un
périmètre **étendu** d'un préfixe (`coffres/`), et le garde échoue — parce qu'il ne connaît
rien d'autre que ce qu'on lui dérive.

---

## 3 — LE FAIL-CLOSED EVIDENCE, ET CE QUI RESTE INTACT

`src/lib/evidence-chain/compartment.ts`. **Une porte unique**, qui refuse au lieu de se
rabattre :

```ts
resoudreCompartimentGouverne(env)
  → { ok: true, config }
  → { ok: false, cause: "evidence_compartment_unconfigured" }     // la variable manque
  → { ok: false, cause: "evidence_credentials_unconfigured" }     // l'accès manque
```

`R2_BUCKET_NAME` n'apparaît **nulle part** dans cette fonction, et un témoin vérifie cette
absence — un `||` de plus et le ruling serait violé sans qu'une ligne de test change.
Une variable à la chaîne vide ou blanche vaut **absente**, pas un compartiment fantôme :
c'est la quatrième fois que ce dépôt rencontre ce mode de panne, et ici il produit un refus.

### La cause est propre, et disjointe

`CAUSES_REFUS_DE_COMPARTIMENT ∩ READBACK_REFUSAL_KINDS = ∅`, vérifié par témoin. Et la
porte **ne lève jamais** : si elle levait, `classifyHeadError` rangerait le refus en
`object_unreadable` et la cause serait perdue. « La configuration manque » ne doit jamais
se lire « l'objet a disparu » — on ne répare pas une variable d'environnement en allant
regarder un bucket.

### Le refus PRÉCÈDE l'écriture

Six sites gouvernés, **recensés par mesure** (tout fichier de `src/` important
`evidence-chain/compartment`) et confrontés à une liste déclarée — un septième site rendrait
le témoin rouge :

| site | ce qu'il fait maintenant sans la variable |
|---|---|
| `scripts/evidence-chain/stamp-pending.ts` | refuse à l'amorçage, `exitCode 1`, aucun horodatage |
| `scripts/evidence-chain/readback-verify.ts` | refuse, `exit 1`, aucune relecture |
| `scripts/evidence-chain/ingest-capture.ts` | refuse, `exit 1`, **aucune pièce créée** |
| `scripts/watcher-bridge/run-auto-evidence.ts` | refuse en LIVE ; `--dry-run` inchangé (rien n'est écrit) |
| `lib/osint/evidenceCommitBridge.ts` | branche **avec octets** : `mode: "failed"`, aucune pièce |
| `lib/osint/retail/evidenceChainBridge.ts` | `ok: false` + cause ; la soumission retail **n'est pas bloquée** |

Aucun de ces sites ne passe plus `r2: null` — un témoin le vérifie. `r2: null` fait entrer
`ingest` en **mode dégradé** : la pièce est créée sans octets. C'est acceptable quand R2 est
en panne ; ce n'en est pas une quand la **configuration** manque, et là la pièce ne doit pas
naître du tout.

**Deux nuances délibérées**, toutes deux sous témoin :

- **La branche HASH-ONLY du commit opérateur n'est PAS refusée.** Elle ne persiste aucun
  octet, donc elle n'a aucun compartiment à résoudre. La refuser casserait un chemin
  légitime au nom d'une variable qui ne le regarde pas.
- **Le pont retail rend son refus à un appelant qui l'absorbe déjà.** L'internaute n'est pas
  bloqué, l'original reste au coffre privé avec son `imageSha256`, et une réconciliation
  pourra re-chaîner après provisionnement.

### LES CHEMINS NON GOUVERNÉS, LAISSÉS INTACTS — et pourquoi

| chemin | pourquoi il n'est pas touché |
|---|---|
| `lib/storage/evidenceStorage.ts` | packs de surveillance + rendus casefile. Hors chaîne de preuve. GPT le garde au backlog — « code mort n'est pas une raison suffisante d'ouvrir un nettoyage pendant le chemin critique » |
| `lib/pdf/engine.ts` | archives `reports/`. Chemin **GELÉ** par `guard-offline.sh`, dette E connue et comptée |
| `lib/storage/pdfStorage.ts` | le registre gouverné des PDF — **autre domaine de gouvernance**, avec sa propre primitive et son propre gate |
| `scripts/evidence-chain/backfill-evidence.ts` | LEGACY : lit des objets **historiques** de `interligens-reports` |
| `scripts/evidence-chain/migrate-snapshots.ts` | LEGACY : idem |
| `scripts/evidence-chain/recover-snapshots-d.ts` | LEGACY, et **hors fenêtre par décision GPT** |
| `lib/vault/*`, `lib/mm/reporting/pdfReport.ts`, `api/admin/documents/presign` | coffres, rapports MM, PUT présigné — aucun rapport avec la naissance d'une pièce probatoire |

Les trois scripts LEGACY gardent **volontairement** l'ancienne autorité
`evidenceR2ConfigFromEnv`, avec son repli assumé : ils existent pour lire ce qui a été
écrit dans `interligens-reports`, et les faire échouer les empêcherait de faire exactement
ce pour quoi ils existent. Un témoin fige cet écart entre les deux autorités : s'il
disparaissait, ce serait que le repli est revenu quelque part.

---

## 4 — LES SIX MUTANTS

Chacun posé dans l'arbre, suite relancée, arbre restauré.

| # | mutant | ce qu'il a rougi |
|---|---|---|
| **M1** | un 403 traité comme « aucune règle » | 3 — `403 → CANNOT_MEASURE`, `CANNOT_MEASURE fait ÉCHOUER`, `5xx/timeout/illisible` |
| **M2** | le garde ignore le statut, ne regarde que l'existence | 1 — `auto-delete-30d DISABLED : signalée, et le garde passe` |
| **M3** | la règle multipart comptée comme une suppression | 4 — dont `l'état RÉEL du compartiment après la suppression` et `le rapport DISTINGUE les deux colonnes` |
| **M4** | le périmètre probatoire codé en dur | 2 — `les PRÉFIXES sont l'objet lui-même` (identité référentielle) et `aucun littéral dans le garde` |
| **M5** | le repli sur `R2_BUCKET_NAME` réintroduit sur le chemin gouverné | 5 — dont `interligens-reports n'apparaît NULLE PART` et `variable vide vaut absente` |
| **M6** | le refus confondu avec `object_absent` | 5 — dont **`les deux vocabulaires sont DISJOINTS`** |

---

## 5 — LE CHEMIN GOUVERNÉ, AVANT ET APRÈS PROVISIONNEMENT

### AVANT (état du dépôt aujourd'hui)

`R2_EVIDENCE_BUCKET_NAME` absente → **tout site gouverné refuse**, avec
`evidence_compartment_unconfigured`. Rien n'est écrit dans `interligens-reports`. Aucune
pièce ne naît. Aucun jeton n'est posé.

C'est une **interruption assumée** du chemin Evidence, et c'est le sens du ruling : mieux
vaut ne pas naître que naître au mauvais endroit. `main` n'étant pas auto-déployé et cette
fenêtre interdisant tout déploiement, **la production servie (9ee790c) est inchangée** :
l'interruption ne commence qu'au prochain déploiement, que le fondateur fera après avoir
provisionné la variable.

### APRÈS

`R2_EVIDENCE_BUCKET_NAME=interligens-evidence` → la porte rend le compartiment **dédié**, et
lui seul. Les nouvelles pièces naissent dans `interligens-evidence`. Le garde de conservation
passe alors à **deux compartiments** sous surveillance, automatiquement, sans qu'une ligne
change.

### ⚠️ CE QUE LE PROVISIONNEMENT VA RÉVÉLER, ET QUI N'EST PAS RÉPARÉ ICI

**`EvidenceItem` porte `r2Key`, et AUCUNE colonne de compartiment.** Vérifié sur
`schema.prod.prisma` : la seule colonne de stockage est `r2Key String?`.

Les ~1 101 pièces existantes ont leurs octets dans **`interligens-reports`**, parce que
c'est là que le repli les a écrites. Le jour où la variable est posée, `stamp-pending` et
`readback-verify` chercheront ces mêmes clés dans **`interligens-evidence`** — et ne les
trouveront pas.

Le comportement qui en résulte est **correct et fail-closed** : `readbackDigest` rendra
`object_absent`, `stampOne` refusera, aucun jeton ne sera posé sur une pièce dont les octets
ne sont pas là où le lecteur les cherche. C'est exactement la doctrine B3. Mais la
conséquence opérationnelle doit être vue avant samedi :

> **Après provisionnement, les 31 pièces éligibles en attente de TSA deviennent
> inhorodatables** tant que leurs octets ne sont pas migrés vers le compartiment dédié,
> ou tant qu'une colonne de compartiment par objet n'existe pas.

Les deux voies — migration des octets, ou colonne `r2Bucket` renseignée rétroactivement —
sont **hors de cette fenêtre** : l'une écrit en production, l'autre est un DDL. Aucune n'est
entamée. C'est une décision de GPT, et c'est le seul point du plan avant samedi qui n'a pas
encore de propriétaire.

Rien n'a été corrigé sur ce point, rien n'a été migré, aucune règle Cloudflare n'a été lue
ni écrite.
