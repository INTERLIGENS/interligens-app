# P0 — CONTAINMENT DES PROCEEDS · DOSSIER STOP 2

**Date :** 2026-08-16 · **Machine :** Host-001
**Objet :** état avant déploiement — ce que le déploiement change, ce qui casse, le retour arrière.
**Rien n'a été déployé. Aucune migration n'a été exécutée. Aucun `UPDATE` n'a été passé sur `ep-square-band`.**

---

## 1. État de `main` et des branches

```
main                                        5bed649   (inchangé)
hotfix/guard-p0-proceeds-containment        3808be1   chore(guard): ouvre … sur 25 fichiers nommés
feat/cc-offline-60-p0-proceeds-containment  a7945ce   feat(governance): containment des proceeds
                                            2536492   fix(scoring): l'absence de données …
                                            f43ca18   docs(stop2)
                                            2e5b3d9   docs(baseline)
                                            (+ 1)     fix(scoring): exclusion des comptes de programme
```

`main` n'a reçu aucun commit. Les deux branches sont locales, non poussées.

**Pourquoi deux branches.** Le guard se protège lui-même (`^scripts/guard-offline\.sh$` est dans `FORBIDDEN_PATTERNS`) et n'accepte d'être modifié que depuis une branche `hotfix/guard-*` ne contenant que le système de garde. La tentative de commit de l'exemption depuis la branche de chantier a été **refusée** — comme prévu par sa conception. J'ai utilisé la voie de maintenance déclarée dans le fichier plutôt que de la contourner.

**Ordre d'atterrissage.** `hotfix/guard-…` d'abord (sinon la CI de la branche de chantier voit 25 chemins interdits), puis `feat/cc-offline-60-…`, puis retrait de l'exemption comme d'habitude. C'est l'ordre que le dépôt applique déjà (`ed495e1` → `e833104` → `3de3d3d`).

### Vérifications sur l'état committé

| Contrôle | Résultat |
|---|---|
| `git diff --quiet HEAD` | ✅ arbre de travail identique à HEAD — prérequis de `vercel --prod` satisfait |
| `npx tsc --noEmit` | ✅ aucune erreur |
| `npx vitest run` | ✅ **3 016 verts**, 2 ignorés, 290 fichiers, **0 échec** |
| Guard sur le diff du chantier | ✅ `aucun chemin interdit modifié` (29 puis 12 fichiers) |
| Tests dédiés | 56 (containment) + 33 (dégradation) + 9 (concentration) = **98**, dont **16 mutants tués** |
| Snapshots anti-régression | **126 insertions, 0 suppression** |

Le seul fichier non suivi est `AGENTS.md`, présent avant ce chantier et étranger à celui-ci.

---

## 2. Ce que le déploiement change

### 2.1 Séquence obligatoire — l'ordre n'est pas négociable

```
1.  Neon SQL Editor : migrations/MIGRATION_proceeds_containment_v1.sql
2.  pnpm prisma:generate
3.  npx vercel --prod
4.  Neon SQL Editor : migrations/RETRAIT_proceeds_2026-08-16.sql
5.  Purge Cloudflare  ← à ta main, je te dis quand au §6
```

**Pourquoi cet ordre.** Le code déployé sélectionne `KolProfile."proceedsPublication"`. Déployer avant la migration ferait échouer **toute lecture de profil KOL** en production. L'inverse est sûr : la colonne existe avec `DEFAULT 'published'`, et le code d'avant l'ignore.

Entre l'étape 1 et l'étape 3, **le comportement du produit est strictement inchangé** — les 411 profils valent `'published'`.

### 2.2 Après l'étape 3 (déploiement), avant l'étape 4 (retrait)

Aucun montant ne bouge. Ce qui change quand même :

