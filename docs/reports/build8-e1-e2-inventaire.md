# BUILD 8 — E2 / E1 · inventaire avant exemption

Branche `feat/cc-offline-153-botify-identity-handle-case`, depuis `main = 7c17b3f`.
**Écrit avant toute mutation et avant toute demande d'exemption.**

---

## E2 — inventaire du littéral 43 caractères

Le littéral `BYZ9CcZGKAXmN2uDsKcQMM9UnZac**ja4**vWcns9Th69xb` apparaît à
**56 emplacements dans 33 fichiers** — nettement plus que les 10 annoncés. La
majorité n'interprète pas cette chaîne comme un mint. Classement complet :

### A. Consommateurs qui traitent le 43 comme un MINT — à corriger

| # | fichier | rôle | gelé ? |
|---|---|---|---|
| 1 | `src/app/api/casefile/route.ts:6` | constante propre + clé de `CASE_DB` — **le KO signalé** | **oui** `^src/app/api/` |
| 2 | `src/app/api/casefile/public/route.ts:43` | `MINT_TO_PRESET` — **surface retail** | **oui** |
| 3 | `src/app/api/casefile/pdf/route.ts:44` | `MINT_TO_PRESET` — PDF admin | **oui** |
| 4 | `src/lib/caseDb.ts:5` | `MINT_TO_CASE` → `botify.json`, via `loadCaseByMint` — **8 routes** | non |
| 5 | `lib/caseDb.ts:5` | duplicat racine, importé par `scan/timeline/[address]` | non |
| ~~6~~ | ~~`src/lib/casefile/presets.ts:150`~~ | `MINT_TO_CASEFILE_PRESET` — **EXCLU après mesure, voir §D** | non |

Les 8 routes servies par `loadCaseByMint` (`v1/score`, `v1/scan-context`,
`pdf/casefile`, `scan/solana`, `scan/timeline`, `partner/v1` ×3) sont corrigées
**sans exemption** : elles importent, elles ne déclarent pas.

### B. Écarté — NON consommateurs de mint

| catégorie | fichiers | motif |
|---|---|---|
| autorité de l'identité | `src/lib/kol-memory/tokenIdentity.ts:50` | **c'est la déclaration** de la clé synthétique. Correcte telle quelle |
| données de dossier | `data/cases/botify.json`, `src/data/cases/botify.json` | `case_meta.mint` est descriptif ; **aucun lookup n'y est indexé** |
| démo / presets | `src/app/{[locale],en,fr}/demo/*`, `en/demo/review`, `src/lib/demo/presets.ts` | adresses de démonstration, pas des lookups de dossier |
| page publique | `src/app/en/cases/botify/evidence/page.tsx` | affichage |
| fixtures & tests | `score-v1.snapshot`, `scan-resolve.snapshot`, `similarity/subject.ts`, `s3-corpus.ts`, `qa/fixtures.ts`, `graph`, `solanaGraph`, `extractAddresses`, `intel-vault` ×2, `community/validate`, `demo/url`, `casefileUrl` | corpus gelés et tests de **détection de chaîne** — les toucher changerait ce qu'ils mesurent |
| documentation | `README.md`, `docs/PARTNER_API_V1.md`, `docs/qa.md`, `docs/prep/*`, `docs/reports/build7-*` | historique, à ne pas réécrire |
| scripts racine | `scan-planted.mjs`, `scan-gordon-*.mjs` | scripts ponctuels hors application |
| faux positif | `src/lib/casefile/pdfGeneratorPublic.ts:259` | sous-chaîne dans un **faux hash de transaction**, pas un mint |

### D. Écarté APRÈS MESURE — `src/lib/casefile/presets.ts`

Ce fichier figurait dans mon périmètre initial. Je l'ai **retiré**, et c'est un
test de doctrine ratifiée qui me l'a fait voir — pas une relecture.

`MINT_TO_CASEFILE_PRESET` alimente `findCasefilePresetsByAddress`
(`src/lib/token-resolution/v3/sources/db.ts:418`), dont le commentaire porte une
position **ratifiée** :

> « Dossiers phares sans ligne en base (BOTIFY / VINE). Le recensement note que
> BOTIFY porte DEUX mints — l'un réel, l'autre synthétique — et qu'ils ne sont
> pas une coquille à corriger : **on lit la table telle quelle, sans
> normaliser**. »

Recléer la carte fait apparaître un candidat `casefile_preset` pour le mint
canonique. Sous panne de provider, token-resolution v3 passait alors de
`AMBIGUOUS` à `RESOLVED` — **5 cas de `ratified-doctrine.test.ts` rougissaient**,
dont « jamais RESOLVED par ABSENCE de rival ».

Vérifié dans les deux sens : le test passe sans mon changement, échoue avec.

**Pourquoi l'exclusion est la bonne réponse, et pas un contournement.** Cette
carte sert la détection de **présence de risque** (PRE-BUY GUARD, surfaces
admin/shadow) — pas le verdict retail. E2 vise le verdict retail, qui vit dans
`/api/casefile` et `/api/casefile/public`. La toucher aurait modifié une
doctrine ratifiée **hors périmètre**, ce que l'arbitrage interdit explicitement.

