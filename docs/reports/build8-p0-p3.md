# BUILD 8 — KOL MEMORY V2 · P0–P3

Branche `feat/cc-offline-151-kol-memory-v2`, depuis `main = cccac57`.
Commits `811b44e` (P0/P1/D3) et `74e8e6d` (P2/P3).

---

## STATUS

**P0, P1, P2, P3 et D3 livrés.** Le contrat est écrit, prouvé sur le corpus
réel, et câblé partout où le guard l'autorise. La DDL est rédigée et non
exécutée.

**STOP** — exemption de chemins gelés, et remise de la migration à T1.

---

## DONE

| | livré | câblé en production ? |
|---|---|---|
| **P0** | dérivation de l'attribution, I1 mécanique | **oui** — ingestion + events |
| **P1** | gate de publiabilité des wallets | non — la route est gelée |
| **P2** | provenance dérivée du chiffre de proceeds | non — `canonical.ts` est gelé |
| **P3** | contrat nature/provenance/méthode sur `amountUsd` + DDL rédigée | registre : **oui** · DDL : à T1 |
| **D3** | identité BOTIFY canonique | **oui** — pages `/en` et `/fr` |

Six modules neufs sous `src/lib/kol-memory/`, cinq fichiers de tests, deux
harnais sous `scripts/kol-memory/`, une DDL sous `docs/prep/patches/BUILD8/`.

---

## PROOF

| | |
|---|---|
| suite | `pnpm test` — **4 689 verts / 4 691**, 2 skipped, **0 rouge** |
| typecheck | `pnpm typecheck` — vert |
| delta-run | `npx tsx scripts/kol-memory/delta-run.mjs` — `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, cible asserted avant connexion |
| mutation | `node scripts/kol-memory/mutation-check.mjs` — **12/12 mutants tués**, sources restaurées, sha256 vérifié |
| guard | `sha256 = ce13d0c…13e50` conforme · « aucun chemin interdit modifié » sur les deux commits |
| prod-write / réseau | **0 écriture, 0 DDL, 0 Helius.** Sept passes SELECT en lecture seule |

### Delta-run — ce que les règles rendent sur les lignes réelles

```
1. ATTRIBUTION                      avant            après
   confidence                       exact 482        strong 246 · probable 215
                                                     exact 15 · candidate 6
   source                           manual 482       inferred 463 · on_chain 19
   revue humaine requise            0                232 / 482
   → gate proceeds de processor.ts  482              15 lignes éligibles

2. PUBLIABILITÉ DES WALLETS         229 servis       164 servis   (−65)

3. IDENTITÉ BOTIFY                  mint 44 car. : 262 / 5 / 3
                                    clé 43 car.  :   0 / 0 / 0

4. NATURE DES MONTANTS              avant : UNE somme, 17 553 032 $ sur 5 602 lignes
   INFERENCE                        5 407 lignes    15 292 471 $
   THIRD_PARTY_DATA                     7 lignes     2 104 408 $
   ESTIMATE                           112 lignes        93 048 $
   UNCLASSIFIED                        76 lignes        63 105 $
```

---

## DISCOVERED

Deux découvertes ont changé la conception en cours de route. Les deux
viennent de la mesure, pas de la relecture.

### F1 — Le vocabulaire d'attribution était une fiction

En construisant la dérivation, j'ai repris l'échelle de `mapDbSource` :
`manual`, `on_chain_footprint`, `airdrop`, `promotion_tx`, `inferred`.

```sql
SELECT count(*) FROM "KolWallet"
 WHERE "attributionSource" IN ('manual','on_chain_footprint',
                               'airdrop','promotion_tx','inferred');
