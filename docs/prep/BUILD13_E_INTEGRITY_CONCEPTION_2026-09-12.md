# E / INTEGRITY — CONCEPTION DU MÉCANISME DE VÉRIFICATION

**Date** : 2026-09-12 · **Lot** : E, face INTEGRITY (T1 tient la face AUTHORITY)
**Nature** : conception. **Zéro code écrit, zéro objet téléchargé, zéro mutation
de compartiment, zéro appel R2, zéro requête base.**

> Ce document ne propose aucune remédiation storage. Il propose un mécanisme,
> le chiffre, dit ce qu'il ne prouve pas, et recommande une séquence.

---

## ⚠️ MISE À JOUR — CE QUE L'EXÉCUTION A DÉMENTI (même jour, après GO)

Le lot a été exécuté : voir **`BUILD13_E_INTEGRITY_RECENSEMENT_JOUR0_2026-09-12.md`**.
Trois énoncés de ce document sont **périmés par la mesure**, et ils le sont ici
plutôt que discrètement corrigés :

| § | ce que j'écrivais | mesuré |
|---|---|---|
| 0.3, 3 | taille du corpus `S ∈ [0,2 ; 3,2] Go` | **4,85 Gio — au-dessus de ma borne haute.** Moyenne 4,5 Mio/objet, pas 0,2–1,5 Mo. Mon hypothèse sur le poids des captures PNG était basse d'un facteur 3 à 20. |
| 2, §7 rang 1 | forme des ETag `[NON MESURÉ]` | **1 136 / 1 136 mono-part.** L'épinglage d'ETag est praticable sur tout le compartiment, sans exception à déclarer. |
| 6 | `EXCLUDED` rangé avec `BYTES_LOST` en « absence connue » | **FAUX dans un sens.** `EXCLUDED` est un état de GOUVERNANCE, pas des octets : 8 des 9 lignes `EXCLUDED` ont des octets vivants. Le seau unique accusait le cas normal. Corrigé — deux faces séparées, voir le rapport §5. |

Le reste du document tient tel quel, y compris O5 écarté et la recommandation.
**L'ordre imposé par GPT — mesurer la taille AVANT de télécharger — a payé
exactement là où mon estimation était fausse.**

---

## 0. D'OÙ VIENNENT LES CHIFFRES — et ce que je n'ai pas pu mesurer moi-même

Ce worktree (`interligens-t2`) **ne porte pas de `.env.local`**. Je n'ai donc ni
accès base ni credential R2, et c'est très bien : la conception n'en a pas
besoin. **Tous les cardinaux cités sont ceux de T1**, repris tels quels. Ce que
j'ajoute est étiqueté : `[LU]` = lu dans le code de ce dépôt aujourd'hui,
`[DÉRIVÉ]` = arithmétique sur les chiffres de T1, `[NON MESURÉ]` = trou déclaré.

### 0.1 — Trois lectures de code qui changent la conception

| # | constat | `[LU]` où |
|---|---|---|
| **L-a** | **`bytesProbe` n'a AUCUN appelant automatisé dans ce dépôt.** Zéro occurrence dans `src/app/**`, absent des **18** crons de `vercel.json`, absent des **2** workflows (`guard-offline.yml`, `security.yml`), absent des scripts `package.json`. Son propre en-tête le dit : *« NON BRANCHÉE SUR UN CRON. On la mesure avant de la programmer. »* | `grep` sur `src/app`, `vercel.json`, `.github/workflows/`, `package.json` |
| **L-b** | **`verifyManifest` ne vérifie pas une clé, il teste l'appartenance à un ENSEMBLE.** `walkFiles` construit `Map<sha256 → chemin>` puis teste `present.has(it.sha256)`. **`r2Key` n'est jamais lu.** Une pièce dont les octets seraient servis par une AUTRE clé passe `PASS`. | `manifest.ts:209-217` |
| **L-c** | **L'ingestion ne relit jamais ce qu'elle a écrit.** `putEvidenceObject` → `item.r2Key = key`. Aucun `HeadObject`, aucun `GetObject`, aucune comparaison après le `PUT`. La ligne affirme des octets que personne n'a jamais reconstatés, **même une seconde après l'écriture**. | `ingest.ts:190-196`, `r2.ts:59-63` |

