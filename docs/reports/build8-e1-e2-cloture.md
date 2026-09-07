# BUILD 8 — E2 / E1 · clôture

`main` : `7c17b3f` → **`39345a3`**.

---

## STATUS

**E2 et E1 corrigés, mergés, guard refermé byte-identical.**
Les 10 points de clôture démontrables sans déploiement sont **conformes**.
Trois points restent ouverts : ils portent sur des réponses d'API et exigent
que `main` soit déployé — ce que je ne fais pas.

---

## LES QUATRE MERGES

| | commit | UTC |
|---|---|---|
| exemption ciblée | `a512efc` | **10:40:48Z** |
| correctif hors gel | *(dans `964a562`)* | — |
| câblage des 4 fichiers gelés | `964a562` | **10:48:06Z** (+7 min 18 s) |
| refermeture | `39345a3` | **10:53:15Z** (+12 min 27 s) |

**Fenêtre d'exemption : 12 min 27 s.**

---

## GUARD

```
$ git show origin/main:scripts/guard-offline.sh | shasum -a 256
ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50
```

| contrôle | résultat |
|---|---|
| sha256 sur `origin/main` | conforme à l'exigence |
| `git diff cccac57 -- scripts/guard-offline.sh` | **vide** |
| exemptions résiduelles | **0** |
| diff de refermeture | **−54 lignes**, exactement les 54 posées |

Les quatre chemins sont re-bloqués, vérifié en rejouant les
`FORBIDDEN_PATTERNS` de `main` : les trois routes casefile sous
`^src/app/api/`, `canonical.ts` sous `^src/lib/kol/`.

---

## PREUVE DE CLÔTURE

`DATABASE_URL=… npx tsx scripts/kol-memory/closure-check.mjs`
(transaction `READ ONLY` + `ROLLBACK`, cible asserted avant connexion)

```
✅ 1. publiabilité       164 wallets servis sur 229 candidats · 0 non publiable parmi les servis
✅ 2. attribution        482/482 classés, 0 hors vocabulaire
                         exact=15 · strong=246 · probable=215 · candidate=6 · unresolved=0
✅ 2b. sources           19 on_chain_footprint · 463 inferred
✅ 3. nature (code)      5602/5602 · INFERENCE=5407 · ESTIMATE=112 · UNCLASSIFIED=76 · THIRD_PARTY_DATA=7
✅ 3b. nature base↔code  5602/5602 cohérents · 0 écart
✅ 3c. ESTIMATE          0 inauditable
✅ 4. mint canonique     262 lignes sur le canonique · 0 sur l'alias
✅ 5. alias              les deux entrées convergent vers le mint canonique
✅ 6. joignabilité       32/32 profils publiés résolubles
✅ 7. casse              aucun profil publié en collision
✅ 8. guard              byte-identical
✅ 9. CI                 verte — 4 743 tests, typecheck, 12/12 mutants
```

**Le point 3b est le plus important** : la migration de T1 est appliquée, et la
colonne en base dit **exactement** ce que le code calcule, ligne par ligne, sur
les 5 602. Le backfill et sa spécification n'ont pas divergé.

### Ce qui reste ouvert — et pourquoi je ne le clos pas

Les points **1, 4, 5 et 6 côté API** portent sur ce qu'un serveur RÉPOND. Le
correctif est sur `main` (`39345a3`) mais **pas déployé** : le déploiement se
fait par `npx vercel --prod`, sur validation humaine, et n'a pas été lancé.

Prouver ces points depuis la base et le code, c'est prouver que le produit est
prêt — pas ce qu'il sert. Je ne confonds pas les deux.

À vérifier après déploiement :

```
GET /api/casefile?mint=<44 canonique>     → doit rendre le dossier BOTIFY (RED/70)
GET /api/casefile?mint=<43 synthétique>   → doit rendre LE MÊME dossier
GET /api/kol/gordongekko                  → doit rendre 200, plus 404
GET /api/kol/<n'importe lequel des 21>    → 200, wallets filtrés
```

---

## CE QUI A ÉTÉ CORRIGÉ

### E2 — l'identité canonique

`/api/casefile` déclarait sa propre constante : la clé de route synthétique, qui
n'existe dans aucune ligne. Mesuré par T1 puis reproduit par lecture :

