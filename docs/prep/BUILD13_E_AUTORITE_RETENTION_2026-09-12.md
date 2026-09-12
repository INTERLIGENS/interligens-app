# BUILD 13 — LOT E · FACE **AUTHORITY + RETENTION** — CONCEPTION

**Conception seule.** Aucun fichier de production modifié, aucune écriture en
base, aucune écriture d'objet, aucune configuration de compartiment touchée,
aucune URL signée émise, aucun `GetObject`, aucun octet d'artefact lu. Les
seules opérations de cette session sont des lectures de code du dépôt.

**Les mesures ne sont pas refaites.** Elles sont reprises telles que ratifiées
(§0.1), et tout ce qui les dépasse est étiqueté **DÉRIVATION** ou **LECTURE DE
CODE**, jamais « mesure ».

---

## §0 — CE SUR QUOI LA CONCEPTION S'APPUIE

### 0.1 Acquis ratifiés (repris, non remesurés)

| fait | valeur |
|---|---|
| stock invalide | **1** — le témoin « avant », 169 014 o, sujet wSOL, aucun dossier gouverné |
| exposition effective | **0**, quatre sondes |
| nature de la clé | **dérivée** : `sha256(octets).slice(0,8)`, aucun sel |
| ce dont dépend la non-exposition | **le refus anonyme du compartiment**, pas un secret |
| objets sans ligne | **35**, deux causes : **26** de seed jamais liés (ensemble strictement identique aux objets antérieurs au 2026-07-20) et **8** de la signature `uploadPdf` |
| **périmètre gouverné** | **≈ 8, pas 35** |
| règle de cycle de vie | **aucune en vigueur** — 0/1136 objets avec échéance |
| références mortes | 2, **toutes deux déjà étiquetées** |

### 0.2 Lecture de code de ce soir — les écrivains et les délivreurs

Ce n'est pas une mesure de compartiment : c'est un inventaire de sites d'appel
dans le dépôt, à HEAD `9cfa03a`.

**Treize sites `PutObjectCommand`**, répartis sur au moins trois compartiments
(`R2_BUCKET_NAME`, `interligens-rawdocs`, `interligens-vaults`). Quatre écrivent
sur le compartiment du périmètre gouverné :

| écrivain | forme de clé | ligne en base ? |
|---|---|---|
| `src/lib/storage/pdfStorage.ts:97` (`uploadPdf`) | `reports/{env}/{yyyy}/{mm}/{lot}-{ms}-{slug}-{hash8}.pdf` | **AUCUNE** — la route rend la clé à l'appelant et ne persiste rien |
| `src/lib/pdf/engine.ts:477` (archive) | `reports/{handle}/CASE_{handle}_{ts}.pdf` | indirecte — `KolProfile.pdfUrl/pdfVersion`, qui ne porte **pas** la clé d'archive |
| `src/lib/pdf/engine.ts:489` (pointeur) | `pointers/{handle}/latest.pdf` | indirecte, idem |
| `src/lib/casefile/pdfGenerator.ts:667` | `casefiles/{case_id}/{case_id}_{ts}.pdf` | aucune ; `r2Key` remonte à l'UI admin |

**Le fait structurant : `uploadPdf` n'a jamais eu de ligne à écrire.** Les 8
objets du périmètre gouverné ne sont pas des orphelins par accident de panne —
ils sont orphelins **par conception**, parce qu'aucun registre n'existe. Ce
n'est pas un défaut de compensation ; c'est l'absence de la chose à compenser.

**Un cinquième chemin, différent de nature** : `src/app/api/admin/documents/presign/route.ts`
signe un **PUT** rendu au navigateur. L'objet est alors écrit par un client, sur
une clé allouée côté serveur, **sans qu'aucune écriture de ligne ne soit liée à
la réussite du PUT**. C'est un générateur d'orphelins structurel, hors périmètre
de ce lot (§5).

**Trois chemins de délivrance**, et un seul passe par la primitive commune :

| chemin | primitive | ce qu'il sert |
|---|---|---|
| `/api/pdf/[handle]` | `getSignedDownloadUrl` (`pdfStorage.ts:127`) | `pointers/{handle}/latest.pdf` |
| `/api/admin/documents/presign` | `getSignedUrl` appelé **en direct** | PUT vers `admin-documents/` |
| `src/lib/vault/r2-vault.ts:56,68` | `getSignedUrl` appelé **en direct** | compartiment vault chiffré |

**Aucune route ne sert aujourd'hui une clé `reports/{env}/…`.** C'est cohérent
avec l'exposition effective mesurée à 0 : l'orphelin n'est pas retenu par une
décision, il est hors de portée de tout code de délivrance. **Une propriété
d'absence, pas une garantie.**

### 0.3 Le précédent qui gouverne toute la conception

`src/lib/evidence-chain/eligibility.ts`, en tête de fichier :