**Conséquence de L-a sur l'énoncé ratifié.** La formule *« bytesProbe, le seul
contrôle AUTOMATISÉ qui regarde R2 »* est **plus optimiste que le dépôt**. Le
constat exact est : **il n'existe aujourd'hui AUCUN contrôle automatisé qui
regarde R2.** Il existe deux CLI manuelles — l'une lit un répertoire local et
recalcule, l'autre interroge R2 et ne lit aucun octet. Les deux attendent qu'un
humain les lance.

*Réserve* : je ne peux exclure, depuis ce dépôt, qu'un ordonnanceur **hors dépôt**
(Host-005, `launchctl`) appelle la sonde. Aucune trace ici. À lever d'un `ls` sur
l'hôte, pas par déduction.

**Conséquence de L-b.** Le contrôle qui recalcule ne sait pas détecter un
**échange de clés**. Porté tel quel sur R2, il validerait un compartiment où
deux pièces auraient été permutées. Un vérificateur R2 doit être **par clé** :
*je lis CETTE clé, je hache, je compare à CETTE ligne.*

**Conséquence de L-c.** La chaîne ne connaît **aucun instant** où les octets ont
été constatés. Le `sha256` de la colonne est celui du **buffer en mémoire avant
l'envoi**, jamais celui de ce que R2 a effectivement rangé. C'est la racine du
mot « décore » : l'empreinte n'a pas seulement cessé d'être vérifiée, **elle ne
l'a jamais été, pas même à la naissance.**

### 0.2 — La réconciliation du périmètre `[DÉRIVÉ]`

Les deux tableaux de T1 se recoupent exactement, et ce recoupement est le
squelette du rapport que le mécanisme devra rendre :

```
1 103 lignes portant un r2Key
  = 1 071 clés adressées par contenu (evidence/<aa>/<sha256>)
  +    32 clés reports/

présents 1 101
  = 1 070 objets evidence/ portant une ligne
  +    31 objets reports/ portant une ligne

absents 2
  = 1 evidence/5b/5b2dcac7….png   → EXCLUDED
  + 1 reports/GordonGekko/CASE_…2026-07-20….pdf → BYTES_LOST
```

**Aucun reste.** Les « 1 071 concordances clé↔colonne » et les « 1 070 objets
`evidence/` avec ligne » ne se contredisent pas : l'unité d'écart **est** la
pièce `EXCLUDED`, qui porte une clé adressée par contenu sans porter d'octets.
Un mécanisme dont le rapport ne reconstitue pas cette table est un mécanisme
qu'on ne peut pas relire.

### 0.3 — Ce qui reste `[NON MESURÉ]`, et qui coûte

**La taille du corpus `S`.** Elle n'est écrite nulle part. Un seul point d'appui
mesuré : le re-hachage du 2026-08-20 a téléchargé **5,7 Mo pour 31 objets
`reports/`** → **≈ 184 Ko/objet**. Rien n'est mesuré pour les 1 070 captures
`evidence/`. Fourchette de travail, **assumée comme telle** : captures PNG plein
écran ≈ 0,2 à 3 Mo → **S ∈ [0,2 ; 3,2] Go**, soit un facteur **16** entre les
bornes. Toute estimation de temps ci-dessous en hérite.

**Elle se ferme gratuitement.** `ListObjectsV2` rend `Size` **et** `ETag` pour
chaque objet : **1 136 objets = 2 requêtes de classe A, zéro octet d'objet
téléchargé.** C'est la première mesure à faire, avant tout arbitrage de cadence.
Elle n'est pas dans ce document : elle exige un credential que ce worktree n'a
pas, et elle appartient à l'exécution, pas à la conception.

---

## 1. LE POINT QUI GOUVERNE TOUT LE RESTE : CONTRE QUOI RECALCULE-T-ON ?

L'invariant ratifié dit *« independently recomputed from the persisted bytes »*.
Il dit ce qu'on recalcule. Il ne dit pas **à quoi on l'oppose**. Trois cibles
existent, et elles ne valent pas la même chose.

