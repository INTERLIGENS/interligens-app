# BASELINE PRÉ-CONTAINMENT — état servi en production

**Capturé le 2026-08-16 entre 18:19:43 et 18:23:43 UTC**, contre `https://app.interligens.com`,
sur le code de production `1178ab8` (identique à `main` = `5bed649`).

**Pourquoi ce document existe.** `ScoreSnapshot` est à **0 ligne** et `snapshotScore` n'a
aucun appelant : le système ne conserve aucune trace de ce qu'il a affiché. Une fois le
containment déployé et les six retraits exécutés, **il n'existera plus aucun moyen de savoir
ce qui était servi avant**. Ce fichier est cette trace, et il est la seule.

Lecture seule stricte : uniquement des requêtes `GET` sur des surfaces publiques et des
appels RPC Solana en lecture. Aucune écriture, aucune migration, aucun déploiement.

---

## 0. Commandes de capture

Toutes reproductibles à l'identique.

### 0.1 Scores de tokens

```bash
# 1. Liste des mints : 107 mints canoniques de KolTokenLink + KolProceedsEvent,
#    plus les 2 mints de CA_MAP (BOTIFY, GHOST) = 108.
#    (requête SELECT en lecture seule sur ep-square-band)

# 2. Concentration mesurée par le NOUVEAU module, contre Helius puis le RPC public :
npx tsx --tsconfig tsconfig.json <script>   # src/lib/token/holderConcentration.ts

# 3. Score servi en PRODUCTION, un mint à la fois, 900 ms entre deux appels :
curl -s "https://app.interligens.com/api/v1/score?mint=<MINT>"
```

⚠️ Le paramètre est **`mint`**, pas `address` : une première passe avec `?address=` a rendu
84 réponses `400 invalid_mint` et a dû être refaite. Les chiffres ci-dessous viennent de la
seconde passe, toutes en `HTTP 200`.

### 0.2 Montants de proceeds

```bash
C='Cookie: investigator_session=baseline-capture'
for h in OrbitApe GordonGekko James bkokoski sxyz500 Myrrha 0xBossman Geppetto; do
  curl -s -H "$C" "https://app.interligens.com/api/kol/$h/proceeds"
done
curl -s -H "$C" "https://app.interligens.com/api/kol/leaderboard"
curl -s -H "$C" "https://app.interligens.com/api/explorer"
curl -s -H "$C" "https://app.interligens.com/api/watchlist"
curl -s -H "$C" "https://app.interligens.com/api/v1/kol?limit=100"
```

Le cookie est une valeur arbitraire : le gate nominatif vérifie sa présence, pas sa validité.
C'est la limite documentée du P0-1, hors périmètre de ce chantier.

---

## 1. Les 8 handles porteurs d'un montant publié

État au **2026-08-16 18:23:26–18:23:43 UTC**.

| handle | `/api/kol/{h}/proceeds` | sa propre ventilation | leaderboard `observedProceedsTotal` | `/api/watchlist` `totalProceeds` | `/api/watchlist` `cashout.total` | `/api/v1/kol` `totalProceedsUsd` |
|---|---:|---|---:|---:|---:|---:|
| **OrbitApe** | `found:false` | — | **817 000** | 817 000 | 0 | `null` |
| **GordonGekko** | **579 645** | `{"2025": 94 644,79}` | **579 645** | 579 645 | 40 627,04 | 94 644,79 |
| **James** | `found:false` | — | **380 000** | — | — | `null` |
| **bkokoski** | **210 900** | `{"2025": 900,06}` | **210 900** | 210 900 | 1 076,62 | 900,06 |
| **sxyz500** | **141 594** | `{"2025": 56 417,82 ; "2026": 186,69}` | **141 594** | 141 594 | 4 356,49 | 56 604,51 |
| **Myrrha** | `found:false` | — | **127 036** | — | — | 36,16 |
| 0xBossman | `found:false` | — | 2 932 | — | — | 2 931,71 |
| Geppetto | `found:false` | — | 2 082 | — | — | 2 082,14 |

