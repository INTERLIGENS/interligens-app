# BUILD 13 · S3 — LOT DE SUITE · 2026-09-12

Deux chantiers. Mesures d'abord, correction ensuite, contrôle dans les deux sens.
Aucun fichier gelé touché. Aucune remédiation R2.

---

# CHANTIER 1 — LES DEUX GARDES DONT LE SIGNAL SURVIVAIT À LEUR CORRECTION

## 1. LA CAUSE EXACTE, PAR OCCURRENCE — MESURÉE, PAS SUPPOSÉE

L'alternative posée était : « codeSeul ne retire pas les commentaires » ou
« codeSeul n'est pas appelé sur ce chemin ». **Ce n'est ni l'un ni l'autre.**

| garde | état AVANT le correctif | source de la mesure |
|---|---|---|
| `rc-resolveur-citation` | le critère était `git grep -l 'resolveCaseFileRef' -- 'src/app'`, et l'on assertait que la sortie soit vide. Détection sur les **octets bruts**, par un processus externe. | `git show 88ff7f8:__tests__/casefile/rc-resolveur-citation.test.ts` |
| `porteurs-artefact-univers` | `decouvrirPorteurs` testait ses trois motifs sur `src` = le **texte brut** du corpus (`for (const [chemin, src] of corpus)`). | `git show 4917bf2:__tests__/casefile/porteurs-artefact-univers.test.ts` |

**La détection opérait en amont de tout dépouillement, parce qu'aucun
dépouillement n'existait sur ces deux chemins.** `codeSeul` y a été introduit
*par* le correctif, dans le même commit `6f0ec29`, pas avant.

Les deux correctifs sont donc **dans le lot fermé**. À `HEAD = 80fb708`, les
deux gardes sont vertes et le sont pour la bonne raison — vérifié, voir §2.

## 2. CE QUI RESTAIT FAUX, ET QUI EST CORRIGÉ DANS CE LOT

Le dépouillement retenu par le correctif est l'idiome historique du dépôt
(`__tests__/kol-memory/e1-e2-wiring.test.ts:17`) : retirer les **lignes** dont
le premier caractère non blanc est `//`, `*` ou `/*`. **Trois formes de prose
lui échappent** — mesuré :

```
const x = dossier.ref;  // ancien : case_meta.case_id      <- fin de ligne
/* on n'émet plus
   case_meta.case_id ici                                    <- intérieur de bloc
*/
const x = /* case_meta.case_id */ dossier.ref;              <- bloc en milieu de ligne
```

Chacune suffit à ressusciter le faux positif exact qu'on vient de fermer.

**Mesure de l'exposition RÉELLE de ce trou aujourd'hui : nulle.** Sur les 1 662
fichiers de `src/**`, aucun ne porte l'un des quatre motifs
(`resolveCaseFileRef`, `IDENTITE_NON_FONDEE`, `CAPACITE_PRODUCTEUR`,
`CAPACITE_IMPRIMEUR`) sous une forme que le dépouillement faible laisse passer
et que le fort attrape. Le trou est **latent, pas actif** — c'est pour cela
qu'il est corrigé par un critère, pas par une exception.

### Ce que j'ai écrit — terrain libre uniquement

| fichier | rôle |
|---|---|
| `__tests__/casefile/codeSeul.ts` | **nouveau** — le dépouillement, en un seul exemplaire pour les deux gardes. Analyseur à états : il traverse chaînes, gabarits et littéraux de motif sans jamais y entrer en mode commentaire ; il préserve les sauts de ligne (plusieurs critères du dépôt sont sensibles à la ligne). Il exporte aussi `codeSeulLigneALigne`, le **témoin** historique, gardé exprès pour que les tests mesurent le gain. |
| `__tests__/casefile/mention-vs-emission.test.ts` | **nouveau** — la garde de la garde, 18 tests, les deux sens. |
| `__tests__/casefile/rc-resolveur-citation.test.ts` | le critère d'exposition devient une **fonction pure** `exposantsDe(corpus)`, appliquée au dépôt réel (`git ls-files src/app`, fichiers lus entiers) **et** à des corpus synthétiques. `git grep` a disparu du chemin. |
| `__tests__/casefile/porteurs-artefact-univers.test.ts` | importe le dépouillement partagé ; contrôle bidirectionnel étendu aux quatre formes de prose. |