| cible de comparaison | origine | ce qu'un accord prouve |
|---|---|---|
| segment de clé `evidence/<aa>/<sha256>` | **la même écriture d'ingestion** que la colonne | rien de neuf — c'est le NOM contre NOM déjà mesuré (1 071/1 071) |
| colonne `EvidenceItem.sha256` | l'ingestion, mais c'est **l'affirmation du registre** | l'objet **est** ce que le registre affirme. Satisfait l'invariant à la lettre. **Plancher.** |
| **token TSA** (`tsaToken` + `tsaCertChain`) | **un tiers horodateur**, à une date qu'il a signée | l'objet est ce dont un tiers a attesté l'existence à une date. **Le seul ancrage qui ne vienne pas de nous.** |

**La cible doit être les DEUX dernières, dans le même passage.** Ce n'est pas un
raffinement : c'est ce qui rend la question (c) — *invalide, corrompu, ou
remplacé ?* — **décidable** au lieu d'être une opinion. Sans ancrage tiers,
toute divergence accuse les octets par défaut, faute d'arbitre. Avec lui, quand
`sha256(octets) ≠ colonne`, l'arbitre dit **de quel côté est l'erreur**.

Le coût de cet ajout est **nul en réseau** : `verifyTimestampOffline` est déjà
écrit, tourne **hors ligne**, et n'utilise que la chaîne de certificats archivée
dans la ligne. Population concernée : **1 070 / 1 104** portent un TSA
(34 sans, dont 31 éligibles) — donc **97 %** du corpus peut être ancré, et les
34 restants deviennent une classe déclarée, pas un angle mort.

---

## 2. L'ÉCHELLE DE FORCE — trois étages, trois prix, trois énoncés

| étage | observation | octets d'objet lus | ce qu'il ÉNONCE |
|---|---|---|---|
| **T0** | `HeadObject` — existence + retour d'une règle destructive | **0** | « la clé répond » |
| **T1** | `Size` vs `byteSize`, `ETag` vs `ETag` épinglé | **0** | « aucune propriété observable n'a bougé depuis l'épinglage » |
| **T2** | `GetObject` en flux → `sha256` → colonne **+** TSA hors ligne | **tous** | « ces octets sont ceux que le registre affirme, et un tiers l'a attesté le J » |

**T0 existe et ne tourne pas** (L-a). **T1 n'existe pas — et il est GRATUIT** :
`ContentLength` est **déjà** dans la réponse que `bytesProbe` reçoit et
**jette** (`bytesProbe.ts:255`, `byteSize` est stocké dans le rapport mais
comparé à rien). **T2 n'existe pour R2 dans aucun chemin permanent.**

### T1 mérite qu'on dise précisément ce qu'il vaut

* **`Size` vs `EvidenceItem.byteSize`** — ce n'est **pas** NOM contre NOM. La
  colonne vient de notre écriture ; `ContentLength` est la comptabilité que R2
  fait **des octets qu'il détient**. Deux origines. Un désaccord est un fait
  neuf. `[NON MESURÉ]` : combien des 1 103 lignes portent un `byteSize` non
  NULL (colonne `Int?`). Si la couverture est partielle, le contrôle l'est aussi,
  et il faudra le déclarer ligne à ligne — jamais moyenner.
* **`ETag`** — sur un `PutObjectCommand` mono-part (ce qu'émet `putEvidenceObject`
  avec un `Buffer`), l'ETag R2 **devrait** être le MD5 hexadécimal de l'objet :
  une empreinte **calculée par le stockage**, donc indépendante de nous.
  `[NON MESURÉ]` — **à vérifier par la requête LIST du §0.3, pas à supposer**
  (un ETag en `<hex>-<n>` signalerait un envoi multipart et invaliderait la
  lecture MD5 pour cet objet).

---

## 3. (a) LES OPTIONS, CHIFFRÉES — et ce que chacune NE PROUVE PAS

Base commune : **N = 1 103** lignes, **P = 1 101** objets observables,
**A = 2** absences connues. Égress R2 **gratuit** ; le coût monétaire de toutes
les options ci-dessous est **inférieur au centime par exécution** aux tarifs
publics (classe B ≈ 1 100 opérations). **Le prix n'est donc pas l'argument.**
Les vraies contraintes sont le **temps**, l'**enveloppe d'exécution**, et
surtout **la portée de l'énoncé produit.**

