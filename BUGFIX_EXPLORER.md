# BUGFIX_EXPLORER — feat/case-intelligence-beta

Date: 2026-04-10
Fichier patché: `src/app/en/explorer/[caseId]/page.tsx`

## Bug 1 — Fond bleu au lieu de noir

### Symptôme
La page `/en/explorer/[caseId]` s'affichait avec un fond `#030712` (slate
quasi-bleu nuit) au lieu du noir absolu `#000000` du design system
INTERLIGENS (bg #000, accent #FF6B00, text #FFFFFF).

### Cause
Deux occurrences en dur de `background: '#030712'` dans le composant :
- état de chargement (`if (loading)`)
- layout racine de la page rendue

### Fix
`#030712` → `#000000` (remplacement global dans le fichier, 2 occurrences).
Aucun autre élément du layout touché : bordures `#111827 / #1e2330`, cards
`#0d1117`, header `#0a0a0a` — tout reste identique.

---

## Bug 2 — `dossier` null pour CASE-2026-BOTIFY-001

### Symptôme
Le composant `CaseSnapshot` ne s'affichait pas (rendu conditionnel
`{dossier && <CaseSnapshot ... />}`) parce que `dossier` restait `null`
après l'appel à `/api/explorer?kind=case&search=CASE-2026-BOTIFY-001`.

### Cause racine
Le `caseId` `CASE-2026-BOTIFY-001` est **synthétique** : il est fabriqué
à la volée par `src/app/api/scan/solana/route.ts:119` :

```ts
off_chain.case_id = caseFile.case_meta.case_id
  .replace(/CASE-\d{4}-/, `CASE-${new Date().getFullYear()}-`)
```

Le case source dans `src/data/cases/botify.json` est `CASE-2024-BOTIFY-001` ;
l'API de scan réécrit simplement l'année courante dessus pour l'affichage
demo. Ce caseId n'existe donc **pas** en base.

Côté DB (`kolCase.caseId`), les enregistrements BOTIFY réels sont :

- `BOTIFY-MAIN`   (bkokoski, sxyz500, …)
- `BOTIFY`        (planted, mariaqueennft, …)
- `BOTIFY-C1`, `BOTIFY-C2` (edurio seed)

`getCaseDossiers()` (`src/lib/explorer/explorerItems.ts`) groupe par
`caseId` brut et génère des dossiers dont le `title` est précisément ce
`caseId`. Conséquence :

1. `search=CASE-2026-BOTIFY-001` ne matche **aucun** item côté serveur
   (ni titre ni handle d'acteur).
2. Le `find(i => i.title === caseId)` côté client renvoie `undefined`.
3. `dossier` reste `null` → `CaseSnapshot` ne se rend pas.

### Fix (strictement côté page, aucun toucher à CaseSnapshot)
Lookup en deux étapes dans `useEffect` :

1. On tente l'appel exact : `search=CASE-2026-BOTIFY-001`.
2. Si aucun match, on extrait le slug via regex
   `/^CASE-\d{4}-(.+?)-\d+$/` → `BOTIFY`, puis on refait un appel
   `search=BOTIFY`. On prend le premier dossier dont le titre commence
   par `BOTIFY` (préférence à l'exact), sinon le premier item.

Cela permet au dossier `BOTIFY` / `BOTIFY-MAIN` (selon l'ordre de tri
primaryDate desc côté serveur) d'être remonté et passé à `CaseSnapshot`
tel quel, sans modifier ni l'API `/api/explorer`, ni la logique de
`snapshotSelectors`, ni `CaseSnapshot.tsx`.

### Pourquoi pas corriger scan/solana ?
- Consigne : ne pas toucher CaseSnapshot / askLog / Intelligence Mode.
  `/api/scan/solana` est hors scope strict mais il fabrique un `case_id`
  volontairement daté à l'année courante (c'est du demo/marketing).
  Le changer casserait l'UX du scan.
- Le fix page-level résout le bug sans effet de bord et reste robuste
  pour tout futur case synthétique `CASE-YYYY-<SLUG>-NNN`.

### Pourquoi pas créer un kolCase `CASE-2026-BOTIFY-001` ?
- Règle DB prod (memory): migrations via Neon SQL Editor, jamais
  `prisma db push`. Créer une entrée par an pour faire "matcher" le
  synthetic id serait fragile et du data leak. Le fix logique au niveau
  client est propre.

---

## Diff résumé
- `src/app/en/explorer/[caseId]/page.tsx`
  - `background: '#030712'` → `background: '#000000'` ×2
  - `useEffect` : lookup dossier à 2 étages (exact caseId, puis slug)

## Hors scope (non touché)
- `src/components/case/CaseSnapshot.tsx`
- `src/lib/case/snapshotSelectors.ts`
- `src/lib/askLog/*`, Intelligence Mode
- `src/lib/explorer/explorerItems.ts`
- `/api/explorer/route.ts`, `/api/scan/solana/route.ts`

## Commit
Branche : `feat/case-intelligence-beta`
Pas de `vercel --prod`, pas de `pnpm typecheck`, pas de `pnpm test`,
conformément à la consigne.
