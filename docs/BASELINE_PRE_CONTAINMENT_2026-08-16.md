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

### 2.1 Ce qui provoque le changement

`public-api.solscan.io` rend **HTTP 404**. Conséquence mesurée : sur les **84 tokens sondés,
`topHolderPct` vaut `null` dans 84 réponses sur 84**. Les signaux
`holders_concentrated_80` (+15), `holders_concentrated_60` (+10) et le `cluster_risk` (+10)
qui en dépend ne se déclenchent donc **jamais** aujourd'hui.

Le remplacement de la source les réactive.

### 2.2 Ampleur — le point à lire avant de déployer

| Mesure | Valeur |
|---|---:|
| Mints du corpus mesurés | **108** |
| Concentration lisible | 94 (14 indisponibles) |
| top 10 > 80 % du supply | **70** |
| top 10 entre 60 et 80 % | **11** |
| Tokens sondés en production | **84** (tous `HTTP 200`) |
| **Score modifié** | **81** |
| **Verdict modifié** | **77** |
| dont **ORANGE → RED** | **68** |
| dont GREEN → ORANGE | **9** |
| `cluster_risk` nouvellement déclenché | **61** |
| Delta moyen sur les tokens modifiés | **+21,9** |

> ⚠️ **Le déploiement fait basculer 68 tokens en RED d'un coup.**
> Ce n'est pas un ajustement à la marge. C'est la correction d'une sous-évaluation
> systématique, mais elle sera visible immédiatement par tout utilisateur bêta, et le
> volume la rend difficile à présenter comme un simple correctif.

**Limite de la mesure, à connaître.** `getTokenLargestAccounts` compte des *comptes de
tokens*, y compris la courbe de bonding pump.fun et les pools de liquidité. Sur un token
mort dont l'essentiel du supply est resté dans la courbe, la concentration mesurée approche
100 % sans qu'un détenteur humain concentre quoi que ce soit — **10 tokens du corpus sont
exactement à 100 %**. La mesure est factuellement exacte ; son interprétation comme
« risque de concentration » est une décision produit, pas une évidence technique. Le
comportement est celui que le signal a toujours été censé produire — il était simplement
éteint depuis que la source est morte.

### 2.3 Contrôles

| Token | Avant | top 10 mesuré | Après | Commentaire |
|---|---:|---:|---:|---|
| **BOTIFY** (`BYZ9CcZG…69xb`) | score 13, GREEN | **53,4 %** | **13, GREEN — inchangé** | sous le seuil de 60 % : aucun signal, aucun effet |
| **GHOST** (`De4ULouu…pump`) | voir tableau §2.4 | **93,5 %** | +15 puis +10 | le dossier de référence bascule |

BOTIFY est le contrôle négatif : il prouve que le seuil discrimine réellement et que la
réactivation n'ajoute pas un delta à tout le monde.

### 2.4 Tableau complet — 81 tokens, avant → après

Projection calculée depuis les signaux réellement servis en production et les règles de
`src/lib/tigerscore/engine.ts` (`holders_concentrated_80` +15 au-delà de 80 %,
`holders_concentrated_60` +10 entre 60 et 80 %, `cluster_risk` +10 dès 3 signaux forts
simultanés — les signaux forts étant `liquidity_very_low`, `liquidity_low`,
`token_young_7d`, `token_young_30d` et la concentration elle-même).

**Ce sont des projections, pas des mesures post-déploiement.** Elles seront à confirmer sur
la production après l'étape 3.