### O0 — Statu quo (T0 manuel)

| | |
|---|---|
| coût | 1 103 `HEAD` ≈ **60 s mesuré** (`--all`, SONDE 2026-08-20) · ~1 Mo d'en-têtes · 0 octet d'objet |
| fréquence | **aucune** — attend un humain (L-a) |
| **ne prouve pas** | **toute propriété des octets.** Une substitution à taille égale est invisible ; une substitution à taille différente aussi, puisque la taille n'est comparée à rien. |

### O1 — Balayage T1 (propriétés gratuites), quotidien

| | |
|---|---|
| coût | **2 requêtes classe A** (LIST 1 136 clés) ≈ **0,3 Mo de XML**, **quelques secondes**, **0 octet d'objet**. Alternative par clé : 1 103 `HEAD` ≈ 60 s. |
| fréquence soutenable | **horaire sans y penser.** |
| prouve | taille en accord avec le registre ; **aucune propriété observable n'a changé depuis l'épinglage.** |
| **ne prouve pas** | **(i) rien sur le jour 0.** L'épinglage enregistre *ce qui est là maintenant* — **y compris des octets déjà altérés**. Sans T2 préalable, O1 certifie la stabilité d'un état inconnu. **C'est la vacuité, exactement.** **(ii) rien contre un adversaire** : les collisions MD5 à préfixe choisi sont à la portée d'une machine de bureau — qui peut écrire dans le compartiment peut substituer à ETag constant. **(iii) il hérite du défaut L3 de la sonde** : si Cloudflare changeait la sémantique de l'ETag, O1 lirait « rien n'a bougé » en silence. |

### O2 — Recensement complet T2, **une fois** (attestation jour 0)

| | |
|---|---|
| coût | **P = 1 101 `GetObject`** en flux · **S octets** `[NON MESURÉ]`, fourchette **0,2–3,2 Go** · temps dominé par la latence par objet : à ~100–200 ms/objet en séquentiel, **3 à 6 min** ; à concurrence 8, **30–60 s** + transfert. Repère mesuré d'enveloppe : la route OFAC absorbe **~200 Mo en < 300 s** (`maxDuration = 300`). |
| fréquence | **une seule fois.** |
| prouve | pour chaque clé prise **une à une** : les octets rangés sous CETTE clé produisent le `sha256` de CETTE ligne, **et** un tiers l'a horodaté. **C'est le seul énoncé qui satisfait l'invariant ratifié.** |
| **ne prouve pas** | rien sur **demain**. Une attestation est **datée** ; elle ne se prolonge pas toute seule. Et elle ne dit rien de la période **2026-03-09 → 2026-07-20**, qui reste `NOT_MEASURABLE` et le reste (défaut `uploadPdf`, hors périmètre). |

> **C'est ici que l'objection de GPT se dissout.** Personne ne propose de
> télécharger 1 103 objets **à chaque CI** — et la bonne raison de ne pas le
> faire n'est pas le coût : **la CI est le mauvais plan.** Elle vérifie du code,
> pas un stockage de production. Y brancher ce contrôle rendrait le build rouge
> pour un événement de stockage et vert pour rien. Ce contrôle appartient au
> **plan opérationnel**. Le recensement, lui, est un **coût unique**, pas une
> taxe récurrente.

### O3 — Recensement glissant (job de réconciliation)

| | |
|---|---|
| coût | P/T objets par exécution. **T = 30 j → 37 objets/jour ≈ 7 à 110 Mo/jour** selon la fourchette S. Tient dans une enveloppe de 300 s **sans concurrence**. |
| fréquence | quotidienne, corpus entier tous les **T** jours. |
| prouve | chaque objet a été recalculé **au moins une fois dans les T derniers jours**. Latence de détection **bornée par T**. |
| **ne prouve pas** | **l'intégrité du corpus MAINTENANT.** Il produit une fenêtre glissante, **jamais un instantané simultané** : au jour J, l'objet visité le jour J−29 n'est attesté qu'à J−29. Un rapport O3 ne doit donc **jamais** écrire « corpus intègre », mais « chaque pièce intègre à la date portée en regard ». |

### O4 — Événementiel (aux frontières)

Trois frontières, de valeur très inégale :