> « S4 a prononcé l'exclusion de 7 artefacts […] et posé `evidentiaryStatus`
> pour la porter. **La colonne n'était lue NULLE PART : l'exclusion était une
> déclaration sans effet**, et le manifeste de chaîne de conservation
> continuait d'inventorier un `.DS_Store` comme pièce. »

C'est exactement le piège de la quarantaine logique. Il produit une **règle
d'ordre de livraison**, posée en §2.5 et non négociable.

---

# §1 — LE PROTOCOLE DE COMPENSATION

## 1.1 Ce qu'on ne prétend pas

DB (Neon) et R2 n'ont **aucune transaction commune**. Aucune propriété conçue
ici ne doit se lire comme « les deux écritures sont atomiques ». Elles ne le
sont pas, elles ne le seront pas, et un invariant qui l'affirmerait serait faux
le jour où il compte.

L'invariant ratifié dit autre chose, et c'est ce qu'on implémente :

> "A governed artifact must not be persisted outside the governed object
> registry. Successful object persistence and successful authority registration
> form ONE governed operation."

**« UNE opération gouvernée » n'est pas « une transaction ».** C'est une
opération dont **tous les états intermédiaires sont nommés, non publiables, et
détectables**. L'atomicité qu'on ne peut pas obtenir sur l'écriture, on
l'obtient sur la **décision de publication** — qui, elle, est locale à un seul
magasin.

## 1.2 Le choix d'ordre — et pourquoi l'ordre actuel est le pire des trois

| ordre | résidu en cas de panne | détectable sans balayage ? | verdict |
|---|---|---|---|
| **A. objet puis ligne** — l'ordre de `generateCaseFile.ts:200→210` | octets sans autorité, **clé inconnue de tout le système** | **non** | l'orphelin est *invisible* |
| **B. ligne puis objet** | autorité sans octets — une ligne publiable qui rend 404, ou pire, qui autorise une publication vide | oui | déplace le défaut du côté qui *ment* |
| **C. intention → objet → confirmation** | **une ligne en retard**, portant déjà la clé exacte | **oui, immédiatement** | retenu |

**L'argument décisif n'est pas la panne du processus — c'est le PUT à faux
négatif.** Un `PutObject` peut aboutir côté R2 et rendre une erreur à
l'appelant (délai réseau coupé après persistance). Aujourd'hui,
`pdfStorage.ts:120-124` attrape, journalise et **rend `null`** ; la route
`/api/pdf/casefile` bascule alors sur le flux direct et sert le PDF à
l'appelant. Résultat : **un objet existe en R2, personne ne connaît sa clé,
personne ne sait qu'il faut la chercher, et l'appelant a eu son dossier.**
L'ordre A ne peut structurellement pas couvrir ce cas. L'ordre C le couvre
entièrement : la ligne d'intention **porte déjà la clé**, écrite avant le PUT.

*(Je ne prétends pas que l'orphelin unique soit né ainsi. Son origine n'est pas
mesurée et ne le sera pas par cette conception.)*

## 1.3 L'allocation de clé — le point non évident

Dans l'ordre C, **c'est le registre qui alloue la clé**, pas l'écrivain.
L'écrivain reçoit une clé et n'a pas le droit d'en fabriquer une.

C'est faisable sans rien changer à la forme actuelle : `buildPdfKey` dérive la
clé de `sha256(buffer)`, et le buffer est **intégralement en main avant le
PUT** — le hash est donc calculable avant toute écriture. L'allocation
préalable ne coûte rien.

Trois propriétés tombent gratuitement :

1. **Unicité imposée par la base.** Un `UNIQUE` sur la clé transforme une
   collision (deux tirages du même dossier dans la même milliseconde : même
   `ms`, même `slug`, même `hash8` si les octets sont identiques) en **erreur**
   plutôt qu'en **écrasement silencieux d'une archive dite immuable**.
2. **La discrimination de l'inventaire devient structurelle** : toute clé sous
   le préfixe gouverné qui n'a pas été allouée est, par construction, non
   gouvernée. On le sait sans lire un octet.
3. **`storage identity` devient un champ du contrat** (§3.6) au lieu d'une
   chaîne fabriquée en trois endroits.

## 1.4 La machine d'états

```
                  ┌───────────────────────────────────────────┐
                  │  allocation (écriture DB #1)              │
                  └────────────────┬──────────────────────────┘
                                   ▼
                             ┌───────────┐
                             │ INTENDED  │  clé réservée, aucun octet attendu
                             └─────┬─────┘
                    PutObject      │      échéance T dépassée
                    rendu OK       │      sans suite
                                   ▼                    ▼
                       ┌──────────────────────┐   ┌──────────────┐
                       │ STORED_UNCONFIRMED   │   │  ABANDONED   │
                       └──────────┬───────────┘   └──────────────┘
                  écriture DB #2  │                (réconciliation requise :
                  (confirmation)  │                 un PUT à faux négatif
                                  ▼                 peut avoir persisté)
                            ┌────────────┐
                            │ REGISTERED │ ◄── le SEUL état d'où l'éligibilité
                            └─────┬──────┘     à publication peut être dérivée
                                  │
                       décision d'invalidation
                                  ▼
                           ┌─────────────┐
                           │ INVALIDATED │  octets conservés, autorité retirée
                           └─────────────┘

  ORPHAN_CONFIRMED — état atteint par le SEUL balayage R2→DB : un objet sous
  préfixe gouverné pour lequel aucune ligne n'existe. C'est l'état des 8, et
  c'est l'état du témoin « avant ».
```

