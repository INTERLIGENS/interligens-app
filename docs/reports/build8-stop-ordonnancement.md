# BUILD 8 — STOP avant exécution : l'ordre 4 → 5 se bloque lui-même

**Rien n'a été entrepris.** La réserve technique demandait une vérification
*avant de commencer* : elle se confirme. `main` est intact sur `cccac57`,
aucune exemption n'a été ouverte, l'arbre est propre.

---

## STATUS

**STOP — contradiction d'une prémisse ratifiée.** L'ordre ratifié place la
refermeture du guard (4) avant le merge du code (5). Cet ordre ne peut pas
s'exécuter : l'étape 5 est mécaniquement bloquée par l'étape 4.

---

## LE MÉCANISME, EXACTEMENT

Trois faits, chacun vérifié :

**1. La CI exécute le guard de `main`, jamais celui de la branche.**
`.github/workflows/guard-offline.yml` :

```yaml
- name: Extraire le guard depuis origin/main
  run: git show origin/main:scripts/guard-offline.sh > "$RUNNER_TEMP/guard-main.sh"
- name: Exécuter le guard de main sur le diff de la PR
  run: bash "$RUNNER_TEMP/guard-main.sh"
```

C'est délibéré, et le fichier le dit : « on ne peut pas s'auto-autoriser en
élargissant la règle dans la PR qui en profite ». Le hook pre-commit local lit
le working tree ; **la CI fait autorité et ne lit que `main`.**

**2. Ce job est un check requis, bloquant.**
Ruleset `protect-main` (id 16637172, `active`) :

```
REQUIRED: All Security Gates Passed
REQUIRED: Paths / branch guard (règles de main)
RULE: pull_request { required_approving_review_count: 0, ... }
RULE: required_linear_history
```

**3. Les 4 fichiers du câblage sont tous sur chemin gelé.**
`src/app/api/kol/[handle]/route.ts` → `^src/app/api/` ; les trois autres
(`identity.ts`, `handleToMint.ts`, `canonical.ts`) → `^src/lib/kol/`.

### La conséquence

À l'étape 5, la PR de code est jugée par le guard **tel qu'il est sur `main` à
cet instant**. L'étape 4 vient précisément d'en retirer l'exemption et de le
ramener à `ce13d0c…13e50`. Ce guard-là voit 4 fichiers gelés dans le diff, sort
en `🛑 BLOCKED`, exit 1 → le check requis `Paths / branch guard (règles de
main)` échoue → le merge est refusé par le ruleset.

Les seules sorties seraient `--admin` (interdit) ou une réouverture d'exemption
(ce que l'étape 4 vient d'annuler). **Il n'y en a pas d'autre : je n'en invente
aucune.**

> L'exemption doit être présente sur `main` **pendant** que la PR de code est
> jugée. Elle doit donc survivre au merge du code, et ne peut être refermée
> qu'après.

---

## CE QUI N'EST *PAS* EN CAUSE

- **La voie de maintenance elle-même fonctionne.** `^hotfix/guard-[a-z0-9-]+$`
  + système de garde seul dans le diff (`scripts/guard-offline.sh` +
  `.github/workflows/guard-offline.yml`) : les étapes 1 et 4 passent chacune
  isolément. C'est leur ORDRE relatif à l'étape 5 qui est impossible.
- **Le sha256 final exigé reste atteignable** — la refermeture byte-identical
  vers `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` est
  réalisable, mais après le merge du code, pas avant.
- **Le périmètre.** Les 4 fichiers, le backfill exact
  (5 407 / 7 / 112 / 76), l'interdiction de reclasser UNCLASSIFIED et de
  fabriquer un methodRef : rien de tout cela n'est remis en cause ici.

---

## POURQUOI JE M'ARRÊTE AVANT L'ÉTAPE 1

Ouvrir l'exemption puis buter sur le blocage laisserait `main` avec une
exemption de chemins gelés **ouverte** pendant l'arbitrage — une posture de
sécurité dégradée, pour un chantier qui ne pourrait pas se terminer. M'arrêter
maintenant laisse `main` exactement dans l'état ratifié.

---

## CE QUE J'ATTENDS

Une décision sur l'ordonnancement. La seule permutation qui lève le blocage
sans toucher au périmètre ni au sha final est l'inversion de 4 et 5 :

```
1  exemption ciblée (hotfix/guard-*, guard seul)     → merge
2  câblage des 4 fichiers
3  tests + mutation
5  merge du code            ← jugé par le guard AVEC exemption
4  refermeture byte-identical → ce13d0c…13e50
6  T1 : migration Neon additive
```

Je ne l'applique pas de moi-même : l'ordre 1→9 est ratifié, et le modifier est
une décision de méthode. Sur GO, je reprends à l'étape 1 et je vais jusqu'à la
refermeture incluse.

---

## ÉTAT RÉEL À CET INSTANT

| | |
|---|---|
| `main` | `cccac57` — **inchangé**, aucun merge, aucune PR ouverte |
| branche | `feat/cc-offline-151-kol-memory-v2` @ `1168500`, arbre propre |
| `sha256` guard | `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` — conforme, jamais modifié (0 commit le touche) |
| **en production** | **rien de BUILD 8.** Aucun déploiement, aucun merge. Tout vit sur la branche |
| prod-write / réseau | 0 écriture, 0 DDL, 0 Helius |
