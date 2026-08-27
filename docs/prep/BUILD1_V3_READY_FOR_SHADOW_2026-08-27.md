# BUILD 1 V3 — READY FOR SHADOW HOOK
## Doctrine ratifiée, implémentée, mesurée
### 2026-08-27

**État : `READY_FOR_SHADOW_HOOK`.** Le module est complet, testé et rejoué sur le
corpus. **Rien n'est câblé en runtime.** Le hook shadow attend le fondateur — il
n'est pas posé ici.

Branche `feat/cc-offline-109-token-resolution-v2` · rien mergé, rien déployé, rien poussé.
Neon `ep-square-band` en lecture seule · aucune écriture DB · aucune migration.

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `vitest run` | **324 fichiers · 3 793 tests · 0 échec** (2 ignorés) |
| module V3 seul | **161 tests · 0 échec** |
| `eslint src/lib/token-resolution` | **0 erreur** |
| `guard-offline.sh` | ✅ aucun chemin interdit modifié |
| Backtest 91 cas | **0,68 s · double-run bit-à-bit identique** |

---

## LE RÉSULTAT

> ### FRR factuel : **0 / 31 résolutions — 0,0 %. MAINTENU.**

| Périmètre | V1 | V2 | V3 (A+B+C) | **V3 RATIFIÉ** |
|---|---|---|---|---|
| **Factuel — 74 GOLDEN** | 23,3 % | 26,1 % | 0,0 % | **0,0 % (0/31)** |
| Doctrinal — 10 `PENDING_POLICY` | 100 % | 100 % | 100 % (3/3) | **2/2 — et les deux sont le comportement ratifié** |

Et les trois cas doctrinaux ont **exactement** le comportement arbitré :

| Cas | Ratifié | Rendu | |
|---|---|---|---|
| **E7b** | AMBIGUOUS si ≥2 CA plausibles | `AMBIGUOUS / multiple_explicit_addresses / LOW` | ✅ |
| **S04** | la curation ne décide pas l'identité sur une autre chaîne | `AMBIGUOUS / contract_identity + cross_chain` | ✅ |
| **I3** | contrat unique + périmètre + zéro rival → RESOLVED, MODERATE max | `RESOLVED / coingecko / MODERATE` | ✅ |
| **R22** | postérieur **hors tolérance** → EXCLUDE, pas LOW | mécanisme vérifié ; à 30 j l'écart de R22 reste **dans** la tolérance, il résout | ✅ voir note |

> **Note R22.** Ce qui a été ratifié est le **mécanisme** : hors tolérance, le
> candidat est ÉCARTÉ (`temporally_impossible`), jamais servi avec une confiance
> dégradée. C'est vérifié par test. Le cas R22 lui-même, avec la tolérance de
> 30 j également ratifiée, reste **sous** le seuil : il résout. Les deux
> décisions sont cohérentes entre elles — la seconde décide du sort de la
> première. Le corpus le compte encore comme faux parce que son étiquette
> `PENDING_POLICY` date d'avant l'arbitrage.
>
> **Même remarque pour I3** : sa « vérité » corpus (`AMBIGUOUS`) est l'option
> qui n'a **pas** été retenue. Les deux dernières « fausses résolutions » sont
> donc des étiquettes périmées, pas des défauts. **Le corpus doit être
> ré-étiqueté avant d'être gelé en test.**

---

# 1. ARCHITECTURE

Six étages, ordre non négociable. Chacun a une responsabilité unique et un seul
endroit où il peut dire non.

```
                    ResolutionRequest
        ticker? · addresses? · rawText? · caseIds?
        allowedChains (OBLIGATOIRE) · observedAt? · audience
                            │
   ┌────────────────────────▼────────────────────────┐
   │ 1. EXTRACTION        address.ts · chain.ts      │  formes, chaînes, marqueurs
   ├─────────────────────────────────────────────────┤
   │ 2. TIER INTERNE      sources/db.ts (READ-ONLY)  │  dossiers · curation · mentions
   │                      sources/caseIndex.ts       │  index de dossiers (UR-12)
   ├─────────────────────────────────────────────────┤
   │ 3. MARCHÉ            providers/ (cache imposé)  │  seulement si nécessaire
   ├─────────────────────────────────────────────────┤
   │ 4. CHAÎNE            providers/helius.ts        │  si le marché n'indexe rien
   ├─────────────────────────────────────────────────┤
   │ 5. ENRICHISSEMENT    sources/db.ts              │  jamais créateur de candidat
   ├─────────────────────────────────────────────────┤
   │ 6. DÉCISION          candidates → identity      │  E5 · D2 · périmètre
   │                      → temporal → confidence    │  SEUL à dire RESOLVED
   └────────────────────────┬────────────────────────┘
                            ▼
   status · confidence · method · callerSupport · selected
   candidates[] · excluded[] · conflicts[] · limitations[] · telemetry
```