**Le mode de défaillance est choisi et déclaré : en cas de doute, on GARDE le
texte, on ne l'efface jamais.** Une chaîne n'est jamais dépouillée — c'est par
elle que passent les gabarits, les en-têtes HTTP et les clefs d'archive. Une
garde qui garde trop crie à tort ; une garde qui efface trop se tait à tort, et
c'est la panne qu'on ne voit pas.

## 3. LE CONTRÔLE QUI COMPTE — LES DEUX SENS, POUR LES DEUX GARDES

Aucune violation n'a été écrite dans le dépôt pour le démontrer : les critères
sont des fonctions pures, on leur donne des corpus synthétiques.

### `porteurs-artefact-univers` (18 tests, +6)

| sens | cas | attendu | résultat |
|---|---|---|---|
| MORD | route qui **émet** `caseFile.case_meta.case_id` vers un moteur imprimeur | découverte | ✅ |
| MORD | émission portée par une **chaîne** (`JSON.parse`, affectation) | découverte | ✅ |
| NE MORD PAS | commentaire de ligne | verte | ✅ |
| NE MORD PAS | commentaire de **fin de ligne** | verte | ✅ |
| NE MORD PAS | **intérieur de bloc** sans `*` en tête | verte | ✅ |
| NE MORD PAS | bloc refermé en **milieu de ligne** | verte | ✅ |
| MESURE | le témoin ligne à ligne laisse passer **3 des 4** formes | assertion explicite | ✅ |

Les mutants historiques restent : cinquième moteur synthétique découvert,
contrôle négatif (même moteur alimenté par le ref fondé), corollaire
d'amputation, négation d'affectation.

### `rc-resolveur-citation` (17 tests, +9)

| sens | cas | attendu | résultat |
|---|---|---|---|
| MORD | route qui **importe et appelle** `resolveCaseFileRef` | exposée | ✅ |
| MORD | le symbole dans une **chaîne** | exposée (on garde) | ✅ |
| NE MORD PAS | les **cinq** formes de prose | verte | ✅ |
| MESURE | le critère **brut** d'avant comptait les 5 | assertion explicite | ✅ |
| MESURE | le témoin ligne à ligne en laissait passer 3 | assertion explicite | ✅ |
| NON TRIVIAL | le dépôt porte bien une mention en prose dans `src/app/api/pdf/casefile/route.ts` | sinon la propriété serait vraie pour rien | ✅ |

Cette dernière ligne compte : sans elle, une garde verte parce qu'il n'y a plus
rien à voir serait indiscernable d'une garde verte parce qu'elle regarde bien.

### La garde de la garde (`mention-vs-emission`, 18 tests)

Prose retirée (5 formes) · code conservé (7 formes : URL en chaîne, gabarit
d'identité, littéral de motif contenant `//`, balise JSX fermante, division,
en-tête `Content-Disposition`, chaîne contenant `//`) · contrôle négatif (un
dépouillement qui efface tout échoue) · **propriété sur le dépôt réel** : sur
les 1 662 fichiers de `src/**`, le compte de lignes est exact, chaque ligne de
sortie est une sous-suite de son entrée, et toute ligne hors bloc et sans `//`
ressort **identique**. Le filtre « hors bloc » est calculé par une **seconde
implémentation** (blanchiment par expression régulière) : c'est un croisement,
pas une copie de la logique testée.

## 4. LE BALAYAGE DE LA FAMILLE — CHERCHÉ EXPRÈS, UNE FOIS

