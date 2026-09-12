# Stash Inventory — 2026-05-24

**Date d'inventaire** : 2026-05-24
**Owner** : David Douville
**Status** : ⚠️ NE PAS DROP avant arbitrage au retour Indo (septembre 2026)

---

## Contexte

Après la session "Full Cleanup + Indo Prep" du 24 mai 2026, 5 stashes artefacts ont été
droppés (last-report.json régénérables et 1 stash vide). 3 stashes WIP réels ont été
conservés pour arbitrage à froid au retour d'Indo.

GPT a confirmé : conservation, pas de drop avant retour.

Ce fichier est l'unique source de vérité sur le contenu de ces 3 stashes : il survit
même si `git stash` est purgé accidentellement (les SHAs des parent commits sont
conservés en référence).

---

## Stashes conservés

### Stash 1 — CBEX/LAB casefiles WIP (pre-offline-setup snapshot)

- **Référence runtime** : `stash@{0}`
- **Description originale** : `On main: pre-offline-setup-20260520-120632`
- **Date** : 2026-05-20 12:06:33 +0200
- **Parent commit** : `97a61b1` — `feat: LAB token casefile — first token_casefiles entry, TokenCasefileView, shared markdown renderer, library index extended`
- **Branche parent** : `main`
- **Volume** : 10 fichiers, 113 insertions, 1 deletion
- **Fichiers modifiés** :
  - `__tests__/reflex/calibration/last-report.json` (régénérable, peut être ignoré au pop)
  - `prisma/schema.prod.prisma` (+2 lignes)
  - `prisma/seed-cbex.ts` (+24)
  - `prisma/seed-lab.ts` (+20)
  - `src/app/{en,fr}/cases/cbex/page.tsx` (+8 EN, +8 FR)
  - `src/app/{en,fr}/cases/lab/page.tsx` (+7 EN, +7 FR)
  - `src/components/cases/PlatformCasefileView.tsx` (+18)
  - `src/components/cases/TokenCasefileView.tsx` (+18)
- **Contexte deviné** : snapshot pris juste avant le passage en offline mode (séquence
  `pre-offline-setup`). Modifications ciblées sur les casefiles CBEX et LAB et leurs
  composants de rendu partagés — vraisemblablement un travail d'enrichissement des deux
  premières fiches plateforme/token canoniques avant gel offline.
- **Recommandation arbitrage retour** :
  - Si CBEX/LAB ont évolué fortement entre-temps : `drop` (le diff sera obsolète).
  - Sinon : `git stash branch wip/cbex-lab-pre-offline stash@{0}` pour réviser dans une
    branche dédiée, puis cherry-pick au cas par cas. Le fichier `last-report.json`
    doit être restauré depuis main, pas pris du stash.

### Stash 2 — TokenPriceTracker schema + vercel cron WIP

