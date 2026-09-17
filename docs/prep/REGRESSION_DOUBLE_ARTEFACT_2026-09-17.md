# DÉPLOIEMENT + DOUBLE ARTEFACT DE RÉGRESSION

**2026-09-17 · CC-OFFLINE-262 · le producteur canonique, éprouvé sur deux cas sémantiquement opposés**

> **NOUS NE RE-CERTIFIONS PAS TOUT LE PRODUIT. NOUS PROUVONS QUE LE PRODUCTEUR CANONIQUE
> GÉNÉRALISE CORRECTEMENT SUR DEUX CAS SÉMANTIQUEMENT DIFFÉRENTS.**

---

## §1 · LE DÉPLOIEMENT ET LES SIX GATES

`pnpm deploy:prod` — chemin gouverné, et lui seul. `npx vercel --prod` non employé.

```
déploiement   dpl_6rz8LGuS8BHQk6CoQYX8YY1RgtD4 · readyState READY · target production
alias         app.interligens.com
MAIN SHA      28e0409770bc0f152c9b8044a94f44840f34511a
SERVED SHA    28e0409770bc0f152c9b8044a94f44840f34511a
```

| Gate | État |
|---|---|
| 1 · déploiement READY | ✅ `READY` · `target=production` |
| 2 · mapping de production | ✅ aliasé sur `app.interligens.com` |
| 3 · projet / périmètre canonique | ✅ `interligens-app` (`prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ`) — le wrapper ne lance pas le CLI si la liaison échoue |
| 4 · source-set servi ≡ `main` | ✅ **sept champs en MATCH**, relus sur la surface servie : `sourceSetRoot f3754374a05cb550…` · `commit 28e0409…` · `fileCount 2033` · algorithme · `ignoreEngine 5.3.2` · `cliVersion` · `generatedAt` |
| 5 · **le renderer corrigé est dans le runtime servi** | ✅ établi **deux fois** — par la racine Merkle du commit qui porte le correctif, et **par le comportement** : les artefacts produits par ce runtime portent `GOVERNED OBSERVATIONS` et ne portent plus `What could not be established` |
| 6 · santé / contrôle opérationnel | ✅ `/api/health` → 200 · `/api/casefile/pdf` (principal machine, sans paramètre) → **400 applicatif** |

**`DEPLOYED ≠ SERVED`** — l'autorité servie est établie avant toute génération, pas déduite du succès
du déploiement.

---

## §2 · LE WITNESS HISTORIQUE VINE — IMMUABLE, ET VÉRIFIÉ COMME TEL

```
id 7cfc5bbd61af4165b5cd6ffe1302759b · REGISTERED / NONE
107 576 octets · e70bff15f2797bb4f74890568dba3e4f6c101c7317fea0d06541dd263758a5ae
INCHANGÉ : OUI
```

Ni remplacé, ni mis à jour, ni supprimé, ni supersédé, ni réinterprété. Il **reste** le témoin
historique de clôture de CF-3. Le registre porte désormais **5 lignes, toutes `REGISTERED`** — les
deux nouveaux artefacts **coexistent** avec lui.

---

## §3 · LES DEUX NOUVEAUX ARTEFACTS — PERSISTANCE ET RELECTURE

Produits par le **même** producteur servi, sur la **même** route, à quelques secondes d'intervalle.

| | BOTIFY | VINE (régression) |
|---|---|---|
| registry id | `e91bd0fde8f1423fb60af3ebe1cfc9ba` | `44524322285144f9bc2ae6a34d9b0d69` |
| clé | `reports/production/2026/09/e91bd0fd….pdf` | `reports/production/2026/09/44524322….pdf` |
| octets (registre / **relus indépendamment**) | 68 010 / **68 010** · **MATCH** | 106 720 / **106 720** · **MATCH** |
| sha256 (registre / **recalculée indépendamment**) | `f2672f8ed81699c2…` / identique · **MATCH** | `7a4ec1beff18cd2d…` / identique · **MATCH** |
| en-tête | `%PDF-` | `%PDF-` |
| claims projetés | 1 | 6 |
| audience | `COUNSEL_INVESTOR` · `PUBLIC` non produit | `COUNSEL_INVESTOR` |

Le `status: "stored"` n'est atteignable que par le cycle complet — identité → `INTENDED` → PUT →
GET du même objet → digest recalculé → comparaison → `REGISTERED`. Les octets et les empreintes
ci-dessus ont **en outre** été remesurés hors du producteur, sur ce qui a été reçu.

---

## §4 · BOTIFY — LE DOCUMENT RENDU

**1 page · 68 010 octets · 2 239 caractères · aucune page vide · aucun titre orphelin.**

```
GOVERNED OBSERVATIONS
Governed assertions classified as observations. Each is stated by its own governed
text and carries its foundation trace and cited evidence below it.

  Bounded measurement: recorded event rows and distinct walletAddress values…
  A bounded measurement of the governed corpus recorded 262 event rows…

  FOUNDATION TRACE
    claim BOTIFY-EVENTS-01 v1 · PRIMARY_OBSERVATION · ATTACHED · digest 388acb33…
  GOVERNED EVIDENCE
    SRC-BOTIFY-MEASURE-01 · MACHINE_MEASURED · instrument:il-measure-botify-proceeds-events@1.0.0
    digest 3d87a6f1ab58944db479b6d0… · captured 2026-09-16
    locator r2://interligens-evidence/evidence/3d/3d87a6f1…json

GOVERNED EVIDENCE   (table)
AUDIT INFORMATION
```

**La contradiction a disparu.** `What could not be established` : **absente**. `What we established` :
absente également — la fausse dichotomie est supprimée des deux côtés, pas rééquilibrée.