| frontière | coût | énoncé |
|---|---|---|
| **relecture après ingestion** (corrige L-c) | 1 `GET` par pièce ingérée — **le trafic d'ingestion, pas le corpus** | « R2 a rangé ce que nous avons envoyé ». **C'est l'instant zéro qui n'existe pas aujourd'hui.** |
| **génération de manifeste** (corrige L-b) | P du dossier concerné, à la demande | « le manifeste que je signe porte des empreintes qui ont été opposées aux octets **ce jour-là** » |
| **service / export d'une pièce** | 1 `GET` déjà en cours | « ce qui est servi est intègre au moment où il est servi » |
| **ne prouve pas** | | **rien sur ce qui n'est jamais servi** — c'est-à-dire la queue longue, c'est-à-dire **précisément les pièces dont personne ne remarquerait la disparition.** C'est ainsi que le PDF du 20 juillet est parti. |

### O5 — Échantillonnage

Je le chiffre pour pouvoir l'**écarter avec un nombre**, pas avec un avis.

Tirage uniforme de `n` objets parmi `N = 1 101`, altération portant sur une
fraction `p` :

```
P(détecter ≥ 1)  =  1 − (1 − p)^n        →  n ≥ ln(0,05) / ln(1 − p)  pour 95 %

p = 1 %   (11 objets) → n = 299     ( 27 % du corpus )
p = 0,5 % ( 6 objets) → n = 598     ( 54 % du corpus )
p = 0,1 % ( 1 objet ) → n = 2 995   ( IMPOSSIBLE — supérieur au corpus )
```

**Le cas à une seule pièce altérée est le cas décisif, et il est exact, pas
asymptotique** : pour un unique objet défectueux, `P(détecter) = n/N`.

```
95 % de confiance sur UNE pièce altérée  →  n = 1 046 objets sur 1 101  ( 95 % )
```

| | |
|---|---|
| **ne prouve pas** | **l'intégrité du corpus — jamais.** Il **borne une probabilité**, sous deux hypothèses qu'il faut écrire : *(H1)* le tirage est uniforme et **indépendant du choix de l'adversaire** ; *(H2)* l'adversaire **ne peut pas observer** quelles clés ont été tirées. Contre une altération **ciblée** — la pièce d'un dossier à 12 M$ — un échantillon de 100 rend **9 %** de détection par exécution. |

**Verdict sur O5 : sans objet ici.** L'échantillonnage est l'outil des corpus
dont le recensement est infaisable. Pour atteindre 95 % sur une pièce unique il
faut en lire **95 %** — soit, à ce coût, **autant lire les 100 % et pouvoir
énoncer une catégorie au lieu d'une borne.** Un échantillon ne coûte pas moins
cher : il coûte le droit d'affirmer.

---

## 4. (b) LE PRÉALABLE DE NON-VACUITÉ — le mécanisme doit MORDRE

Règle, reprise du geste de T1 sur le guard : **un témoin d'intégrité qui n'a
jamais vu diverger son comparateur n'atteste rien.** Le témoin doit être
**positif** — « j'ai muté, il a crié » — jamais « je n'ai rien trouvé ».

### 4.1 — Quatre morsures, pas une

Le comparateur n'a pas un mode d'échec, il en a quatre, et un `FAIL` générique
rendrait (c) indécidable. Chacun doit produire un **verdict nommé distinct** :

| on mute… | attendu | ce que ça démontre |
|---|---|---|
| **un octet des données** | `DIVERGENT` sur cette clé, les autres inchangées | le hachage mord, et il ne contamine pas ses voisins |
| **la colonne `sha256`** attendue | `DIVERGENT_REGISTRY_SUSPECT` si le TSA atteste les octets | l'arbitre tiers est **réellement consulté**, pas décoratif |
| **un octet du token TSA** | `ANCHOR_BROKEN`, **et non** `DIVERGENT` | les deux axes sont séparés : octets ≠ ancrage |
| **la clé lue** (servir les octets de B sous la clé A) | `DIVERGENT` | **la liaison par clé est effective — c'est la morsure que `verifyManifest` ne sait PAS faire aujourd'hui (L-b), et il faut la démontrer par un échec du modèle ensembliste** |