| Surface | Avant | Après |
|---|---|---|
| `POST /api/scan/ask` | **200 en anonyme** | **401** sans cookie beta / clé partenaire / jeton mobile |
| `GET /api/v1/kol` | 6 valeurs de `KolProceedsSummary`, dont des résumés en `reviewStatus='draft'` | seulement les résumés `published` — **de 6 à 4 valeurs** |
| `/api/v1/score` | `topHolderPct: null` en permanence (solscan 404) | valeur réelle, ou `topHolderSource: null` + `topHolderUnavailableReason` |
| Toutes les sorties de score | — | nouveau bloc `dataQuality { degraded, missing, unevaluatedSignals }` |
| Score avec RPC mort | `confidence: "Medium"` | `confidence: "Low"` |
| Échec de lookup renseignement | indiscernable d'une adresse propre | `intelligenceStatus: "UNKNOWN"` |
| Token concentré (top 10 > 80 %) | signal jamais déclenché | **+15**, et `cluster_risk` redevient atteignable |

⚠️ **Le point 3 peut faire monter des scores — mais beaucoup moins qu'annoncé initialement.**

Une première mesure annonçait 68 bascules ORANGE → RED. **Ce chiffre était un artefact de
méthode** : `getTokenLargestAccounts` comptait la courbe de bonding pump.fun et les pools
comme des détenteurs. Blocage posé par David, correction appliquée (exclusion des comptes
détenus par un programme), mesure refaite le 2026-08-16 à 19:01 UTC :

| | Naïf (disqualifié) | **Corrigé** |
|---|---:|---:|
| Tokens à 100 % | 10 | **0** |
| top 10 > 80 % | 70 | **0** |
| Scores modifiés | 81 | **1** |
| **Verdicts modifiés** | 77 | **0** |
| **ORANGE → RED** | **68** | **0** |

**Le déploiement ne fait basculer aucun token.** Un seul score bouge : ANSEM, 50 → 60,
ORANGE → ORANGE, sur une concentration de portefeuilles réels (0,5 % seulement dans un
programme). Détail complet : `docs/BASELINE_PRE_CONTAINMENT_2026-08-16.md` §2.

### 2.3 Après l'étape 4 (les six retraits)

| Surface | Avant | Après |
|---|---|---|
| `/api/kol/leaderboard` → `totalObservedProceeds` | 2 261 189 $ | **5 014 $** |
| `/api/kol/leaderboard` → `profilesWithProceeds` | 8 | **2** |
| `/api/explorer` → `minimumObservedProceeds` | 2 261 189 $ | **5 014 $** |
| `/api/explorer` → dossier **BOTIFY** | 932 139 $ | **2 082 $** |
| `/api/explorer` → dossier **GHOST** | 932 139 $ (les mêmes 3 personnes comptées une 2ᵉ fois) | **0 $** |
| `/api/explorer` → dossier **SERIAL-12RUGS** | 210 900 $ | **0 $** |
| `/api/kol/{h}/proceeds` (GordonGekko, bkokoski, sxyz500) | 200 avec un total contredit par sa propre ventilation | **409 `proceeds_withdrawn`** |
| `/api/watchlist` | `totalProceeds` **et** `cashout.total` pour 4 personnes | `null` / buckets vides |
| `/api/pdf/{handle}` (GordonGekko) | 302 vers `latest.pdf` (« CASHOUTS DOCUMENTÉS $580K ») | **409 `proceeds_withdrawn`** |
| `/api/admin/plainte/generate?preset=botify` | génère le PDF | **409 `preset_frozen`** |
| Pages `/en|fr/kol/{handle}` | bloc « PROCEEDS : $X » | bloc absent (`(x ?? 0) > 0` devient faux) |
| `POST /api/scan/ask` | « Min. $580K observed » dans le prompt | phrase absente du contexte |

**Conservés** : 0xBossman (2 932 $) et Geppetto (2 082 $), intégralement adossés à des observations on-chain.

---

## 3. Ce qui casse — et ce qui ne casse pas

### 3.1 Ce qui casse volontairement

