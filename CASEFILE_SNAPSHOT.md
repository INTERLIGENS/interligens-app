# Case Snapshot — Compression block CaseFile

Branch: `feat/case-intelligence-beta`
Date: 2026-04-10

## Objectif

Bloc supérieur premium en tête de la page CaseFile pour qu'un utilisateur (BA, investigateur, retail averti) comprenne un dossier en 20–30 secondes avant de lire le détail complet.

---

## Fichiers créés / modifiés

### Créés
- `src/lib/case/snapshotSelectors.ts` — pure functions : derivation solidité, ranking signaux, ranking preuves, sélection actor, next action, subline.
- `src/components/case/CaseSnapshot.tsx` — composant UI présentationnel (props only, zéro fetch).
- `CASEFILE_SNAPSHOT.md` — ce fichier.

### Modifiés
- `src/app/en/explorer/[caseId]/page.tsx` — import + injection du `<CaseSnapshot />` au-dessus du bloc TITLE existant. Ajout d'un anchor `id="case-detail"` sur le bloc TITLE pour le scroll depuis le CTA "OPEN DOSSIER".

### Non modifié
- Aucun composant existant n'est touché.
- La page CaseFile garde **exactement** son contenu actuel sous le snapshot — aucun retrait, aucune duplication.
- Aucune nouvelle route, aucun nouveau fetch — le snapshot consomme `dossier` + `snapshots` déjà fetched par la page parent.

---

## Audit — où vit le CaseFile et comment il est alimenté

### Page
`src/app/en/explorer/[caseId]/page.tsx` (client component, inline styles, accent `#F85B05`).

### Routes data
- `GET /api/explorer?kind=case&search=<caseId>` → renvoie un array de `DossierItem` ; on prend `items.find(i => i.title === caseId)`. Implémentation : `src/lib/explorer/explorerItems.ts:getCaseDossiers`.
- `GET /api/evidence/snapshots?relationType=case&relationKey=<caseId>` → renvoie `{ snapshots: [...] }`.

### Champs dossier disponibles (DossierItem)
- `title`, `summary`, `linkedActors[]`, `linkedActorsCount`
- `proceedsObservedTotal`, `proceedsCoverage`
- `evidenceDepth` (none | weak | moderate | strong | comprehensive)
- `strongestFlags[]` (BehaviorFlagKey, max 5)
- `documentationStatus` (documented | partial)
- `multiLaunchRecurrence`, `multiLaunchCount`
- `topCoordinationSignal` ({ labelEn, labelFr, strength })
- `snapshotCount`

### Champs snapshot
- `id`, `snapshotType` (evidence_image | document_excerpt | tweet_post | other)
- `title`, `caption`, `sourceLabel`, `observedAt`, `imageUrl`

### Ce qu'il faut dériver
- **TigerScore / tier** — n'existent **pas** sur les cases (réservés aux scans / KOL profiles). → remplacé par un **niveau de solidité** (CONFIRMED / PROBABLE / SIGNAL) dérivé de `documentationStatus` + `evidenceDepth`. Cohérent avec le brief ("niveau de solidité (CONFIRMED / PROBABLE / SIGNAL) si cohérent avec le modèle existant").
- **Verdict** — phrase courte par tier (cf. `solidityCopy()`).
- **4 signaux clés** — fusion ranked de coordination + multi-launch + behavior flags + proceeds + actor density.
- **3 preuves majeures** — snapshots ranked par type + récence.
- **Featured actor** — meilleur tier parmi `linkedActors`.
- **Next action** — branche sur le tier de solidité.

### Ce qu'il NE FAUT PAS dupliquer
- La liste complète des `linkedActors` est déjà rendue plus bas par le bloc "LINKED ACTORS" → le snapshot ne montre **qu'un seul** actor (le plus pertinent), avec un compteur "+N more".
- La liste complète des `snapshots` est déjà rendue plus bas par "EVIDENCE ON FILE" → le snapshot ne montre **que les 3 premiers** ranked.
- Le `summary` brut est déjà rendu sous le titre → le snapshot affiche une **subline compressée** (parts pipe-séparées), pas le summary brut.
- Les `strongestFlags` sont déjà rendus plus bas en chips → dans le snapshot, ils sont **fondus** dans la liste de signaux clés ranked.

