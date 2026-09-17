# BC-0 — LE PREMIER CASEFILE CANONIQUE BOTIFY

**2026-09-17 · CC-OFFLINE-258 · un test PRODUIT par l'artefact · aucune correction appliquée**

> **NE CHERCHE PAS À RENDRE BOTIFY IMPRESSIONNANT. FAIS DIRE À INTERLIGENS LA VÉRITÉ SUR BOTIFY.**

---

## LA RÉPONSE, EN UNE LIGNE

**CLASSIFICATION : B — TECHNICALLY VALID / PRODUCT-INCOMPLETE.**

Le producteur canonique a traité BOTIFY **sans une ligne de modification** — la réutilisation
subject-agnostic est démontrée. L'artefact est gouverné, relu, concordant, et sa chaîne de fondement
est intégralement traçable dans le document. **Mais son unique section porte le titre « WHAT COULD
NOT BE ESTABLISHED » au-dessus d'une observation qui ÉTABLIT.** Un avocat lit l'inverse de ce que le
dossier dit.

---

## §1 · L'ARTEFACT

Produit par la route canonique sur le runtime servi — **aucun déploiement**, le producteur étant
**identique octet pour octet** à celui déjà servi (`git diff 0613324..HEAD` sur route, assemblage,
projection, renderer, lecteur, stockage : **vide**).

```
runtime servi   dpl_Bm5uYsPhdsVSbmvZbxPEJBb43491 · commit 0613324c… · root d3d574ad…
appel           GET /api/casefile/pdf?preset=botify&template=governed   HTTP 200 · 10,1 s
registry id     332f529105d8455ca0db500362db22d1
object identity reports/production/2026/09/332f529105d8455ca0db500362db22d1.pdf
byte length     68 413
expected sha256 a84efcf52bb99af841551bba2e88e5a3a06e88d22d86359bf269ab62cf41b2e2
readback sha256 identique · MATCH · en-tête %PDF-1.4
claims projetés 1 · audience COUNSEL_INVESTOR · état GOVERNED_CLAIMS
```

`status: "stored"` n'est atteignable que par le cycle complet : identité de registre → `INTENDED` →
rendu → PUT → GET du même objet → digest recalculé → comparaison → `REGISTERED`. Le digest a en
outre été **remesuré hors du producteur**, sur les octets reçus.

---

## §2 · CE QUE LE DOCUMENT REND

**1 page · 68 413 octets · 2 292 caractères de texte · 25 lignes non vides.**
Aucune page vide, aucun titre orphelin, aucune coupure.

| Section | État | Autorité |
|---|---|---|
| *What we established* | **absente** | aucune claim hors mesure |
| *What could not be established* | **PRÉSENTE** | ⚠️ **le défaut — voir §3** |
| *Governed conclusion* | **absente** | aucune `INFERENCE` |
| *Consumed governed assertions* | **absente** | **0 dépendance — propriété CORRECTE ici** |
| *Foundation trace* | présente | sous la claim |
| *Governed evidence* | présente | la pièce, avec digest et localisateur |
| *Audit information* | présente | — |

**Le défaut prédit ne s'est PAS produit.** Aucune rubrique « en forme de VINE » n'apparaît vide : le
renderer n'affiche une section que si une autorité la porte, et les trois sections que BOTIFY ne
remplit pas sont **absentes**, ni vides ni « non établies ». Cette propriété tient.

---

## §3 · ⛔ LE DÉFAUT — LA PROVENANCE EST PRISE POUR UNE POLARITÉ

L'unique observation BOTIFY est rendue sous :

```
WHAT COULD NOT BE ESTABLISHED
Bounded measurements produced by an identified INTERLIGENS instrument. A measurement states
what was searched, within which perimeter, and what was NOT FOUND — not that the thing does
not exist.

  Bounded measurement: recorded event rows and distinct walletAddress values…
  A bounded measurement of the governed corpus RECORDED 262 EVENT ROWS…
```

**Le titre nie ce que le paragraphe affirme.**

### La cause, mesurée dans le code

`governedCaseFileRenderer.ts:63-65` :

```ts
/** Une claim est-elle fondée sur une MESURE ? L'autorité est la provenance. */
const estMesure = (c: ProjectedClaim): boolean =>
  c.citedSources.some((s) => s.provenanceKind === "MACHINE_MEASURED");
```

Ce booléen — **une qualification de PROVENANCE** — pilote une section dont le titre est une
**assertion ÉPISTÉMIQUE**. CF-3 avait raison de refuser de *classer* ; mais il a adossé la section à
la mauvaise autorité :

> **`MACHINE_MEASURED` DIT QUI A PRODUIT LA PIÈCE. IL NE DIT PAS CE QUE LA MESURE A TROUVÉ.**

Sur VINE, les deux coïncidaient — la mesure était un **constat négatif**, et la section disait vrai.
La coïncidence a été prise pour une règle. BOTIFY est la première mesure **positive** du dépôt, et
elle sépare les deux : **la règle se révèle fausse au premier sujet qui la teste.**

C'est exactement ce que BC-0 existait pour découvrir.

---

## §4 · AUTORITÉ MANQUANTE vs PROBLÈME DE PRÉSENTATION — LES DEUX, ET PAS AU MÊME ENDROIT

**Les deux sont réels, et ils ne se corrigent pas au même endroit.**

### ① PROBLÈME DE PRÉSENTATION — le renderer

`estMesure` fait porter à `provenanceKind` une décision qu'il n'a pas l'autorité de prendre.
**Surface de correction minimale :** `src/lib/casefile/governedCaseFileRenderer.ts`, la règle de
section et le libellé qui l'accompagne. **Aucun DDL, aucun déploiement de données.**