| Chose | Conséquence | Assumé ? |
|---|---|---|
| `/api/scan/ask` en anonyme | Tout appelant non authentifié reçoit 401. **Si un client externe l'utilisait sans cookie, il tombe.** Aucun appelant de ce type n'existe dans le dépôt ; un appelant hors dépôt ne serait pas visible d'ici | Oui — c'est la demande |
| `/api/pdf/GordonGekko` | Le dossier n'est plus servi, y compris à un administrateur | Oui — c'est le gel |
| Préréglage `botify` de la plainte | Refus 409 | Oui |
| `KolCanonicalSnapshot.totalDocumented` devient `number \| null` | Rupture de type pour tout consommateur externe au dépôt | Oui — `0` était une affirmation fausse |

### 3.2 Ce qui ne casse pas, et comment je le sais

- **Le scoring sur données complètes est bit-identique.** Les 33 snapshots anti-régression se mettent à jour en **126 insertions et 0 suppression** : ni `score`, ni `tier`, ni `confidence`, ni `drivers` ne changent. Seul le bloc `dataQuality` s'ajoute.
- **Le gate est fail-closed**, donc un oubli fait disparaître un chiffre au lieu d'en publier un. Deux fixtures de test l'ont démontré en échouant : `watchlist.publish-gate` et `publication-lifecycle-cycle` ne déclaraient pas l'état de publication et ont vu leur montant retiré. Corrigées en déclarant l'état, pas en affaiblissant le gate.
- **Aucune suppression.** Vérifié par test sur les deux fichiers SQL : aucun `DROP`, `DELETE` ou `TRUNCATE`, et aucune écriture de `NULL` dans un montant.

### 3.3 Correction post-STOP 2 — l'artefact des comptes de programme

Documentée ici parce qu'elle change ce que le déploiement fait. La mesure de concentration
exclut désormais les comptes détenus par un programme (courbe de bonding, pools AMM, vaults),
identifiés par une règle déterministe : un portefeuille est une autorité dont le compte
appartient au System Program. Les autorités absentes de la chaîne sont encadrées — on conclut
si les deux bornes tombent dans la même bande de signal, on refuse sinon.

Effet : 68 bascules RED annoncées → **0**. 10 tokens à 100 % → **0**.

### 3.4 Les deux limites connues

1. **`getTokenLargestAccounts` échoue sur les tokens à très grand nombre de comptes.** Mesuré : USDC → `Too many accounts requested (10000000 pubkeys)` chez Helius, `HTTP 429` sur le RPC public. Ces tokens sortent donc en `holders_unavailable: true`, confiance `Low`. C'est le comportement voulu — on préfère dire « inconnu » — mais cela concerne les stablecoins et les majors, pour lesquels la concentration n'est pas le signal pertinent. **Non traité dans ce lot.**
2. **Le cache mémoire de `/api/solana/holders` reste par instance de lambda.** L'échec y est désormais mis en cache 60 s au lieu de 5 min. Le problème de fond (cache par instance) est celui de tout le dépôt et sort du périmètre.

---

## 4. Retour arrière

### 4.1 Code

```bash
git revert 2536492 a7945ce      # ou redéployer depuis 5bed649
npx vercel --prod
```

Aucun couplage : les deux commits sont indépendants l'un de l'autre. Revenir sur `2536492` seul rétablit l'ancien comportement de scoring sans toucher au containment.

**Un ordre à respecter** : ne pas retirer la colonne `proceedsPublication` de la base avant d'avoir redéployé un code qui ne la lit plus.

### 4.2 Données

La colonne est additive et la table est un registre. **Il n'y a rien à défaire.** Une remise en publication est une seconde décision, pas une annulation — le SQL est fourni en pied de `RETRAIT_proceeds_2026-08-16.sql` :

```sql
INSERT INTO "KolProceedsPublicationLog" (…)
VALUES ('<handle>','profile_total','withdrawn','published', …, 'approved',
        '<pourquoi le chiffre est de nouveau publiable>', 'person:david-douville');
UPDATE "KolProfile" SET "proceedsPublication" = 'published' WHERE handle = '<handle>';
```