**Périmètre.** Une garde entre dans la famille si son verdict dépend du TEXTE
d'un fichier du dépôt (`readFileSync` sur `src/`, `prisma/`, `scripts/`,
`.github/`, ou `grep`/`git grep`).

**Méthode — deux sondes, pas une lecture.** Une sonde vitest hors dépôt
(`vi.mock("node:fs")`) intercepte la LECTURE et rend une variante du texte.
Aucun fichier du dépôt n'est modifié.

- **Sonde A — le faux vert.** Les commentaires sont retirés de tout fichier
  source lu. Une garde qui passe au rouge devait son vert à de la prose.
- **Sonde B — le faux rouge.** Les littéraux que le test courant **interdit**
  (`not.toContain`) sont ajoutés en commentaire à la fin de chaque fichier
  source lu. Une garde qui passe au rouge compte une mention comme une émission.

**Le compte.**

| | nombre |
|---|---|
| gardes examinées (famille complète) | **80** — 63 fichiers de test + 17 scripts |
| gardes sondées empiriquement (A et B) | **63** fichiers, 1 271 tests |
| **faux verts** (sonde A) | **0** — 1 512 fichiers source distincts dépouillés en lecture, 63/63 restent verts |
| **concernées** (sonde B) | **6 assertions, dans 4 fichiers** |
| concernées par lecture (hors portée des sondes) | **6 scripts** |

### Les 6 mesurées

| fichier | ligne | assertion | ce qu'un commentaire ferait |
|---|---|---|---|
| `__tests__/data-nature/claims-invariants.test.ts` | 66 | `not.toContain("Estimated retail harm")` | rouge sur une note expliquant le retrait du label |
| `__tests__/kol-memory/wiring.test.ts` | 36 | `not.toContain("function mapDbConfidence")` | rouge sur une note de délégation |
| `__tests__/kol-memory/wiring.test.ts` | 50 | `not.toContain("UnZacja4")` | rouge sur une note citant la clé synthétique |
| `__tests__/kol-memory/wiring.test.ts` | 54 | `not.toContain("const BOTIFY_KOLS")` | rouge sur une note de dé-duplication |
| `__tests__/prebuy/failopen-containment.test.ts` | 299 | `not.toContain("derivePhantomWarning")` | **le fichier DÉFINIT `codeSeul` (l.39) mais cette assertion ne l'applique pas** — le seul cas du dépôt où la réponse est « pas appelé sur ce chemin » |
| `__tests__/security/evidence-bytes-probe.test.ts` | 367 | `not.toContain("redact")` sur le module pur | rouge sur une note expliquant pourquoi le module pur n'a rien à caviarder |

**Direction du défaut : faux POSITIF (rouge à tort), jamais faux vert.** Ces
six gardes crieraient sur de la prose ; aucune ne se tairait sur une émission.
C'est visible, donc corrigible sans urgence. **Non corrigées dans ce lot** —
le brief demandait le compte, pas la correction ; elles sont toutes en terrain
libre et tiennent dans un lot court.

### Les 6 hors portée des sondes (classées par lecture)

