# LE CASEFILE VINE CANONIQUE — CF-1 · CF-2 · CF-3

**2026-09-16 · CC-OFFLINE-240 / 242 / 244 · trois stages enchaînés**

> **LA DONNÉE ÉTAIT CORRECTE. LE PRODUIT NE LA LISAIT PAS.**

CF-0 avait mesuré cinq gaps. Les cinq sont fermés, et la chaîne porte désormais, de bout en bout :

```
SUBJECT → EVIDENCE → RELATION → MEASURED LIMIT → GOVERNED INFERENCE → AUDITABLE FOUNDATION
```

---

## §1 · CF-1 — L'ASSEMBLAGE D'AUTORITÉ · `CC-OFFLINE-240`

`assembleAuthority(ref)` transporte le corpus gouverné réel. Subject-agnostic : l'entrée est un
`CaseFileRef`, aucun `if VINE`, aucune carte de mints, aucun `claimId` en dur.

**Golden trace, sur le VINE réel, en données :**

```
VINE-MULTI-01 v1      → 4 evidenceRefs → 4 pièces · digest + locator + déclarant
VINE-MEASURE-01 v1    → SRC-MEASURE-01 → MACHINE_MEASURED
                        → instrument:il-measure-vine-wallet-attribution@1.0.0 · r2://
VINE-CONCLUSION-01 v1 → evidenceRefs [] → DERIVED_FROM → VINE-MEASURE-01 v1
contentHash présent sur les trois · 33 227 octets sérialisables
```

### Deux frontières que des témoins ont défendues

1. **Le sceau ne remonte pas par le lecteur public.** J'avais d'abord ajouté `contentHash` au
   `SELECT` de `canonicalReader` ; un témoin a rougi — *le lecteur public ne sélectionne aucun
   identifiant de ligne ni aucun sceau, c'est l'affaire de l'audit*. L'assemblage lit `contentHash`
   par **sa propre requête**. La frontière n'a pas bougé.
2. **L'assemblage relaie la qualification, il ne la résout pas.** Déclaré au registre des poseurs,
   avec un témoin qui vérifie qu'il ne contient ni `resolveJournalProvenance`, ni
   `readLatestJournalRows`, ni `provenanceDecoration`.

`declaredBy` est remonté au résolveur : c'est là, et seulement là, que vit **l'identité de
l'instrument** d'une mesure.

---

## §2 · CF-2 — LA PROJECTION PAR AUDIENCE · `CC-OFFLINE-242`

> Si le renderer reçoit déjà des assertions qu'il n'a pas le droit de présenter, **la frontière
> d'audience est trop tardive.**

```
COUNSEL_INVESTOR → contrat de FONDEMENT
PUBLIC           → contrat de PUBLICATION, INCHANGÉ, + état PUBLIC
```

Le **même** assemblage alimente les deux ; seule l'autorité appliquée change. `projectAssembly`
retient **toute claim admissible**, là où `projectConclusions` (CC-OFFLINE-234) ne retenait que les
`INFERENCE` : un dossier counsel montre ses observations et sa limite mesurée, pas seulement sa
conclusion.

**Witness réel :**

```
COUNSEL_INVESTOR · GOVERNED_CLAIMS · 6 claims
  VINE-0xS-01/02/03 v2 · VINE-MULTI-01 v1 (4 pièces) · VINE-MEASURE-01 v1
  VINE-CONCLUSION-01 v1 · INFERENCE · 0 pièce · DERIVED_FROM → VINE-MEASURE-01 v1
PUBLIC · NO_GOVERNED_CLAIM · 0 claim
```

Les 8 legacy `C9`–`C17`, non classées, sont absentes des deux. **Comportement selon les autorités
réelles**, pas selon une règle inventée. `decidePublicationContract` n'a pas été touché.

---

## §3 · CF-3 — L'ARTEFACT GOUVERNÉ · `CC-OFFLINE-244`

> **UN RENDERER PRÉSENTE DES AUTORITÉS. IL NE FABRIQUE PAS UNE AUTORITÉ PAR CALCUL LOCAL.**

### ⛔ LE CÂBLAGE DE LA ROUTE EST BLOQUÉ — STOP *(levé, voir §4bis)*

La branche `?template=governed` a été **écrite, compilée et vérifiée** :

```
AUTH → assemblage canonique → projection COUNSEL_INVESTOR → renderer
     → artefact gouverné (identité · persistance · relecture · digest · registre)
     → référence
```

Puis **refusée par `guard-offline.sh`** :

```
🛑 BLOCKED — ❌ src/app/api/casefile/pdf/route.ts (matched ^src/app/api/)
```