`found:false` = `"No published proceeds summary available"` — le résumé est en
`reviewStatus='draft'`. **Le leaderboard publie le montant quand même** : c'est l'incohérence
d'interrupteurs décrite au STOP 1, visible ici en direct.

Les trois chiffres concurrents pour une même personne sont lisibles ligne à ligne. Pour
bkokoski : **210 900 $** annoncés, **900,06 $** dans sa propre ventilation servie par la même
réponse, **1 076,62 $** en `cashout.total` sur `/api/watchlist`.

### Agrégats publiés

```
/api/kol/leaderboard  stats : {"publishedCount":32, "totalObservedProceeds":2261189,
                               "totalDocumentedWallets":229, "totalLinkedTokens":9,
                               "profilesWithProceeds":8, "profilesWithStrongEvidence":5}

/api/explorer         stats : {"publishedProfiles":32, "minimumObservedProceeds":2261189,
                               "documentedWallets":164, "linkedLaunches":9,
                               "strongEvidenceCount":5}

/api/explorer         dossiers portant un montant :
   platform  CBEX             12 000 000   acteurs : —
   case      SERIAL-12RUGS       210 900   acteurs : bkokoski
   case      GHOST               932 139   acteurs : planted, GordonGekko, bkokoski, sxyz500
   case      BOTIFY              932 139   acteurs : planted, GordonGekko, DonWedge, bkokoski, sxyz500
```

GHOST et BOTIFY portent **la même valeur** — la somme des `totalDocumented` de GordonGekko,
bkokoski et sxyz500, comptée une fois par dossier. `CBEX` (12 M$) ne vient pas du pipeline
proceeds et n'est pas concerné par le containment.

### Après les six retraits — valeurs attendues

| Mesure | Avant (capturé) | Après (attendu) |
|---|---:|---:|
| `totalObservedProceeds` / `minimumObservedProceeds` | **2 261 189** | **5 014** |
| `profilesWithProceeds` | **8** | **2** |
| dossier BOTIFY | 932 139 | **2 082** |
| dossier GHOST | 932 139 | **0** |
| dossier SERIAL-12RUGS | 210 900 | **0** |

---

## 2. Les tokens dont le score change

> ### ⚠️ CORRECTION DU 2026-08-16 19:01 UTC
>
> **La première version de cette section annonçait 68 bascules ORANGE → RED.
> Ce chiffre était FAUX, et il était faux à cause d'un artefact de méthode.**
> Il est conservé ci-dessous, en §2.2, parce qu'il est la preuve que l'artefact
> existait et qu'il aurait été livré en production.
>
> `getTokenLargestAccounts` rend les plus gros **comptes de tokens**. Sur
> Solana, la courbe de bonding pump.fun, un pool Raydium / Orca / Meteora, un
> vault ou un escrow en sont aussi. Les compter comme des « détenteurs »
> produit une concentration proche de 100 % sur des tokens où **aucune
> personne** ne détient quoi que ce soit.
>
> Blocage posé par David avant déploiement. Correction appliquée, mesure
> refaite. Chiffres définitifs en §2.3.

### 2.1 Ce qui provoque le changement

`public-api.solscan.io` rend **HTTP 404**. Conséquence mesurée : sur les
**84 tokens sondés, `topHolderPct` vaut `null` dans 84 réponses sur 84**. Les
signaux `holders_concentrated_80` (+15), `holders_concentrated_60` (+10) et le
`cluster_risk` (+10) qui en dépend ne se déclenchent donc **jamais**
aujourd'hui. Le remplacement de la source les réactive.

Ce constat-là est inchangé et reste exact.

### 2.2 Première mesure — méthode naïve, résultat DISQUALIFIÉ

Comptage de tous les comptes de tokens, sans distinguer leur propriétaire.

| Mesure | Valeur |
|---|---:|
| Concentration lisible | 94 / 108 |
| top 10 > 80 % du supply | **70** |
| dont exactement 100 % | **10** |
| Scores modifiés | 81 / 84 |
| Verdicts modifiés | 77 |
| dont **ORANGE → RED** | **68** |
| Delta moyen | +21,9 |

