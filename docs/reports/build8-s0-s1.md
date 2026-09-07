# BUILD 8 — KOL MEMORY V2 · S0 inspection → S1 contrat

Branche `feat/cc-offline-151-kol-memory-v2`, depuis `main = cccac57`.
Enveloppe respectée : lecture seule, aucune écriture, aucune DDL, aucun Helius.

---

## STATUS

**S0 clos. S1 proposé. STOP de ratification.**
Aucun fichier produit modifié. Le rapport est le seul livrable.

---

## DONE

Cartographie des 14 tables `Kol*` de `ep-square-band`, de leurs lecteurs et
écrivains, des routes qui les servent, de leur couverture Data Nature et de
leurs tests. Douze constats mesurés (D1–D12). Contrat V2 proposé en §S1.

---

## PROOF

| | |
|---|---|
| tests | `pnpm test` — **4 602 verts / 4 605**, 2 skipped, **1 rouge** (D12, flake d'ordonnancement : vert en isolation) |
| typecheck | `pnpm typecheck` — vert |
| guard | `interligens-guard` non touché — `git status` propre, 0 fichier produit modifié |
| CI | inchangée ; le rouge D12 préexiste à cette branche (fichier inchangé depuis `4490d19`) |
| prod-write / réseau | **0 écriture, 0 DDL, 0 appel Helius.** 4 passes SELECT en `BEGIN TRANSACTION READ ONLY` + `ROLLBACK` sur `ep-square-band-ag2lxpz8`, cible vérifiée par assertion avant connexion |

Note d'environnement : le worktree était sans `node_modules`. `pnpm install
--frozen-lockfile` puis `pnpm prisma:generate` (schema de prod, jamais
`npx prisma generate`). Aucun effet hors du worktree.

---

## DISCOVERED

### D1 — Le cœur nominatif est hors du registre

14 tables `Kol*` en base. **5 déclarées** au `NATURE_REGISTRY` :
`KolPromotionMention`, `KolTokenLink`, `KolTokenInvolvement`, `KolWallet`,
`KolCase`. **9 absentes**, donc `natureForTable` → `UNCLASSIFIED` (I5) :

| table | lignes | colonnes | colonnes de nature |
|---|---|---|---|
| `KolProfile` | 412 | 57 | **0** |
| `KolProceedsEvent` | 5 602 | 18 | **0** |
| `KolEvidence` | 80 | 19 | **0** |
| `KolProceedsSummary` | 28 | 31 | **0** |
| `KolAlias` | 14 | 5 | 0 |
| `KolProceedsPublicationLog` | 12 | 12 | 0 |
| `KolCrossLink` | 0 | 8 | 0 |
| `KolActivityProfile` | — | 14 | 0 |
| `KolTokenLinkStatusLog` | — | 14 | 0 |

`KolProfile` est la table qui nomme les personnes. Elle porte 57 colonnes et
aucune ne dit ce qu'affirme une ligne.

### D2 — Aucune sortie KOL ne traverse la frontière Data Nature

`decorate()` et `assertDtoPublishable()` ont **un seul appelant produit dans
tout le repo** : `src/lib/labels/scanEnrich.ts`, sur `AddressLabel`. Zéro sur
KOL.

Conséquence directe : le commentaire du registre affirme que les 117
`KolTokenLink` à `contractAddressNature = UNCLASSIFIED` « sont exclues de toute
sortie publique ». **Le mécanisme qui les exclurait n'est appelé nulle part.**
Mesuré : les 117 sont `visibility = 'public'` et franchissent le gate de
visibilité (qui, lui, est réellement verrouillé par
`koltokenlink-visibility-invariant.test.ts`).

L'effet réel est nul — les 117 portent toutes une adresse `PENDING%` (117/117,
8 handles). La garantie est donc vraie **par accident du contenu**, pas par
construction. Le jour où une ligne UNCLASSIFIED portera une vraie adresse,
rien ne l'arrêtera.

### D3 — Aucune écriture KOL ne traverse le chokepoint

`assertNatureWritable` a 6 appelants : `ShillEvent`,
`ShillCorrelationCandidate`, `ExitEvent`, `CoExitQualification`, `FundingEdge`,
`FundingRelationshipObservation`. Les six tables les plus récentes du produit.

Face à ça, **51 appels d'écriture dans 36 fichiers** sur `KolProfile` /
`KolWallet` / `KolEvidence` / `KolTokenLink` — 10 routes admin, 2 crons,
3 modules `lib`, 21 seeders/scripts. Aucun ne passe par le chokepoint.
Mesuré côté base :

- `KolWallet` : 453 lignes sur 482 sans `rowNature` ; 29 en `THIRD_PARTY_DATA`.
- `KolTokenInvolvement` : 15/15 en `UNCLASSIFIED` explicite.
- `KolCase` : 10/11 classées, 11/11 avec `methodologyRef` — **la seule table
  KOL réellement prête.**

### D4 — La table de la monnaie est la moins gouvernée

`KolProceedsEvent`, 5 602 lignes, déclarée source canonique des proceeds :

- **absente des DEUX schemas Prisma** → accessible uniquement en
  `$queryRaw`, sans type ;
- absente du registre ;
- aucune colonne de nature ;
- **deux natures dans la même colonne `amountUsd`** :

| classe | lignes | USD |
|---|---|---|
| prix tiers relayé (`binance_historical`, `ARKHAM_CSV`, `arkham_aggregate`) | 5 414 | 17 396 879 |
| prix **calculé par le produit** (`helius_sol_estimate_200usd` 133, `yearly_fallback` 50, autres 5) | 188 | 156 153 |

C'est le site de mélange M4, appliqué à l'argent. Un `THIRD_PARTY_DATA` et une
`ESTIMATE` additionnés dans le même `SUM()`, sans que rien dans la sortie ne
distingue les deux.

### D5 — La provenance du chiffre est affirmée, pas dérivée

`canonical.ts` pose `proceedsSource: "KolProceedsEvent"` en **littéral** et
`builtFromEventId: null` **en dur**. Le snapshot déclare sa source sans jamais
la lire.

Testé contre la règle EXACTE de son writer
(`sync-proceeds` : `SUM(amountUsd) WHERE ambiguous=false AND amountUsd>0`,
arrondi) sur les 32 profils publiés :

| | |
|---|---|
| reproductibles | **30** |
| sans chiffre | 1 |
| **non reproductibles** | **1** — 141 594 $ servis que la source déclarée ne rend pas |

La déclaration est donc vraie à 30/32. **Rien dans la charge utile ne dit
lequel est le 31ᵉ.** Un consommateur ne peut pas falsifier l'affirmation.

Aggravant : `KolProceedsSummary` sait déjà ce que le snapshot tait —
**28/28 `coverageStatus = 'partial'`**, **24/28 `pricingQuality = 'fallback'`**.
`canonical.ts` ne lit jamais cette table.

### D6 — Deux identités BOTIFY, sur le même écran

| fichier | constante | longueur |
|---|---|---|
| `src/lib/kol/handleToMint.ts` | `BYZ9…UnZac**ja4**…Th69xb` | **43** |
| `src/lib/kol/proceeds.ts` (`CA_MAP`) | `BYZ9…UnZac**ija4**…Th69xb` | **44** |

Mesuré en base : le **43 n'existe dans aucune ligne** — `KolProceedsEvent` 0,
`KolTokenLink` 0, `KolTokenInvolvement` 0. Le 44 en porte 262 / 5 / 3.

Or `/en/kol/[handle]`, `/fr/kol/[handle]` et `/api/casefile` résolvent sur le
**43**. Le lien casefile d'une fiche pointe donc vers une identité que rien ne
porte, à côté d'un chiffre de proceeds calculé sur l'autre.

⚠️ **Ne pas corriger à l'aveugle** — le 43 est la clé de casefile/démo ; la
substituer casserait la jointure casefile ou les snapshots d'anti-régression.
C'est une décision produit, pas un typo.

Second point sur le même fichier : `BOTIFY_KOLS` est une **liste fermée de
11 handles codée en dur**, qui lie nominativement des personnes à un token —
sans provenance, sans nature, sans chemin de revue.

### D7 — La frontière nominative tient ; la publiabilité DANS le nominatif n'existe pas

`isNominativeApiPath` couvre `/api/kol/`, `/api/v1/kol/`, `/api/cluster/`,
`/api/laundry/`, etc., et le gate est verrouillé par test. **Ce n'est pas le
trou.**

Le trou est derrière : `/api/kol/[handle]` rend `kolWallets` en
`select: { kolWallets: true }`, **sans aucun `where`**. Mesuré sur les profils
publiés :

| wallets servis | dont `isPubliclyUsable = false` | dont non confirmés | dont sans nature |
|---|---|---|---|
| **229** | **65** | 51 | 200 |

21 des 32 profils publiés sont concernés. `isPubliclyUsable` est écrit par
5 seeders et **lu par un seul site** (`explorerItems.ts`, un compteur).
L'indicateur existe ; il ne gouverne rien.

Le gate nominatif limite l'exposition aux appelants légitimes (front beta,
admin, clé partenaire, token mobile). Il ne la supprime pas : une clé partenaire
reçoit les 65.

### D8 — `identity.ts` se contredit dans le même fichier

`mapDbConfidence()` traduit fidèlement la confiance DB, et
`resolveHandleToWallets` l'utilise.

`resolveWalletToKol` — appelé par `ingestion/pipeline.ts` (2×) et
`events/processor.ts` — rend `confidence: "exact"` et `source: "manual"`
**en dur, dès qu'une ligne existe**, quels que soient sa `confidence` et son
`attributionSource` réels.

Mesuré : 194 `KolWallet` en `review` / non publiables ressortiraient
« exact / manual ». C'est une nature qui **remonte l'échelle d'autorité** —
littéralement I1, dans le module qui décide à qui appartient un wallet.

### D9 — Deux contrats pour la même personne

| | `/api/kol/[handle]` | `/api/v1/kol/[handle]` |
|---|---|---|
| wallets | **oui, bruts, non filtrés** | non |
| evidences | brutes | montants redactés (`redactEvidenceAmount`) |
| cases | bruts | `paidUsd` redacté |
| proceeds | via `canonical.ts` | via `redactProceeds` |

Même sujet, deux vérités selon la porte. La v1 est la plus prudente ; c'est la
route interne qui fuit.

### D10 — 32 profils publiés, pas 215

`CLAUDE.md` annonce « 215 profils publiés ». Mesuré : **412 `KolProfile`,
dont 32 passent `PUBLIC_KOL_FILTER`** (32 `published`, dont 3 `isActive=false`),
304 `draft` actifs, 75 `draft` inactifs, 1 `review`. Aucune combinaison de
`publishStatus` / `publishable` / `isActive` ne rend 215.

Ligne de contexte périmée — **pas une prémisse ratifiée**, donc pas un STOP.

### D11 — Code mort dans `src/lib/kol/`

`cexComplicityScore.ts` (204 l.) et `kolDossier.ts` (84 l.) : **zéro
référence** dans tout `src`. `kolDossier.ts` embarque pourtant sa propre
logique de containment (`redactProceeds`, `hasObservedProceeds`) — une seconde
implémentation non testée d'une décision de publication.

### D12 — Un test rouge en suite complète, vert en isolation

`contradictionDetector.test.ts` › « same tweet+sell pair produces exactly one
alert » : les deux `mkTweet(600)` évaluent `Date.now()` **séparément**. Sous la
charge de la suite complète, ils tombent sur deux millisecondes différentes →
deux `dedupKey` distincts → 2 alertes au lieu d'1.

Le produit est correct (la dédup est exacte à la milliseconde, c'est voulu) ;
**la fixture est datée à l'exécution.** Conséquence : la CI bloquante est
rouge par intermittence sur `main`.

---

## S1 — CONTRAT V2 PROPOSÉ

### Ce que « Memory V2 » doit garantir

Sept garanties, chacune dérivée d'un invariant déjà ratifié et d'un trou que S0
expose. Aucune n'est nouvelle en doctrine — elles appliquent à la mémoire KOL
ce qui est déjà vrai ailleurs dans le produit.

| | garantie | invariant source | trou fermé |
|---|---|---|---|
| **G1** | Toute affirmation KOL servie porte sa nature, ou **n'est pas servie**. | Data Nature I3/I5 | D1, D2 |
| **G2** | Toute écriture **nouvelle** passe le chokepoint. L'historique non classé reste lisible et n'est jamais promu. | S6 / writeGuard | D3 |
| **G3** | Un chiffre servi est **reproductible depuis sa source déclarée**, ou se déclare non reproductible. | provenance | D4, D5 |
| **G4** | Une adresse attribuée à une personne ne sort que si son attribution l'autorise. | frontière nominative · fail-closed | D7 |
| **G5** | Une identité de token est **unique par sujet, ou déclarée en conflit** — jamais deux silencieuses. | BUILD 7 S3 « l'identité d'abord » | D6 |
| **G6** | Memory V2 rend des **états**, jamais des conclusions. Pas de score, pas de seuil, pas de pourcentage. | aucune conclusion/verdict | D8 |
| **G7** | Une même personne rend le **même contrat** quelle que soit la porte. | fail-closed | D9 |

**G6, précisé.** Les états empruntés au comparateur — `OBSERVED`,
`NOT_OBSERVED`, `NOT_MEASURABLE`, `MISSING`, `INADMISSIBLE` — sont le
vocabulaire proposé. `INADMISSIBLE` porte déjà ses causes fermées
(`DATA_NATURE_MISSING`, `DATA_NATURE_MISMATCH`, `PROVENANCE_UNSATISFIED`) : les
trois causes que S0 mesure. Rien à inventer.

### Frontière — dans le build

- **Déclarer** au registre les 9 tables absentes, avec leur régime et leur
  motif mesuré (D1). Zéro DDL : c'est ce que le régime DECLARED existe pour
  faire.
- **Fermer** `resolveWalletToKol` (D8) : rendre la confiance et la source
  réelles, comme le fait déjà `resolveHandleToWallets` dans le même fichier.
- **Poser** la frontière de sortie sur les lectures KOL publiques
  (`decorate` / `assertDtoPublishable`), en commençant par les tables déjà
  classées (D2, D3).
- **Filtrer** les wallets servis sur leur publiabilité (D7).
- **Aligner** les deux contrats `/api/kol/[handle]` et `/api/v1/kol/[handle]`
  sur le plus prudent des deux (D9).
- **Rendre falsifiable** la provenance du chiffre : dériver `proceedsSource`
  au lieu de l'affirmer, et remonter ce que `KolProceedsSummary` sait déjà —
  `coverageStatus`, `pricingQuality` (D5).
- **Séparer** dans `KolProceedsEvent` les prix relayés des prix calculés, en
  lecture et en sortie (D4) — sans toucher aux lignes.
- **Retirer** le code mort (D11).
- **Réparer** la fixture datée (D12).

### Frontière — hors build

- **Toute DDL.** Les colonnes de nature manquantes sur `KolProfile`,
  `KolEvidence`, `KolProceedsEvent`, et les 5 modèles Prisma absents
  (`KolProceedsEvent`, `KolProceedsSummary`, `KolProceedsPublicationLog`,
  `KolActivityProfile`, `KolTokenLinkStatusLog`) : phase séparée, ratification
  séparée.
- **Tout backfill.** Les 453 `KolWallet` et 15 `KolTokenInvolvement` non
  classés restent tels quels — c'est la dette, elle doit rester visible.
- **L'identité BOTIFY (D6).** Décision produit. Le build peut *nommer* le
  conflit ; il ne le tranche pas.
- **Toute réécriture du moteur de proceeds.** L'archi qui marche reste debout.
- **Toute exemption** au gate nominatif ou aux gates de publication existants.

### Phases gatées

| phase | contenu | DDL | démontrable sur données existantes |
|---|---|---|---|
| **P0** | déclaration des 9 tables au registre · fermeture de `identity.ts` · retrait du code mort · fixture D12 | non | oui — 5 602 + 482 + 292 lignes |
| **P1** | frontière de sortie sur les lectures KOL déjà classées · filtre de publiabilité wallet · alignement des deux contrats | non | oui — 229 wallets, 32 profils |
| **P2** | provenance du chiffre : `proceedsSource` dérivé, `coverageStatus` / `pricingQuality` remontés, séparation relayé/calculé | non | oui — 30/32 vs 1/32, 5 414 vs 188 |
| **P3** | colonnes de nature + modèles Prisma manquants | **oui** | ratification séparée |
| **P4** | identité BOTIFY | non | décision produit |

Chaque phase se clôt comme BUILD 7 : un **delta-run** avant/après sur le
corpus réel, en lecture seule, et un **mutation-check** où chaque invariant a
son mutant en correspondance 1:1. Les compteurs mesurés ci-dessus sont la
baseline ; aucun pourcentage n'en sera dérivé.

**P0 → P1 → P2 sont réalisables sans une seule écriture en base.** C'est le
point qui rend la proposition défendable : les trois quarts du contrat V2 se
démontrent sur ce que la base contient déjà.

---

## BACKLOG

- Modèles Prisma manquants (5 tables) → tout passe en `$queryRaw` non typé.
- 453 `KolWallet` + 15 `KolTokenInvolvement` + 41 `EvidenceItem` non classés —
  dette assumée, à garder lisible.
- `BOTIFY_KOLS` : liste nominative codée en dur, sans provenance ni revue.
- `KolCrossLink` : 0 ligne, 3 fichiers — table déclarée jamais alimentée.
- Drift `CLAUDE.md` : « 215 profils publiés » (réel : 32), « Prisma 5.22 »
  (réel : client 6.19.3), « Branch active : feat/case-intelligence-beta ».
- Deux règles d'agrégation de proceeds concurrentes : `sync-proceeds`
  (`ambiguous=false AND amountUsd>0`) vs `PROCEEDS_POLICY` /
  `isCashoutDocumented` (par `eventType`). Elles ne coïncident pas.
- `pnpm test` **salit l'arbre de travail** : la suite réécrit
  `__tests__/reflex/calibration/last-report.json` (champ `generatedAt`).
  Un `git status` après une suite verte n'est pas propre. Restauré ici.

---

## NEXT

Sur ratification du scope : P0, dans l'ordre du tableau, avec delta-run et
mutation-check en clôture de phase.

---

## STOP

**STOP légitime — ratification de scope par l'architecte.**

Trois décisions sont produit/méthodo et ne m'appartiennent pas :

1. **Le périmètre P0–P2 tel que proposé** — en particulier G4 (filtrer les
   65 wallets non publiables) et G7 (aligner `/api/kol/[handle]` sur la v1) :
   les deux **retirent** de la donnée à des consommateurs existants. Le
   fail-closed dit que c'est le bon sens du refus ; c'est quand même un retrait,
   et il se décide.
2. **P3 (DDL)** — dedans ou dehors.
3. **D6, l'identité BOTIFY** — nommer le conflit sans le trancher, ou le
   trancher.

Aucun autre STOP : aucune prémisse ratifiée n'est contredite (D10 corrige une
ligne de contexte, pas une doctrine), et rien dans P0–P2 n'exige d'écriture,
de DDL ni d'exemption.
