# BUILD 8 — KOL MEMORY V2 · clôture des étapes 1 à 6

Étapes 1 → 6 exécutées. **Les étapes 7 et 8 (migration Neon, post-checks) sont
à T1.**

---

## STATUS

**Câblage mergé. Guard refermé byte-identical. Fenêtre : 14 min 17 s.**

---

## LES TROIS MERGES

| étape | commit sur `main` | horodatage UTC |
|---|---|---|
| 1 · exemption ciblée | `d7992d7` | **09:06:52Z** |
| 4 · merge du code | `42be59a` | **09:16:18Z** (+9 min 26 s) |
| 5 · refermeture | `0ff5f0d` | **09:21:09Z** (+14 min 17 s) |

`main` : `cccac57` → **`0ff5f0d`**, 8 commits, historique linéaire, aucun
`--admin`, aucune PR forcée.

## ÉTAPE 6 — VÉRIFICATION DU SHA256

```
$ git show origin/main:scripts/guard-offline.sh | shasum -a 256
ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50
```

**Conforme.** Trois contrôles indépendants :

| contrôle | résultat |
|---|---|
| sha256 sur `origin/main` | `ce13d0c…13e50` — identique à l'exigence |
| `git diff cccac57 -- scripts/guard-offline.sh` | **vide** (0 ligne) |
| occurrences de `kol-memory-v2` dans le guard de `main` | **0** |
| diff de refermeture | **−42 lignes**, exactement les 42 posées par `d7992d7` |

Et les quatre chemins sont re-bloqués, vérifié en rejouant les
`FORBIDDEN_PATTERNS` de `main` :

```
src/app/api/kol/[handle]/route.ts   BLOQUÉ (^src/app/api/)
src/lib/kol/identity.ts             BLOQUÉ (^src/lib/kol/)
src/lib/kol/handleToMint.ts         BLOQUÉ (^src/lib/kol/)
src/lib/kol/canonical.ts            BLOQUÉ (^src/lib/kol/)
```

## LA FENÊTRE D'EXEMPTION

**14 min 17 s**, dont 9 min 26 s avant le merge du code.

Conditions tenues : 4 fichiers nommés un par un, **aucun wildcard** ;
**PR #252 est la seule PR fonctionnelle** de la fenêtre ; T1 au repos ; aucune
autre modification ; refermeture immédiatement après le merge, avant toute
migration prod. Les trois branches sont supprimées.

---

## PROOF

| | |
|---|---|
| suite | **4 704 verts / 4 706**, 2 skipped, 0 rouge |
| typecheck | vert |
| mutation | **12/12 mutants tués**, sources restaurées, sha256 vérifié |
| delta-run | `READ ONLY` + `ROLLBACK`, cible asserted |
| CI | 3 PR, tous checks verts, dont `Paths / branch guard (règles de main)` |
| prod-write | **0 écriture, 0 DDL, 0 Helius** |

---

## CE QUI EST RÉELLEMENT EN PRODUCTION

> **Rien de BUILD 8 n'est servi en production à cette heure.**
>
> Le code est sur `main` (`0ff5f0d`), pas déployé : le déploiement se fait par
> `npx vercel --prod` **uniquement**, sur validation humaine, et n'a pas été
> lancé. Il n'y a pas d'auto-deploy GitHub sur ce projet.
>
> Et la base est **inchangée** : les 3 colonnes de `KolProceedsEvent` n'existent
> pas encore, la DDL n'a pas été exécutée.

Ce qui prendra effet **au premier déploiement** :

| | effet |
|---|---|
| `/api/kol/[handle]` | 229 → **164 wallets** servis ; 65 adresses non publiables retirées, sur 21 des 32 profils publiés |
| attribution | 482 → **15 lignes** au rang `exact` ; 232 marquées « revue humaine requise » |
| `processor.ts` | recalcul de proceeds (Helius) déclenché sur **15** wallets au lieu de 482 |
| `canonical.ts` | `identityConfidence` cesse d'être structurellement bloqué sous `exact` ; le snapshot porte `proceedsProvenance` |
| pages KOL + casefile | résolvent sur le mint BOTIFY **44 caractères**, celui que la base porte (262/5/3 lignes) |

Le classement des montants (`INFERENCE` 5 407 · `THIRD_PARTY_DATA` 7 ·
`ESTIMATE` 112 · `UNCLASSIFIED` 76) est **déjà actif en lecture** — le registre
le dérive de `pricingSource` sans colonne. La DDL ne fera que le matérialiser.

---

## NEXT — T1

**Étape 7** : `docs/prep/patches/BUILD8/01_kolproceedsevent_nature.sql`, via
l'éditeur SQL Neon sur `ep-square-band`. Additive, 3 colonnes sur la seule
`KolProceedsEvent`, nullable et sans `DEFAULT`, rollback symétrique fourni.

**Étape 8** : les cinq contrôles de sortie du fichier. Répartition attendue —
`INFERENCE` 5 407 · `ESTIMATE` 112 · `THIRD_PARTY_DATA` 7 · `NULL` 76.

Contraintes tenues par le backfill tel qu'écrit : `UNCLASSIFIED` reste
`UNCLASSIFIED` (aucun `UPDATE` ne vise `CEX_DETECTED` ni une source inconnue),
aucun `methodRef` inventé (colonne laissée `NULL`, les `ESTIMATE` sont
auditables par leur `basis`).

Puis **étape 9** (validation produit/API) et **BUILD 8 CLOSE**.

---

## BACKLOG — inchangé

`computeIdentityConfidence` est corrigé ; restent : la branche `handle` de
`ingestion/pipeline.ts` (même `exact`/`manual` en dur, affirmation différente),
les synonymes `KolWallet` (tâche S4), `BOTIFY_KOLS` codée en dur,
`KolProfile`/`KolEvidence` hors P3, le flake `contradictionDetector`,
`CLAUDE.md` « 215 profils publiés » (réel : 32), et `pnpm test` qui salit
l'arbre.
