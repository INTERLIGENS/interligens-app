# R0 CENSUS — Universal Token Resolution V2
Date: 2026-08-26 · Mode: READ_ONLY · Rien écrit dans le code, rien mergé.
Objet: cartographier la brique de résolution token avant construction T1.

---

## 0. Constat d'entrée (à corriger dans l'énoncé)

Il n'existe **pas un** resolver V1. Il en existe **deux indépendants** qui ne se
connaissent pas, plus **trois satellites** qui refont de la résolution à la main.
La V2 n'est donc pas une réécriture : c'est une **unification**.

| # | Resolver | Fichier | Entrée | Sources | DB ? |
|---|---|---|---|---|---|
| A | Canonical (bridge) | `src/lib/token-resolution/resolveCanonicalToken.ts` | cashtags + adresses | DexScreener, Helius RPC | **aucune** |
| B | Scan public | `src/app/api/scan/resolve/route.ts` | ticker (query string) | KolTokenLink, KolPromotionMention, DexScreener, CoinGecko | oui (2 tables) |
| C | Vision OSINT | `src/lib/osint/vision/resolveTokens.ts` | capture d'écran | double-vision + verifyMint on-chain | non |
| D | Shill | `src/lib/shill-correlation/resolve.ts` | `tokenMint` texte | `CA_MAP` (26 entrées, hardcodé), texte du tweet | non |
| E | Hyperliquid | `src/app/api/resolve/hyper-token/route.ts` | tokenId 0x…32 | API Hyperliquid `spotMeta` | non |

A et B partagent leurs primitives via `src/lib/marketProviders.ts`
(`normalizeSymbol`, `tickerMatchType`, `GENERIC_TICKERS`, `searchDexScreenerPairs`,
`ResolvedTokenCandidate`) — c'est le seul point de non-divergence actuel, et il est
volontaire (commentaire en tête de `scoreTokenCandidate.ts`). **C, D et E n'en
utilisent rien.** D possède sa propre notion de mint valide (`looksLikeSolanaMint`
dans `shill-correlation/buyers.ts`) alors que A a `normalizeSolanaMint.ts` et B a
`isScanableAddress` inline : **trois regex base58 distinctes** pour la même chose.

---

## 1. V1 PATH — les deux chemins réels

### Chemin A (bridge, DB-blind)
```
promoteWatcherSignalsToDraft.ts:203
  → resolveCanonicalToken({cashtags, addresses, chainHint:'solana', ...}, telemetry)
      L1 explicit CA  → dexScreenerByMint()  → sinon rpcConfirmMint() (Helius)
      L4 CONFLICT     → searchDexScreenerPairs(cashtag) si symboles divergent
      L2/L3 cashtag   → searchDexScreenerPairs() → decideCashtag()
  → {status, confidence, method, canonicalMint, candidates[], limitations[]}
```
Statuts : `RESOLVED | AMBIGUOUS | UNRESOLVED | CONFLICT`. Confidence `LOW|MODERATE|HIGH`.
Chaîne auto-résolue : **SOL uniquement** (`KNOWN_AUTORESOLVE_CHAINS`).
Règle d'or : jamais HIGH tant que ≥2 candidats plausibles.

### Chemin B (scan public, DB-first)
```
/fr/demo + /en/demo (page.tsx:416 / :422)
  → GET /api/scan/resolve?ticker=XXX
      T1 curated  : KolTokenLink WHERE visibility='public'   (SQL brut)
      T2 mentions : KolPromotionMention                       (SQL brut)
      T3 DexScreener  — seulement si interne vide
      T4 CoinGecko    — seulement si interne + DexScreener vides
  → {status:'resolved|ambiguous|not_found', selected, candidates[], + alias legacy}
```
Chaînes supportées : SOL, ETH, BSC, TRON, BASE, ARBITRUM, HYPER (mapping
`normalizeChain` / `PLATFORM_TO_CHAIN`). **Plus large que A.**