### ② AUTORITÉ MANQUANTE — la polarité n'est projetée nulle part

L'objet de mesure scellé **porte déjà** la polarité :

```json
"result": "ESTABLISHED",
"causes": []
```

Mais `CaseFileSource` et `CaseFileClaim` **ne la transportent pas**. Le renderer ne peut donc pas la
lire, même s'il voulait bien faire. Il n'existe, aujourd'hui, **aucun chemin gouverné** par lequel
la polarité d'une mesure atteint la projection.

**AUTORITÉ ADDITIONNELLE MINIMALE QUI CHANGERAIT LE DOCUMENT :** que la claim porte, ou que
l'assemblage remonte, **le `result` de la mesure citée**. Une seule information — `ESTABLISHED` vs
`NOT_ESTABLISHED` — suffirait à faire tomber cette observation sous *What we established* et à
laisser VINE-MEASURE-01 là où elle est.

⚠️ Corriger ① **sans** ② produirait un renderer qui devine la polarité — exactement la seconde
autorité que tout ce chantier refuse. **Corriger ② d'abord, ① ensuite.**

---

## §5 · CE QU'UN AVOCAT NE PEUT PAS COMPRENDRE

1. **Si le dossier établit ou n'établit pas quelque chose.** Le titre et le corps se contredisent.
2. **Pourquoi il n'y a rien d'autre.** Le document ne dit pas que BOTIFY ne porte qu'**une** assertion
   gouvernée — et donc rien ne distingue « le dossier est mince » de « le producteur a échoué ». Une
   cardinalité explicite manque.
3. **Ce que « 262 event rows » autorise à conclure.** Les limites mesurées — `EVENT LABEL ≠ EVENT`,
   `RECORDED WALLET FIELD ≠ WALLET ATTRIBUTION` — vivent dans l'objet scellé et **n'apparaissent pas
   dans le document**. C'est prudent en apparence, et risqué en pratique : le lecteur comble.

**Ce sont trois défauts de PRÉSENTATION et d'AUTORITÉ, aucun n'est un défaut de gouvernance.**

---

## §6 · LES QUATRE CONTRÔLES

**GOLDEN TRACE — complète.** `BOTIFY-EVENTS-01 v1` → sceau `388acb33…` → `SRC-BOTIFY-MEASURE-01` →
`MACHINE_MEASURED` · `instrument:il-measure-botify-proceeds-events@1.0.0` → digest `3d87a6f1ab58…` →
`r2://interligens-evidence/evidence/3d/3d87a6f1…json`. **Aucun `DERIVED_FROM`, et c'est correct.**

**ASSERTIONS NÉGATIVES — toutes absentes** du texte rendu : `sale · sold · seller · profit · revenue
· cash-out · liquidation · insider · coordinated · fraud · manipulation · dump · USD · $ (hors le
ticker) · KOL · actor · dex_sell · cex_deposit · total de tokens · TigerScore · SmokingGun ·
riskClass · UNDETERMINED · AVOID · SAFE · WARNING · /100 · score`.
**`proceeds` : 3 occurrences, TOUTES dans un identifiant technique** — l'identité versionnée de
l'instrument et le nom de la table citée comme borne. **Contexte qualifié : ce n'est pas un FAIL.**

**HISTORIQUE — intact et absent.** `SRC-001…008` : **aucune** dans le document. Les 8 sources et 8
claims historiques ne sont ni projetées, ni fondatrices, ni modifiées. Dépendances = 0, décisions de
publication = 0.

**CONTRÔLE PUBLIC — `PUBLIC = 0` (`NO_GOVERNED_CLAIM`).** Vérifié par projection, **sans produire de
second artefact** et sans créer aucune autorité de publication.

---

## §7 · SUBJECT-AGNOSTIC — LA PARTIE QUI RÉUSSIT

```
modifications spécifiques BOTIFY au producteur   0
littéraux BOTIFY ajoutés                          0
branches conditionnelles par sujet                0
nouvelle doctrine                                 0
nouvelle projection                               0
second moteur PDF                                 0
déploiement                                       0
```

Mesuré, pas affirmé : `git diff 0613324..HEAD` sur la route, l'assemblage, la projection, le
renderer, le lecteur canonique et le stockage rend **un diff vide**. Le binaire qui a produit VINE a
produit BOTIFY.

**L'hypothèse testée est vérifiée sur le plan mécanique. Elle échoue sur le plan sémantique.**

---

## §8 · DÉCLARATION D'ÉCART

| Autorisé | Exercé |
|---|---|
| produire exactement UN CaseFile counsel BOTIFY par le producteur canonique | **exercé une fois**, par la route, sur le runtime servi |
| STOP si le producteur ne sait pas traiter BOTIFY tel quel | **non déclenché** — il l'a traité sans modification |
| ouvrir le PDF persisté et le mesurer | **exercé** — octets, pages, texte extrait, sections, mise en page |
| classer A / B / C | **B**, et le motif est un défaut sémantique, pas une maigreur |
| ne pas enrichir si B | **tenu** — aucune claim ajoutée, aucun libellé retouché |
| corriger le défaut | **NON EXERCÉ.** Cause nommée, surfaces nommées, rien de modifié |
| campagne T2 / protocole 15/15 | **non exercée** — vérification ciblée uniquement |
| 8 sources et claims historiques · KolProceedsEvent en direct · USD · v1.1 · UX · SERIAL-12RUGS · paquet RC | **non ouverts** |
| déploiement · DDL · nouvelle autorité · GRANT | **aucun** |

Aucun second artefact, aucune autorité de publication, aucune modification du producteur.