Le cycle `published → withdrawn → published` laisse **trois lignes** au journal. Une décision ne s'écrase pas, elle s'empile.

### 4.3 Documents

Les **31 archives PDF R2** sont intactes et le resteront. Le retour arrière du code suffit à les reservir.

---

## 5. Preuve d'exécution — `TRIGGER → EXECUTION → PERSISTENCE → CONSUMPTION → OUTPUT CORRECT`

### 5.1 Prouvé par exécution réelle

**Concentration des détenteurs, contre le réseau, 2026-08-16 :**

```
GHOST   De4ULouuU2c…pump   naïf 93,5 %  ->  CORRIGÉ 9,5 %   (84,4 % dans l'AMM pump.fun)
                           -> aucun signal. Le « 93,5 % » cité dans la première version de
                              ce document ÉTAIT l'artefact ; il est retiré.
BOTIFY  BYZ9CcZGKAX…69xb   53,4 %  -> aucun signal (sous le seuil de 60 %), score 13 GREEN
ANSEM                      62,6 %, dont 0,5 % en programme -> holders_concentrated_60 (+10)
                              seul token du corpus dont le score change : 50 -> 60
mint invalide                INDISPONIBLE  -> confiance Low, missing=[holders]

Seuils sur valeurs forcées : 95 % -> _80(+15) · 85 % -> _80(+15) · 70 % -> _60(+10)
                             45 % -> aucun · 12 % -> aucun
Classification : 83 mesures abouties sur 84 (99 %), 1 refus pour bornes ambiguës.
```

**RPC indisponible :**
```
données complètes : score=30  confiance=Medium  degraded=false
RPC mort          : score=30  confiance=Low     degraded=true  missing=[rpc]
repli RPC         : score=30  confiance=Medium  missing=[rpc_primary]
```
Le score est identique. Seule la confiance tombe.

