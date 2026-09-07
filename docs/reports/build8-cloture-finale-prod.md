# BUILD 8 — validation finale, après correctif du point 5 et containment P0

Validation **lecture seule** de ce qu'un serveur répond. `0 écriture · 0 DDL ·
0 appel Helius.` Lectures base en `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`,
cible `ep-square-band` assertée avant connexion.

Ce rapport **succède** à `build8-cloture-validation-prod.md`, qui reste le
constat de son heure (point 5 en échec, sur un artefact antérieur). Il ne le
remplace pas : il mesure l'état d'après correctif.

| | |
|---|---|
| `main` | `8377feb596dfbcf51121da76501f980bad1974a6` |
| guard | `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` — `git diff cccac57` **vide**, **0** exemption |
| déploiement | **`interligens-5kbspp268`** · READY · émis depuis `8377feb` en HEAD détaché, projet `interligens-app` |
| horodatage | 2026-09-07, 12:19–12:30 UTC |

---

## VERDICT

> ## Les cinq points remesurés passent. Le containment passe.
>
> **Point 5 : 8 critères sur 8.** Le neuvième — `report_hash` — est
> **NON APPLICABLE**, démontré et non supposé.

| # | point | verdict |
|---|---|---|
| 1 | 0 wallet `isPubliclyUsable=false` servi | **PASS** |
| 4 | le mint canonique ouvre le bon CaseFile | **PASS** |
| 5 | la clé synthétique n'est plus acceptée comme mint | **PASS — 8/8** |
| 8 | guard byte-identical | **PASS** |
| 9 | CI verte | **PASS** |
| — | containment P0 | **PASS — API et PDF** |

Points 2, 3, 6, 7 non rouverts, hors périmètre de cette passe.

---

## PRÉALABLE — l'artefact porte bien le code

Le défaut du matin était un déploiement qui ne portait pas le commit. Contrôle
bloquant refait **avant toute mesure**, sur l'URL du déploiement puis sur le
domaine :

| surface | `engine_version` | `canonical_hash` | |
|---|---|---|---|
| `interligens-5kbspp268….vercel.app` | **`CaseFile-v1.2`** | présent | OK |
| `app.interligens.com` | **`CaseFile-v1.2`** | présent | OK |

Les deux servent le même artefact : ni le faux négatif du matin (code non
déployé), ni son inverse (déployé mais non aliasé).

Contrôles avant émission, tous vérifiés : `HEAD = 8377feb…`, arbre suivi
**vide**, `grep -c "CaseFile-v1.2" = 1`, `projectName = interligens-app`.

---

## POINT 5 — les huit critères, mesurés séparément

Trois passes consécutives. **Résultat identique aux trois.**

| # | critère | attendu | observé | |
|---|---|---|---|---|
| 1 | même canonical subject | identique, = 44 | `44 → …s9Th69xb` · `43 → …s9Th69xb` | **OK** |
| 2 | même CaseFile | identique | `off_chain` **identique**, 8 claims des deux côtés | **OK** |
| 3 | mêmes données on-chain | identiques | **17 champs sur 17 identiques**, `asset.mint` compris | **OK** |
| 4 | même score | identique | `75/RED` · `75/RED` | **OK** |
| 5 | `canonical_hash` égalité stricte | identique | `288f7fe82dc2090e` == `288f7fe82dc2090e` | **OK** |
| 6 | `asset.mint` = 44 | 44 des deux côtés | **44 car. des deux côtés** | **OK** |
| 7 | aucune assertion « 43 est un mint » | aucune | le 43 apparaît **1×**, en `input.value` seul, `type=route_alias` | **OK** |
| 8 | provenance visible alias / neutre canonique | voir ci-dessous | voir ci-dessous | **OK** |

### Le critère 8, en détail

```
alias (43)        type: "route_alias"
                  value: <43>
                  resolved_to: <44>
                  alias_of: <44>
                  resolution: "botify_synthetic_route_key"

canonique (44)    type: "mint"
                  value: <44>
                  resolved_to: <44>
                  alias_of: null
                  resolution: "identity"