`STORED_UNCONFIRMED` n'est pas un état que l'écrivain écrit : c'est
l'**interprétation** d'une ligne `INTENDED` pour laquelle un `HeadObject` trouve
l'objet. Il n'y a donc **que deux écritures DB** par opération nominale.

## 1.5 Les propriétés exigées

| # | propriété | ce qu'elle interdit |
|---|---|---|
| **P1** | **Allocation préalable.** Aucun écrivain du périmètre ne fabrique une clé. | une quatrième forme de clé apparaissant sans revue |
| **P2** | **Fail-closed sur l'état.** L'éligibilité à publication se dérive d'une **liste blanche** d'états. Tout état inconnu ⇒ non publiable. | qu'un futur état soit publiable par défaut (le mécanisme exact des sept sites de mélange, cf. `eligibility.ts`) |
| **P3** | **Détectabilité bornée.** Tout état non terminal porte son horodatage d'entrée ; le dépassement d'une échéance **T** est un **incident**, pas un mystère. | une fenêtre intermédiaire non bornée dans le temps |
| **P4** | **Réconciliation idempotente et bidirectionnelle.** Rejouable ; converge vers `REGISTERED`, `ABANDONED` ou `ORPHAN_CONFIRMED`. **Jamais de suppression, jamais de `Copy`, jamais de `Delete`.** | qu'une seule direction (DB→R2) laisse les objets sans ligne invisibles |
| **P5** | **Le préfixe porte la frontière.** Une clé hors préfixe gouverné n'est pas gouvernée, et on ne prétend pas le contraire. | un périmètre déclaré plus large que le mécanisme |
| **P6** | **L'intégrité se vérifie sur `ContentLength` + métadonnée `sha256`, jamais sur l'ETag.** | de fonder l'intégrité sur une valeur qui n'est pas un MD5 en multipart (§4, F4) |
| **P7** | **L'échec du registre est l'échec de l'opération.** Un appelant ne reçoit jamais `status:"stored"` pour une opération non enregistrée. | le comportement actuel : `200 {status:"stored"}` sans qu'aucune autorité n'existe |

**P7 est une décision produit** (D5, §6) : elle rend la génération de dossier
dépendante de la disponibilité de la base. Je la recommande ; je ne la décide
pas.

## 1.6 Comment on prouve que le mécanisme MORD

Un témoin qui montre le refus d'une chose **déjà** non servie ne prouve rien :
l'exposition effective est 0 avant comme après. **Le témoin doit porter sur la
DÉCISION D'ÉLIGIBILITÉ prise par le code de production, pas sur l'exposition
réseau.** Sa forme est **différentielle** : même entrée, deux états de registre,
deux décisions — et le point de décision doit être la **vraie** primitive, pas
un double de test.

Trois témoins, et — c'est le résultat que je retiens — **aucun n'exige d'écrire
un objet dans le compartiment de production.**

### T1 — l'orphelin d'intention (DB seule, 1 ligne de test)
Une ligne `INTENDED` datée au-delà de **T**, sans objet. Assertions : (a) la
dérivation d'éligibilité rend `WITHHELD`, (b) le réconciliateur la classe
`ABANDONED` après `HeadObject` négatif, (c) rejouer le réconciliateur ne change
rien (P4). **Coût : 0 écriture d'objet.**

### T2 — l'orphelin d'objet : **il existe déjà, et c'est le témoin « avant »**
Le balayage R2→DB n'a pas besoin qu'on fabrique quoi que ce soit : **l'objet de
169 014 octets, sujet wSOL, sans dossier gouverné, EST le cas de test.** Il est
réel, il est en production, il est déjà inventorié par
`scripts/casefile/inventaire-artefacts-r2.ts` (lecture seule : `ListObjectsV2` +
`HeadObject`, aucun `GetObject`). Assertion : le balayage le classe
`ORPHAN_CONFIRMED`, **nommément**, et le compteur d'incident vaut 1 et non 0.
**Coût : 0 écriture, 0 octet lu.**

### T3 — la morsure, en différentiel
Sur la primitive de délivrance réelle (§2.3), le **même** identifiant d'objet,
soumis deux fois :

| état du registre | décision attendue |
|---|---|
| `REGISTERED` | délivrance autorisée |
| `INVALIDATED` | **refus nommé**, avec la raison |
| aucune ligne, clé sous préfixe gouverné | **refus nommé** (fail-closed, P2) |
| aucune ligne, clé hors préfixe gouverné | passage, **et incrément du compteur de passage** (§2.3) |