**Échec de consultation du renseignement** (injection de panne par `vi.mock` — un import ESM ne se remplace pas à chaud, ma première tentative d'injection en script n'exerçait pas le chemin et je l'ai refaite) :
```
aucune correspondance : intelligenceStatus=NO_MATCH  confiance=Low  degraded=false
consultation en échec : intelligenceStatus=UNKNOWN   confiance=Low  degraded=true
                        missing=[intelligence]  unevaluatedSignals=[intelligence_overlay, sanctions_floor]
```

**Gates de production, sondes `GET` du 2026-08-16** : `/api/kol` 401 anonyme / 200 cookie beta ; `/api/pdf/GordonGekko` 401 même avec cookie forgé (validation DB) ; `pub-interligens.r2.dev` 401 (domaine public R2 non activé) ; `public-api.solscan.io` **404**.

### 5.2 Constaté non prouvé

- **Le comportement de Postgres.** Ni la migration ni le retrait ne sont appliqués (interdit du chantier), et il n'y a pas de Postgres local sur cette machine. Les contraintes `CHECK` sont vérifiées par lecture du SQL et par alignement avec les constantes TypeScript, **pas par exécution**. Le premier `INSERT` réel aura lieu à l'étape 4.
- **`PERSISTENCE` et `CONSUMPTION` en production.** La chaîne complète ne sera démontrable qu'après les étapes 1 à 4. Les contrôles post-exécution sont écrits en fin des deux fichiers SQL — notamment : total publié restant attendu **5 014 $**, et `KolProceedsEvent` inchangé à **5 602 lignes dont 6 `SUMMARY_ARKHAM`**.
- **L'effet réel sur les tiers de tokens** après réactivation du signal de concentration. GHOST est prouvé ; l'ampleur sur l'ensemble du corpus n'est pas mesurée.

### 5.3 Non vérifié

- La valeur de `NODE_ENV` et de `DATABASE_URL` en production (variables non lisibles).
- L'existence d'appelants externes au dépôt sur `/api/scan/ask` et `/api/v1/kol`.
- Le contenu des 29 PDF intermédiaires de GordonGekko (seuls ceux du 2026-07-18 et du 2026-08-16 ont été lus).

---

## 6. Purge Cloudflare — quand, et sur quoi

**À faire par toi, après l'étape 4 uniquement.** Avant, rien de visible n'a changé.

Les réponses nominatives portent déjà `Cache-Control: no-store` et `Vary: Cookie` (posés par `applyNominativeCacheHeaders`), donc en théorie aucune n'est en cache partagé. La purge vise ce qui pourrait l'être malgré tout :

- `/api/v1/kol` et `/api/v1/kol/*` — servent des montants et ne passent pas tous par le gate nominatif ;
- `/api/v1/score` — nouveau champ `topHolderPct` réellement renseigné ;
- `/api/explorer`, `/api/kol`, `/api/kol/leaderboard` — agrégats qui changent de valeur ;
- les pages `/en/kol/*` et `/fr/kol/*` ;
- `/api/casefile/public` — inchangé par ce lot (aucun montant), mais dans le même périmètre nominatif.

Une purge globale est plus sûre qu'une purge sélective : le coût est un pic de cache miss, le risque inverse est de laisser un montant retiré dans un cache d'edge.

---

## 7. Ce que ce chantier ne couvre pas

Explicitement hors périmètre, non commencé :

- **Identité de relecteur (P0-3).** `actorId = person:david-douville` est posé *à la main* dans le SQL de retrait. Le système reste incapable de produire un nom : `admin_session` est un HMAC constant de l'environnement. La contrainte `CHECK` interdit désormais la chaîne `'admin'` — c'est un garde-fou, pas une solution.
- **Score Versioning (P0-4).** `ScoreSnapshot` est toujours à 0 ligne et `snapshotScore` toujours sans appelant. Le bloc `dataQuality` ajouté ici est précisément une des données qu'un snapshot devra capturer — chaque jour sans lui ajoute des scores non reconstructibles.
- **Observabilité critique (P0-5).** Aucune alerte n'a été ajoutée. En particulier, `holderConcentration` journalise ses indisponibilités en `console.warn` et rien ne les agrège : si le RPC tombe durablement, le signal de concentration disparaîtra de nouveau en silence — plus lentement, mais aussi sûrement.
- **Cookie beta forgeable.** `/api/scan/ask` est désormais derrière le gate nominatif, mais ce gate vérifie la **présence** du cookie, pas sa validité en base.
- **La correction des montants du préréglage `botify`.** Le générateur est gelé ; les littéraux restent dans `src/lib/plainte/data.ts`, non supprimés, non réécrits. C'est une décision juridique.
- **Les trois autres sources de proceeds.** `KolProceedsSummary`, `KolProceedsEvent` et `KolTokenInvolvement` continuent de diverger entre elles. Ce lot retire la publication ; il ne tranche pas laquelle fait autorité.
- **Le `DELETE` non transactionnel de `computeProceedsForHandle`** (`proceeds.ts:231`), cause racine de l'irreproductibilité, est **inchangé**. Un recalcul peut toujours détruire l'historique d'un handle. Le journal fige au moins la valeur au moment du retrait, ce qui limite le dégât — mais la cause demeure.

### Signalements de passage, non corrigés

- `src/app/api/casefile/route.ts:141,173,234` — `parseFloat(top10_pct ?? "0")` : une panne RPC devient « concentration nulle ». Même famille que le défaut n° 3 corrigé ici, sur une autre route.
- `src/app/api/market/route.ts:57` — `NaN` explicite ensuite comparé.
- `src/lib/kol/proceeds.ts:258-262` — le commentaire annonce un plafond de 10 portefeuilles, le code applique `.slice(0, 5)`.
- `src/app/api/admin/kol/sync-proceeds/route.ts:6-14` — annonce `helius-scan` « every 12h » ; `vercel.json` planifie `0 4 * * *`.