**Ces 68 verdicts RED auraient été des verdicts fondés sur un artefact.**
Vérification manuelle sur OLTSESON (`2WnQohaM…pump`) : le compte n°1 détient
958 881 801 tokens, soit 99,9 % du supply, et son propriétaire est une PDA du
programme `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` — l'**AMM pump.fun**.
Le compte n°17 appartient à `LBUZKhRxPF…`, **Meteora DLMM**.

### 2.3 Mesure corrigée — comptes de programme exclus

Classification déterministe, sans liste de programmes à maintenir : un vrai
portefeuille est une autorité dont le compte appartient au **System Program**
(`1111…1111`) et n'est pas exécutable. Tout le reste est une PDA de programme,
et est exclu du numérateur.

Pour les autorités **absentes de la chaîne** — indiscernables entre « PDA jamais
financée » et « portefeuille vidé » — la conclusion est **encadrée** : borne
basse (tous programmes) et borne haute (tous portefeuilles). Si les deux bornes
tombent dans la même bande de signal, la conclusion ne dépend pas de
l'hypothèse et on conclut ; sinon on refuse, et la confiance tombe à `Low` avec
le motif.

| Mesure | Naïf | **Corrigé** |
|---|---:|---:|
| Mesure aboutie | 94 | **83 / 84 (99 %)** |
| Refus explicite | 14 | **1** |
| Tokens à 100 % | **10** | **0** |
| top 10 > 80 % | **70** | **0** |
| top 10 entre 60 et 80 % | 11 | **1** |
| **Scores modifiés** | 81 | **1** |
| **Verdicts modifiés** | 77 | **0** |
| **ORANGE → RED** | **68** | **0** |

**Le déploiement ne fait basculer aucun token.** Un seul score bouge :

| Token | top 10 corrigé | dont programmes | score | verdict |
|---|---:|---:|---|---|
| **ANSEM** | 62,6 % (borne haute 62,6 %) | 0,5 % | 50 → **60** | ORANGE → ORANGE |

C'est une concentration de **portefeuilles réels** — seuls 0,5 % du supply sont
dans un programme. Le signal fait exactement ce pour quoi il a été écrit.

**Ce que l'exclusion a écarté**, tous tokens confondus : AMM pump.fun (81
tokens), Token-2022 (7), Meteora DLMM (4), Raydium CLMM (3), courbe de bonding
pump.fun (2), Orca Whirlpool (1), 2 programmes non étiquetés.

**75 des 83 tokens mesurés ont plus de 50 % de leur supply immobilisé dans un
programme** ; 25 en ont plus de 95 %. L'artefact n'était pas marginal, il était
systémique.

### 2.4 Contrôles

| Token | Naïf | **Corrigé** | dont programmes | Effet |
|---|---:|---:|---:|---|
| **GHOST** (`De4ULouu…pump`) | 93,5 % | **9,5 %** | 84,4 % (AMM pump.fun) | **aucun signal** |
| **BOTIFY** (`BYZ9CcZG…69xb`) | 53,4 % | sous le seuil | — | aucun signal, score 13 GREEN inchangé |

⚠️ GHOST à 93,5 % avait été présenté comme la preuve d'exécution du point 3 au
STOP 2. **C'était l'artefact lui-même.** La concentration réelle des
portefeuilles y est de 9,5 % : le dossier de référence ne bascule pas, et ne
doit pas basculer.

### 2.5 Les 20 tokens les plus touchés par la correction