| # | symbole | mint | score avant | verdict avant | top 10 mesuré | +concentration | +cluster_risk | score après | verdict après |
|---|---|---|---:|---|---:|---:|---:|---:|---|
| 1 | CYBERUNC2077 | `2jFYTf1j…pump` | 62 | ORANGE | 98 % | +15 | +10 | **87** | **RED** |
| 2 | PWOG | `3LhFf7hj…pump` | 62 | ORANGE | 98.3 % | +15 | +10 | **87** | **RED** |
| 3 | FOMOPERPS | `4Zu4zbJN…pump` | 62 | ORANGE | 96.5 % | +15 | +10 | **87** | **RED** |
| 4 | SEALON | `72uv3iPK…pump` | 62 | ORANGE | 92.7 % | +15 | +10 | **87** | **RED** |
| 5 | RAMPAGE | `7Xdftxa2…pump` | 62 | ORANGE | 98.4 % | +15 | +10 | **87** | **RED** |
| 6 | OPENLIVING | `7icY7J9U…pump` | 62 | ORANGE | 97 % | +15 | +10 | **87** | **RED** |
| 7 | MELANIA64 | `7pAexbqx…pump` | 62 | ORANGE | 99.7 % | +15 | +10 | **87** | **RED** |
| 8 | KING | `9A5QWVQu…pump` | 62 | ORANGE | 93.6 % | +15 | +10 | **87** | **RED** |
| 9 | LUNA | `9ZDZYJNm…pump` | 62 | ORANGE | 97.6 % | +15 | +10 | **87** | **RED** |
| 10 | FART | `9bde4zbM…pump` | 62 | ORANGE | 99.1 % | +15 | +10 | **87** | **RED** |
| 11 | HOOKPAD | `B3NtgzdS…pump` | 62 | ORANGE | 97.9 % | +15 | +10 | **87** | **RED** |
| 12 | SH | `CG82j2ad…pump` | 62 | ORANGE | 99 % | +15 | +10 | **87** | **RED** |
| 13 | PUMPFROG | `DKHbtzo7…pump` | 62 | ORANGE | 94.1 % | +15 | +10 | **87** | **RED** |
| 14 | MUDWIG | `EjbK4C7B…pump` | 62 | ORANGE | 86.4 % | +15 | +10 | **87** | **RED** |
| 15 | NEMO | `GJ5S5Nxh…pump` | 62 | ORANGE | 97.1 % | +15 | +10 | **87** | **RED** |
| 16 | THESIS | `H4ZrjWPj…pump` | 62 | ORANGE | 99.2 % | +15 | +10 | **87** | **RED** |
| 17 | OLTSESON | `2WnQohaM…pump` | 57 | ORANGE | 100 % | +15 | +10 | **82** | **RED** |
| 18 | DREAMCOIN | `3UGJHrLq…pump` | 57 | ORANGE | 95.7 % | +15 | +10 | **82** | **RED** |
| 19 | HITLERHAUS | `47pWDLGY…pump` | 57 | ORANGE | 98.7 % | +15 | +10 | **82** | **RED** |
| 20 | WAGMI | `5agBrU27…pump` | 57 | ORANGE | 98.3 % | +15 | +10 | **82** | **RED** |
| 21 | REDDIT | `5tYCSAFH…pump` | 57 | ORANGE | 97.8 % | +15 | +10 | **82** | **RED** |
| 22 | NIGGAHOUSE | `6Sk1NgWh…pump` | 57 | ORANGE | 96.7 % | +15 | +10 | **82** | **RED** |
| 23 | MEMOLUTION | `6a4TCQoC…pump` | 57 | ORANGE | 96.9 % | +15 | +10 | **82** | **RED** |
| 24 | JIMHOOD | `6wCpTaxL…pump` | 57 | ORANGE | 95.7 % | +15 | +10 | **82** | **RED** |
| 25 | SEAL | `7GPdC9F5…pump` | 57 | ORANGE | 99.1 % | +15 | +10 | **82** | **RED** |
| 26 | EMBERCAT | `94jVx7XR…pump` | 57 | ORANGE | 90.5 % | +15 | +10 | **82** | **RED** |
| 27 | DLM | `AEgyF6YL…pump` | 57 | ORANGE | 97.8 % | +15 | +10 | **82** | **RED** |
| 28 | LENNY  | `ApMrbYXQ…pump` | 57 | ORANGE | 81.6 % | +15 | +10 | **82** | **RED** |
| 29 | MURPHY | `AxQSeybK…pump` | 57 | ORANGE | 86.4 % | +15 | +10 | **82** | **RED** |
| 30 | CHIBBI | `BSiKCMF2…pump` | 57 | ORANGE | 88.3 % | +15 | +10 | **82** | **RED** |
| 31 | USTC | `F1KW9nmn…pump` | 57 | ORANGE | 100 % | +15 | +10 | **82** | **RED** |
| 32 | PODUM | `GAcMLQLW…pump` | 57 | ORANGE | 98.5 % | +15 | +10 | **82** | **RED** |
| 33 | CATDANCE | `HcNWQPmv…pump` | 57 | ORANGE | 90.8 % | +15 | +10 | **82** | **RED** |
| 34 | BBC | `MXHTEbFc…pump` | 57 | ORANGE | 98.1 % | +15 | +10 | **82** | **RED** |
| 35 | ANSEMOTHY | `cdxxwBUA…pump` | 57 | ORANGE | 85.4 % | +15 | +10 | **82** | **RED** |
| 36 | RAVECAT | `mNzssXQ9…pump` | 57 | ORANGE | 95.4 % | +15 | +10 | **82** | **RED** |
| 37 | ANONS | `5PCZHS3C…pump` | 53 | ORANGE | 99.4 % | +15 | +10 | **78** | **RED** |
| 38 | NEEGYCOIN | `2bkkpApC…pump` | 52 | ORANGE | 100 % | +15 | +10 | **77** | **RED** |
| 39 | RIANG | `4hUC4L81…pump` | 52 | ORANGE | 97.1 % | +15 | +10 | **77** | **RED** |
| 40 | WHITEBULL | `4xQ94116…pump` | 52 | ORANGE | 99.9 % | +15 | +10 | **77** | **RED** |
| 41 | KNOX | `4z3fS34V…pump` | 52 | ORANGE | 98 % | +15 | +10 | **77** | **RED** |
| 42 | SVG | `5jEBmD6V…pump` | 52 | ORANGE | 100 % | +15 | +10 | **77** | **RED** |
| 43 | NEEG | `6ANcFRdR…pump` | 52 | ORANGE | 100 % | +15 | +10 | **77** | **RED** |
| 44 | NEEGYCOIN | `BC8tsBtq…pump` | 52 | ORANGE | 100 % | +15 | +10 | **77** | **RED** |
| 45 | SCALER | `BLHdKeaB…pump` | 52 | ORANGE | 100 % | +15 | +10 | **77** | **RED** |
| 46 | NIBZ | `CbzkNcwV…pump` | 52 | ORANGE | 100 % | +15 | +10 | **77** | **RED** |
| 47 | COAL | `EDWMuNrF…pump` | 52 | ORANGE | 97.9 % | +15 | +10 | **77** | **RED** |
| 48 | RIZZCATE | `FiNd8X5h…pump` | 52 | ORANGE | 99.1 % | +15 | +10 | **77** | **RED** |
| 49 | BIND | `9Tvkqa2C…BiND` | 32 | GREEN | 98.2 % | +15 | +10 | **57** | **ORANGE** |
| 50 | NORMOIDS | `57HrLUAX…2vmh` | 27 | GREEN | 88.7 % | +15 | +10 | **52** | **ORANGE** |
| 51 | PRESCIENCE | `Dwm6hJL8…h2Yi` | 27 | GREEN | 98.2 % | +15 | +10 | **52** | **ORANGE** |
| 52 | VICTOR | `6J4fmDst…pump` | 57 | ORANGE | 72.9 % | +10 | +10 | **77** | **RED** |
| 53 | OMOJI | `7WmG1z9y…pump` | 57 | ORANGE | 79.8 % | +10 | +10 | **77** | **RED** |
| 54 | JORDAN | `8TLxeYnn…pump` | 57 | ORANGE | 78.8 % | +10 | +10 | **77** | **RED** |
| 55 | FORTNITE | `ERRZ89iF…pump` | 57 | ORANGE | 78.9 % | +10 | +10 | **77** | **RED** |
| 56 | TARDIMALS | `77rUTY78…pump` | 52 | ORANGE | 67.1 % | +10 | +10 | **72** | **RED** |
| 57 | BR1 | `8T6rjb3e…pump` | 52 | ORANGE | 78.2 % | +10 | +10 | **72** | **RED** |
| 58 | WAGMI | `AKsiofzf…pump` | 52 | ORANGE | 74 % | +10 | +10 | **72** | **RED** |
| 59 | TURTLENECK | `F6Tbmw6b…pump` | 52 | ORANGE | 68 % | +10 | +10 | **72** | **RED** |
| 60 | FROGE | `FVZhiS1u…pump` | 52 | ORANGE | 63.3 % | +10 | +10 | **72** | **RED** |
| 61 | WIG | `Gs2LiwnY…pump` | 52 | ORANGE | 70.6 % | +10 | +10 | **72** | **RED** |
| 62 | MOX | `3Knru44n…pump` | 67 | ORANGE | 96.1 % | +15 | +0 | **82** | **RED** |
| 63 | BEANIE | `6ZyA44Kz…pump` | 67 | ORANGE | 94.3 % | +15 | +0 | **82** | **RED** |
| 64 | FARMER | `ARW3iLiJ…pump` | 67 | ORANGE | 85.8 % | +15 | +0 | **82** | **RED** |
| 65 | TREE | `Eqq9cQMF…pump` | 67 | ORANGE | 98.6 % | +15 | +0 | **82** | **RED** |
| 66 | PUMPERS | `Hi2VTgk4…pump` | 67 | ORANGE | 89.1 % | +15 | +0 | **82** | **RED** |
| 67 | CLOUT | `5jUwEEKM…pump` | 62 | ORANGE | 95.9 % | +15 | +0 | **77** | **RED** |
| 68 | CATSEM | `5upMUvnB…pump` | 62 | ORANGE | 89.2 % | +15 | +0 | **77** | **RED** |
| 69 | MEMECOIN | `7NG9CYXh…pump` | 62 | ORANGE | 89.7 % | +15 | +0 | **77** | **RED** |
| 70 | TORTUGA | `8v23vrVz…pump` | 62 | ORANGE | 95.7 % | +15 | +0 | **77** | **RED** |
| 71 | PLANSEM | `j8RdRQ8t…pump` | 62 | ORANGE | 91.9 % | +15 | +0 | **77** | **RED** |
| 72 | WSG | `3zPBkMhk…pump` | 50 | ORANGE | 93.9 % | +15 | +0 | **65** | ORANGE |
| 73 | GHOST | `De4ULouu…pump` | 42 | ORANGE | 93.5 % | +15 | +0 | **57** | ORANGE |
| 74 | FARTATM  | `6oGVn8NC…pump` | 30 | GREEN | 100 % | +15 | +0 | **45** | **ORANGE** |
| 75 | TAYLOR | `7MkBrQ95…pump` | 30 | GREEN | 99.4 % | +15 | +0 | **45** | **ORANGE** |
| 76 | BOING | `CvrvvCTU…pump` | 30 | GREEN | 99.7 % | +15 | +0 | **45** | **ORANGE** |
| 77 | GOGLZ | `D4Eeq1uH…pump` | 30 | GREEN | 100 % | +15 | +0 | **45** | **ORANGE** |
| 78 | MINER | `GMaQLYXT…pump` | 30 | GREEN | 99.9 % | +15 | +0 | **45** | **ORANGE** |
| 79 | BLOWIE | `RNc9b5qK…pump` | 30 | GREEN | 99.7 % | +15 | +0 | **45** | **ORANGE** |
| 80 | TG | `3SDjJTCS…gsCs` | 17 | GREEN | 83.2 % | +15 | +0 | **32** | GREEN |
| 81 | ANSEM | `9cRCn9rG…pump` | 50 | ORANGE | 62.7 % | +10 | +0 | **60** | ORANGE |

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
