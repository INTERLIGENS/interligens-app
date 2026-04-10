# BUGFIX_SNAPSHOT_V2 — CaseSnapshot (feat/case-intelligence-beta)

Date: 2026-04-10
Fichiers patchés :
- `src/components/case/CaseSnapshot.tsx`
- `src/lib/case/snapshotSelectors.ts`

---

## Bug 1 — Bouton "OPEN DOSSIER →" inopérant

### Symptôme
Le CTA "OPEN DOSSIER →" dans le bloc CaseSnapshot ne déclenchait rien
de visible côté user.

### Cause
Ligne 470 de `CaseSnapshot.tsx` :

```tsx
<a href="#case-detail">OPEN DOSSIER →</a>
```

- C'est un ancrage intra-page vers `<div id="case-detail">`.
- Le composant CaseSnapshot est rendu à l'intérieur de
  `src/app/en/explorer/[caseId]/page.tsx`, qui porte bien l'ancre, mais :
    1. Sur un snapshot CONFIRMED premium, le bouton doit *toujours*
       déboucher sur une URL stable, même si CaseSnapshot est un jour
       embarqué ailleurs (listing, demo, landing, email).
    2. Un href bareword `#case-detail` rend l'intention floue
       (hash-only, pas de `caseId` dans l'URL) et ne survit pas à
       un montage hors de la page détail.

### Fix
```tsx
href={`/${locale}/explorer/${encodeURIComponent(caseId)}#case-detail`}
```

- Route canonique du dossier complet : `/{locale}/explorer/[caseId]`
  (cf. `src/app/en/explorer/[caseId]/page.tsx` et `fr` equivalent).
- `encodeURIComponent(caseId)` : `caseId` peut contenir des caractères
  non-ASCII ou des tirets multiples (ex. `CASE-2026-BOTIFY-001`) — on
  reste conservateur.
- Le hash `#case-detail` est conservé : sur la page détail elle-même,
  le navigateur scrolle au bloc ; depuis n'importe quelle autre page,
  il navigue + scrolle automatiquement.
- Cohérent avec le routing Next 16 existant (rewrites `en`/`fr` déjà
  utilisées dans toutes les autres ancres de CaseSnapshot, cf. le
  LINKED ACTOR `\`/${locale}/kol/${actor.handle}\``).

Aucun autre élément du composant touché.

---

## Bug 2 — Contradiction "CONFIRMED" + "No archived evidence"

### Symptôme
Sur un snapshot dont la headline est `CONFIRMED — Confirmed case —
multi-source evidence`, la colonne *CORE EVIDENCE* affichait
"No archived evidence" juste en dessous. Dissonance éditoriale
brutale qui sape la crédibilité du snapshot.

### Audit rapide
- `selectCoreEvidence(snapshots, 3)` (snapshotSelectors.ts:208) est
  pur : il trie et renvoie `snapshots.slice(0, 3)`. Il ne regarde
  **que** les `SnapshotEvidenceItem` (modèle `KolEvidenceSnapshot` via
  `/api/evidence/snapshots?relationType=case&relationKey=…`).
- Dans CaseSnapshot.tsx (avant fix) :
  ```tsx
  {evidence.length === 0 ? (
    <div>No archived evidence</div>
  ) : (…)}
  ```
- Donc : si **aucun snapshot archivé** n'existe pour ce `caseId` dans
  `KolEvidenceSnapshot`, on affiche le message vide — **indépendamment**
  de la solidité réelle du dossier (`documentationStatus`,
  `evidenceDepth`, `strongestFlags`, `topCoordinationSignal`,
  `linkedActors`, `summary`).
- Un case peut parfaitement être `documented` + `evidenceDepth=strong`
  (→ tier CONFIRMED) sans avoir encore eu de `KolEvidenceSnapshot`
  archivé. C'est exactement le cas de `BOTIFY-MAIN` aujourd'hui : le
  dossier a des acteurs publiés, des flags, des liens on-chain, une
  `evidence` brute dans `KolCase`, mais la table `KolEvidenceSnapshot`
  n'a que deux lignes, toutes `relationKey = "BOTIFY-MAIN"`.
- Et surtout : le front-end charge les snapshots via
  `relationKey = caseId` exact — si `caseId` ne matche pas la
  `relationKey` archivée (cas synthétique `CASE-2026-BOTIFY-001` vs
  `BOTIFY-MAIN`), la requête renvoie `[]` et l'empty-state casse
  le snapshot.

### Règle retenue
Quand `selectCoreEvidence` renvoie `[]`, rendre un **fallback
truthful** construit *uniquement* depuis les champs réels du dossier
déjà chargé. Aucun champ inventé, aucune promesse de preuve.

Le fallback est exposé comme un *pure selector* dans
`snapshotSelectors.ts`, testable et traçable :

```ts
coreEvidenceFallback(dossier, locale): string
```

Branches — ordonnées du plus fort au plus minimal :

| Priorité | Condition réelle sur `dossier`                             | Copy EN                                | Copy FR                                       |
|----------|------------------------------------------------------------|----------------------------------------|-----------------------------------------------|
| 1        | `documentationStatus === "documented"` **et** `depth ≥ 3`  | Evidence documented in linked records  | Preuves documentées dans les dossiers liés    |
| 2        | `documented` OU `topCoordinationSignal` OU `strongestFlags.length > 0` | Published signals on file  | Signaux publiés au dossier                    |
| 3        | `depth ≥ 2` (moderate+)                                    | Source-backed case record available    | Enregistrement de cas source disponible       |
| 4        | `linkedActorsCount > 0` OU `summary` non-vide              | Documented case inputs available       | Éléments de dossier documentés disponibles    |
| 5        | Aucun des ci-dessus                                        | Evidence archival pending               | Archivage de preuves en attente                |

`DEPTH_RANK` déjà défini au-dessus (`none=0 … comprehensive=4`) est
réutilisé — pas de duplication.

### Rendu UI
Dans CaseSnapshot.tsx, l'empty branch est remplacée par une **ghost
card** (dashed border, pas solide) qui s'intègre visuellement à la
grille CORE EVIDENCE sans hurler "empty state" :

```tsx
<div style={{ background: BG_RAISED, border: '1px dashed BORDER', ... }}>
  <div>LINKED RECORDS</div>
  <div>{coreEvidenceFallback(dossier, locale)}</div>
</div>
```

- Même `BG_RAISED`, même `BORDER`, même `borderRadius` que les cards
  d'evidence réelles → cohérence visuelle.
- `border: 1px dashed` (vs `solid` pour les vraies preuves) → distinction
  honnête : "record reference" et non "proof artifact".
- Label `LINKED RECORDS` / `ENREGISTREMENTS LIÉS` : signalement clair
  que ce qui suit référence les champs du case, pas un artefact archivé.

### Cas couverts (non-régression CORE EVIDENCE)

| Situation dossier                                                | Rendu                                     |
|------------------------------------------------------------------|-------------------------------------------|
| Snapshots archivés présents (≥ 1)                                | Cards evidence réelles (inchangé)         |
| CONFIRMED, documented+strong, 0 snapshot                         | Ghost card — "Evidence documented in linked records" |
| PROBABLE avec coord signal, 0 snapshot                           | Ghost card — "Published signals on file"  |
| SIGNAL avec moderate depth, 0 snapshot                           | Ghost card — "Source-backed case record available" |
| SIGNAL sans depth mais avec acteurs liés                         | Ghost card — "Documented case inputs available" |
| SIGNAL vide — pas d'acteurs, pas de flags, pas de summary        | Ghost card — "Evidence archival pending"  |
| Dossier totalement vide (guard `hasAnything` en amont)           | Inchangé : "DOSSIER UNDER QUALIFICATION…" (pas de grid rendue) |

### Garde-fous respectés
- ❌ Aucune preuve inventée : chaque fallback pointe sur un champ
  non-nul du `SnapshotDossier`.
- ❌ Pas de sur-vente : on dit "linked records" / "signals on file" /
  "case inputs", jamais "proof" / "evidence archived".
- ❌ Aucun autre case n'est dégradé — les dossiers qui avaient déjà
  des snapshots gardent le rendu d'origine.
- ✅ Crédibilité préservée : la headline CONFIRMED n'est plus sapée
  par un vide froid ; elle est suivie d'une référence honnête aux
  champs réels du dossier.

---

## Hors scope (non touché)
- `AskLog`, `Intelligence Mode`, `IntelligenceModeBadge`
- `/api/explorer`, `/api/evidence/snapshots`
- `selectCoreEvidence` (logique de tri des *vraies* preuves inchangée)
- Tous les autres blocs de CaseSnapshot : HEADER, SOLIDITY, KEY SIGNALS,
  LINKED ACTOR, RECOMMENDED ACTION, footer IntelligenceModeBadge

## Commit
Branche : `feat/case-intelligence-beta`
Puis `npx vercel --prod` conformément à la consigne.