```
?mint=<44 canonique>   → CASE_DB miss → 0 claim → score 0  → GREEN
?mint=<43 synthétique> → 8 claims → garde-fou ≥6 → 70      → RED
```

C'était **la moitié manquante de la Décision 3** : BUILD 8 avait corrigé les
*producteurs* de mint sans recléer les cartes qui les *consomment*. Les cartes
sont désormais clé sur le canonique et lisent via `casefileLookupKey` — l'URL
historique mène au dossier, elle ne le définit plus.

### E1 — la casse

21 des 32 profils publiés étaient injoignables, 126 des 164 wallets publiables
jamais servis. Résolution en trois temps : exact → insensible **si unique** →
**refus** si ambigu.

Le refus n'est pas rhétorique : `0xsweep` et `0xSweep` sont deux lignes
distinctes en base. Servir l'une pour l'autre attribuerait à une personne le
dossier d'une autre. Les deux sont en `draft`, donc aucun profil publié n'est
concerné aujourd'hui — mais la règle tient le jour où l'un sera publié.

---

## UNE EXCLUSION QU'UN TEST A TROUVÉE

`src/lib/casefile/presets.ts` était dans mon périmètre initial. **Retiré après
mesure.**

Il alimente `findCasefilePresetsByAddress` (token-resolution v3), dont le
commentaire porte une position **ratifiée** : « BOTIFY porte DEUX mints […] ils
ne sont pas une coquille à corriger : **on lit la table telle quelle, sans
normaliser** ».

Le recléer faisait apparaître un candidat `casefile_preset` pour le canonique ;
sous panne de provider, le résolveur passait de `AMBIGUOUS` à `RESOLVED` —
**5 cas de `ratified-doctrine.test.ts` rougissaient**, dont « jamais RESOLVED
par ABSENCE de rival ». Vérifié dans les deux sens : vert sans mon changement,
rouge avec.

Cette carte sert la détection de **présence de risque** (PRE-BUY GUARD), pas le
verdict retail que vise E2. La toucher aurait modifié une doctrine ratifiée hors
périmètre. L'écart est consigné par un test nommé plutôt que laissé muet.

`src/app/api/osint/signals/route.ts` également écarté : une recherche,
l'autorité d'aucun verdict.

**L'exemption a donc couvert 4 fichiers là où mon inventaire initial en visait
6.** Deux ont été retirés, aucun ajouté.

---

## GARDE-FOU DOCTRINAL

**Rien dans ce correctif n'établit que « 44 caractères = mint Solana valide ».**
Le contrat ne connaît que **deux chaînes nommées** — l'identité BOTIFY canonique
et sa clé synthétique. Deux tests le tiennent : un base58 de 44 caractères
inconnu traverse le contrat inchangé, et une autre chaîne de 43 caractères n'est
pas traitée comme un alias.

---

## BACKLOG

- `src/lib/casefile/presets.ts` — rapprocher cette carte demande un **arbitrage
  sur token-resolution v3**, pas une correction d'identité.
- `src/app/api/osint/signals/route.ts` — `q === <43>` marque `isBotify` dans une
  recherche.
- `data/cases/botify.json` et `src/data/cases/botify.json` — `case_meta.mint`
  porte encore l'alias. Descriptif, **aucun lookup n'y est indexé**.
- Les ~20 fixtures, snapshots et documents portant le littéral : corpus gelés,
  les toucher changerait ce qu'ils mesurent.
- Reportés : branche `handle` de `ingestion/pipeline.ts`, synonymes `KolWallet`
  (S4), `BOTIFY_KOLS` codée en dur, `CLAUDE.md` « 215 profils » (réel : 32),
  `pnpm test` qui salit l'arbre.

---

## ÉTAT RÉEL

| | |
|---|---|
| `main` | `39345a3` |
| guard | `ce13d0c…13e50`, 0 exemption |
| base | migrée, classifiée, **cohérente avec le code sur 5 602/5 602** |
| **en production** | **le correctif E2/E1 n'est PAS déployé.** Le déploiement actif sur `app.interligens.com` précède `964a562` |
| prod-write | 0 écriture, 0 DDL, 0 Helius — 6 passes SELECT en lecture seule |
