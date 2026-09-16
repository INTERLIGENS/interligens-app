# CF-0 — LE PRODUCTEUR CANONIQUE PEUT-IL ASSEMBLER LA CHAÎNE D'AUTORITÉ VINE ?

**2026-09-16 · CC-OFFLINE-238 · MESURE · aucune correction, aucune lease**

---

## §1 · LA QUESTION, ET LA RÉPONSE

> *Can the existing canonical producer assemble the VINE authority chain without reading
> non-authoritative fields?*

```
GAPS [5]
```

Et un fait qu'il faut lire avant les cinq : **le producteur nommé au périmètre ne lit pas le corpus
gouverné du tout.** Pour VINE aujourd'hui, il rendrait **zéro claim et zéro pièce**.

---

## §2 · LES SEPT MAILLONS

### A · SUBJECT — **PRÉSENT (partiel)**

| | |
|---|---|
| `casefileRef` | **PRÉSENT** — `route.ts:88-90` : `canonicalRefForMint(mint)` puis `loadCanonicalCaseFile(ref)`. Gouverné. |
| identité du sujet | **PRÉSENT** — `route.ts:117` `case_id: dossierGouverne.ref` |
| scope temporel | **ABSENT** — aucun champ de borne temporelle sur ce chemin |
| audience | **ABSENT** |

**L'audience n'est ni un paramètre de rendu ni une autorité : elle n'existe pas sur ce chemin.**
`projectConclusions` (CC-OFFLINE-234) n'a **aucun appelant de production** — vérifié par recherche sur
le dépôt entier. Le seul consommateur est `toInternalCaseView`, qui n'est pas sur ce chemin.

La résolution du sujet passe par `CANONICAL_REF_BY_MINT` (`publicProjection.ts:110-113`), une table de
**deux entrées** en dur, indexée par constantes importées. Le producteur n'est donc **pas
subject-agnostic par construction** — voir §4.

### B · EVIDENCE — **PRÉSENT chez le lecteur, ABSENT chez le producteur**

Le lecteur canonique (`canonicalReader.ts:277-279`) lit `sourceId, sourceType, caption, capturedAt,
sourceUrl, sha256, snapshotId`, puis **résout la qualification de provenance par le journal** —
`provenanceDecoration` / `resolveJournalProvenance`, jamais un registre en dur. Identité, digest,
capture, locator, lien au snapshot : tous **PRÉSENTS**.

**Mais le producteur nommé ne s'en sert pas.** `route.ts:101` appelle `loadCaseByMint`, et les sources
rendues viennent de là (`route.ts:127`). Le producteur **n'ignore pas** la qualification de
provenance : il ne la rencontre jamais.

### C · GOVERNED CLAIMS — **ABSENT sur le chemin nommé**

Le lecteur remonte `claimId · version · rowNature · state · evidenceRefs` (`canonicalReader.ts:280-284`)
— **`contentHash` n'est PAS sélectionné** (unique occurrence du mot dans le fichier : un commentaire,
ligne 266).

Le producteur nommé, lui, projette `caseFile.claims` issus du JSON (`route.ts:120-126`) :
`id · title · severity · status · description · thread_url · category`. **Aucun `rowNature`, aucune
version, aucun `state`, aucun `contentHash`.**

> **Le producteur projette-t-il des claims sans regarder `rowNature` ?**
> Il projette des claims **qui n'ont pas de `rowNature`** — ce ne sont pas les claims gouvernées.

### D · RELATION — **ABSENT**

`VINE-MULTI-01` et ses quatre pièces existent et sont lisibles (§5). Le lecteur canonique les rendrait.
Le producteur nommé ne les voit pas : ses claims viennent du JSON. **La relation n'est pas projetable
par ce chemin**, et il ne connaît pas davantage des claims isolées — il n'en connaît aucune.

### E · MEASURED LIMIT — **PRÉSENT chez le lecteur, ABSENT chez le producteur**

`MACHINE_MEASURED` **est lisible** par le lecteur : `JOURNAL_PROVENANCE_KINDS` porte les quatre
valeurs depuis CC-OFFLINE-230, et `resolveJournalProvenance` rend la qualification sans la dériver.
Confirmé en base : journal `#17`, `MACHINE_MEASURED / DOCUMENT`, déclarant
`instrument:il-measure-vine-wallet-attribution@1.0.0` (§5).

Ce qui manque au **transport** : l'objet `CanonicalCaseFile` porte la qualification de la *pièce*, pas
le **contenu de la mesure** — instrument, scope, result, causes, limitations vivent dans les octets R2
que la pièce désigne. Rien sur le chemin ne les ouvre.

### F · GOVERNED INFERENCE — **ABSENT**

`VINE-CONCLUSION-01` v1 existe, `INFERENCE`, avec sa dépendance persistée (§5).

`loadClaimDependencies` **existe** (`canonicalReader.ts:264-285`, livré par CC-OFFLINE-234) et
**aucun producteur ne l'appelle** : son unique appelant du dépôt est
`src/scripts/casefile/mesure-vine-attribution.ts:570`, un script.