| symbole | mint | top 10 méthode NAÏVE | top 10 corrigé | dont programmes | verdict avant | verdict après |
| OLTSESON | `2WnQohaM…pump` | 100 % | **0.1 %** | 99.8 % | ORANGE | ORANGE |
| NEEGYCOIN | `2bkkpApC…pump` | 100 % | **0.2 %** | 99.8 % | ORANGE | ORANGE |
| SVG | `5jEBmD6V…pump` | 100 % | **0.1 %** | 99.9 % | ORANGE | ORANGE |
| NEEG | `6ANcFRdR…pump` | 100 % | **0 %** | 99.9 % | ORANGE | ORANGE |
| FARTATM  | `6oGVn8NC…pump` | 100 % | **0.9 %** | 99 % | GREEN | GREEN |
| NEEGYCOIN | `BC8tsBtq…pump` | 100 % | **0.1 %** | 99.7 % | ORANGE | ORANGE |
| SCALER | `BLHdKeaB…pump` | 100 % | **0 %** | 100 % | ORANGE | ORANGE |
| NIBZ | `CbzkNcwV…pump` | 100 % | **0.3 %** | 99.7 % | ORANGE | ORANGE |
| GOGLZ | `D4Eeq1uH…pump` | 100 % | **0.2 %** | 99.8 % | GREEN | GREEN |
| USTC | `F1KW9nmn…pump` | 100 % | **0.1 %** | 99.7 % | ORANGE | ORANGE |
| WHITEBULL | `4xQ94116…pump` | 99.9 % | **0.4 %** | 99.2 % | ORANGE | ORANGE |
| MINER | `GMaQLYXT…pump` | 99.9 % | **0.3 %** | 99.5 % | GREEN | GREEN |
| MELANIA64 | `7pAexbqx…pump` | 99.7 % | **0.5 %** | 99.2 % | ORANGE | ORANGE |
| BOING | `CvrvvCTU…pump` | 99.7 % | **0.9 %** | 98.7 % | GREEN | GREEN |
| BLOWIE | `RNc9b5qK…pump` | 99.7 % | **2.7 %** | 96.9 % | GREEN | GREEN |
| ANONS | `5PCZHS3C…pump` | 99.4 % | **8.7 %** | 90.8 % | ORANGE | ORANGE |
| TAYLOR | `7MkBrQ95…pump` | 99.4 % | **1.8 %** | 97.4 % | GREEN | GREEN |
| THESIS | `H4ZrjWPj…pump` | 99.2 % | **2.7 %** | 96.4 % | ORANGE | ORANGE |
| SEAL | `7GPdC9F5…pump` | 99.1 % | **4 %** | 94.5 % | ORANGE | ORANGE |
| FART | `9bde4zbM…pump` | 99.1 % | **8.6 %** | 90.6 % | ORANGE | ORANGE |

---

## 3. Ce que cette baseline ne couvre pas

- **Les tokens hors corpus.** `/api/v1/score` accepte n'importe quel mint : l'effet réel
  porte sur tout token concentré scanné par un utilisateur, pas seulement sur les 108 mints
  qu'INTERLIGENS a en fiche. Les 108 sont le seul ensemble sur lequel un avant/après est
  vérifiable.
- **Les 14 mints dont la concentration est illisible** (`getTokenLargestAccounts` refuse les
  tokens à très grand nombre de comptes, ou le RPC public rend 429). Ils sortiront en
  `holders_unavailable: true`, confiance `Low` — leur score ne changera pas, mais leur
  réponse gagnera un marqueur de dégradation.
- **Les pages HTML.** Seules les réponses d'API sont capturées. Le rendu des pages
  `/en|fr/kol/*` et de l'Explorer n'est pas photographié.
- **Les 31 PDF archivés de GordonGekko.** Inventoriés et analysés séparément dans
  `docs/AUDIT_BOTIFY_PROCEEDS_2026-08.md` ; ils ne changent pas et ne doivent pas changer.
- **Les scores non liés à la concentration.** Aucun autre facteur n'est modifié par ce lot :
  les 33 snapshots anti-régression bougent en 126 insertions et 0 suppression.

---

*Capturé en lecture seule le 2026-08-16. Aucune écriture, aucun déploiement, aucune migration
au moment de cette capture. Données brutes conservées hors dépôt dans le répertoire de
travail de la session (`measured.json`, `probed.json`, `projected.json`, `kol_*.json`).*