```

La provenance est **visible côté alias** — quatre champs concordants disent
d'où vient la résolution et vers quoi elle mène. Côté canonique elle est
**neutre** : `alias_of: null` nie explicitement tout alias, et
`resolution: "identity"` dit que l'entrée est l'identité elle-même.

> **Transparence sur la mesure** : mon contrôle mécanique exigeait l'ABSENCE des
> clés côté canonique et a d'abord rendu `KO`. Le critère convenu était
> « absent **ou neutre** ». `identity` est neutre — il ne prétend pas qu'une
> résolution a eu lieu, il déclare l'inverse, et distingue sans ambiguïté du cas
> alias. Le critère passe ; c'est ma règle qui était plus stricte que la règle
> convenue, pas le produit qui manque à celle-ci.

### Le rapprochement avec l'état antérieur

| | avant correctif | maintenant |
|---|---|---|
| `case.input.type` (alias) | `"mint"` | **`"route_alias"`** |
| `on_chain.asset.mint` (alias) | le 43, longueur 43 | **le 44, longueur 44** |
| `verdict.score` | **70 vs 75** | **75 vs 75** |
| données on-chain (alias) | `null` partout | **complètes, identiques au canonique** |
| marqueur de résolution | aucun | **4 champs** |
| deux vérités concurrentes | oui | **non** |

Les sept écarts relevés au rapport précédent sont fermés.

---

## `report_hash` — non-applicabilité démontrée

**Par le code**, `src/app/api/casefile/route.ts` :

```ts
const caseId = crypto.randomBytes(4).toString("hex").toUpperCase();   // :307
      scan_timestamp: new Date().toISOString(),                       // :332

caseFile.case.canonical_hash = sha256({ subject: lookupKey, chain,    // :353
        verdict, on_chain, off_chain, evidence_linking })