### 4.2 — Trois niveaux de témoin, et ce que chacun laisse dehors

1. **Comparateur pur, hors réseau.** Fonction `(octets, empreinte attendue) →
   verdict`, alimentée par une fixture, un bit retourné. Disponible
   **immédiatement**, **aucune mutation**, aucun credential. *Laisse dehors :*
   le câblage.
2. **Faux R2 servant des octets mutés.** Le patron `fakeR2` de
   `__tests__/security/evidence-bytes-probe.test.ts` existe déjà et sert
   exactement à ça. Couvre la chaîne `lecture → hachage → comparaison → verdict
   → code de sortie`. *Laisse dehors :* **le réseau réel, et lui seul.**
3. **Un objet réel muté.** La seule morsure qu'aucune feinte ne donne — et la
   seule qui exige une **écriture dans le compartiment**.
   - sur une pièce gouvernée : **jamais**.
   - sur la pièce `BYTES_LOST` : impossible, il n'y a plus d'octets.
   - sur un **canari d'intégrité dédié** (une clé sous un préfixe canari, dont
     l'empreinte attendue est enregistrée, et qu'on mute volontairement) :
     **c'est la seule voie**, elle est **hors de ma fenêtre** — elle mute le
     compartiment — et elle **demande un ruling**. Je la pose comme demande,
     je ne la prends pas. Précédent de discipline : `DEFAULT_CANARY_KEY` est
     déjà une clé qui **doit** répondre 404, et son absence est *vérifiée*
     avant toute interprétation des autres 404.

### 4.3 — La non-vacuité au niveau du CORPUS, pas seulement du comparateur

Un comparateur qui mord peut encore rendre un rapport creux s'il n'examine rien.
Le dépôt porte déjà la parade — **`nothing_expected` : un périmètre vide est
`UNABLE`, jamais `OK`** — et elle se généralise en une règle d'arithmétique :

```
examinés_et_recalculés  +  absents_connus  +  non_observés  =  1 103
```

**Si la somme ne tombe pas, le rapport est UNABLE, quel que soit le nombre de
divergences trouvées.** C'est ce qui interdit à « 0 divergence » de signifier
« 0 objet regardé » — le défaut du compteur nº 4 du watchdog, dans sa forme
intégrité. Et la même règle **fail-closed** que la sonde : un `GET` qui échoue
par autre chose qu'un 404 est une **non-observation**, jamais une divergence,
jamais un OK.

---

## 5. (c) QUAND UNE DIVERGENCE EST TROUVÉE — la classification

**Principe** : chaque classe doit être **décidable sur des faits observés**, pas
sur une intuition. Je donne donc, pour chacune, le **discriminant**. Trois
observables suffisent : la **longueur**, la **date de dernière écriture R2
comparée à `ingestedAt`**, et **le verdict du TSA hors ligne**.