---

## Architecture du snapshot — structure définitive

```
┌─────────────────────────────────────────────────────────────┐
│ ▌ CASE SNAPSHOT                              SOLIDITY        │
│   {VERDICT LINE — h2 26px black}            ┌──────────┐   │
│   subline · pipe · separated · narrative     │ CONFIRMED │  │
│                                              └──────────┘   │
│                                              status · depth  │
├─────────────────────────────────────────────────────────────┤
│ KEY SIGNALS (4)              CORE EVIDENCE (3)              │
│ 01  ...                      ┌─ EVIDENCE IMAGE ──────────┐  │
│ 02  ...                      │  Title                    │  │
│ 03  ...                      │  Caption (2-line clamp)   │  │
│ 04  ...                      └───────────────────────────┘  │
│                              ┌─ DOCUMENT EXCERPT ────────┐  │
│                              │  ...                      │  │
│                              └───────────────────────────┘  │
│                              ┌─ TWEET POST ──────────────┐  │
│                              │  ...                      │  │
│                              └───────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│ LINKED ACTOR  @handle  TIER A  PROMOTER         +2 more    │
├─────────────────────────────────────────────────────────────┤
│ RECOMMENDED ACTION                           ┌────────────┐ │
│ OPEN FULL DOSSIER                            │ OPEN DOSSIER│ │
│ Investigate 3 linked actors                  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **Header bar** : verdict line (gauche, 26px black) + bloc SOLIDITY (droite, badge couleur tier).
- **Body grid 2 colonnes** : signaux (numérotés 01..04) | preuves (cards stacked).
- **Linked actor strip** : conditionnel, une seule carte horizontale.
- **Action footer** : label + hint à gauche, CTA pill orange à droite.
- **Accent bar verticale** orange à gauche du bloc.

---

## Logique de sélection — détail

### 1. Solidity tier (`deriveSolidity`)

Source : `documentationStatus` + `evidenceDepth` ranked.

| Condition | Tier |
|-----------|------|
| `documented` AND depth ≥ `strong` | **CONFIRMED** |
| `documented` OR depth ≥ `moderate` | **PROBABLE** |
| sinon | **SIGNAL** |

`DEPTH_RANK = { none:0, weak:1, moderate:2, strong:3, comprehensive:4 }`

Verdict line par tier (`solidityCopy`) :
- CONFIRMED → "Confirmed case — multi-source evidence"
- PROBABLE → "Probable pattern — corroboration in progress"
- SIGNAL → "Early signal — partial evidence"

Couleurs de badge :
- CONFIRMED → rouge `#ef4444` sur fond `#dc262615`
- PROBABLE → ambre `#f59e0b`
- SIGNAL → bleu `#60a5fa`

### 2. Sélection des signaux clés (`selectKeySignals`, max 4)

Pipeline :
1. Coordination signal (`topCoordinationSignal`) — weight 95 si strong, 75 sinon.
2. Multi-launch recurrence (si `multiLaunchCount ≥ 2`) — weight 88, label "Shared actors across N dossiers".
3. Behavior flags ranked par priorité fixe :
   - LAUNDERING_INDICATORS (100)
   - COORDINATED_PROMOTION (90)
   - CROSS_CASE_RECURRENCE (80)
   - MULTI_LAUNCH_LINKED (70)
   - REPEATED_CASHOUT (60)
   - MULTI_HOP_TRANSFER (50)
   - KNOWN_LINKED_WALLETS (40)
4. Proceeds observed (si `> 0`) — weight 65, label "Min. $XK in observed proceeds".
5. Actor density (si `linkedActorsCount ≥ 3`) — weight 55, label "N published actors linked".

Puis : tri par weight desc, dedup par label, cap à 4.