C'est la quatrième ligne qui fait de ce témoin autre chose qu'une formalité :
elle mesure, à chaque exécution, **la taille du trou qu'on a choisi de laisser
ouvert** en phase 1.

### Ce qu'aucun de ces trois ne couvre
Le comportement **réel de R2** sous panne : PUT à faux négatif, cohérence de
`ListObjectsV2` juste après écriture, erreur 5xx partielle. En test, ces cas
sont **injectés** sur un client S3 simulé — ce qui prouve la réaction du code,
jamais le comportement du fournisseur. Le seul témoin qui le prouverait exige
d'écrire dans un compartiment réel : **décision produit D1**.

---

# §2 — LA QUARANTAINE LOGIQUE DE L'ORPHELIN UNIQUE

## 2.1 Réponse directe à l'alerte du prompt

> ⚠️ « Si la quarantaine s'obtient par métadonnée/registry/access boundary SANS
> déplacer les objets, c'est préférable. Si elle exige une mutation
> irréversible ou un déplacement massif : STOP AVANT ACTION. »

**Elle s'obtient sans aucune mutation d'objet.** Je ne demande pas d'arrêt sur
ce point. La cible **RETAINED / NON-SERVABLE / INVALIDATED ARTIFACT** est
atteignable par **une ligne de base de données et un lecteur pour cette ligne**.
Aucun `Copy`, aucun `Delete`, aucun changement de configuration de compartiment,
aucun octet touché.

## 2.2 Les deux voies écartées, et pourquoi

**Écartée — la métadonnée R2.** Les métadonnées d'objet S3/R2 sont **immuables
après écriture** : les modifier impose un `CopyObject` de l'objet sur lui-même.
C'est une **réécriture**. L'objet cesse d'être celui qui a été produit — et cet
objet est précisément la **preuve qu'une ancienne version du système a produit
un artefact sous une autorité qu'elle n'avait pas**. Marquer la preuve
détruirait ce qu'elle prouve. Interdit, et mauvais.

**Écartée — le déplacement sous `quarantine/`.** `Copy` + `Delete`. Contient une
suppression. Interdit, et destructeur de l'horodatage d'origine.

**Retenue — le registre + la frontière d'accès.** Elle est disponible parce
qu'aucune URL publique n'est active sur ce compartiment et que **toute**
délivrance passe par du code que nous écrivons. La frontière existe déjà ; il
lui manque une chose à lire.

## 2.3 Où vit le gate — et pourquoi pas dans les routes

Dans la **primitive de signature**, jamais dans les routes. Une garde posée dans
`/api/pdf/[handle]` ne protège pas la quatrième route, celle qui n'est pas
encore écrite. Le précédent du dépôt est explicite :
`src/lib/ops/prodWriteGuard.ts` a été mis dans le code plutôt que dans la
configuration pour la raison symétrique — *« un rescope correct dans l'UI Vercel
se re-casse en un clic, sans diff, sans revue, sans test »*.