L'écart est consigné par un test nommé plutôt que laissé muet, et part au
backlog : le rapprocher demande un arbitrage sur token-resolution v3, pas une
correction d'identité.

### C. Écarté après examen — signalé, pas corrigé

`src/app/api/osint/signals/route.ts:51` — `q === <43>` marque `isBotify` dans
une **recherche**, pas dans un verdict de dossier. Le corriger coûterait un
quatrième fichier gelé pour une surface qui n'est l'autorité de rien. Écarté au
titre de « aucun chemin au cas où » ; consigné au backlog.

### Le mécanisme du KO, confirmé par lecture

```
/api/casefile?mint=<44>  → CASE_DB[<44>] = undefined → claims=[] → score 0  → GREEN
/api/casefile?mint=<43>  → CASE_DB[<43>] = 8 claims  → garde-fou ≥6 → 70 → RED
```

Et une conséquence directe de BUILD 8 que je dois assumer : `kolHandleToMint`
rend désormais le 44 canonique. Les routes dont la carte est encore clé sur le
43 reçoivent donc une clé qu'elles ne connaissent pas. **Le correctif D3 était
juste, son câblage était incomplet.**

---

## E1 — inventaire de la discordance de casse

`src/app/api/kol/[handle]/route.ts:17` abaisse la casse
(`.trim().toLowerCase()`), `buildKolCanonicalSnapshot` fait un `findUnique`
strict sur `handle`. Tout handle portant une majuscule est structurellement
injoignable.

Mesuré sur `ep-square-band` le 2026-09-07, en lecture seule :

| | |
|---|---|
| profils publiés | 32 |
| **dont handle avec majuscule → injoignables** | **21** |
| wallets publiables portés par ces 21 | **126** |
| wallets publiables réellement servis | **38** |

Les 21 : `0xBossman`, `Barbie`, `Blackbeard`, `Brommy`, `CoachTY`, `CryptoZin`,
`DonWedge`, `EduRio`, `ElonTrades`, `Exy`, `Geppetto`, `GordonGekko`,
`HalieyWelch`, `HaydenDavis`, `JMilei`, `James`, `Myrrha`, `Nekoz`, `OrbitApe`,
`Ronnie`, `SolanaRockets`.

### Le piège vérifié : une collision de casse existe

`0xsweep` **et** `0xSweep` sont deux lignes `KolProfile` distinctes. Une
résolution insensible à la casse serait donc ambiguë — exactement le « fallback
ambigu » interdit.

Mais les deux sont en `draft`, **aucune n'est publiée**. Parmi les publiés :

```
profils publiés            32
résolubles sans ambiguïté  32
ambigus                     0
```

La règle retenue est donc déterministe et fail-closed :

1. **égalité exacte** d'abord — l'identité canonique l'emporte toujours ;
2. sinon, égalité **insensible à la casse**, et **seulement si elle désigne une
   seule ligne** ;
3. plusieurs correspondances → **refus**, jamais un choix arbitraire.

Aucune recherche floue, aucun repli silencieux.

### Où corriger

Dans `src/lib/kol/canonical.ts`, et **pas** dans la route : le snapshot est le
point d'étranglement de toutes les surfaces (route publique, `snapshots.ts`,
scan mobile). Corriger la route ne réparerait qu'un appelant et laisserait les
autres avec le même défaut.

---

## EXEMPTION DEMANDÉE — 4 fichiers, aucun autre

| fichier | pour | pourquoi il ne peut pas être évité |
|---|---|---|
| `src/app/api/casefile/route.ts` | E2 | il **déclare** sa constante et sa `CASE_DB` en ligne — le KO signalé |
| `src/app/api/casefile/public/route.ts` | E2 | `MINT_TO_PRESET` déclarée en ligne ; c'est la surface retail |
| `src/app/api/casefile/pdf/route.ts` | E2 | idem, PDF admin |
| `src/lib/kol/canonical.ts` | E1 | le lookup `findUnique` y vit ; c'est le point d'étranglement |

Tout le reste du correctif vit hors gel : `src/lib/kol-memory/tokenIdentity.ts`,
`src/lib/kol-memory/handleResolution.ts`, `src/lib/caseDb.ts`, `lib/caseDb.ts`,
et les tests.

**L'inventaire ne déborde pas.** Aucun wildcard, aucun chemin « au cas où » —
`osint/signals` a été explicitement écarté plutôt qu'ajouté par confort.

---

## GARDE-FOU DOCTRINAL

L'interdiction est tenue : **rien dans ce correctif n'établit que « 44
caractères = mint Solana valide »**. La correction repose exclusivement sur les
**deux constantes nommées** de l'identité BOTIFY — le mint canonique connu et sa
clé synthétique connue. Le contrôle de forme existant dans `tokenIdentity.ts`
(base58, bornes 32–44) reste ce qu'il est : un filtre de condition nécessaire
pour refuser une chaîne manifestement invalide, jamais une affirmation de
validité.