> **Le producteur sait-il lire `casefile_claim_dependencies` ? NON.** C'est un GAP, pas une opinion.

### G · FOUNDATION TRACE — **ABSENT**

`claim → evidence` : non reconstructible depuis l'objet du producteur nommé — ses claims et ses
sources viennent de deux listes JSON reliées par `evidence_refs`, hors autorité.

`inference → dependency → measurement` : non reconstructible du tout. Il faut **retourner en base**
pour la dépendance, et **aller chercher R2** pour la mesure.

---

## §3 · CONSOMMATION DE CHAMPS NON AUTORITATIFS

| Champ | Verdict | Méthode |
|---|---|---|
| `summary` | **CONSOMMÉ** | recherche par nom **et** suivi du chemin : `route.ts:119` le pose depuis `case_meta.summary` (JSON), `pdfRenderer.ts:159` le rend |
| `summary` (variante indexée) | **CONSOMMÉ** | `pdfRenderer.ts:159` lit `(scan as any).off_chain_fr?.summary` — accès **via `any`**, invisible à toute recherche par nom qualifié. Trouvé par lecture du chemin de données, pas par grep |
| `token_casefiles.verdict` | **NON CONSOMMÉ sur le chemin mesuré**, mais **TOUJOURS TRANSPORTÉ** | le lecteur le sélectionne (`canonicalReader.ts:295`) et le pose sur l'objet (`:371`). Aucune surface du périmètre ne le lit — D l'a retiré des deux projections. Il reste **disponible** sur l'objet d'assemblage |
| `bodyMarkdown` | **NON CONSOMMÉ** | absent des trois entrées, et le lecteur ne le sélectionne pas (colonnes énumérées, jamais `*`) |
| `keyWallets` | **TRANSPORTÉ, non rendu** | sélectionné `canonicalReader.ts:295`, porté sur l'objet ; aucune lecture dans la route ni le renderer |
| `SmokingGun` / `SG-*` | **NON CONSOMMÉ sur le chemin nommé** | absent de la route et de `pdfRenderer.ts`. ⚠️ **CONSOMMÉ par l'autre producteur** — `pdfGenerator.ts:407-408` rend `sg.verdict_fr` en encadré « VERDICT » |
| `case_meta.status` | **CONSOMMÉ** | `route.ts:112` → `pdfRenderer.ts:150`, rendu comme statut du dossier. Prose JSON |

**Aucun champ n'est déclaré INDÉTERMINÉ** : les trois entrées sont petites (214 + 412 + le renderer) et
chaque verdict ci-dessus repose sur le chemin de données suivi, pas sur une recherche par nom seule.

### ⚠️ Deux producteurs, pas un

Le périmètre nomme `/api/pdf/casefile`. La mesure en a trouvé **un second**, et il importe pour la
question :

| | producteur | source du contenu |
|---|---|---|
| `/api/pdf/casefile` | `renderCaseFilePDF` (`src/components/pdf/pdfRenderer.ts`) | **`loadCaseByMint`** — JSON sur disque |
| `/api/casefile/pdf` | `generateCaseFilePdf` (`src/lib/casefile/pdfGenerator.ts`) | **`loadCanonicalCaseFile`** (`route.ts:148`) |

Le second lit bien l'autorité — **et consomme `summary`, `summary_fr` et `sg.verdict_fr`**
(`pdfGenerator.ts:399-408`). Il est hors du périmètre nommé ; il est consigné ici parce qu'identifier
*quel* producteur est canonique fait partie d'une réponse honnête. `DISCOVERED → CLASSIFY`.

---

## §4 · HARDCODE VINE

| Occurrence | Fichier:ligne | Classe |
|---|---|---|
| `VINE_CASEFILE_REF = "IL-SHILL-VINE-001"` | `publicProjection.ts:105` | **production** — constante canonique, autorité unique ratifiée par S19 |
| `CANONICAL_REF_BY_MINT = { [BOTIFY_MINT], [VINE_MINT] }` | `publicProjection.ts:110-113` | **production** — table de deux entrées, par constantes |
| `MINT_TO_CASE = { [BOTIFY_MINT]: "botify.json" }` | `caseDb.ts:61-63` | **production** — **VINE en est ABSENT** |
| mentions « VINE » en commentaire | `caseDb.ts:35`, `publicProjection.ts:18,52` | prose |

**Aucun `claimId` ni `sourceId` en dur** sur le chemin de production : ni `VINE-MULTI-01`, ni
`VINE-MEASURE-01`, ni `VINE-CONCLUSION-01`, ni `SRC-MEASURE-01`.

Les deux tables en dur ne sont pas des littéraux dispersés — elles passent par des constantes
importées, ce que S19 a ratifié. Mais elles restent des **tables d'enregistrement par sujet** : ajouter
un dossier exige d'y ajouter une ligne. Le producteur **n'est pas subject-agnostic par construction**.