Mais un fail-closed **global** sur clé inconnue casserait immédiatement
`pointers/` (aucune ligne n'existe) et `admin-documents/`. D'où la forme en deux
phases :

- **Phase 1** — fail-closed **sur le seul préfixe gouverné** (`reports/`) ;
  passage explicite hors préfixe, **avec compteur**. Le trou est laissé ouvert
  *et mesuré*. Un trou compté est une dette ; un trou non compté est un oubli.
- **Phase 2** — extension préfixe par préfixe, chacun le jour où il a un
  registre. `pointers/` a déjà, lui, une garde d'autorité en amont
  (`isProceedsPublished`, `/api/pdf/[handle]/route.ts:73`) : il n'est pas nu.

Les deux appels directs à `getSignedUrl` (`r2-vault.ts`, `presign/route.ts`)
**contournent la primitive**. Ils sont hors périmètre (§5) et doivent être
**nommés comme tels dans le code du gate**, pas laissés à la sagacité du
prochain lecteur.

## 2.4 L'invariant, et ce qu'il découpe

> "Preservation of an invalid artifact does not preserve its publication
> authority."

Il sépare deux choses que le compartiment confond naturellement : **exister** et
**être publiable**. Aujourd'hui, dans ce compartiment, exister *est* être
publiable dès qu'une route apprend à lire la clé. L'invariant fait de
l'éligibilité une propriété **dérivée d'un jugement**, jamais de la présence des
octets.

## 2.5 RÈGLE D'ORDRE DE LIVRAISON — non négociable

**Le gate d'abord. La ligne `INVALIDATED` ensuite.**

Écrire l'état d'invalidation avant qu'un lecteur existe reproduirait
exactement `evidentiaryStatus` : une exclusion prononcée, inscrite, et sans
effet — pendant que le reste du système continue de compter l'artefact comme
éligible. Si un seul élément de cette conception doit survivre à une
priorisation, c'est cette phrase.

## 2.6 La rétention — ce qui la tient aujourd'hui

**Rien ne la tient.** 0/1136 objets portent une échéance, et aucune règle de
cycle de vie n'est en vigueur. La conservation actuelle est obtenue par
**absence de politique**, pas par décision. Trois conséquences :

1. **Une politique de cycle de vie posée un jour sur le compartiment
   supprimerait la preuve du défaut**, sans diff, sans revue, sans test — le
   mode de défaillance que `prodWriteGuard` documente, transposé au stockage.
   Toute politique future **doit** exclure nommément les préfixes probatoires,
   et cette exclusion doit être **affirmée par un test**, pas par une capture
   d'écran de console.
2. **R2 n'est pas WORM ici** et aucun Bucket Lock n'est posé (A4 reste un
   projet, cf. le commentaire d'en-tête de `pdfStorage.ts:41-58`). La
   préservation est donc une propriété **de processus**, pas une garantie
   technique. Le contrat ne doit jamais la déclarer garantie.
3. Le champ `retentionClass` (§3.7) sert à **rendre la décision explicite**, pas
   à l'appliquer. Il n'applique rien tant qu'une politique n'existe pas.

---

# §3 — LE CONTRAT CONCEPTUEL DU REGISTRE

Pas un schéma de base. Le contrat : pour chaque face, **ce qu'elle affirme, ce
qu'elle n'affirme pas, son domaine, qui l'écrit, qui la lit.** Tous les domaines
sont **fermés** — une septième valeur ne s'invente pas sur place, elle vient se
déclarer ici, donc devant quelqu'un. C'est la forme de
`src/lib/governance/uniteGouvernee.ts`, et elle a déjà fait ses preuves dans ce
dépôt.

### 3.1 `objectNature` — ce que l'objet EST
**Affirme :** la catégorie sémantique de l'artefact.
**N'affirme pas :** qu'il soit exact, à jour, ou publiable.
**Domaine fermé :** `CASEFILE_RENDER` · `KOL_REPORT_ARCHIVE` · `KOL_REPORT_POINTER` · `EVIDENCE_CAPTURE` · `ADMIN_DOCUMENT` · `LEGACY_UNCLASSIFIED`.
**Écrit par :** l'allocateur, à l'allocation. **Jamais modifié ensuite.**
**Lu par :** la dérivation d'éligibilité, l'inventaire.
*`KOL_REPORT_POINTER` porte une propriété unique : l'objet est **mutable par
conception**. Le confondre avec une archive ferait promettre une immuabilité que
le second `PutObject` de chaque génération dément.*

### 3.2 `provenance` — D'OÙ il vient
**Affirme :** quel écrivain, quelle version, sous quelle intention.
**N'affirme pas :** que le contenu soit de première main (cette notion existe
déjà, ailleurs et mieux : `EvidenceItem.provenanceType`).
**Domaine fermé :** `GOVERNED_PIPELINE` · `CLIENT_PRESIGNED_UPLOAD` · `SEED` · `MIGRATED_BACKFILL` · `UNKNOWN_PREEXISTING`.
**Écrit par :** l'allocateur. `UNKNOWN_PREEXISTING` est réservé à la
réconciliation R2→DB — **c'est la valeur du témoin « avant » et celle des 26**.
**Lu par :** l'éligibilité, les rapports d'audit.
*`UNKNOWN_PREEXISTING` n'est pas une valeur honteuse : c'est l'enregistrement
honnête de ce que nous ne pouvons pas établir. Lui substituer une valeur plus
flatteuse serait fabriquer une provenance.*

### 3.3 `authorityState` — OÙ EN EST l'opération
**Affirme :** un fait de **processus**, non un jugement.
**N'affirme pas :** que l'artefact soit bon ou publiable.
**Domaine fermé :** `INTENDED` · `STORED_UNCONFIRMED` · `REGISTERED` · `ABANDONED` · `ORPHAN_CONFIRMED` · `INVALIDATED`.
**Écrit par :** l'allocateur (#1), le confirmateur (#2), le réconciliateur, la
décision d'invalidation.
**Lu par :** l'éligibilité — **en liste blanche** (P2).

### 3.4 `publicationEligibility` — DÉRIVÉE, jamais stockée
**C'est le point le plus important du contrat.** L'éligibilité n'est **pas une
colonne**. C'est une **fonction pure** :

```
eligibility( objectNature, provenance, authorityState, invalidation, retentionClass )
      → PUBLISHABLE | WITHHELD(raisonNommée)
```

**Pourquoi pas une colonne :** deux sources de vérité pour la même propriété
divergent — c'est l'Invariant Propagation Failure, et le dépôt en porte déjà la
trace mesurée (`evidenceDepth`, deux sites de lecture avec `?? 0`, la seule
ligne `deep` du dépôt écrasée). Une colonne d'éligibilité serait cette faute,
posée volontairement, sur la propriété qui décide ce que le public voit.

**`WITHHELD` porte toujours une raison nommée.** Un refus anonyme est
indistinguable d'une panne — c'est précisément la leçon des quatre 401 du lot F,
identiques au statut et venus de deux couches différentes.

### 3.5 `invalidationState` — le jugement, séparé du processus
**Affirme :** qu'une **décision** a retiré l'autorité de publication, par qui,
quand, et sur quel motif.
**N'affirme pas :** que l'artefact soit faux. Un artefact peut être invalidé
pour défaut d'**autorité** tout en étant factuellement exact — c'est exactement
le cas du témoin « avant ».
**Domaine fermé :** `NONE` · `INVALID_AUTHORITY` · `SUPERSEDED` · `WITHDRAWN_BY_DECISION`.
**Écrit par :** un humain, ou une procédure nommée. **Jamais par un flux
automatique.**
**Lu par :** l'éligibilité, et **le gate de délivrance** — sans quoi §0.3
recommence.

### 3.6 `storageIdentity` — la clé, et ce qu'elle porte

> "Storage identity is part of governed object authority when it encodes
> semantic identity, even if that identity is never rendered to an end user."

**Trois formes non gouvernées coexistent dans le dépôt** — le résiduel est plus
large que la seule ligne 664 :

| site | forme | ce que la clé encode |
|---|---|---|
| `pdfGenerator.ts:664` | `casefiles/{case_id}/{case_id}_{ts}.pdf` | **`case_id` en clair, deux fois**, forme fabriquée en ligne dans le générateur, jamais allouée |
| `pdfStorage.ts:74` | `…/{lot}-{ms}-{slug}-{hash8}.pdf` | `slugify(subject)` = **le mint**, et `hash8` dérivé des octets |
| `engine.ts:474` | `reports/{handle}/CASE_{handle}_{ts}.pdf` | **le handle, deux fois** |

`buildPdfKey` a déjà le mérite d'être **une fonction unique** ; ce qui lui manque
est le registre. La forme de `pdfGenerator` n'a ni l'un ni l'autre : elle se
referme en passant par l'allocateur, ce qui est aussi la seule manière de faire
sortir `case_id` du nom sans le remplacer par une autre chaîne parlante.

**DÉRIVATION (pas une mesure), à partir du fait ratifié « clé dérivée, aucun
sel » :** un tiers détenant les octets recalcule `hash8` ; `env`, `yyyy`, `mm`,
le préfixe de lot et le slug sont dérivables du sujet ; seul le timestamp en
millisecondes reste inconnu. La clé **n'est donc pas un secret**, et le fait
ratifié s'énonce en invariant :

> "Key unguessability is not an access control. The private bucket is."

Toute conception future qui s'appuierait sur la difficulté de deviner une clé —
un lien « non listé », un partage « par URL seulement » — viole cet invariant.

### 3.7 `retentionClass` — la face RETENTION
**Affirme :** la **décision** de conservation applicable.
**N'affirme pas :** qu'un mécanisme l'applique. **Aucun n'existe** (§2.6).
**Domaine fermé :** `EVIDENTIARY_INDEFINITE` · `OPERATIONAL_ROLLING` · `UNCLASSIFIED_LEGACY`.
**Écrit par :** une décision humaine. **Décision produit D2 (§6).**
**Lu par :** l'éligibilité (un artefact conservé à titre probatoire n'est pas
publiable de ce seul fait), et, le jour où une politique de cycle de vie
existera, par la garde qui en exclut les préfixes probatoires.