**Trois invariants structurels, tenus par les types, pas par la discipline :**

1. **Identité = `(chain, contract)`.** Le symbole est une étiquette. La fusion,
   le classement et les conflits ne l'utilisent jamais pour identifier.
   Invariant exécutable `assertContractIdentity`, gardé par un **mutant**.
2. **Le cache est dans la signature.** `ProviderContext` l'exige ; aucun chemin
   ne permet d'appeler un provider sans lui.
3. **`allowedChains` est obligatoire.** Pas de défaut implicite : un module
   Solana-only et un module multi-chaînes n'ont pas la même réponse correcte, et
   ce n'est pas au résolveur d'en décider.

---

# 2. FILES — 24 fichiers, 4 281 lignes (hors tests)

| Fichier | L | Rôle |
|---|---|---|
| `index.ts` | 76 | **`@canonical-resolver`** — surface publique unique |
| `types.ts` | 336 | contrats : candidat, requête, résultat, conflits, télémétrie |
| `policy.ts` | 197 | **les 12 seuils ratifiés**, chacun avec sa décision et son cas témoin |
| `chain.ts` | 107 | table de chaînes unique (squelette alphanumérique) |
| `address.ts` | 186 | une validation par chaîne · Tron avant Solana · marqueurs éditoriaux |
| `symbol.ts` | 68 | matching de ticker — importe `marketProviders`, ne le modifie jamais |
| `identity.ts` | 115 | **E5** — collisions de contrat + invariant exécutable |
| `temporal.ts` | 200 | **D2** — règle temporelle canonique, deux régimes de preuve |
| `candidates.ts` | 340 | fusion → cloisonnement → périmètre → temps → classement |
| `confidence.ts` | 717 | conflits + décision. **Seul à pouvoir dire RESOLVED** |
| `resolve.ts` | 448 | orchestrateur des six étages |
| `sources/db.ts` | 591 | lecteurs **READ-ONLY** · deux listes blanches `visibility` |
| `sources/caseIndex.ts` | 109 | **UR-12** — index de dossiers, type nominal `CaseId` |
| `providers/*` | 647 | 7 fichiers — adapters, cache, budget, instrumentation, fixtures |
| `providersPublic.ts` | 7 | ré-export ciblé (les adapters restent internes) |

Le V1 (`src/lib/token-resolution/*.ts`) porte `@legacy-v1-do-not-extend`.
**Il n'existe aucun `v2`.** Huit invariants de nommage ferment l'ambiguïté de
chemin, dont : *aucun fichier n'importe à la fois le V1 et le V3*.

---

# 3. PROVIDERS

Aucun `fetch` nu. Un seul fichier appelle le réseau (`providers/http.ts`) ;
tout le reste reçoit un `HttpClient` injecté.