→ 0        (sur 482)
```

**Aucune de ces cinq valeurs n'existe en base.** La colonne porte 18 étiquettes
de provenance — `botify_leaked_doc`, `sns`, `ens`, `arkham_intel`,
`dune_4838225`… — c'est-à-dire *d'où vient la preuve*, pas *comment
l'attribution a été faite*. Deux questions logées dans une colonne.

Conséquence, et c'est le même défaut que celui qu'on corrigeait :
`attributionSource === 'manual'` ne peut **jamais** être vrai. Ma première
version exigeait `confirmed AND manual` — le delta a rendu `exact = 0`, un
palier structurellement inatteignable. Réécrit sur `claimType`, le vocabulaire
Publishing Standard v1 réellement peuplé : `exact` exige `confirmed` ET
`verified_onchain`, soit **15 lignes** — un palier réel.

> **`computeIdentityConfidence` dans `src/lib/kol/canonical.ts` porte
> exactement la même condition morte.** Son niveau `exact` est inatteignable
> pour les 412 profils. Chemin gelé, non corrigé ici — voir STOP.

### F2 — `helius_sol_estimate_200usd` ne dit pas ce qu'il fait

L'étiquette annonce un prix SOL de 200 $. Mesuré : sur les 133 lignes, 74 n'ont
aucun montant, et les 59 restantes portent des `priceUsdAtTime` de l'ordre de
0,002 à 0,04 — des prix de **token**, pas de SOL.

Le 200 $ n'est pas le prix stocké : c'est une constante d'entrée dont les
59 prix **dérivent**, et rien dans la ligne ne le disait. Ce sont bien des
ESTIMATE, mais pour une raison plus profonde que ne le laissait croire leur
nom.

---

## BACKLOG

Constats réels, hors périmètre de ce build, non traités :

- `computeIdentityConfidence` (`canonical.ts`) — même condition morte que F1.
- `src/lib/ingestion/pipeline.ts` — branches `handle` et `casefile` : même
  `exact`/`manual` en dur, sur une affirmation différente (« ce handle existe »
  et non « cette adresse est à cette personne »).
- `KolWallet` — synonymes non fusionnés : `onchain_confirmed` vs
  `verified_onchain`, `attributed` vs `source_attributed`. Tâche déjà
  identifiée au registre (étape S4) ; les rapprocher ici aurait été décider à
  sa place.
- `BOTIFY_KOLS` — liste nominative de 11 handles codée en dur, sans provenance
  ni chemin de revue. Reprise **à l'identique** : l'arbitrage exclut toute
  nouvelle investigation BOTIFY.
- `KolProfile`, `KolEvidence` et les 4 modèles Prisma absents — hors P3 sur
  précision d'arbitrage.
- Reportés de S0 : `totalDocumented` 30/32 · flake `contradictionDetector` ·
  `CLAUDE.md` « 215 profils publiés » (réel : 32).
- `pnpm test` salit l'arbre (`__tests__/reflex/calibration/last-report.json`).

---

## NEXT

À l'ouverture des exemptions : câbler le gate wallet dans la route, réduire
`src/lib/kol/identity.ts` et `handleToMint.ts` en délégations, brancher la
provenance dans `canonical.ts`. Puis migration par T1.

---

## STOP

### 1. Exemption de chemins gelés

**La liste abrégée de l'arbitrage — `^prisma/ ^src/app/api/ ^src/components/
le guard ^vercel.json ^.github/` — est plus courte que celle du guard.** Le
guard, ratifié comme autorité et dont le sha256 est conforme, gèle aussi
`^src/lib/kol/`, `^src/lib/security/`, `^migrations/`, `^src/lib/pdf/`,
`^src/lib/watcher/`, `^src/lib/scoring/`, `^src/lib/tigerscore/`,
`^src/lib/evidence/`, `^src/lib/auth/`.

Tous les fichiers nommés par les Décisions 1 et 3 sont donc gelés :
`identity.ts`, `handleToMint.ts`, `canonical.ts`, la route, le schema.

J'ai suivi la doctrine du repo plutôt que de m'arrêter : la logique vit hors
chemins gelés, les consommateurs non gelés sont recâblés, et le résidu gelé est
réduit au minimum. **P0 et D3 sont donc effectifs en production dès maintenant**
— `ingestion/pipeline.ts`, `events/processor.ts`, `/en/kol/[handle]`,
`/fr/kol/[handle]`.

Restent quatre fichiers, à ratifier pour une exemption `feat/cc-offline-151-*` :

| fichier | ce qu'il reste à faire | effet |
|---|---|---|
| `src/app/api/kol/[handle]/route.ts` | appliquer `PUBLISHABLE_WALLET_FILTER` | retire les 65 wallets |
| `src/lib/kol/identity.ts` | réduire en délégation vers `kol-memory/attribution` | supprime la dernière source du défaut |
| `src/lib/kol/handleToMint.ts` | réduire en délégation vers `kol-memory/tokenIdentity` | ferme le 43 caractères |
| `src/lib/kol/canonical.ts` | brancher la provenance ; corriger la condition morte F1 | rend le chiffre falsifiable |

Sans cette exemption, P1 et P2 restent des contrats prouvés mais non servis, et
`/api/kol/[handle]` continue de servir les 65 adresses non publiables.

### 2. Migration prod

`docs/prep/patches/BUILD8/01_kolproceedsevent_nature.sql` — additive, cible
`ep-square-band`, trois colonnes sur la seule `KolProceedsEvent`, backfill
transcrit du TypeScript et comparé par test, cinq contrôles de sortie. **Non
exécutée.** Elle revient à T1, conformément à l'arbitrage.

### Ce qui n'est PAS un STOP

Aucune prémisse ratifiée n'est contredite. F1 et F2 corrigent des lectures que
je faisais du code, pas des faits ratifiés. Aucune écriture prod, aucune DDL
exécutée, aucun appel Helius, aucun dépassement de coût.