### 3.8 La forme des invariants

Les trois invariants de ce lot sont exprimables tels quels dans
`src/lib/governance/invariants/registry.ts` — `id → définition / raison /
primitive → tests d'application`. Ce registre est **délibérément fermé à deux
entrées** (« un troisième invariant n'entre pas ici parce que ce serait
pratique ; il entre s'il est nécessaire à une propriété gouvernée, et il entre
avec sa mesure »). Les trois candidats ont leur mesure. **Leur admission est une
décision, pas une conséquence** — je la nomme, je ne la prends pas.

---

# §4 — LES MODES DE DÉFAILLANCE DE CETTE CONCEPTION

| # | défaillance | pourquoi elle est plausible | ce qui la contient |
|---|---|---|---|
| **F1** | **Le registre devient la nouvelle source de vérité fausse** — une ligne `REGISTERED` pour un objet absent. | Une réconciliation DB→R2 seule ne voit jamais les objets sans ligne ; une R2→DB seule ne voit jamais les lignes sans objet. | P4 : **bidirectionnelle**, et les deux directions armées **ensemble**. Une seule direction est pire que rien : elle crée la confiance sans la couverture. |
| **F2** | **Le gate est contourné.** | 13 sites `PutObject`, 3 chemins de délivrance dont **2 appellent `getSignedUrl` en direct**, et un PUT présigné écrit par un navigateur. | Phase 1 : fail-closed sur `reports/` + **compteur de passage** (§2.3). Le contournement reste possible ; il cesse d'être silencieux. |
| **F3** | **Déclaration sans lecteur.** | Le précédent `evidentiaryStatus` (§0.3) : ce n'est pas une hypothèse, c'est arrivé ici. | La règle d'ordre §2.5, et **un test qui échoue si `INVALIDATED` n'a aucun lecteur**. |
| **F4** | **L'intégrité fondée sur l'ETag.** | Réflexe S3 courant ; l'ETag n'est pas un MD5 en multipart, et R2 ne garantit pas sa forme. | P6 : `ContentLength` + métadonnée `sha256` posée à l'écriture. **Jamais `GetObject`** pour comparer — cela ferait sortir les octets. |
| **F5** | **La fenêtre P3 n'est jamais bornée en pratique.** | Sans ordonnanceur armé, l'échéance **T** est une fiction. Et *fusionner `main` n'arme pas un cron* — le plan Vercel est Pro, 15 crons déclarés sur 40. | Le réconciliateur n'est « livré » que lorsque sa **première exécution planifiée est constatée**, avec `trigger='CRON'`. Précédent exact : la sonde C4. |
| **F6** | **Écrasement silencieux d'une archive dite immuable.** | Deux tirages des mêmes octets dans la même milliseconde produisent la même clé ; `PutObject` écrase sans bruit. | Le `UNIQUE` d'allocation (§1.3). Bénéfice non recherché du design, mais réel. |
| **F7** | **La quarantaine est prospective, et seulement prospective.** | Une URL signée déjà émise reste valide jusqu'à son expiration (TTL 900 s, plafond 3600 s) ; un PDF déjà téléchargé ne revient pas. | Rien ne la contient. **Ce doit être écrit dans le contrat**, pas découvert le jour où quelqu'un demande « et les copies ? ». |
| **F8** | **Le registre ment sur la rétention.** | Écrire `EVIDENTIARY_INDEFINITE` donne le sentiment d'une garantie ; aucun mécanisme n'existe (§2.6), R2 n'est pas WORM. | Le champ est une **décision enregistrée**, et sa documentation doit le dire à l'endroit où on le lit, pas seulement ici. |
| **F9** | **Coût de latence.** | Deux allers-retours base supplémentaires par génération. | Négligeable devant un lancement de Chromium headless. Ce mode est cité pour être **écarté avec sa raison**, non pour être surveillé. |