| Provider | Opérations | TTL | Clé | Rôle |
|---|---|---|---|---|
| **DexScreener** | `byAddress` · `searchTicker` | 5 min | non | marché + `pairCreatedAt` (borne d'activité D2) |
| **Helius RPC** | `getAccountInfo` | 30 min | `HELIUS_API_KEY` | existence on-chain du mint |
| **CoinGecko** | `search` + `coins/{id}` | 10 min / 60 min | non | catalogue multi-chaînes, **sans marché** |
| **Hyperliquid** | `spotMeta` | 30 min | non | `tokenId` (0x+32) → contrat EVM |

**Chemin unique `instrumentedCall`**, trois garanties dans cet ordre :

1. **cache** — mémoire de process, TTL, plafond d'entrées, dédoublonnage des
   appels concurrents, **échec jamais mis en cache** ;
2. **budget** — plafond dur par provider **lu sur la politique passée à
   `resolveToken`**. Au-delà : refusé, compté (`budgetRefusals`), remonté en
   limitation. Jamais omis en silence ;
3. **comptage** — `providerCalls`, `providerCacheHits` et **`providerFailures`**
   séparés par provider.

> `providerFailures` est nouveau et porte la **frontière A** : c'est ce qui
> distingue « il n'y a pas de rival » de « je n'ai pas pu regarder ». Sans lui,
> une panne se lisait comme une absence de contradiction.

---

# 4. UR-1 → UR-13

| # | Invariant | Ce qui casserait le test |
|---|---|---|
| **UR-1** | une seule table de chaînes | perdre `"BNB Chain"`, `"unknown"`, ou une casse de la prod |
| **UR-2** | une validation d'adresse par chaîne | abaisser la casse d'un base58 · dédoubler une identité EVM · laisser passer `PENDING:BREAD` · tester Solana avant Tron · deviner la chaîne d'un hex EVM |
| **UR-3** | une identité = un candidat | fusionner par symbole · sommer `kolCount` · laisser le marché renommer un token documenté |
| **UR-4** | cloisonnement d'audience | servir un `curated_draft` en public · faire fuiter un handle |
| **UR-5** | classement déterministe | ex æquo résiduel · ordre dépendant de l'arrivée · confiance devant pertinence |
| **UR-6** | cache obligatoire **+ frontière A** | second appel identique · TTL non respecté · **échec mis en cache** · appels concurrents non dédupliqués · **échec provider confondu avec un résultat vide** |
| **UR-7** | adapters sur réponses réelles | accepter `chainId:"robinhood"` · deux paires pour une identité · confondre « absent » et « indéterminé » · **retomber sur le réseau** |
| **UR-8** | interne avant marché | appeler DexScreener quand l'interne répond **et couvre le périmètre** · atteindre CoinGecko après une réponse DexScreener · **émettre autre chose qu'un SELECT** · lecture `KolTokenLink` sans liste blanche |
| **UR-9** | règle d'or | HIGH avec deux exacts liquides · auto-résoudre un générique · résoudre sous le plancher · plafonner par chaîne |
| **UR-10** | conflit ticker ↔ adresse | manquer le conflit · le servir résolu · **le lever sur simple accord de symbole** |
| **UR-11** | mint neuf non indexé **+ frontière A** | perdre un pump.fun de quelques minutes · confondre « pas de clé RPC » et « n'existe pas » · **résoudre par absence de rival non vérifiée** |
| **UR-12** | sémantique d'index | consommer un index `caseId` comme un mapping ticker · `$SERIAL-12RUGS` résolvant vers BOTIFY · le contrat fantôme `$GHOST` |
| **UR-13** | **le plancher de liquidité ne gouverne pas l'identité explicite** | refuser d'identifier un token mort dont le CA a été fourni |

---

# 5. TESTS — 161 sur le module

| Fichier | L | Contenu |
|---|---|---|
| `universal-resolution.test.ts` | 690 | UR-1 → UR-11 |
| `v3-doctrine.test.ts` | 657 | E5 · **mutant symbol-only** · D2 · tier curated · J3 · I3 · multi-chaînes |
| `ratified-doctrine.test.ts` | 482 | **UR-13 · E7b · R22 · S04 · B3/C5 · frontière A · frontière B** |
| `abc-fixes.test.ts` | 242 | règle temporelle canonique · les trois curseurs, deux régimes chacun |
| `ur12-index-semantics.test.ts` | 236 | UR-12, comportemental **et** statique |
| `falseCriticalCorpus.ts` | 234 | 5 cas sur contrats réels de la prod |
| `module-naming.test.ts` | 117 | 8 invariants de nommage |
| `frr-corpus.test.ts` | 88 | mesure et **imprime** le FRR |
| `mutants/symbolOnlyIdentity.ts` | 49 | le canari |

## Les tests sont porteurs — 6 mutations dirigées sur les règles ratifiées

| Mutation | Effet |
|---|---|
| E7b — conflit multi-CA désactivé | **2 rouges** |
| Frontière A — garde de dégradation désactivée | **2 rouges** |
| Frontière B — auto-contradiction non promue en CONFLICT | **1 rouge** |
| S04 — curation redevient autorité toutes chaînes | **1 rouge** |
| I3 — retour au régime strict | **2 rouges** |
| UR-13 — le plancher s'applique à l'identité explicite | **2 rouges** |

Toutes restaurées, suite verte. S'y ajoutent les mutations antérieures (E5, D2,
budget, invariant E5, index par ticker), toutes vérifiées rouges.

---

# 6. BACKTEST FINAL — 91 cas, 0,68 s