`^src/app/api/` est un chemin **gelé**, et le ruling de ce bloc est explicite : *« Si un chemin gelé
par `guard-offline.sh` est nécessaire, c'est un STOP — la lease n'est pas pré-autorisée ici. »*
Le garde n'a **pas** été contourné, et la branche de route est revenue à son état d'origine.

**Ce qui est livré et ce qui ne l'est pas :** le renderer existe, il est testé, il est déclaré au
registre des surfaces, et le witness a été tiré sur le VINE réel en l'appelant directement. Ce qui
manque est **la seule ligne de câblage** : la route ne l'appelle pas encore. CF-3 est complet en
mécanique, bloqué en exposition.

Le patch est prêt à être rejoué tel quel, sous lease, sur un seul chemin :
`src/app/api/casefile/pdf/route.ts`. Les gabarits `public` et `internal` n'y sont pas touchés ; la
branche est **ajoutée**, avec FAIL CLOSED — pas de corpus gouverné ⇒ 404, jamais un repli sur le
JSON historique.

### Les sections sont adossées à une AUTORITÉ, jamais à un jugement

| Section | Autorité qui la détermine |
|---|---|
| *What we established* | les claims admises restantes |
| *What could not be established* | une pièce citée dont la provenance est `MACHINE_MEASURED` |
| *Governed conclusion* | `rowNature === "INFERENCE"` |
| *Governed evidence* | les pièces citées, avec provenance et digest |

**Il n'y a PAS de section RELATION, et c'est délibéré.** « Relation » n'est porté par aucune autorité
du modèle. Une claim qui cite quatre pièces le **montre** — ses quatre pièces sont rendues — mais
rien dans la donnée ne la déclare « relation ». Fabriquer cette section aurait été **classer**, ce
que le renderer n'a pas le droit de faire.

Une section sans autorité **n'apparaît pas** : ni vide, ni « non établie ».

### Le défaut trouvé en tirant le witness

Le rendu contenait le mot `summary` — non pas la prose historique, mais l'élément HTML
`<details><summary>` que j'avais utilisé pour la trace de fondement. En le vérifiant, un défaut plus
grave est apparu : **un moteur d'impression rend `<details>` REPLIÉ.** La trace de fondement aurait
disparu de l'artefact tout en restant présente dans la source — visible pour un `grep`, invisible
pour un lecteur. Remplacé par un bloc ordinaire, et un témoin interdit désormais `<details>` :

> **Un PDF est un document, pas une page.**

### Deux niveaux, et le niveau 2 reste attaché

`LEVEL 1` ce que le dossier établit · `LEVEL 2` pourquoi il peut l'établir — identité, version,
sceau, pièces avec digests et localisateurs, instrument, dépendances épinglées. Le niveau 2 est
**sous** l'assertion qu'il fonde, jamais rejeté en annexe.

### MONEY

Le dossier ne dit **pas** « MONEY = MISSING ». Il rend la claim de mesure sous *What could not be
established*, avec son texte réel : ce qui a été cherché, dans quel périmètre, par quel instrument,
et ce qui n'a pas été trouvé. **L'information existe dans certaines structures historiques ;
l'autorité nécessaire à l'attribution manque.** Ce n'est pas la même chose, et le dossier le dit.

---

## §4 · LES CINQ GAPS DE CF-0

| Gap | Fermé par |
|---|---|
| G1 · corpus gouverné non lu | CF-1 — `assembleAuthority` ; **la route le consomme** depuis `462d6ba` (§4bis) |
| G2 · `casefile_claim_dependencies` jamais lu | CF-1 — transporté ; CF-3 — rendu dans la trace |
| G3 · `contentHash` non remonté | CF-1 — lu par l'assemblage, hors du lecteur public |
| G4 · audience inexistante en production | CF-2 — explicite, **avant** le rendu |
| G5 · renderer consommant de la prose | CF-3 — le renderer ne reçoit que la projection |

---

## §4bis · LE WITNESS PAR LA ROUTE — `CC-OFFLINE-246`

> **UNE PREUVE PRÉSENTE DANS LA SOURCE MAIS ABSENTE DE LA PAGE RENDUE N'EST PAS UNE PREUVE FOURNIE.**

Le STOP de §3 a été levé par la lease `CC-OFFLINE-246-EXPOSITION-ROUTE` — **un seul chemin**,
`src/app/api/casefile/pdf/route.ts`, ouverte 13:06:00Z, consommée à 13:18Z, fermée à 13:19Z.
**Résiduel : 0 lease OPEN.** PR #470 (câblage, `462d6ba`) puis #471 (clôture, `0cc24ca`).

### Ce que la route a réellement traversé

`GET /api/casefile/pdf?preset=vine&template=governed`, en-tête `x-admin-token`, sur `main`, contre
la base de production :