---

# §5 — CE QUE LA CONCEPTION NE COUVRE PAS

1. **Les 26 objets de seed jamais liés.** Ils sont hors du périmètre gouverné
   (≈ 8) par la mesure elle-même. Ils restent des octets sans autorité ; ils
   relèvent de la **rétention**, pas de la compensation. Les gouverner
   rétroactivement — une ligne `UNKNOWN_PREEXISTING` / `UNCLASSIFIED_LEGACY`
   chacun, ou une règle par préfixe et date — est **D4**.
2. **Les autres compartiments.** `interligens-vaults` (chiffré, `r2Key @unique`
   déjà présent), `interligens-rawdocs`, la chaîne de preuve
   (`EvidenceItem.sha256 @unique`, `evidentiaryStatus`). Chacun porte **une
   autorité partielle qui lui est propre** ; les unifier ce soir fabriquerait
   une plateforme là où deux invariants suffisent.
3. **Le PUT présigné admin** (`presign/route.ts`). Générateur d'orphelins
   structurel, d'une autre nature : l'écrivain n'est pas notre code.
4. **La garantie de conservation.** Pas de WORM, pas de Bucket Lock posé, A4
   non fait.
5. **La vérité du contenu.** Un artefact parfaitement gouverné peut être faux.
   C'est ASSERTION CORRECTNESS, c'est l'autre axe, et
   `uniteGouvernee.ts` existe précisément pour rendre la confusion impossible.
6. **L'exposition passée**, et les copies déjà distribuées (F7).
7. **L'origine du témoin « avant ».** Non mesurée, non mesurable par ce
   mécanisme, et je ne la reconstitue pas.

---

# §6 — DÉCISIONS PRODUIT REQUISES — JE M'ARRÊTE DESSUS