**Vocabulaire :** aucun de `positive · negative · established · sale · sold · seller · profit ·
revenue · cash-out · liquidation · insider · coordination · fraud · manipulation · dump · USD ·
TigerScore · SmokingGun · riskClass · UNDETERMINED · AVOID · /100 · score`. Aucun `$` hors le
ticker. **`proceeds` : 3 occurrences, TOUTES dans un identifiant technique** — l'identité versionnée
de l'instrument et le nom de la table citée comme borne. **Contexte qualifié : ce n'est pas un FAIL.**

### CLASSIFICATION BOTIFY : **A — SUFFICIENT MINIMAL SHOWCASE**

Les quatre critères tiennent : **cohérent** — le titre et le corps disent la même chose ;
**lisible** — une page, une assertion, aucune rubrique vide ; **auditable** — la chaîne va de la
claim scellée à l'objet gouverné et à son localisateur ; **seconde application du Product Spine** —
le producteur n'a pas une ligne de BOTIFY en lui.

Des trois incompréhensions relevées en BC-0, la première est **résolue** et la deuxième a été
**tranchée par l'architecte** : *ABSENCE OF PROJECTED CLAIMS ≠ ASSERTION OF ABSENCE* — un dossier
minimal n'a pas à s'excuser. Le document ne s'excuse pas, et c'est exactement ce qui était demandé.

---

## §5 · VINE — LE DOCUMENT DE RÉGRESSION

**3 pages · 106 720 octets · 7 580 caractères · aucune page vide · aucun titre orphelin.**
**Les 6 claims projetées sont rendues, toutes avec leur trace :**

```
GOVERNED OBSERVATIONS
  VINE-0xS-01 v2 · VINE-0xS-02 v2 · VINE-0xS-03 v2   PRIMARY_OBSERVATION
  VINE-MEASURE-01 v1                                  PRIMARY_OBSERVATION
  VINE-MULTI-01 v1 (4 pièces)                         PRIMARY_OBSERVATION
GOVERNED CONCLUSIONS
  VINE-CONCLUSION-01 v1 · INFERENCE
    CONSUMED GOVERNED ASSERTIONS → DERIVED_FROM → VINE-MEASURE-01 v1
GOVERNED EVIDENCE · AUDIT INFORMATION
```

### Le point qui fait la régression

`VINE-MEASURE-01` est désormais rendue sous **GOVERNED OBSERVATIONS** — une catégorie neutre — et
**son sens négatif est intact** :

```
« …aucune attribution acteur↔wallet satisfaisant le contrat de fondement et aucun bridge
  wallet↔VINE admissible n'ont été trouvés… »
Causes rendues par l'instrument : NO_FOUNDED_ACTOR_WALLET_ATTRIBUTION ·
NO_GOVERNED_WALLET_CASE_TOKEN_BRIDGE · WALLET_SHAPED_STRINGS_PRESENT_BUT_UNFOUNDED
…et `NOT_ESTABLISHED n'est pas ABSENT` dans la conclusion.
```

> **LE SENS NÉGATIF DE VINE VIENT DE L'ASSERTION, PAS DE LA CATÉGORIE.** C'était l'hypothèse du
> correctif ; le document persisté la confirme.

Aucun verdict global, aucun score, aucun vocabulaire interdit ressuscité. Aucune autorité CF-3
historique modifiée.

### **VINE : REGRESSION PASS**

---

## §6 · DISCOVERED

**Une observation, classée, non corrigée.** Les limites mesurées de BOTIFY — `EVENT LABEL ≠ EVENT`,
`RECORDED WALLET FIELD ≠ WALLET ATTRIBUTION`, `EVENT LABEL ≠ REALIZED PROCEEDS` — existent dans
l'objet gouverné scellé (`limitations[]`) et **n'apparaissent pas dans le document**. Le libellé
actuel de la claim est prudent — il dit `recorded`, nomme les champs comme des champs, et n'affirme
rien au-delà — de sorte que le document reste **honnête par omission**.

Ce n'est **ni un défaut du producteur, ni une raison de déclasser** : rendre ces limites exigerait
qu'une autorité les projette, ce que le modèle ne fait pas aujourd'hui. **Décision de l'architecte,
pas la mienne.** Je ne l'ai pas ouverte.

---

## §7 · DÉCLARATION D'ÉCART

| Autorisé | Exercé |
|---|---|
| déployer par `pnpm deploy:prod` | **exercé une fois**. `npx vercel --prod` non employé |
| établir les six gates avant toute génération | **exercé** — dont la gate 5 établie **deux fois**, par la racine Merkle et par le comportement |
| deux nouveaux artefacts, chacun avec sa propre identité | **exercés** — et ils **coexistent** avec le witness historique |
| preuve de persistance indépendante pour chacun | **exercée** — octets **et** sha256 recalculés hors du producteur, MATCH sur les deux |
| inspecter les PDF persistés | **exercé** — pages, sections, claims, traces, provenance, mise en page, vocabulaire |
| classer BOTIFY A ou B | **A**, et le motif est argumenté contre les quatre critères |
| régression causale D/E | **non rouverte** — déjà démontrée en mutants (`CC-OFFLINE-260`), aucun audit élargi du renderer |
| toucher le witness historique VINE | **non exercé** — vérifié `REGISTERED/NONE`, 107 576 o, `e70bff15…`, INCHANGÉ |
| enrichir BOTIFY · réécrire la claim · mesure v1.1 · SERIAL-12RUGS · assemblage · projection · schéma · DDL · iPhone · paquet RC · hardening · audit sécurité · runtimes historiques | **non ouverts** |
| passe d'inspection T2 | **non anticipée** |

Aucun secret, aucun jeton, aucune URL signée dans ce dossier. Aucune autorité de publication créée —
`PUBLIC` reste 0 et aucun artefact public n'a été produit.