| Métrique | V1 | V2 | **V3 RATIFIÉ** | vs `8ae2e27` |
|---|---|---|---|---|
| Résolutions émises | 30 | 23 | **31** | = |
| **FALSE RESOLUTION RATE** | 23,3 % | 26,1 % | **0,0 %** | **0 % maintenu** |
| Fausses résolutions CRITICAL | 7 | 6 | **0** | = |
| Accuracy stricte | 59,5 % | 50,0 % | **71,6 %** | 64,9 % → **71,6 %** |
| Accuracy « refus correct » | 59,5 % | 50,0 % | **82,4 %** | 75,7 % → **82,4 %** |
| Recall | 52,3 % | 38,6 % | **70,5 %** | = |
| Résolutions correctes | 23 | 17 | **31** | = |
| Abstentions correctes | 21 | 20 | **22** | 17 → 22 |
| **Refus sous-informés** | 3 | 5 | **0** | **5 → 0** |
| Conflict rate | 0 % | 1,4 % | **16,2 %** | 9,5 % → 16,2 % |
| Ambiguity rate | 21,6 % | 23,0 % | 21,6 % | 28,4 % → 21,6 % |
| Not-found rate | 14,9 % | 44,6 % | 20,3 % | = |
| Survie au blackout | 14 | 0 | **15** | = |
| Dépendance providers | 46,7 % | 100 % | **100 %** | 54,8 % → **100 %** ⚠️ |

**Le gain est dans l'étiquette autant que dans le chiffre.** Les cinq
« refus sous-informés » ont disparu : ils sont devenus des refus **exacts**.
`E4`, `E4b`, `E5`, `K6`, `S01`, `S05` rendent maintenant `CONFLICT` là où le
corpus attend `CONFLICT` — c'est la frontière B qui les convertit.

## Par famille

| Famille | n | V1 | V2 | **V3** | faux V3 |
|---|---|---|---|---|---|
| golden | 9 | 8 | 4 | **9** | 0 |
| ambiguous | 3 | 3 | 3 | **3** | 0 |
| **collision** | 14 | 11 | 6 | **14** | 0 |
| historical | 8 | 4 | 1 | **4** | 0 |
| **adversarial** | 11 | 5 | 8 | **11** | 0 |
| dead_recent | 6 | 0 | 3 | **3** | 0 |
| cashtag_form | 6 | 4 | 6 | **6** | 0 |
| address_input | 3 | 1 | 2 | **2** | 0 |
| fake_ticker | 3 | 3 | 3 | **3** | 0 |
| generic | 2 | 2 | 1 | **1** | 0 |
| **provider_outage** | 9 | 3 | 0 | **5** | 0 |

`collision` **14/14** et `adversarial` **11/11** — parfaits. `provider_outage`
passe de 3 à 5 : la frontière A transforme des fausses certitudes en refus justes.

## Sweep temporel — la bande s'est resserrée

| Tolérance | Fausses rés. | Faux rejets | `historical` | Accuracy | `P01` (+45 j) | `P02` (+200 j) |
|---|---|---|---|---|---|---|
| 0 j → 30 j | 0 | 0 | **4/8** | 82,4 % | `NOT_FOUND` | `NOT_FOUND` |
| 45 j → 180 j | 0 | 0 | **4/8** | 82,4 % | `RESOLVED` | `NOT_FOUND` |
| **270 j → 365 j** | 0 | 0 | **3/8** ⚠️ | 81,1 % | `RESOLVED` | `RESOLVED` |
| 730 j → ∞ | **1 (`D2`)** | 0 | 3/8 | 81,1 % | `RESOLVED` | `RESOLVED` |

> **Nouveau, à signaler.** La zone plate n'est plus [0 j, 365 j] mais
> **[0 j, 180 j]** : à 270 j, `S10` (migration de token) bascule en `AMBIGUOUS`
> et `historical` retombe de 4/8 à 3/8. **Le défaut ratifié de 30 j reste très à
> l'intérieur** — facteur 6 avant la première dégradation, facteur 24 avant le
> premier danger. Rien à changer ; c'est une borne plus serrée qu'annoncée au
> checkpoint, et il vaut mieux le savoir.

## Blackout total (91 cas, tous providers en TIMEOUT)

| | V1 | V2 | **V3** |
|---|---|---|---|
| `RESOLVED` | 19 | 0 | 18 |
| **`CONFLICT`** | 0 | 0 | **10** |
| `AMBIGUOUS` | 5 | 0 | 6 |
| `NOT_FOUND` | 49 | **91** | 57 |
| Verdicts encore justes | 27 | 0 | **32** |

V3 conserve **dix verdicts de conflit** sous panne totale : la contradiction
reste signalée au lieu de retomber à « rien trouvé ».

---

# 7. RÉGRESSION V1 — un seul cas