```
AUTH                         ✅ traversé
résolution de la ref         ✅ IL-SHILL-VINE-001
assembleAuthority            ✅ 6 sources · 14 claims · 1 dépendance   (pas de 404 → non-null)
projectAssembly COUNSEL      ✅ GOVERNED_CLAIMS · 6 claims
renderGovernedCaseFilePdf    ❌ spawn ENOEXEC
produireArtefactGouverne     ⬛ JAMAIS ATTEINT
```

### ⛔ LE DOCUMENT N'A PAS PU ÊTRE PRODUIT SUR CET HÔTE — ET CE N'EST PAS UN DÉFAUT DU CHEMIN GOUVERNÉ

Le renderer lance le binaire du pack `@sparticuz/chromium-min`. Mesuré, pas supposé :

```
binaire extrait  ELF 64-bit LSB pie executable, x86-64, for GNU/Linux 3.2.0
hôte             Darwin arm64
```

`ENOEXEC` est exactement ce que le noyau répond à cela.

**Contrôle positif** — le producteur canonique PRÉEXISTANT échoue à l'identique sur le même hôte :

```
?template=public    HTTP 500 · {"error":"spawn ENOEXEC"}
?template=governed  HTTP 500 · spawn ENOEXEC
```

Aucun PDF n'est productible sur cet hôte, **par aucun gabarit**. C'est une propriété de l'HÔTE, pas
du chemin gouverné. Le runtime qui exécute ce pack est linux x64 — Vercel. Le franchir exige un
**déploiement**, geste du fondateur, non autorisé par cette fenêtre. **STOP déclaré.**

Corollaire mesurable : l'échec est **avant** `produireArtefactGouverne`. Aucun octet n'a été écrit,
aucune identité allouée, **aucune ligne `INTENDED` orpheline** n'a été laissée au registre.

### La nature EXACTE de l'artefact — étape par étape

`renderGovernedCaseFilePdf` appelle `page.pdf()` de Chromium : ce que la route produirait est un
**PDF portable réel**, pas une représentation intermédiaire. Ce qui suit est mesuré **dans le code
du chemin**, pas traversé sur cet hôte :

| Étape | Dans le code du chemin | Traversée sur cet hôte |
|---|---|---|
| **identité** | ✅ `allouerIdentite` + ligne registre `INTENDED` **avant** le moindre octet | ⬛ non atteinte |
| **digest** | ⚠️ `sha256hex(input.buffer)` — sur le buffer **en mémoire**, **avant** persistance | ⬛ non atteinte |
| **persistance** | ✅ `PutObjectCommand`, `Metadata:{sha256, registryid}` | ⬛ non atteinte |
| **relecture** | ❌ **ABSENTE** — le `GetObjectCommand` de `pdfStorage.ts:226` n'est jamais envoyé : il ne sert qu'à **signer une URL** | ⬛ non atteinte |
| **digest recalculé** | ❌ **ABSENT** — aucun octet n'est relu, donc aucune empreinte n'est recalculée | ⬛ non atteinte |
| **registre** | ✅ `confirmerEnregistrement(ligne.id)` | ⬛ non atteinte |

Et la nuance qui compte : le réconciliateur (`scripts/casefile/reconcilier-registre-r2.ts`, **hors
du chemin de la route**) compare `Metadata.sha256` à `registre.sha256`. **Les deux viennent du même
buffer, écrits par la même opération** — une telle comparaison ne peut pas détecter un corps
altéré. Le commentaire du code l'assume : `HeadObject` uniquement, *« jamais GetObject »*, pour ne
pas faire sortir les octets du compartiment. C'est un arbitrage explicite, pas un oubli — mais il
faut le dire pour ce qu'il est : **la chaîne prouve ce qu'elle a VOULU écrire, pas ce qui EST
écrit.**

### Le CONTRÔLE DE MISE EN PAGE — et ce qu'il n'est pas

⚠️ **CE N'EST PAS L'ARTEFACT DE LA ROUTE.** Le HTML rendu par `renderGovernedCaseFileHtml`, à partir
de la projection réelle, a été imprimé par un moteur d'impression **local** (Chrome de l'hôte). Cet
objet ne porte ni identité allouée, ni persistance, ni ligne de registre. Il répond à **une seule**
question, celle que l'incident `<details>` avait ouverte : *un moteur d'impression cache-t-il une
partie de ce HTML ?*

Vérifié sur le **texte extrait du document** (`pdftotext`), 3 pages, 7 718 caractères — jamais sur
la source HTML :