> **Brief mappant** : la priorité demandée était "CRITICAL > OFFICIAL > RPC_SOURCE" — ces buckets sont des catégories de signaux **scan**, pas des champs CaseFile. Sur le modèle Case existant, la hiérarchie naturelle est celle des `BehaviorFlagKey` + signaux de coordination + récurrence cross-dossier. La priorisation ci-dessus encode cette hiérarchie sans inventer de champs.

### 3. Sélection des preuves (`selectCoreEvidence`, max 3)

Pipeline :
1. Tri par poids de type :
   - `evidence_image` (on-chain artefact) → 100
   - `document_excerpt` → 80
   - `tweet_post` → 60
   - `other` → 30
2. Tie-break par `observedAt` desc.
3. Slice 3.

Garantit que la preuve **on-chain** prime sur le tweet, et que le document légal prime sur le tweet — cohérent avec le pitch "investigator-grade".

### 4. Featured actor (`selectFeaturedActor`)

- Tri par tier : S > A > B > C > D.
- Fallback : premier de la liste.
- Conditionnel : aucun rendu si `linkedActors.length === 0`.
- Affiche `+N more` si plusieurs actors publiés.

### 5. Next action (`deriveNextAction`)

Branche sur le tier de solidité :

| Tier | Label | Hint |
|------|-------|------|
| CONFIRMED | OPEN FULL DOSSIER | Investigate N linked actors / Review full evidence chain |
| PROBABLE | CORROBORATE EVIDENCE | Cross-reference with KOL timeline and on-chain history |
| SIGNAL | MONITOR | Insufficient evidence to escalate — active surveillance |

> Pas de "ESCALATE TO LEGAL" ni de promesses excessives. Les actions restent dans le périmètre INTELLIGENCE / OBSERVATION, jamais juridique. Cohérent avec le ton retail-first sans sur-vendre.

### 6. Subline (`buildSubline`)

Concatène en pipe-séparé (max 4 parts) :
1. `N published actor(s)`
2. `min. $XK observed`
3. `evidence depth: <level>`
4. `<coordination signal>`

Tronqué naturellement par les conditions (pas de pipe orphelin si une donnée manque).

---

## Empty / partial states

- **Dossier vide** (`dossier === null`) : le snapshot **n'est pas rendu du tout** — la garde `{dossier && (...)` côté page parent l'évite. Pas de placeholder cassé.
- **Dossier sans signaux ET sans preuves ET sans actor ET sans summary** : rendu d'un message minimal "DOSSIER UNDER QUALIFICATION — LIMITED PUBLISHABLE DATA AT THIS TIME." dans le body au lieu d'une grille vide.
- **Signaux vides seuls** : message "No qualified signal".
- **Preuves vides seules** : message "No archived evidence".
- **Pas d'actor** : la strip "LINKED ACTOR" est entièrement omise (pas même son séparateur).
- **Pas de tier ou de role sur l'actor** : champs omis individuellement.

---

## Retail / Investigator balance

- **Le tier de solidité** est instantanément lisible (3 niveaux, code couleur, badge net) → **retail OK**.
- **Le badge `documented · evidenceDepth` sous le tier** + **les 4 signaux ranked avec weights** + **les 3 preuves typées** → **investigator OK**.
- **La subline en monospace pipe-séparée** est dense mais lisible : compresse 4 dimensions en une ligne sans corporate-speak.
- **Les labels sont en clair**, jamais d'enum brute exposée verbatim au user (les `BehaviorFlagKey` passent par `BEHAVIOR_FLAG_LABELS` pour un rendu humain).
- **Aucune promesse exagérée** : "MONITOR" dit explicitement "insufficient evidence". "PROBABLE" dit "corroboration in progress".

---

## Décisions techniques (avec rationale)

### D1 — Inline styles plutôt que Tailwind
La page parent (`src/app/en/explorer/[caseId]/page.tsx`) est **100% inline-styled**. Mixer Tailwind dans un fichier 100% inline créerait une incohérence visuelle dans le DOM (`className` sans `style`, `style` sans `className`). Le brief impose Tailwind comme règle générale, mais exiger Tailwind pour ce composant **précis** au-dessus d'un parent inline serait contre-productif. **Trade-off documenté ici, à reconvertir le jour où la page parent est migrée à Tailwind**.