- **Référence runtime** : `stash@{1}`
- **Description originale** : `WIP on main: d75adf1 chore(watcher-v2): remove 21 dead handles confirmed by X API`
- **Date** : 2026-05-14 17:42:39 +0200
- **Parent commit** : `d75adf1` — `chore(watcher-v2): remove 21 dead handles confirmed by X API`
- **Branche parent** : `main`
- **Volume** : 2 fichiers, 34 insertions, 1 deletion
- **Fichiers modifiés** :
  - `prisma/schema.prod.prisma` (+32 lignes — vraisemblablement la table TokenPriceTracker)
  - `vercel.json` (+3, -1 — ajout/modif d'un cron)
- **Contexte deviné** : aligne avec la mémoire projet `project_token_price_tracker.md`
  ("new per-token table separate from PriceCache; DexScreener + Jupiter; watermark
  peak strategy"). +32 lignes de schéma correspondent au scaffold du modèle Prisma.
  Modification de `vercel.json` cohérente avec ajout d'un cron de polling.
- **⚠️ Sensibilité** : touche `prisma/schema.prod.prisma` ET `vercel.json` — deux
  chemins INTERDITS en offline mode. Le pop nécessitera une fenêtre online avec
  validation humaine + migration Neon SQL Editor.
- **Recommandation arbitrage retour** :
  - Plan Vercel = Hobby → cron capé à 1/jour : vérifier que le cron ajouté respecte
    cette contrainte avant d'appliquer.
  - Si TokenPriceTracker est encore au programme : `git stash branch wip/token-price-tracker stash@{1}`,
    valider la migration sur Neon, ouvrir PR.
  - Si pivot stratégique entre-temps : `drop`.

### Stash 3 — Structural foundations cleanup WIP

- **Référence runtime** : `stash@{2}`
- **Description originale** : `WIP on main: 0b9a05d fix: structural foundations — layout system, responsive, routes, sparse graph, design consistency`
- **Date** : 2026-04-20 21:01:42 +0200
- **Parent commit** : `0b9a05d` — `fix: structural foundations — layout system, responsive, routes, sparse graph, design consistency`
- **Branche parent** : `main`
- **Volume** : 21 fichiers, 91 insertions, 781 deletions (NET DELETIONS — gros nettoyage)
- **Fichiers modifiés** :
  - `docs/audits/{design,layout,routes}-audit.md` (3 fichiers d'audit SUPPRIMÉS, -515 lignes total)
  - `eslint.config.mjs` (+36, -? — ajout règles probablement)
  - `src/app/{admin,en/explorer,en/investigator,en/investigator/login,en/kol,en/methodology,fr/explorer,fr/kol,fr/methodology,history,investigators/box/cases,investigators/box/graph/demo,investigators/box/network,scan}/page.tsx` (touches mineures, sauf `scan/page.tsx` -191 lignes et `investigators/box/cases` et `box/network` +12/+18)
  - `src/components/LaundryTrailCard.tsx` (+2/-? micro-fix)
  - `src/components/network/EditableGraph.tsx` (-14)
  - `src/components/vault/CaseGraphPremium.tsx` (62 lignes touchées, net -)
- **Contexte deviné** : finition d'un sprint de cleanup structurel (audits docs vidés
  parce que traités, suppression d'une vieille `scan/page.tsx`, ajustements lint).
  Le stash a probablement été créé pour interrompre temporairement le sprint et n'a
  jamais été repris.
- **⚠️ Sensibilité** : touche `src/components/**` (interdit offline), `src/app/casefiles`
  non touché mais beaucoup de pages publiques. Pop = risque de régression UI sur
  surfaces beta enquêteur. **À ne PAS pop pendant offline mode.**
- **Recommandation arbitrage retour** :
  - Probablement le plus risqué des trois — code de 5 semaines, divergence forte attendue.
  - Inspection visuelle ligne par ligne via `git stash show -p stash@{2} | less`
    avant toute action.
  - Si décision = appliquer : `git stash branch wip/structural-cleanup-apr20 stash@{2}`,
    puis cherry-pick fichier par fichier, en testant à chaque étape.
  - Si décision = drop : documenter la raison dans le commit qui drop.

---

## Process arbitrage retour Indo

1. Au retour, vérifier si chaque stash est encore pertinent (lire ce fichier d'abord).
2. Pour chaque stash : décider `drop` / `apply` / `pop` / `créer une branche` dédiée.
3. Documenter la décision dans un commit ou mise à jour de ce fichier.
4. Ne pas oublier que les SHAs des parent commits permettent de reconstituer le contexte
   même si le stash est perdu :
   - Stash 1 parent : `97a61b1`
   - Stash 2 parent : `d75adf1`
   - Stash 3 parent : `0b9a05d`

---

## Commandes utiles au retour

```bash
# Voir contenu d'un stash en diff complet
git stash show -p stash@{N}

# Voir uniquement les noms de fichiers
git stash show --name-only stash@{N}

# Appliquer dans une nouvelle branche (sécurisé — pas de conflit avec main actuel)
git stash branch <new-branch-name> stash@{N}

# Pop dans la working tree courante (RISQUÉ si main a divergé)
git stash pop stash@{N}

# Drop si plus pertinent
git stash drop stash@{N}

# Voir l'état d'origine
git log -1 --format='%H %s' $(git rev-parse stash@{N}^)
```

---

## Audit trail

- 2026-05-24 : inventaire initial créé par session "Bloc immédiat post-arbitrage GPT".
  Décision GPT : conservation des 3 stashes, pas de drop avant retour Indo.