```
✅ SUBJECT IL-SHILL-VINE-001 · $VINE · audience COUNSEL_INVESTOR · GOVERNED_CLAIMS
✅ VINE-MULTI-01 v1 → ses QUATRE pièces, chacune avec digest, capture et localisateur
     SRC-0xS-09 · SRC-CKF-01 · SRC-FKK-01 · SRC-SLD-01
✅ MEASURED LIMIT → SRC-MEASURE-01 · MACHINE_MEASURED
     instrument:il-measure-vine-wallet-attribution@1.0.0 · locator r2://…
✅ GOVERNED CONCLUSION → CONSUMED GOVERNED ASSERTIONS · DERIVED_FROM → VINE-MEASURE-01 v1
✅ FOUNDATION TRACE sous CHACUNE des 6 claims — identité, version, état, sceau
✅ AUDIT INFORMATION
❌ absents : UNDETERMINED · AVOID · SAFE · WARNING · /100 · score · SG-1 · legacy summary
              TigerScore · SmokingGun · riskClass
```

La trace de fondement est **visible dans le document**, pas seulement dans la source : le correctif
`<details>` → bloc ordinaire tient à l'impression.

### Conséquence de doctrine

**CF-3 N'EST PAS `FINAL CLOSED`.** Le critère est celui du ruling lui-même : tant que le document
n'est pas traversé par la route, il n'est pas fourni. Ce qui manque est nommé, et c'est **deux
choses distinctes** :

1. **un runtime d'architecture compatible** — un déploiement gouverné ;
2. **une relecture et un digest recalculé** — absents du chemin, et qui exigeraient
   `src/lib/storage/pdfStorage.ts`, **deuxième fichier gelé**, hors de la lease à un seul chemin.
   **STOP GPT** conformément à la consigne.

---

## §5 · LES MUTANTS

**CF-1 (19)** — pièce absente · dépendance absente · sceau absent → `null` jamais fabriqué ·
lignage absent · verdict légataire modifié → **assemblage identique octet pour octet** ·
`summary`/`bodyMarkdown`/`keyWallets` modifiés → identique · aucune contamination entre dossiers ·
aucun `any` · subject-agnostic.

**CF-2 (19)** — claim non classée · observation sans pièce même avec dépendance · pièce non
qualifiée · claim `ATTACHED` côté public · `OPERATOR_DECLARED` ferme le public pas le counsel ·
référence orpheline · **dépendance épinglée sur une autre version → non attribuée** · zéro claim →
cardinalité sans aucun mot de verdict.

**CF-3 (17)** — aucune claim → cardinalité · **aucun score sous aucune forme** · contenu
exclusivement issu de la projection · HTML échappé, pas d'injection · audience jamais devinée ·
aucune relecture de base, aucun preset, aucune prose · aucun `any` · vocabulaire RC respecté ·
subject-agnostic · **aucun `<details>`**.

**Trois registres ont rougi et ont été satisfaits, jamais affaiblis** : poseurs de `provenanceKind`
(deux fois), registre des surfaces S22, et la borne inférieure S12 — où le renderer est *déclaré mais
non détecté*, exactement comme l'entrée qui l'y précédait.

**7851 tests verts.**

---

## §6 · DÉCLARATION D'ÉCART

| Autorisé | Exercé |
|---|---|
| trois stages, trois branches, trois PR | trois, plus un correctif de typage sur CF-1 |
| modifier le producteur canonique `/api/casefile/pdf` | une branche `governed` **ajoutée** ; `public` et `internal` non touchés |
| retirer `loadCaseByMint` / `computeScore` du chemin RC | **non exercé** — ils n'ont jamais été sur le chemin `governed`, qui est neuf. Rien n'a été supprimé ailleurs |
| lease sur un chemin gelé | **STOP déclaré en CF-3, puis lease accordée** (`CC-OFFLINE-246`) : un seul chemin, 45 mn, consommée en 12 mn, fermée, résiduel 0. Le garde n'a jamais été contourné |
| produire le witness PAR la route | **exercé jusqu'au renderer, pas au-delà** — l'hôte est arm64, le pack Chromium est x86-64/linux. Contrôle positif : le gabarit `public` préexistant échoue à l'identique. **Aucun document fourni**, donc **CF-3 non `FINAL CLOSED`** (§4bis) |
| relecture + digest recalculé | **non exercé, et STOP déclaré** — absents du chemin ; les poser exigerait `src/lib/storage/pdfStorage.ts`, deuxième fichier gelé, hors lease |
| `/api/pdf/casefile` legacy | **non touchée**, non mesurée, non redirigée |

**Écart : l'autorisation couvrait le retrait de structures legacy du chemin RC ; aucune n'a eu à être
retirée, parce que le chemin canonique est neuf et ne les a jamais appelées.** Le JSON disque, les
presets et le producteur legacy continuent d'exister pour leurs usages, hors du chemin RC.

Aucun DDL, aucune migration, aucun `GRANT`, aucune nouvelle autorité, aucun contrat de publication
modifié.