> Les deux modèles de statut ne sont pas les mêmes (`RESOLVED` vs `resolved`,
> `CONFLICT` n'existe pas côté B). C'est la première collision à trancher.

---

## 2. CALLERS

**A** — un seul appelant : `src/lib/watcher-bridge/promoteWatcherSignalsToDraft.ts`.
Aucun autre. La promesse du header (« three consumers : scan, watcher-bridge,
retail-upload ») **n'est pas tenue** : scan et retail-upload n'appellent pas A.

**B** — deux appelants front (`src/app/fr/demo/page.tsx`, `src/app/en/demo/page.tsx`),
plus une dépendance documentaire depuis REFLEX (`src/lib/reflex/inputRouter.ts`,
`types.ts` : un `TICKER` est censé être résolu « downstream via /api/scan/resolve »
— **le câblage n'existe pas encore**, c'est un commentaire, pas du code).

**marketProviders** (primitives + `getMarketSnapshot`) est lu par 17 fichiers, dont
`api/v1/score`, `api/partner/v1/*`, `api/mobile/v1/scan`, `api/pdf/casefile`,
`api/report/v2`, `lib/scan/buildTigerInput/solana.ts`, `lib/publicScore/computeVerdict.ts`.
**C'est le vrai blast radius.** Toute V2 qui touche `marketProviders.ts` touche le
scoring public, l'API partenaire et le PDF.

---

## 3. Tables token — CONSULTÉES vs NON CONSULTÉES

### Consultées aujourd'hui par un resolver
| Table | Par | Comment |
|---|---|---|
| `KolTokenLink` | B | SQL brut, `visibility='public'`, LIKE sur symbole normalisé |
| `KolPromotionMention` | B | SQL brut, LIKE sur symbole normalisé |

**C'est tout. Deux tables sur ~21 modèles token/KOL.**

### NON consultées (le gisement de la V2)
| Table | Contenu | Clé de jointure disponible | Pourquoi c'est un manque |
|---|---|---|---|
| `TokenCaseFile` (`token_casefiles`) | dossiers publiés, `contractAddresses` **jsonb** (typé `String` en Prisma) | mint via `jsonb_each_text` | Un token avec case file publié est le signal le plus fort du produit, et le resolver l'ignore. Déjà requêté ailleurs — `src/lib/prebuy/casefile.ts` |
| `TokenPriceTracker` | prix courant/peak/dumpPct, `@@unique([chain, contractAddress])` | (chain, CA) | Cache prix déjà persisté, jamais lu par la résolution ; seuls les crons/seeds y touchent |
| `KolTokenInvolvement` | `@@unique([kolHandle, chain, tokenMint])`, `@@index([chain, tokenMint])` | (chain, mint) | Relation KOL↔token la plus riche (promotion/buy/sell/proceeds), invisible du resolver |
| `TokenLaunchMetric` | `@@unique([chain, tokenMint])`, concentration, holders | (chain, mint) | Signal rug déjà calculé, non exposé |
| `TokenScanAggregate` | `mint` PK, `scanCount` | mint | Popularité de scan = tie-breaker de désambiguïsation gratuit, non utilisé |
| `KolCrossLink`, `WatcherCampaignKOL` | contexte campagne | handle/campaignId | Contexte de résolution disponible côté A (`watcherCampaignId` est **reçu en entrée et jamais utilisé**) |
| presets `MINT_TO_CASEFILE_PRESET` | BOTIFY / VINE, hors DB | mint | Cases phares sans ligne DB (cf. mémoire *BOTIFY two mints*) |
| `CA_MAP` (`src/lib/kol/proceeds.ts`) | 26 paires ticker→CA hardcodées | ticker | Seule table ticker→CA « curée » du repo, utilisée uniquement par D |

Points morts notés dans le code de A : `rawText`, `postTimestamp`, `kolHandle`,
`watcherCampaignId` sont dans `ResolveCanonicalInput` et **ne servent à rien**.

---

## 4. Types / caches

- **Types** : `ResolvedTokenCandidate` (marketProviders) → `TokenCandidate`
  (scoreTokenCandidate, découplage volontaire) → sérialisation route B avec
  **alias legacy `symbol`/`address` à ne jamais retirer** (demo pages).
  `TokenResolution` (vision, C) et `MintResolution` (shill, D) sont des types
  totalement disjoints. **4 formes de candidat pour un même concept.**
- **Caches** :
  - `marketProviders._cache` — Map en mémoire process, TTL 10 min, clé `chain:mint`,
    porte `getMarketSnapshot` uniquement. **Pas de cache sur la résolution elle-même.**
  - HTTP : route B renvoie `s-maxage=120, stale-while-revalidate=60`.
  - CoinGecko : `next: {revalidate: 600 / 3600}`.
  - A : **aucun cache** → chaque candidat du bridge repaie DexScreener/Helius.
  - `TokenPriceTracker` = le seul cache persistant, non branché.

## 5. Providers externes

| Provider | Appelé par | Timeout | Clé |
|---|---|---|---|
| DexScreener `tokens/v1/solana/{mint}` | A | 8 s | non |
| DexScreener search | A, B (via `searchDexScreenerPairs`) | — | non |
| Helius RPC `getAccountInfo` | A (fallback), C (`verifyMintOnChain`) | 8 s | `HELIUS_API_KEY` |
| CoinGecko search + coins | B (tier 4) | — | non |
| GeckoTerminal | `getMarketSnapshot` | — | non |
| Hyperliquid `spotMeta` | E | — | non |

Aucun rate-limit partagé, aucun budget commun, aucune télémétrie hors
`ApiCallTelemetry` optionnel de A.

## 6. API routes

- `GET /api/scan/resolve?ticker=` — publique, contrat figé par snapshot.
- `GET /api/resolve/hyper-token?tokenId=` — publique, isolée.
- Pas de route pour A : le resolver canonique n'est **pas exposé**.

## 7. Consumers TigerScore / scan

Aucun ne consomme un resolver — ils consomment tous un **mint déjà connu** :
`/api/scan/solana?mint=` et les 19 sous-routes `/api/scan/*`,
`lib/scan/buildTigerInput/{solana,evm}.ts`, `lib/publicScore/computeVerdict.ts`,
`api/v1/score`, `api/partner/v1/*`, `api/mobile/v1/scan`, `api/pdf/casefile`.
Le couplage passe exclusivement par `getMarketSnapshot(chain, mint)`.

**Conséquence** : la V2 peut être construite sans toucher au scoring, tant qu'elle
sort un `(chain, mint)` et **ne modifie pas `getMarketSnapshot`**.

## 8. Chemins gelés (guards actuels)

`FORBIDDEN_PATTERNS` de `scripts/guard-offline.sh` — pertinents ici :
```
^prisma/            ^src/app/api/       ^src/components/
^src/lib/scoring/   ^src/lib/tigerscore/  ^src/lib/watcher/
^src/lib/pdf/       ^src/lib/evidence/    ^src/lib/kol/
^src/lib/auth/      ^src/lib/security/    ^src/middleware/  ^src/proxy.ts
```

| Élément V2 | Statut |
|---|---|
| `src/lib/token-resolution/` | **LIBRE** (confirmé guard l.360) |
| `src/lib/marketProviders.ts` | **LIBRE** (confirmé guard l.239) |
| `src/lib/watcher-bridge/` | **LIBRE** |
| `src/lib/osint/`, `src/lib/shill-correlation/`, `src/lib/prebuy/` | libres (hors fichiers de sécu nommés) |
| `src/app/api/scan/resolve/route.ts` | **GELÉ** — exemption existante l.243 / l.303 |
| toute autre route `src/app/api/**` | **GELÉ** — exemption nominative requise |
| `src/lib/kol/proceeds.ts` (CA_MAP) | **GELÉ** (`^src/lib/kol/`) |
| `prisma/schema*.prisma` | **GELÉ** + verrou A9 : aucune migration Prisma possible, SQL via Neon uniquement |
| `src/components/scan/TokenPicker.tsx` | **GELÉ** (`^src/components/`) |

## 9. Risques de collision

1. **Snapshot anti-régression** — `__tests__/anti-regression/scan-resolve.snapshot.test.ts`
   verrouille la réponse de B sur 10 tickers, en mockant `prisma.$queryRawUnsafe`
   **appel par appel** (curated puis mentions). Ajouter une 3ᵉ source DB à B casse
   le mock avant même de casser le snapshot.
2. **Invariant visibility** — `__tests__/security/koltokenlink-visibility-invariant.test.ts`
   exige une **liste blanche `visibility='public'`** sur toute lecture publique de
   `KolTokenLink`, et vérifie que chaque exemption pointe un fichier qui lit vraiment
   la table. Une V2 qui lit KolTokenLink hérite de cette contrainte.
3. **PERSON-type jamais retail-visible** + `nominativeApiGate` : la V2 ne doit pas
   faire remonter de handle KOL dans une réponse publique (aujourd'hui seul
   `kolCount`, agrégé, est toléré — cf. `nominativeApiGate.ts:58`).
4. **Alias legacy** `symbol` / `address` dans la sérialisation de B — les pages demo
   les lisent. Retrait = 500 côté front.
5. **Divergence de statut** A (`RESOLVED/CONFLICT`) vs B (`resolved/ambiguous/not_found`) :
   toute fusion doit choisir un modèle et adapter, jamais renommer en place.
6. **3 regex base58 concurrentes** (`normalizeSolanaMint`, `isScanableAddress`,
   `looksLikeSolanaMint`) : les unifier touche `^src/lib/kol/` indirectement (D).
7. **`contractAddresses` de TokenCaseFile est jsonb mais typé `String`** en Prisma —
   accès obligatoire en `$queryRawUnsafe` (cf. mémoire *Prisma schema drift*).
8. **BOTIFY deux mints** (`UnZacija4` réel vs `UnZacja4` synthétique) : une
   normalisation « corrective » casserait la jointure casefile ou les snapshots.
9. **Coût providers** : brancher A sur plus de candidats sans cache multiplie les
   appels DexScreener/Helius (budget ~$279/mois, X API déjà au plafond mensuel).

---

## 10. PROPOSED V2 BOUNDARY

**Nom** : `src/lib/token-resolution/v2/` — nouveau sous-dossier, zone libre du guard.

**Ce que V2 possède**
- Un type canonique unique `TokenIdentity { chain, mint, symbol, name, confidence,
  status, method, sources[], evidence{} }` et un `ResolutionRequest` unique
  (ticker | CA | tokenId | handle+contexte).
- Une couche **DB-first** lisant en lecture seule les tables aujourd'hui ignorées :
  `TokenCaseFile` (jsonb), `TokenPriceTracker`, `KolTokenInvolvement`,
  `TokenLaunchMetric`, `TokenScanAggregate`, + `KolTokenLink`/`KolPromotionMention`.
- Un étage providers **derrière une interface injectable** (DexScreener / Helius /
  CoinGecko / GeckoTerminal / Hyperliquid), avec cache et compteur d'appels
  obligatoires — plus de `fetch` nu.
- La normalisation d'adresse unifiée (une seule regex par chaîne).

**Ce que V2 NE touche PAS (frontière dure)**
- `getMarketSnapshot` et le reste de `marketProviders.ts` : **lecture seule**, les
  primitives sont importées, jamais modifiées. Protège les 17 consommateurs scoring.
- `src/app/api/scan/resolve/route.ts` : gelé. La route ne devient un *adaptateur*
  vers V2 qu'en R-final, sous exemption guard nommée, avec le snapshot vert **avant**
  bascule.
- Le schéma Prisma et la DB : **aucune écriture, aucune migration** en V2. Tout est
  read-only ; si une table de cache s'avère nécessaire, elle passe par Neon SQL
  Editor en additif, décision séparée.
- `src/lib/kol/proceeds.ts` (CA_MAP) : lu par import, jamais réécrit.
- TigerScore / PDF / partner API : hors périmètre total.

**Ordre d'intégration proposé**
1. V2 en pur additif, non appelé (aucun risque, aucune exemption guard).
2. Bascule de A (`promoteWatcherSignalsToDraft`) sur V2 — zone libre, un seul appelant,
   comparaison A/V2 possible en shadow.
3. Bascule de D (shill) et branchement de REFLEX `TICKER` — zone libre.
4. **Seulement ensuite**, adaptateur de B sous exemption guard, snapshot conservé.
5. C (vision) et E (hyperliquid) : absorbés en dernier, ce sont des cas de bord.

**Question ouverte à trancher avant R1** — une seule : V2 doit-elle rester
**read-only DB** (position par défaut retenue ci-dessus, zéro risque) ou est-elle
autorisée à **persister ses résolutions** (nouvelle table `TokenResolutionCache`)
pour cesser de repayer DexScreener à chaque passage du bridge ? La réponse ne
bloque pas R1 : je construis read-only, le cache reste un adaptateur enfichable.