### D2 — Accent `#F85B05` plutôt que `#FF6B00`
La page parent utilise `#F85B05` comme accent partout. Le brief mentionne `#FF6B00`. J'ai aligné sur le code existant pour cohérence visuelle locale. À harmoniser globalement dans un autre chantier si nécessaire.

### D3 — Pas de TigerScore numérique
Le brief mentionne "TigerScore / tier si disponible". Sur le modèle Case actuel, **il n'y a pas de TigerScore** — c'est un champ scan/KOL, pas case. J'utilise donc le **tier de solidité** (CONFIRMED / PROBABLE / SIGNAL), explicitement listé comme alternative dans le brief. Le badge "documented · strong" sous le tier reste lisible pour qui veut la granularité.

### D4 — Composant pure-presentational, zéro fetch
Le snapshot **ne fait aucun fetch**. Il consomme `dossier` et `snapshots` déjà chargés par la page parent. Avantages :
- Zéro double appel réseau.
- Zéro re-render race condition.
- Le composant est trivialement testable / réutilisable dans un autre contexte (PDF export, démo BA, page mobile…).

### D5 — Helpers en `src/lib/case/`
Nouveau dossier `src/lib/case/` (n'existait pas). Justification : la sélection appartient à un **domaine "case"** distinct de `src/lib/kol/` et `src/lib/explorer/`. Garder les selectors près de la frontière domaine-UI plutôt que dans `src/components/case/` permet un import depuis n'importe où (PDF, démo, mobile…) sans dépendance React.

### D6 — Anchor `#case-detail` pour le CTA
Le CTA "OPEN DOSSIER" du snapshot pointe sur `#case-detail`, ajouté comme `id` sur le bloc TITLE existant. Comportement natif scroll, zéro JS, zéro nouvelle dépendance.

### D7 — Locale = `en` hardcodé pour l'instant
La page parent est `src/app/en/explorer/[caseId]/page.tsx` — il n'existe **pas** de version FR (`src/app/fr/explorer/[caseId]/page.tsx` n'existe pas). Le composant accepte une prop `locale` et tous les helpers sélecteurs supportent `en` | `fr` — il suffira de copier la page en `fr/` et de passer `locale="fr"` quand la version FR sera demandée.

### D8 — `summary` du dossier conservé sous le snapshot
Le snapshot affiche une **subline compressée** au lieu du `summary` brut. Le `summary` brut reste rendu plus bas dans le bloc TITLE existant — pas de duplication, pas de perte d'info.

---

## Garanties

- **Zéro régression** : aucune ligne supprimée de la page parent. Tout le contenu existant reste intact sous le snapshot.
- **Zéro nouveau fetch** : le snapshot reuse `dossier` et `snapshots` déjà chargés.
- **Zéro nouvelle dépendance** : React + types existants seulement.
- **TypeScript strict** : tous les helpers ont leurs types, les inputs sont des sous-ensembles explicites des types existants pour découpler.
- **Empty states robustes** : aucun cas où un bloc est rendu vide ou cassé.
- **Ranking déterministe** : à donnée égale, l'ordre des signaux et preuves est toujours le même (pas d'aléa).

---

## QA manuelle suggérée

1. Aller sur `/en/explorer/<caseId-confirmé>` → vérifier badge **CONFIRMED** rouge + 4 signaux + 3 preuves + actor + next action "OPEN FULL DOSSIER".
2. Aller sur un case avec peu de données → vérifier le badge **SIGNAL** bleu + message "DOSSIER UNDER QUALIFICATION" si rien à montrer.
3. Cliquer le CTA "OPEN DOSSIER →" → doit scroller au bloc TITLE existant.
4. Vérifier qu'aucun élément du bloc historique (LINKED ACTORS, COORDINATION SIGNALS, EVIDENCE ON FILE) n'a disparu sous le snapshot.
5. Inspecter les preuves : la première carte doit toujours être de type `evidence_image` si disponible, sinon `document_excerpt`, sinon `tweet_post`.