| script | forme | verdict |
|---|---|---|
| `scripts/legal-wording-check.sh` | `grep -rn "$term" src/ data/` sur le texte brut | **concerné** — un commentaire citant un terme interdit compte comme exposition. Scanner **consultatif** (sortie 0 quoi qu'il arrive), pas une barrière. |
| `scripts/kol-memory/mutation-check.mjs`, `scripts/security/a9-lock-mutation-check.mjs`, `scripts/intelligence/flake-check.mjs`, `scripts/similarity/mutation-check.mjs`, `scripts/similarity/mutation-check-v2.mjs` | localisent le site de mutation par `original.includes(ancre)` puis `replace` (première occurrence) | **concernés par la forme.** Si l'ancre apparaît d'abord dans un commentaire, le mutant mute de la prose, ne change aucun comportement, et le runner crie « MUTANT SURVIVANT ». Défaillance **bruyante**. Non mesuré empiriquement : la sonde n'atteint pas ces processus. |
| `scripts/guard-offline.sh` | opère sur des NOMS de fichiers (`git diff --name-only`) | hors famille textuelle |
| `scripts/sql/parse-check.ts` | analyseur SQL réel (`@libpg-query/parser`) | **immunisé par construction** — c'est la doctrine bien faite |
| `scripts/prefreeze-check.sh`, `scripts/healthcheck.sh`, `scripts/smoke-demo.sh` | grep sur une sortie de compilateur ou une réponse HTTP | hors famille |

## 5. `s1b-identite-portable.test.ts` — RÉPONSE EXPLICITE

**Il a été corrigé, dans le lot fermé, par `b051d55`** — pas laissé à faire, et
ce n'est pas déduit d'un compte de tests verts. Le texte à `HEAD` :

```ts
// ─── BUILD 13 · S3 — CE TEST ASSERTAIT LE DÉFAUT ─────────────────────────
// Il exigeait `>CANONICAL<` sur `BASE` — une instance SANS bloc canonique.
expect(html).toContain(">PRESET<");
expect(html).not.toContain(">CANONICAL<");
// Adossée à un dossier, la MÊME entrée hérite de la déclaration de surface.
expect(avecDossier).toContain(`>${CASEFILE_AUTHORITY}<`);
```

La propriété visée survit (le document porte un état d'autorité, dans le
vocabulaire du registre) ; ce qui change est **lequel** — il dépend de
l'instance, pas de la surface.

## 6. ÉTAT DE LA SUITE

`443 fichiers · 5 897 tests verts · 1 expected fail · 2 skipped` (5 866 avant ce
lot, +31). `npx tsc --noEmit` : 0 erreur. Aucun fichier gelé modifié ni ajouté.

---

# CHANTIER 2 — INVENTAIRE DES ARTEFACTS EN R2

**Lecture seule.** `ListObjectsV2` et `HeadObject`, rien d'autre. Aucun
`GetObject`, aucune URL signée, aucun Put/Delete/Copy, aucune écriture en base,
aucun octet d'artefact lu ni transcrit. Aucun accès public activé.
Script rejouable : `npx tsx scripts/casefile/inventaire-artefacts-r2.ts`.

## 1. LE CARDINAL

| famille | objets | octets | fenêtre |
|---|---|---|---|
| `reports/production/**` | **2** | 450 346 | 2026-09-12T13:14:37Z → 13:17:20Z |
| `reports/<handle>/**` (archive de veille, moteur `engine.ts`) | 36 | 6 136 320 | 2026-07-21T04:38:57Z → 2026-09-12T04:04:05Z |
| `reports/preview/**`, `reports/development/**` | **0** | — | — |
| **total `reports/`** | **38** | 6 586 666 | |

Par mois sous `reports/production` : **2026-09 → 2 objets**. Il n'y a pas d'autre
mois.

## 2. GOUVERNÉS / ORPHELINS — critère de la route, importé

Le critère n'est pas réécrit : le script **importe** `canonicalRefForMint` puis
`loadCanonicalCaseFile` et les applique dans cet ordre, exactement comme
`src/app/api/pdf/casefile/route.ts:89-91` avant de rendre 404
`no_governed_casefile`. Le mint exact vient de la métadonnée `subject` posée par
`uploadPdf`, **jamais du slug de la clé** : `slugify` met en minuscules et un
mint base58 est sensible à la casse.

| clé | octets | modifié (UTC) | sujet (métadonnée) | gouverné | ref |
|---|---|---|---|---|---|
| `reports/production/2026/09/casefile-1789218877303-so1111…112-664ae987.pdf` | 169 014 | 2026-09-12T13:14:37.669Z | `So11111111111111111111111111111111111111112` | **NON** | — |
| `reports/production/2026/09/casefile-1789219040091-byz9ccz…69xb-057da050.pdf` | 281 332 | 2026-09-12T13:17:20.443Z | `BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb` | oui | `IL-SHILL-BOTIFY-001` |

**Le stock d'orphelins est de 1 objet** : le témoin « avant » lui-même, 169 014
octets, mint wSOL, aucun dossier. Le second est le témoin « après » : mint
BOTIFY canonique, dossier gouverné, produit après la correction.

## 3. LA FENÊTRE TEMPORELLE — et ce qu'elle ne dit pas

- **Capacité d'écrire** : depuis `7f51577` (2026-03-09) — le commit qui a branché
  `uploadPdf` sur cette route.
- **Premier orphelin mesurable** : 2026-09-12T13:14:37Z. **Dernier** : le même.
- **Aucun objet sous `reports/production/` n'est antérieur à aujourd'hui**,
  alors que `reports/<handle>/` porte des objets depuis le 2026-07-21. La règle
  `auto-delete-30d` (active jusqu'au 2026-08-19, rétroactive) n'explique donc
  **pas** cette absence pour la période postérieure au 2026-07-21 : des objets
  de cette période survivent ailleurs dans le même compartiment.
- **⚠️ Limite déclarée** : la période **2026-03-09 → 2026-07-20 n'est pas
  mesurable** depuis l'état actuel du compartiment. Aucun objet, quel que soit
  le préfixe, n'y survit — `auto-delete-30d` a détruit rétroactivement tout ce
  qui dépassait 30 jours le 2026-08-19. Un orphelin écrit en avril ne laisserait
  aucune trace ici. **Je ne peux ni l'affirmer ni l'exclure.**

## 4. ÉNUMÉRABILITÉ DE LA CLÉ — mesurée sur la construction, pas devinée

`src/lib/storage/pdfStorage.ts:65-75` :

```
reports/{env}/{yyyy}/{mm}/{batchPrefix}{timestamp}-{slug}-{hash8}.pdf
```

| composante | dérivation | entropie pour un tiers |
|---|---|---|
| `batchPrefix` | constante `"casefile-"` (la route passe `batchId: "casefile"`) | **nulle** |
| `timestamp` | `Date.now()` en millisecondes | connue à la seconde près si l'instant de la requête est connu → **~10 bits** |
| `slug` | `slugify(mint)` — minuscules, non-alphanumériques → `-`, tronqué à 64 | **nulle** (le mint est public on-chain) |
| `hash8` | **`sha256(octets du PDF).slice(0, 8)`** | 32 bits |

**Le suffixe est DÉRIVÉ, pas aléatoire** — vérifié sur les deux objets : la
métadonnée `sha256` commence bien par le suffixe de la clé
(`664ae987…`, `057da050…`). Aucun `crypto.randomUUID`, aucun sel, **aucun
secret n'entre dans la clé**.

Conséquences, dites nettement :

1. **Quiconque possède les octets du PDF peut recalculer la clé exacte.**
2. Le rendu est déterministe à contenu égal : reproduire l'artefact
   (même mint, même dossier, même moteur) reproduit `hash8`.
3. Ce qui reste inconnu à un tiers est **32 bits + l'horodatage à la
   milliseconde** — une devinette, pas un secret.

**Donc : l'exposition ne dépend PAS d'un secret. Elle dépend entièrement du
fait que le compartiment refuse l'accès anonyme.** C'est le seul contrôle, et
c'est mesuré au point 5.

## 5. EXPOSITION EFFECTIVE — **0**, mesurée

Les deux hôtes publics, en anonyme, sans en-tête d'authentification, sur les
deux clés :

| hôte | méthode | clé | code | octets servis |
|---|---|---|---|---|
| `pub-interligens.r2.dev` | GET | orpheline | **401** | 0 (page « Unauthorized », `text/html`) |
| `pub-interligens.r2.dev` | HEAD | les deux | **401** | 0 |
| `pub-bbfbc08b…r2.dev` (bucket public ACTIF `interligens-static`) | GET/HEAD | les deux | **404** | 0 |
| `pub-interligens.r2.dev/` (listing) | GET | — | **401** | — |
| `{account}.r2.cloudflarestorage.com/` (endpoint S3, anonyme) | GET | — | **400** | 0 |

**Aucun octet d'artefact n'est servi par aucune voie anonyme. Attendu 0,
mesuré 0.** Même résultat que la mesure du 2026-08-20 sur les pièces
`evidence/`. Le domaine public de ce compartiment reste **non activé** — c'est
ce qui tient toute la propriété, et c'est pourquoi l'interdiction permanente
« ne jamais activer l'accès public R2 » n'est pas une précaution de style.

## 6. RECOUPEMENT AVEC L'INVENTAIRE D'AOÛT — **famille DISTINCTE, hypothèse confirmée**

| mesure | valeur aujourd'hui |
|---|---|
| lignes `EvidenceItem` portant un `r2Key` | **1 103** (identique au balayage du 2026-08-19) |
| objets sous `reports/` **sans aucune ligne** `EvidenceItem` | **7** |
| dont connus depuis août | **5** — `reports/deployer_pool/latest.pdf`, `reports/GordonGekko/latest.pdf`, et 3 `reports/deployer_pool/CASE_deployer_pool_2026-09-{09,11,12}.pdf` |
| dont **nouveaux, produits par le défaut** | **2** (les deux artefacts `casefile-`) |
| artefacts `casefile-` portés par une ligne en base | **0 / 2** |

**Ils ne recoupent pas les 5 orphelins d'août** : ceux-là sortent du moteur
d'archive (`src/lib/pdf/engine.ts`, clé `reports/{handle}/CASE_*.pdf`), ceux-ci
du moteur d'artefact (`uploadPdf`, clé `reports/{env}/{yyyy}/{mm}/…`). Producteur
différent, forme de clé différente, préfixe différent. **Sixième famille.**

Le seul trait partagé est **l'absence de ligne en base** — et ce n'est pas une
coïncidence de périmètre : `uploadPdf` n'écrit **aucune** ligne, par
construction. Tout artefact produit par cette voie est structurellement
invisible au registre de preuve et à la sonde d'octets qui s'appuie dessus.

### Sur les « 14 pièces `reviewStatus = excluded` »

**Je n'ai pas retrouvé le document d'août qui pose ce nombre**, et je ne le
reconstitue pas. `EvidenceItem` ne porte pas de colonne `reviewStatus`. Les deux
familles voisines, mesurées aujourd'hui :

| table.colonne | valeur | compte |
|---|---|---|
| `EvidenceSnapshot.reviewStatus` | `excluded` | **20** (aussi : 925 `approved`, 224 `internal`, 2 `pending`) |
| `EvidenceItem.evidentiaryStatus` | `EXCLUDED` | **9** (+ 1 `BYTES_LOST`, 1 094 `NULL`) |

Ni l'une ni l'autre ne vaut 14 aujourd'hui. **Aucune ne recoupe les artefacts
`casefile-`** : ces 2 objets n'ont aucune ligne dans aucune des deux tables.
Si le nombre de référence est `EvidenceSnapshot.reviewStatus = excluded`, il a
augmenté de 14 à 20 depuis août — **observation, pas conclusion** : je n'ai pas
audité cette croissance, elle est hors de ce lot.

## 7. AUCUNE ACTION DE REMÉDIATION

Rien n'a été supprimé, déplacé, réécrit ni re-permissionné. Aucun accès public,
aucune URL signée, aucun contenu d'artefact lu. La décision sur le stock — 1
orphelin, 169 014 octets, non exposé — reste à prendre avec GPT.

---

# CE QUI RESTE EN HOLD, INTOUCHÉ

`report/v2` fail-closed (arbitrage GPT) · contenu de `loadCaseByMint`
(qualification propre) · renommage `case_id` (dette P1 SERVED/SCHEMA SEMANTICS)
· `pdfRenderer.ts`, `templateV2.ts` (passifs).