Et l'absence de VINE dans `MINT_TO_CASE` est la cause mécanique du GAP-1 : `loadCaseByMint(VINE_MINT)`
rend `null`, donc `caseFile?.claims ?? []` rend `[]`.

---

## §5 · ÉTAT DES OBJETS VINE EN BASE — confirmé en lecture seule

```
4 pièces de VINE-MULTI-01   SRC-0xS-09 · SRC-CKF-01 · SRC-FKK-01 · SRC-SLD-01
                            digest ✓ · capture ✓ · snapshot lié ✓  (les quatre)

SRC-MEASURE-01              snapshot vinemeas-d5cc1def3c38fc75 · type SYSTEM_MEASUREMENT
                            canonicalMint ✓ · digest pièce ≡ digest snapshot ✓ · locator r2:// ✓

dépendance causale          IL-SHILL-VINE-001 · VINE-CONCLUSION-01 v1 → VINE-MEASURE-01 v1
                            DERIVED_FROM

journal de provenance       #17 · MACHINE_MEASURED / DOCUMENT
                            instrument:il-measure-vine-wallet-attribution@1.0.0 · digest ✓

provenance des 6 pièces     5 × OPERATOR_DECLARED · 1 × MACHINE_MEASURED
```

**Tous les objets de la chaîne existent et sont lisibles.** Le défaut n'est pas dans la donnée.

---

## §6 · LES CINQ GAPS — liste causale minimale

Chacun répond à : *sans cette correction, quelle partie du CaseFile serait fausse, non traçable, ou
impossible à rendre ?*

**GAP-1 · Le producteur nommé ne lit pas le corpus gouverné.**
`route.ts:101` alimente claims, sources et résumé depuis `loadCaseByMint`, un JSON disque dont la carte
ne contient que BOTIFY.
→ *Pour VINE, le CaseFile rendu serait **vide** : zéro claim, zéro source, `summary` nul, et un score
`computeScore([])` calculé sur rien — présenté comme un score de dossier.* **Faux, et non traçable.**

**GAP-2 · Aucun producteur ne lit `casefile_claim_dependencies`.**
`loadClaimDependencies` existe et n'a qu'un appelant, un script.
→ *`VINE-CONCLUSION-01` serait rendue sans son `DERIVED_FROM` — une inférence privée de son fondement
causal, c'est-à-dire l'affirmation sans la chaîne.* **Non traçable.**

**GAP-3 · Le lecteur canonique ne remonte pas `contentHash`.**
→ *Aucune claim rendue ne serait vérifiable contre son sceau ; un lecteur ne pourrait pas confronter
l'artefact à l'assertion persistée.* **Non traçable.**

**GAP-4 · L'audience n'existe pas sur le chemin de production.**
`projectConclusions` n'a aucun appelant de production ; le producteur ne sait pas quelle autorité il
applique.
→ *Un artefact COUNSEL_INVESTOR ne peut pas être distingué d'un artefact public — et `VINE-CONCLUSION-01`,
fondée mais non publiable, ne pourrait être rendue ni sûrement incluse ni sûrement exclue.*
**Impossible à rendre.**

**GAP-5 · Le renderer consomme de la prose et n'a aucun emplacement pour l'autorité.**
`pdfRenderer.ts:159` rend `summary` (dont une variante via `any`), `:150` rend `case_meta.status` ;
aucun emplacement pour `rowNature`, version, provenance ou digest.
→ *La prose occuperait la place de l'autorité : le lecteur croirait lire un dossier fondé.* **Faux.**

### Classés BACKLOG, hors liste causale

- `token_casefiles.verdict` et `keyWallets` restent **transportés** par `CanonicalCaseFile` sans être
  consommés par aucune surface mesurée. Rien n'en serait faux aujourd'hui.
- Le second producteur `/api/casefile/pdf` consomme `summary`, `summary_fr` et `sg.verdict_fr` — hors
  périmètre nommé.
- `MINT_TO_CASE` / `CANONICAL_REF_BY_MINT` : enregistrement par sujet. Pas un défaut de la chaîne VINE.

---

## §7 · DÉCLARATION D'ÉCART

> *Une autorisation définit le maximum permis ; l'exécution doit rester au minimum nécessaire démontré.*

| Autorisé | Exercé |
|---|---|
| lecture du code | oui — 5 fichiers du périmètre, plus 3 lus pour trancher un verdict de §3 |
| lecture de la base en READ-ONLY | oui — 5 requêtes `SELECT`, aucune écriture |
| écriture du dossier et de ses annexes | **ce fichier seul** — aucune annexe n'a été nécessaire |
| tests de lecture jetables | **non exercé** — aucun test écrit, donc aucun à supprimer |
| lease | **non exercé** — aucune n'était nécessaire, aucune n'a été ouverte |

Les scripts de lecture ont vécu dans le bac de session, hors dépôt : ils ne sont ni commités ni à
supprimer.

**Écart : le périmètre autorisé couvrait des annexes et des tests jetables ; ni les unes ni les autres
n'ont été produits.** Rien n'a été corrigé, aucune architecture n'a été proposée, aucun chantier
ouvert.