| # | décision | ma recommandation |
|---|---|---|
| **D1** | **Le témoin positif exige-t-il de fabriquer un orphelin RÉEL dans un compartiment réel** (donc une écriture), ou T1+T2+T3 (§1.6, zéro écriture) suffisent-ils ? | **Zéro écriture.** Le témoin d'objet existe déjà — il a 169 014 octets. Écrire une sonde dans un compartiment sans règle de cycle de vie créerait un déchet permanent (0/1136 avec échéance). |
| **D2** | **Rétention : indéfinie, ou à échéance ?** Et corollaire : **s'engage-t-on à ce que toute politique de cycle de vie future exclue nommément les préfixes probatoires**, exclusion affirmée par un test ? | **Indéfinie** pour le préfixe probatoire, **exclusion testée**. C'est le seul moyen d'empêcher qu'un clic de console défasse la conservation. |
| **D3** | **Portée du fail-closed en phase 1.** Accepte-t-on `reports/` seul, avec les passages hors préfixe **comptés** ? | **Oui.** Un fail-closed global casserait `pointers/` et `admin-documents/` le jour de sa pose. |
| **D4** | **Les 26 legacy** : gouvernés rétroactivement, ou classés hors périmètre avec motif ? | **Classés**, une seule ligne de règle (préfixe + antériorité au 2026-07-20), pas 26 lignes fabriquées à la main. |
| **D5** | **P7** : l'indisponibilité de la base doit-elle **empêcher** la génération d'un dossier (aujourd'hui : repli en flux direct, `200 {status:"stored"}` sans autorité) ? | **Oui, bloquer.** Mais c'est une dégradation de service assumée, et elle n'est pas à moi. |
| **D6** | **Les trois invariants entrent-ils au registre** `INVARIANTS_GOUVERNES`, délibérément fermé à deux entrées ? | **Oui pour deux** (`GOVERNED_OBJECT_REGISTRATION`, `INVALID_ARTIFACT_AUTHORITY`). `KEY_IS_NOT_ACCESS_CONTROL` est une **doctrine**, pas un invariant testable sur une valeur : sa place est dans la prose du contrat. |

---

# §7 — COÛT ESTIMÉ, PARTIE PAR PARTIE

Unités honnêtes : fichiers, tests, migrations, écritures, dépendances. Pas
d'heures.

| partie | contenu | migration | écriture prod | bloquée par | risque |
|---|---|---|---|---|---|
| **1. Contrat de types + allocateur** | 1 module neuf (~200-250 l), domaines fermés, dérivation d'éligibilité pure. Reprend la forme de `uniteGouvernee.ts`. | aucune | aucune | **rien** | **faible** — pur, testable hors réseau et hors base |
| **2. Table de registre** | 1 table additive (~14 colonnes, `UNIQUE(storageKey)`, index sur état + horodatage) via **Neon SQL Editor**, puis `schema.prod.prisma` additif + `pnpm prisma:generate`. | **1**, additive | 1 DDL | D2, D4 (domaines) | **faible** en soi. ⚠️ vérifier `information_schema` **après** : un message de commit n'est pas une source de vérité sur l'état de la base |
| **3. Câblage écrivain** | `pdfStorage.ts` + `/api/pdf/casefile/route.ts` : allocation avant PUT, confirmation après. Le contrat de retour passe de `null` à un état typé → **change le comportement de repli**. | aucune | aucune | **D5** | **moyen** — c'est la partie qui touche une route servie |
| **4. Gate de délivrance** | `getSignedDownloadUrl` : fail-closed `reports/`, passage compté ailleurs, refus **nommé**. + tests de sécurité du dépôt. | aucune | aucune | **D3** | **moyen** — une erreur de frontière casserait `/api/pdf/[handle]` ; `__tests__/security/pdf-pointer-separation.test.ts` couvre déjà cette frontière |
| **5. Réconciliateur** | Balayage bidirectionnel. **~80 % existe déjà** : `inventaire-artefacts-r2.ts` fait `ListObjectsV2` + `HeadObject`, lecture seule, et importe déjà le critère de gouvernance de la route au lieu de le réécrire. Reste : la direction DB→R2, l'idempotence, le compteur d'incident. | aucune | lecture seule tant qu'il n'écrit pas d'état | D3 | **faible** en lecture seule ; **le vrai coût est d'armer le cron et de constater sa première exécution** (F5) |
| **6. Quarantaine du témoin « avant »** | **1 ligne** : `ORPHAN_CONFIRMED` + `INVALID_AUTHORITY` + `EVIDENTIARY_INDEFINITE`. | aucune | **1 INSERT** | **partie 4 livrée** (§2.5) | **très faible techniquement**, **élevé si l'ordre est inversé** — ce serait `evidentiaryStatus` à nouveau |
| **7. Résiduel `pdfGenerator.ts:664`** | Passage par l'allocateur. 1 fichier, plus la propagation de `r2Key` vers l'UI admin (`casefile-generator/page.tsx`) et `/api/casefile/generate`. | aucune | aucune | partie 1 | **faible** — chemin admin, non retail |
| **8. Rétention** | 0 ligne de code tant qu'aucune politique n'existe. 1 champ, 1 décision, et **une garde testée le jour où une politique est posée**. | aucune | aucune | **D2** | **faible aujourd'hui**, **structurel demain** — c'est la partie dont l'absence ne se voit pas |

**Forme du lot.** Les parties 1, 2, 5 (lecture seule) et 7 ne dépendent
d'**aucune** décision produit et représentent l'essentiel du volume. Les parties
3, 4 et 6 sont bloquées par D3 et D5, et la 6 l'est en plus par un **ordre**.
La partie 8 n'est pas de l'ingénierie : c'est une décision qui a besoin d'un
domicile.

---

## CE QUE JE N'AI PAS FAIT

Aucune suppression, aucun déplacement, aucun `CopyObject`, aucune mutation de
configuration de compartiment, aucun Public Access, aucune URL signée, aucun
octet d'artefact lu ni recopié, aucune écriture en base, aucun fichier de
production modifié. Les mesures ratifiées n'ont pas été refaites — seulement
lues, et étendues par des lectures de code étiquetées comme telles.