| | Cas | |
|---|---|---|
| **V1 seul correct** | `J2` | **1 cas** |
| **V3 seul correct** | `E4`, `E4b`, `E5`, `E7`, `F1`, `G5`, `G6`, `H1`, `K6`, `R06`, `R07`, `R17`, `R18`, `R19`, `S01`, `S02`, `S05`, `S08` | **18 cas** |
| Faux pour les deux | `D1`, `D2`, `D3`, `F2`, `F3`, `F4`, `H2`, `K1`, `K2`, `K3`, `K5`, `S09` | 12 cas |

**`J2`** — `$PEPE` avec un lien curé. V3 refuse par principe de blocklist
(`genericTickerNeverAutoResolves`, ratifié `true`). **Arbitrage assumé, pas un
défaut** : à `false`, on gagne `J2` et on perd `J1` et `J3` en fausses
résolutions. Le vrai correctif — autoriser une source curée à lever la blocklist —
est une question distincte, non posée au checkpoint.

Sur les 12 « faux pour les deux », **aucun n'est une fausse résolution du V3** :
ce sont des ratés sûrs (plancher de liquidité, panne sans source interne,
historique sans trace).

> **Deux régressions apparues puis corrigées en cours d'implémentation.** Ma
> première version de S04 consultait le marché dès que le périmètre débordait la
> couverture interne — et laissait entrer le **bruit de marché de la chaîne déjà
> curée**. `C4` et `R03` (deux collisions que seule la curation sait casser)
> tombaient alors en `AMBIGUOUS`. La doctrine dit « la curation ne décide pas
> l'identité sur une **autre** chaîne », pas « la curation ne décide plus rien » :
> les résultats de marché sur une chaîne déjà couverte par la curation sont
> désormais ignorés. `C4` et `R03` sont revenus corrects.

---

# 8. COÛTS ATTENDUS

## Le coût réel de S04

**Dépendance providers : 46,7 % (V1) → 100 % (V3).** C'est le prix direct de la
doctrine S04 : tant que le périmètre déclaré contient une chaîne qu'aucune source
interne ne couvre, la curation ne peut pas trancher sans regarder.

Dans le backtest, chaque cas déclare `DEFAULT_SCOPE = SOL/ETH/BSC/BASE/ARBITRUM`
— cinq chaînes, jamais couvertes par une curation mono-chaîne. **D'où 100 %.**

> **Le périmètre déclaré est devenu un levier de coût direct.** Un appelant qui
> déclare `allowedChains: ["SOL"]` et dont la curation couvre Solana **ne paie
> aucun appel supplémentaire** — vérifié par test. C'est la première décision à
> prendre au moment du câblage, avant toute optimisation.

## Ordre de grandeur par requête

| Chemin | Appels sortants | Note |
|---|---|---|
| Ticker, tier interne couvre le périmètre | **0** | cas mono-chaîne curé |
| Ticker, périmètre débordant | **1** DexScreener search | coût S04 |
| Ticker, interne vide | 1 search (+1 CoinGecko si vide) | inchangé |
| CA Solana explicite | 1 `byAddress` (+1 Helius si non indexé) | inchangé |
| CA EVM sans indication de chaîne | jusqu'à **4** sondages, **bornés au périmètre déclaré** | déclarer la chaîne les supprime |
| Identifiant Hyperliquid | 1 `spotMeta`, mis en cache pour l'exécution | — |

**Plafond dur** : 40 appels par provider et par exécution (ratifié), lu sur la
politique passée. Au-delà : refusé, compté, annoncé.

**Cache** : mémoire de process, TTL 5–60 min selon l'opération, dédoublonnage des
appels concurrents. Sur Vercel, cron et requête web ne partagent pas d'instance :
le cache borne le coût d'**une exécution**, pas celui de la journée. Un cache
persistant exigerait une table, donc une migration — hors périmètre.

**Providers sans clé** : DexScreener, CoinGecko et Hyperliquid sont keyless.
Seul Helius consomme le quota existant, et seulement quand le marché n'indexe
rien. Aucun budget nouveau à ouvrir.

## Coût DB

Lecture seule, **9 requêtes au maximum** par résolution (3 découverte par
adresse, 3 découverte par ticker, 5 enrichissement — mutualisées). Toutes des
`SELECT`, vérifié par test. Aucune écriture, aucune migration.

---

# 9. CHEMIN GELÉ NÉCESSAIRE POUR LE HOOK SHADOW

C'est la seule décision qui reste, et elle appartient au fondateur.