caseFile.report_hash = sha256(JSON.stringify(caseFile))               // :364
```

`report_hash` hache **le dossier entier**, lequel contient `case_id`
(`randomBytes(4)`) et `scan_timestamp` (`new Date()`). Il ne peut donc pas être
stable, même à entrée identique.

**Par la mesure** — trois appels, entrée strictement identique (le canonique) :

| passe | `case_id` | `report_hash` | `canonical_hash` |
|---|---|---|---|
| 1 | `8ECC3B33` | `2ceffc2e7bb2db52` | `288f7fe82dc2090e` |
| 2 | `058AE7C1` | `f2cc0590d6eacbb6` | `288f7fe82dc2090e` |
| 3 | `95C8432E` | `f175bec4b301afd0` | `288f7fe82dc2090e` |

`report_hash` : **3 valeurs distinctes sur 3** — il identifie une émission.
`canonical_hash` : **1 seule valeur sur 3**, et identique entre alias et
canonique — il identifie un dossier.

**Critère NON APPLICABLE**, établi sur les deux plans. Le forcer à l'égalité
supposerait de retirer l'aléa et l'horodatage, donc de changer ce qu'il désigne.

---

## POINT 4 — le canonique n'a pas régressé

| mesure | attendu | observé | |
|---|---|---|---|
| `offchain_source` | `case_db` | **`case_db`** | OK |
| `verdict` | `RED` | **`RED / 75`** | OK |
| `retail_summary` | 3 lignes | **3 lignes** | OK |
| données on-chain | présentes | **supply, decimals 6, pool `raydium`, prix, liquidité, FDV, volume** | OK |
| `input.type` | `mint` | **`mint`** | OK |

Refermer l'alias n'a rien coûté au canonique.

---

## POINT 1 — publiabilité

| mesure | attendu | observé | |
|---|---|---|---|
| profils joignables | 32/32 | **32/32** | OK |
| wallets servis | 164 | **164** | OK |
| `isPubliclyUsable !== true` servi | 0 | **0** | OK |
| `status !== 'active'` servi | 0 | **0** | OK |
| `"confidence":"exact"` en dur | 0 | **0** | OK |
| `"source":"manual"` en dur | 0 | **0** | OK |

---

## POINTS 8 ET 9

| contrôle | attendu | observé | |
|---|---|---|---|
| sha256 du guard sur `origin/main` | `ce13d0c0…3e50` | **conforme** | OK |
| `git diff cccac57 -- guard` | vide | **vide** | OK |
| exemptions ouvertes | 0 | **0** | OK |
| CI `8377feb` · `744f5c8` · `14ca537` · `5a015cb` | verte | **`success` ×4** | OK |

---

# CONTAINMENT P0 — sujet distinct

## Confrontation à la base, avant toute mesure de surface

Les quatre adresses du preset BOTIFY, telles que la base les porte :

| handle | adresse | `isPubliclyUsable` | lignes `KolProceedsEvent` |
|---|---|---|---|
| `EduRio` | `GWnE324dDE…SKF66` | **`false`** | **0** |
| `ElonTrades` | `BN5edYKL6t…3fGKwX` | **`false`** | **0** |
| `Moneylord` | `7QquANyvZg…otp8JJ` | **`false`** (2 lignes) | **0** |
| `GordonGekko` | `0xa5B0eDF6…01D41` | **`true`** | **0** |

**Les 3 non publiables sont EduRio, ElonTrades et Moneylord.** La quatrième —
GordonGekko EVM — est **publiable**. C'est la distinction annoncée : *4 montants,
3 wallets*, et les deux propriétés sont indépendantes. L'adresse du quatrième a
le droit de sortir ; **son montant, non**, puisqu'il n'a pas plus de provenance
que les trois autres.

**Les quatre adresses portent 0 ligne `KolProceedsEvent`** : aucun des quatre
montants n'est reproductible depuis l'autorité produit. Le fondement du retrait
est vérifié, pas supposé.

## Surfaces API

| surface | montants fuités | adresses fuitées | substitutions |
|---|---|---|---|
| `/api/casefile?mint=<44>` | **aucun** | **aucune** | **aucune** |
| `/api/casefile?mint=<43>` | **aucun** | **aucune** | **aucune** |

## Surface PDF — sur le texte extrait

`content-type: application/pdf`, magic `%PDF-`. Extraction par `pdftotext` :
**8 308 octets de texte, 577 lignes** (EN) et **9 355 octets** (FR). Le contrôle
porte sur ce texte, jamais sur le flux binaire.

| contrôle | EN | FR |
|---|---|---|
| `347 237` (EduRio) | **absent** | **absent** |
| `85 484` (Moneylord) | **absent** | **absent** |
| `53 313` (ElonTrades) | **absent** | **absent** |
| `40 627` (GordonGekko) | **absent** | **absent** |
| agrégat `604 489 $` | **absent** | **absent** |
| agrégat `28 KOL` | **absent** | **absent** |
| agrégat `295 événements` | **absent** | **absent** |
| adresse EduRio | **absente** | **absente** |
| adresse ElonTrades | **absente** | **absente** |
| adresse Moneylord | **absente** | **absente** |
| adresse GordonGekko EVM (autorisée) | absente | absente |

Comparaison normalisée : espaces, espaces fines, insécables et virgules retirés
avant recherche — `347 237`, `347237` et `347,237` sont donc tous couverts.

## Aucune valeur de base substituée

| valeur interdite | EN | FR |
|---|---|---|
| `150 577` | **absente** | **absente** |
| `18 KOL` | **absente** | **absente** |
| `262 événements` | **absente** | **absente** |

**Seule somme en dollars subsistant dans le PDF EN : `$15.1M`**, au libellé
« Observed on-chain event · Peak market cap reached ». C'est une capitalisation
de marché constatée on-chain, sans rapport avec les cashouts nominatifs. Le PDF
FR n'en contient aucune.

> **Une occurrence a demandé vérification** : la chaîne `262` apparaissait dans
> les réponses JSON. Contexte relevé : `"supply":"999559722628488"`. Hors ce
> champ, **0 occurrence**. Faux positif de sous-chaîne, pas une substitution.

## Le PDF de l'alias

`/api/casefile/pdf?mint=<43>` et `?mint=<44>` rendent **le même document** :
177 050 octets, 8 308 octets de texte extrait, à l'octet près. La résolution
d'alias couvre donc aussi la route PDF.

## Ce que je n'ai pas contrôlé

`/api/casefile/generate` accepte un `data` arbitraire et exige un `POST`. Cette
validation est en **lecture seule** : je n'ai émis aucun `POST`, donc **je n'ai
pas exercé le garde qui lit le HTML final et lève**. Son existence est lisible
dans `src/lib/casefile/containment.ts` ; son déclenchement n'est pas mesuré ici.
Un contrôle non concluant annoncé vaut mieux qu'un contrôle faux.

---

## OBSERVATIONS, sans incidence sur les verdicts

1. **Le marqueur de retrait n'apparaît dans aucun des deux PDF** (0 occurrence
   de « montant retiré de la publication »). Les montants ont été retirés avec
   leur phrase porteuse plutôt que remplacés par la mention. Le résultat est
   conforme — rien ne fuit, rien n'est substitué — mais le lecteur du PDF n'est
   pas informé qu'une donnée a été retirée.
2. **`Moneylord` existe en base** (`KolProfile`, `draft`, `publishable=false`) —
   il n'est donc pas publié, ce qui explique son absence de mes 32. Le preset
   l'écrit `MoneyLord`, la base `Moneylord`. Sujet resté **ouvert et non
   instruit**, non rouvert ici.
3. **Deux lignes `KolWallet` pour la même adresse Moneylord**, l'une
   `attributionStatus=confirmed`, l'autre `approved`. Doublon signalé, hors
   périmètre.
4. Deux occurrences de `604 489` / `347 237` subsistent dans
   `presets.ts` — **dans des commentaires expliquant le retrait**, jamais dans
   la charge utile.

---

## MÉTHODE

- Contrôle bloquant de version **avant** toute mesure, sur l'URL du déploiement
  puis sur le domaine.
- Base : `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, host asserté, valeurs de
  connexion jamais imprimées.
- HTTP : `GET` uniquement — 32 handles, 6 appels casefile en 3 passes, 4 PDF.
- PDF : `pdftotext` sur le document, jamais `grep` sur le flux.
- Recherche de montants normalisée (espaces fines, insécables, virgules).
- Déploiement émis depuis un HEAD détaché sur `8377feb`, arbre suivi vide,
  marqueur `CaseFile-v1.2` vérifié dans l'arbre **avant** émission.
- `0 écriture · 0 DDL · 0 appel Helius · 0 POST.`
