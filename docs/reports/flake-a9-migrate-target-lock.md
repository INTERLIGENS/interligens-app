# Flake CI — `prisma-migrate-target-lock`, fermé

Branche `feat/cc-offline-158-flake-migrate-target-lock`, depuis `main = 8377feb`.
**PR ouverte, non mergée** — T1 mesure la production sur `main`.

---

## STATUS

**Fermé.** Le défaut est un budget d'exécution, pas un contrôle. Aucune
assertion n'a bougé, et le verrou est démontré toujours actif.

---

## LA CAUSE — deux budgets qui se contredisaient

Le fichier lance trois vrais sous-processus `npx prisma …`. Le helper leur
accorde **120 s** :

```ts
const sortie = execFileSync("npx", args, { … timeout: 120_000 });
```

Mais `vitest.config.ts` ne fixe **aucun `testTimeout`**, donc vitest coupait le
test à sa valeur par défaut — **5 000 ms**. L'enfant avait deux minutes, le test
en avait cinq secondes. Ce n'est pas un test lent : c'est un test dont les deux
horloges ne parlaient pas de la même durée.

### Ce que fait réellement `prisma generate` ici

Mesuré le 2026-09-07 sur `prisma/schema.prod.prisma` — **164 modèles,
4 482 lignes** — machine de développement **chaude** :

| condition | `real` | dont génération |
|---|---|---|
| cache moteur purgé | **2,81 s** | 0,53 s |
| passe suivante | 1,32 s | — |
| passe suivante | 1,47 s | — |

**L'essentiel du temps n'est pas la génération.** 0,53 s de travail utile pour
2,81 s au total : le reste est la résolution `npx` et le démarrage de Node.

Sur un runner CI froid — pas de cache npx, pas de moteur Prisma en cache, CPU
partagé, et **11 workers vitest en parallèle** — ce coût fixe dépasse
régulièrement 5 s. D'où un rouge intermittent qui n'a jamais de rapport avec le
diff jugé : il a bloqué la PR d'exemption du point 5, dont le diff ne contenait
que le guard.

---

## LE CORRECTIF

Une constante, `TIMEOUT_SOUS_PROCESSUS = 120_000`, posée sur les **trois** tests
qui lancent un sous-processus (`validate`, `migrate status`, `generate`) et
réutilisée par le helper. Le budget du test est désormais celui déjà accordé à
l'enfant.

`vitest.config.ts` est un chemin gelé — et c'était de toute façon la mauvaise
maille : un `testTimeout` global aurait relâché les 4 777 tests pour en réparer
trois.

**Aucune assertion n'est modifiée.** Un budget n'est pas une garantie.

---

## PREUVE

### 1 — le job passe en conditions froides

Caches purgés (`~/.cache/prisma`, cache local du harnais), puis :

```
Test Files  1 passed (1)
Tests       7 passed (7)
Duration    2.43s
```

### 2 — le verrou rougit toujours sur une mauvaise cible

C'est le point qui prouve que la stabilisation n'a rien vidé.
`node scripts/security/a9-lock-mutation-check.mjs` réintroduit la cible
historique — `directUrl = env("DATABASE_URL_UNPOOLED")`, c'est-à-dire
`ep-bold-sky`, la production — dans chaque schema à tour de rôle :

```
✅ référence verte — le verrou est en place et le test passe
✅ prisma/schema.prod.prisma — la mauvaise cible fait ROUGIR le test.
✅ prisma/schema.prisma      — la mauvaise cible fait ROUGIR le test.
✅ Le verrou tient. […] les deux schemas sont restaurés à l'octet près
```

Le harnais écrit **transitoirement** dans `prisma/` — chemin gelé — et restaure
dans un `finally` avec vérification sha256. Jamais en vue d'un commit ;
`git status prisma/` est vide après exécution. Une restauration incomplète
sortirait en erreur bruyante plutôt que de laisser un schema muté.

### 3 — rien d'autre n'a bougé

| | |
|---|---|
| suite complète | **4 777 verts / 4 779**, 2 skipped, 0 rouge |
| typecheck | vert |
| guard | `ce13d0c…13e50` — aucun chemin gelé committé |
| fichiers | 2 : le test, et le harnais de preuve |

---

## CE QUE JE N'AI PAS FAIT

- Aucun `testTimeout` global : la maille était trop large, et le fichier est gelé.
- Aucune mise en cache du client Prisma entre les runs : ce serait une refonte
  de la CI, hors périmètre.
- Aucune suppression ni allègement du test `generate`. Il est là pour une
  raison — `vercel-build` lance `prisma generate --schema
  prisma/schema.prod.prisma`, donc un verrou qui casserait `generate` casserait
  le déploiement. C'est exactement le contrôle qu'on vient de voir compter,
  puisque le déploiement d'aujourd'hui a échoué sur un autre défaut de build.

---

## LE TROISIÈME FLAKE, ET CE QU'ILS ONT EN COMMUN

Trois incidents d'infra ont coûté un run pendant BUILD 8 :

1. **`contradictionDetector`** — deux `Date.now()` séparés sous charge. Fermé.
2. **La course d'annulation de la PR #254** — ma suppression prématurée de la
   branche, suivie d'un reopen. Mon erreur, pas un défaut du dépôt.
3. **`prisma-migrate-target-lock`** — celui-ci.

Les deux vrais flakes ont la même forme : **une hypothèse implicite sur le temps
qui tient sur une machine au repos et casse sous charge.** L'un supposait que
deux lectures d'horloge rendraient la même milliseconde, l'autre qu'un
sous-processus tiendrait en cinq secondes. Aucun des deux ne testait ce qu'il
croyait tester au moment où il rougissait.