## Option 1 — shadow dans le bridge : **AUCUN chemin gelé**

`src/lib/watcher-bridge/promoteWatcherSignalsToDraft.ts` **n'est pas gelé**
(`FORBIDDEN_PATTERNS` ne couvre pas `^src/lib/watcher-bridge/`). Un appel V3 en
parallèle de `resolveCanonicalToken`, dont le résultat est **journalisé et
jeté**, ne demande **aucune exemption de guard**.

* Portée : un seul appelant, exécution en cron, comparaison V1 ↔ V3 sur du
  trafic réel.
* Coût : selon `allowedChains` déclaré — `["SOL"]` pour le bridge ⇒ coût quasi nul.
* Risque : nul si le résultat n'est pas consommé. **C'est le chemin recommandé.**

## Option 2 — shadow sur le scan public : **chemin gelé requis**

`src/app/api/scan/resolve/route.ts` est couvert par `"^src/app/api/"`. Il faut :

1. une **exemption nommée** dans `scripts/guard-offline.sh` — lui-même gelé,
   donc via la voie de maintenance déclarée (branche dédiée, guard seul dans le diff) ;
2. le snapshot `__tests__/anti-regression/scan-resolve.snapshot.test.ts` **vert
   avant** bascule. Attention : il mocke `$queryRawUnsafe` **appel par appel** —
   il casse avant le snapshot dès qu'une source DB s'ajoute ;
3. l'invariant `koltokenlink-visibility` reste satisfait (il l'est : V3 porte
   deux listes blanches énumérées).

## Ce que le shadow ne peut PAS faire sans décision supplémentaire

**Persister ses comparaisons.** Écrire un journal shadow en base exigerait une
table, donc une migration — explicitement hors périmètre. Trois voies :
journalisation applicative (aucune migration), fichier/objet R2, ou une table
additive décidée séparément.

---

# 10. ROLLBACK

Le module est **inerte** : aucun consommateur ne l'appelle. Le risque de
rollback est, aujourd'hui, structurellement nul.

| Situation | Geste | Portée |
|---|---|---|
| **Avant tout hook** (état actuel) | rien à faire — V3 n'est pas exécuté | nulle |
| Annuler l'implémentation ratifiée | `git revert` du commit de ratification | revient au comportement `8ae2e27` (A+B+C), FRR factuel déjà 0 |
| Annuler tout le module | `git branch -D feat/cc-offline-109-token-resolution-v2` | rien n'a jamais touché `main` |
| **Après un hook shadow** | retirer l'appel V3 du fichier appelant | V1 n'a jamais cessé d'être le chemin de production |
| Neutraliser une règle sans revert | passer une `policy` au point d'appel | 12 seuils, tous injectables par requête |

**Aucune écriture DB n'a eu lieu** — donc aucun rollback de données n'est
concevable. Aucune migration n'existe. `marketProviders.ts`, `getMarketSnapshot`,
la route B et `src/lib/kol/proceeds.ts` n'ont jamais été modifiés.

**Point de retour propre** : `8ae2e27` (V3 A+B+C, avant ratification).
**Tête actuelle** : le commit de ratification décrit par ce rapport.

---

# 11. CE QUI RESTE OUVERT

1. **Ré-étiqueter le corpus** avant de le geler en test : `I3` et `R22` portent
   encore des vérités d'avant l'arbitrage, et sont comptés comme faux à tort.
2. **`minLiquidityUsdForAutoResolve`** — ratifié à 1 000, mais reste le seul
   curseur qui déplace encore du factuel (4 GOLDEN entre 0 et 1 000, tous des
   tokens rugués ou mourants). Le domaine utile est connu ; l'arbitrage
   recall/certitude reste à instruire s'il doit bouger.
3. **`curatedRequiresChainBinding`** — 0 bascule au backtest. Trou de corpus, pas
   curseur mort : `T03` prouve que la frontière fonctionne.
4. **Décalage mint → paire réel en production** — la donnée qui rendrait le choix
   dans la bande temporelle mesurable au lieu d'arbitraire. Toujours absente.
5. **Dépendance providers à 100 %** — conséquence assumée de S04. Le levier
   existe et il est gratuit : déclarer un `allowedChains` étroit.

---

## STOP — `READY_FOR_SHADOW_HOOK`

Le module est prêt. **Rien n'est câblé en runtime.** Le hook attend une décision
du fondateur sur l'option 1 (bridge, aucun chemin gelé) ou l'option 2 (scan
public, exemption de guard requise).