| classe | discriminant | conduite |
|---|---|---|
| **`ABSENT_KNOWN`** | clé absente **et** ligne déjà étiquetée `BYTES_LOST`/`EXCLUDED` | **pas une divergence.** Comptée à part. Voir §6. |
| **`ABSENT_UNDECLARED`** | clé absente, ligne **non** étiquetée | la classe du 2026-08-19. Rupture d'intégrité **référentielle**. Étiqueter, geler l'assertion, incident. |
| **`UNREADABLE`** | échec de lecture ≠ 404 | **jamais « OK », jamais « divergence ».** Non-observation. Reste ouvert tant qu'il n'est pas levé. |
| **`DIVERGENT_TRUNCATED`** | `sha256` ≠ colonne **et** longueur lue < `byteSize` | **deux lectures concordantes exigées avant d'escalader.** Une lecture courte est un défaut d'**observation** jusqu'à preuve qu'elle est un défaut de **stockage**. |
| **`DIVERGENT_SUBSTITUTED`** | `sha256` ≠ colonne, longueur pleine, **stable sur deux lectures**, **et `LastModified` > `ingestedAt`** | **quelqu'un a écrit après l'ingestion.** C'est un événement de sécurité, pas un incident de stockage : le chemin d'écriture ou un porteur de credential est en cause. |
| **`DIVERGENT_CORRUPTED`** | `sha256` ≠ colonne, **`LastModified` inchangé depuis l'ingestion**, octets structurellement invalides pour le `mimeType` déclaré | aucune écriture constatée → dégradation, ou **mauvaise écriture d'origine** (et L-c rend la seconde hypothèse **pleinement ouverte** : rien n'a jamais vérifié le `PUT`). |
| **`DIVERGENT_REGISTRY_SUSPECT`** | `sha256` ≠ colonne **mais le TSA atteste les octets LUS** | **le registre a tort, pas les octets.** Erreur de backfill. On corrige **la colonne**, jamais les octets. **Cette classe n'existe que parce qu'on interroge l'ancrage tiers — sans lui, elle serait rangée à tort en `CORRUPTED`.** |
| **`ANCHOR_BROKEN`** | `sha256` **=** colonne, mais le TSA ne vérifie pas | l'artefact va bien ; c'est l'attestation tierce qui est rompue. **Un ré-horodatage silencieux est interdit** : il attesterait d'aujourd'hui en se faisant passer pour la date d'origine. On déclare et on conserve. |

### Les trois règles qui traversent toutes les classes

1. **Aucune classe ne conduit à supprimer.** Aucune. Y compris `SUBSTITUTED` :
   les octets déviants sont **eux-mêmes une pièce** — la preuve de la
   substitution — et doivent être conservés **à côté**, jamais par-dessus.
2. **Aucune classe ne conduit à réécrire en silence.** Le dépôt a déjà tranché
   la forme dure de cette règle : *« Aucun PDF régénéré. La pièce du 20 juillet
   est perdue et le reste. »* **Un artefact régénéré n'est pas une restauration,
   c'est un artefact neuf** — et le faire passer pour l'original serait la faute
   que tout ce chantier existe pour empêcher.
3. **Divergence ⇒ la pièce cesse d'être ASSERTABLE, sans cesser d'être au
   dossier.** Même doctrine que « les huit sortent de l'Explorer » : elle quitte
   la surface qui l'affirme, elle **reste** au registre, avec son motif. Le
   véhicule existe déjà et il est le bon : **`custodyScope` entre dans le hash du
   manifeste** — une mise en quarantaine devient donc **visible et
   horodatable**, jamais une disparition. *(La face AUTHORITY de E, tenue par
   T1, gouverne la quarantaine elle-même ; je m'arrête à sa frontière.)*

---

## 6. (d) LA BORNE — les deux absences connues

**Elles restent dans la liste attendue.** Les retirer ferait rendre au rapport
« 1 101 / 1 101 » — **un périmètre qui guérit en oubliant**, c'est-à-dire la
même faute que le compteur nº 4, d'un cran plus haut.

Trois exigences :

1. **Attente inversée, pré-enregistrée.** Pour ces deux clés, le mécanisme
   **attend l'absence**. Elles ne comptent donc pas comme divergences
   d'intégrité, mais comme **absences confirmées**.
2. **L'assertion est à deux faces.** Si l'un de ces objets **réapparaissait**,
   c'est un constat : `ABSENT_KNOWN_REAPPEARED`. Une pièce perdue qui revient
   n'est pas une bonne nouvelle, **c'est une écriture inexpliquée** — exactement
   la logique du canari existant, une clé dont l'existence est le problème.
3. **Dénominateurs séparés, jamais fondus.** Trois cardinaux imprimés côte à
   côte — `recalculés` / `absents connus` / `non observés` — dont la somme fait
   **1 103** (§4.3). L'intégrité se calcule sur le **premier seul**. Aucune
   moyenne, aucun pourcentage global.

**Et la réserve que ce périmètre ne lève pas** — inchangée, et elle est
structurelle : ce dénominateur **ne borne que les octets que le registre
connaît**. Les **35** objets sans ligne de registre sont hors de la question
d'intégrité **par construction** — on ne peut pas vérifier une empreinte qui
n'existe pas. Ils doivent être déclarés en `notCovered`, comme la sonde le fait
déjà, et **ne jamais** être comptés comme « conformes ».

---

## 7. RECOMMANDATION

**Une composition, et l'ordre EST l'argument.** Chaque étage n'est honnête que
posé sur le précédent.

| rang | quoi | cadence | pourquoi à ce rang |
|---|---|---|---|
| **1** | **LIST** (§0.3) — `Size` + `ETag` des 1 136 | **une fois**, puis à chaque balayage | ferme `S`, ferme la question ETag/MD5, **0 octet d'objet**. Rien ne doit être arbitré avant. |
| **2** | **O2 — recensement complet**, contre colonne **+ TSA** | **une fois**, sous supervision humaine, depuis un poste (précédent : les 5,7 Mo du 2026-08-20) | **sans lui, tout le reste maintient un état jamais constaté.** C'est l'attestation jour 0, et c'est ce qui rend O1 non vacuant. |
| **3** | **O1 — T1 quotidien** | quotidien, ~0 octet | transforme la sonde d'« existence » en **« inchangé depuis la date où il a été vérifié »**. Énoncé conditionnel, daté, **honnête et relisable**. |
| **4** | **O3 — recensement glissant, T = 30 j** | quotidien, ~37 objets | **c'est la réponse au défaut de type L3 de l'étage 3** : si l'ETag devenait muet, O3 le découvre en ≤ 30 j. Et il rétablit la vérité au sol contre un adversaire à collision MD5. |
| **5** | **O4 — relecture après ingestion** (L-c) | par pièce ingérée | **clôt le trou d'origine** : à partir de là, aucune ligne n'affirme des octets que personne n'a constatés. |
| **6** | **O4 — vérification à la génération de manifeste**, **par clé contre R2** (L-b) | à la demande | un manifeste signé cesse de recopier une empreinte : il **l'oppose**. |
| **—** | **O5 — échantillonnage** | — | **écarté, avec le nombre du §3** : 95 % sur une pièce unique exige 95 % du corpus. |

**Et deux décisions de cadrage, explicites :**

* **Rien de tout ceci ne va en CI.** La CI vérifie du code. Y brancher un
  contrôle de stockage produit un build rouge pour un événement de production et
  vert pour rien. **Ce qui va en CI, en revanche, ce sont les morsures du §4.1**
  — elles sont pures, hors réseau, déterministes : leur place est là, et nulle
  part ailleurs.
* **L'étage 2 se fait sous supervision, pas sous cron.** Un recensement complet
  est un acte daté dont le résultat est une attestation. Il se lit, il se signe.
  Ce qui s'automatise, ce sont les étages 3, 4 et 5.

---

## 8. CE QUE CETTE CONCEPTION NE RÈGLE PAS

1. **Elle constate, elle n'empêche pas.** Le compte n'offre aucun verrou
   d'écriture — mesuré par appel réel et inscrit dans `r2.ts:1-12` :
   `CreateBucket ObjectLockEnabled` → `NotImplemented`, `GetObjectLock` /
   `Versioning` → `AccessDenied`. **Aucun étage n'est un verrou.**
2. **La période 2026-03-09 → 2026-07-20 reste `NOT_MEASURABLE`**, et le rester
   **est la conclusion**, pas une étape. Un artefact détruit sans ligne
   `EvidenceItem` est invisible à toute empreinte, par construction.
3. **Les 34 pièces sans TSA** n'ont pas d'ancrage tiers. Elles retombent sur le
   plancher (colonne seule) et doivent être **rapportées comme telles** —
   `VERIFIED_UNANCHORED` — jamais confondues avec les 1 070 ancrées.
4. **La morsure sur objet réel (§4.2-3) n'est pas couverte** et le restera tant
   qu'un canari d'intégrité n'aura pas été autorisé. **Je le déclare comme trou,
   je ne l'ai pas comblé en douce** — même discipline que le L3 de la sonde, qui
   est le seul point non démontrable en vif et qui le dit.
5. **Ce document n'a rien mesuré lui-même** (§0). Les trois lectures de code
   sont à moi ; tous les cardinaux sont ceux de T1 ; `S` est un trou déclaré.

---

## 9. FENÊTRE RESPECTÉE

Aucun code écrit. Aucun fichier de `src/`, `scripts/`, `__tests__/` touché.
Aucun objet téléchargé. Aucune mutation de compartiment. Aucun accès R2
(ce worktree n'a pas de credential). Aucune requête base. Aucun accès public
proposé nulle part. **Un seul fichier créé : celui-ci.**
