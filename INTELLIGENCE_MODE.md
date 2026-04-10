# Intelligence Mode — Deterministic / Exploratory layer

Branch: `feat/case-intelligence-beta`
Date: 2026-04-10

## Objectif

Verrouiller une distinction produit claire entre deux types de sorties :

- **Deterministic** — output fondé sur des données, signaux, règles, evidence items, scores ou événements explicitement traçables dans le système. Reproductible. Auditable.
- **Exploratory** — output d'orientation, hypothèse, synthèse interprétative, suggestion de pattern, lecture assistée, piste possible.

C'est une **règle produit + éditoriale + technique**, pas une décoration.

---

## Fichiers créés / modifiés

### Créés
- `src/lib/intelligence/mode.ts` — source de vérité : type `IntelligenceMode`, mapping `IntelligenceSurface → mode`, microcopy EN/FR, classifier ASK partagé, règle `shouldRenderModeBadge()`.
- `src/components/intelligence/IntelligenceModeBadge.tsx` — badge Tailwind sobre, 2 variants (`pill` / `line`), couleurs orange/zinc.
- `INTELLIGENCE_MODE.md` — ce fichier.

### Modifiés
- `src/components/explanation/AskInterligensChat.tsx` — import + injection `<IntelligenceModeBadge mode="exploratory">` dans le header (à côté de "Ask about this scan / Scan scope only"). Une seule instance, pas par message.
- `src/components/case/CaseSnapshot.tsx` — import + injection `<IntelligenceModeBadge mode="deterministic" variant="line">` en footer du bloc, séparé par un `border-top dashed` discret. Une seule instance.
- `src/lib/ask/askLog.ts` — rebranche `AskMode` sur `IntelligenceMode` depuis `lib/intelligence/mode.ts`. `classifyAnswer()` et `deriveMode()` délèguent aux helpers partagés (`isRefusalText`, `hasHardScanNumber`, `deriveAskMode`). Zéro changement de comportement.

### Non modifié — couverture différée
- `src/app/api/scan/ask/route.ts` : aucun changement nécessaire — la route continue d'appeler `writeAskLog({...})` qui dérive le `mode` via `deriveMode()` rebranché en interne. La valeur écrite dans `AskLog.mode` est désormais garantie d'appartenir au domaine `IntelligenceMode`.
- `src/app/en/explorer/[caseId]/page.tsx` : aucun changement — le snapshot enfant porte le badge. Pas de second badge à ce niveau.
- Surfaces scan result, Laundry Trail, Evidence list, KOL profile : **non couvertes par ce chantier** (voir section "Couverture" ci-dessous).
- `prisma/schema.prod.prisma` : `AskLog.mode` est déjà un `String` avec défaut `"deterministic"`. Pas de migration : la contrainte est au niveau TypeScript, pas DB. Un `CHECK` DB-level est documenté comme amélioration future.

---

## Audit des surfaces

### Surfaces identifiées

| Surface | Fichier clé | Mode | Notes |
|---|---|---|---|
| Scan result verdict / TigerScore | `src/lib/explanation/*`, `src/components/explanation/*` | deterministic | Déjà lisible comme tel (chiffres, tags). Pas de badge pour cette V1. |
| Risk tier (LOW/MODERATE/HIGH/CRITICAL) | `src/lib/explanation/types.ts` | deterministic | Idem. |
| Key signal cards | `src/components/explanation/*` | deterministic | Idem. |
| Evidence items / tags (`KolEvidence`) | Prisma `KolEvidence` | deterministic | Idem. |
| Laundry Trail signals (`LaundrySignal`) | Prisma `LaundrySignal` | deterministic | Idem. |
| Case Snapshot (bloc compression) | `src/components/case/CaseSnapshot.tsx` | **deterministic** | **✅ Badge ajouté (variant `line`, footer).** |
| Case linked actors | Même fichier | deterministic | Couvert par le badge Case Snapshot — pas de second. |
| Timeline / on-chain events | Prisma `OnchainEvent` | deterministic | Pas de badge — format déjà explicite. |
| **ASK INTERLIGENS answers** | `src/components/explanation/AskInterligensChat.tsx` | **exploratory** | **✅ Badge ajouté (variant `pill`, header).** |
| ASK suggestions / follow-up buttons | Même fichier | exploratory | Couvert par le badge ASK global. |
| Pattern hypothesis / investigation hints | À venir | exploratory | Mapping déclaré dans `SURFACE_MODE`, pas encore wired. |

### Mapping codé — `IntelligenceSurface`

Le fichier `src/lib/intelligence/mode.ts` déclare un enum `IntelligenceSurface` avec 15 valeurs et un `SURFACE_MODE` qui les mappe. Cela permet à un futur composant de faire :

```ts
import { getSurfaceMode, shouldRenderModeBadge } from "@/lib/intelligence/mode"

const mode = getSurfaceMode("ask_answer")         // "exploratory"
const render = shouldRenderModeBadge("ask_answer") // true
```

**Garde-fou** : si un dev ajoute une nouvelle surface, il doit l'ajouter au type ET à `SURFACE_MODE` — TypeScript strict le force (le `Record<IntelligenceSurface, IntelligenceMode>` ne compile pas sans toutes les clés).

---

## Type + helpers codés

### Type canonique

```ts
export type IntelligenceMode = "deterministic" | "exploratory"
```

Une seule source de vérité : `src/lib/intelligence/mode.ts`. Importé par :
- `src/components/intelligence/IntelligenceModeBadge.tsx`
- `src/lib/ask/askLog.ts` (alias `AskMode = IntelligenceMode`)
- `src/components/case/CaseSnapshot.tsx` (indirect via badge)

### Helpers

- `getIntelligenceModeCopy(mode, locale)` — retourne `{ short, long, explain }`.
- `getSurfaceMode(surface)` — retourne le mode d'une surface.
- `shouldRenderModeBadge(surface)` — booléen, dicte la règle de rendering.
- `deriveAskMode(answer)` — classifier ASK déterministe → partagé avec askLog.
- `isRefusalText(answer)` — détection des refus scope/financial.
- `hasHardScanNumber(answer)` — détection des chiffres durs (%, $, K, M, jours, wallets, tx).

### Règle de rendering (`shouldRenderModeBadge`)

```
ask_answer               → true   (priorité brief)
ask_suggestion           → true
pattern_hypothesis       → true
investigation_hint       → true
cross_case_suggestion    → true
case_snapshot            → true   (ancre éditoriale)
tiger_score              → false  (format auto-explicite)
risk_tier                → false
evidence_tag             → false
evidence_item            → false
key_signal_card          → false
timeline_event           → false
onchain_event            → false
laundry_trail_signal     → false
case_linked_actor        → false
```

**Principe** : badge uniquement là où la confusion est possible. Un TigerScore chiffré n'a pas besoin d'un badge "TRACED" — c'est évident. Une réponse ASK en prose a besoin d'un badge "INTERPRETIVE" — c'est là que le risque "l'IA raconte" existe.

---

## Microcopy EN/FR retenue

### Brief vs retenu

Le brief proposait :
- Deterministic : `"Based on traced signals"` / `"Fondé sur des signaux tracés"`
- Exploratory : `"Interpretive guidance"` / `"Lecture interprétative"`

**Retenu : exactement ces phrases** pour la forme `long`. Ajout de 2 formes dérivées pour l'usage UI :

| Mode | Locale | `short` (pill) | `long` (line) | `explain` (tooltip) |
|---|---|---|---|---|
| deterministic | en | `TRACED` | `Based on traced signals` | Grounded in scores, evidence items, on-chain events and rules that can be audited in the system. |
| deterministic | fr | `TRACÉ` | `Fondé sur des signaux tracés` | Ancré dans les scores, les preuves, les événements on-chain et les règles auditables dans le système. |
| exploratory | en | `INTERPRETIVE` | `Interpretive guidance` | Assisted reading. Hypotheses and orientation — not established fact. Cross-check before acting. |
| exploratory | fr | `INTERPRÉTATIF` | `Lecture interprétative` | Lecture assistée. Hypothèses et orientation — pas un fait établi. À recouper avant d'agir. |

**Rationale des formes** :
- `short` est utilisé pour la variante `pill` (badge inline compact dans le header ASK) — 1 mot, 10 caractères max, tracking-widest.
- `long` est utilisé pour la variante `line` (footer Case Snapshot) — plus lisible, pas d'effet "badge gadget".
- `explain` est injecté en `title` HTML (tooltip natif) — pas de drawer, pas de popover — minimal et discret.

**Ton** : factuel, sobre, pas anxieux. `"Cross-check before acting"` plutôt que `"This may be incorrect, please verify"`. `"À recouper avant d'agir"` plutôt que `"Ceci peut être inexact"`. Cohérent avec le ton INTERLIGENS : sharp, net, premium — pas legalese.

---

## Décisions techniques

### D1 — Source de vérité unique
`src/lib/intelligence/mode.ts` est **le seul** endroit où le type `IntelligenceMode`, la microcopy et le classifier existent. `askLog.ts` délègue, `IntelligenceModeBadge` importe, `CaseSnapshot` importe via le badge. Aucune duplication.

### D2 — Rebranchement askLog zéro breaking
`askLog.ts` exporte toujours `AskMode` et `classifyAnswer` — les call sites ne bougent pas. En interne, `AskMode = IntelligenceMode` (alias) et les patterns sont importés depuis `intelligence/mode.ts`. Les regex `REFUSAL_PATTERNS` et `HEDGE_MARKERS` ont été **déplacées** (pas dupliquées) — le fichier `askLog.ts` est plus léger.

### D3 — Composant Tailwind (cohérent avec AskInterligensChat)
Le badge est pure Tailwind. C'est cohérent avec `AskInterligensChat` (100% Tailwind). Dans `CaseSnapshot` (inline-styled), le badge reste Tailwind — les classes appliquent sur le `<span>` du badge lui-même, sans conflit avec les inline styles du parent. Pas de mixité néfaste.

### D4 — Deux variants suffisent
`pill` (outlined) pour les surfaces éditoriales actives (ASK header). `line` (no border, muted) pour les surfaces éditoriales passives (Case Snapshot footer). Pas de 3e variant — pas besoin, et le brief dit "pas 15 variantes".

### D5 — Couleurs
- Deterministic → `#F85B05` (accent orange existant dans le repo) à 40-70% d'opacité.
- Exploratory → zinc-400/700 (gris neutre).

**Choix** : la deterministic est "chaude" (fiable, anchored) et l'exploratory est "froide" (à recouper). Inversion intuitive par rapport au cliché "rouge = danger" — ici, la couleur chaude est la couleur de la **confiance**. Documenté pour éviter toute confusion future.

### D6 — Refusal = deterministic
Un refus d'ASK ("je n'ai pas ça ici", "price prediction isn't what we do") est **deterministic** : le système énonce un **fait** sur sa propre couverture, pas une hypothèse. Cette règle est encodée dans `deriveAskMode()`. Évite d'étiqueter des refus clairs comme "interpretive guidance" — ce serait contre-productif.

### D7 — Pas de badge sur tiger_score, risk_tier, evidence_tag
Ces surfaces sont **déjà lisibles comme deterministic** : un chiffre, un tag encadré, un label de risque en couleur. Un badge "TRACED" les alourdirait sans clarifier. Règle : **badge uniquement là où la confusion est possible**. `shouldRenderModeBadge()` le formalise.

### D8 — CHECK DB-level différé
Aujourd'hui `AskLog.mode` est un `String` Postgres. Un `CHECK (mode IN ('deterministic','exploratory'))` ajouterait une garantie DB mais nécessite une migration. **Différé** à un chantier séparé — pas de valeur immédiate, et la contrainte TypeScript couvre toutes les call sites actuelles.

### D9 — i18n en/fr seulement
Le brief dit "app bilingue EN/FR". Le type `getIntelligenceModeCopy(mode, locale: "en" | "fr")` ne supporte que ces deux locales — pas d'échappatoire, pas de fallback silencieux. Si un jour une 3e locale arrive, TypeScript cassera immédiatement et le dev devra ajouter la copy.

### D10 — Tooltip natif plutôt que drawer
Le `explain` est injecté via l'attribut HTML `title`. Pas de popover, pas de `useState`, pas de JS. Zéro coût, zéro régression, support clavier/screen-reader natif. Si le besoin d'un tooltip plus riche émerge, il sera facile de swap — le contenu existe déjà dans `INTELLIGENCE_MODE_COPY`.

---

## Couverture — ce qui est fait, ce qui est laissé

### Couvert dans ce chantier
- ✅ Type canonique + mapping surfaces codé.
- ✅ Classifier ASK unifié avec `askLog`.
- ✅ Badge déployé sur **ASK INTERLIGENS** (priorité #1 du brief).
- ✅ Badge déployé sur **Case Snapshot** (priorité #2 du brief).
- ✅ Microcopy EN/FR complète.
- ✅ `AskLog.mode` aligné sur `IntelligenceMode` (pas de migration DB requise).

### Laissé pour plus tard (mapping déclaré, pas wired)
- Scan result global : pas besoin de badge — format déjà deterministic. Si un jour on ajoute une section "AI-assisted read" sur le scan result, elle devra porter le badge `exploratory`.
- KOL profile pages : contiennent des `summary` / `observedBehaviorSummary` éditoriaux qui pourraient bénéficier d'un `exploratory` discret. Pas touché ici pour rester additif et éviter le refacto parasite.
- Pattern hypothesis / investigation hints : surface future (watchlist v2, graph cases) — le mapping est prêt (`SURFACE_MODE.pattern_hypothesis = "exploratory"`), il suffira d'importer le badge le jour où la surface existe.
- PDF exports (casefile legal) : `src/lib/pdf/kol/*` — un chantier séparé devra décider si le PDF doit porter le badge (probablement oui pour les sections assisted).
- Admin `/admin/ask-logs` viewer : affichage actuel montre `answerType` et `mode` séparément. Amélioration possible : afficher le `IntelligenceModeBadge` directement dans la table. Non critique — reporté.

### Non couvert, volontairement
- Mobile ASK route (`src/app/api/mobile/v1/ask/route.ts`) : n'existe pas sur cette branche. Au port main → beta, hériter automatiquement via `writeAskLog()`.
- Toute autre surface non listée ici.

---

## QA manuelle suggérée

1. Ouvrir un scan result (`/en/<scan>`) → scroll vers le bloc ASK INTERLIGENS → vérifier la présence du badge `INTERPRETIVE` orange sobre dans le header, à côté de "Ask about this scan · Scan scope only".
2. Poser une question → vérifier que le badge reste visible et ne se duplique pas par message.
3. Passer en FR → badge devient `INTERPRÉTATIF`.
4. Hover le badge → tooltip natif "Assisted reading. Hypotheses and orientation — not established fact. Cross-check before acting.".
5. Aller sur `/en/explorer/<caseId>` → Case Snapshot en tête → scroller jusqu'au footer du snapshot → voir la line `· Based on traced signals` en orange discret.
6. Inspecter une entrée AskLog récente (via `/admin/ask-logs`) → le champ `mode` doit être `"deterministic"` ou `"exploratory"` — jamais une autre valeur.

---

## Garanties

- **Zéro régression ASK** : `writeAskLog()` conserve la même signature, les mêmes call sites, le même comportement. Seule la provenance des patterns change.
- **Zéro refacto parasite** : rien d'autre que les 3 fichiers de wiring n'est touché.
- **TypeScript strict** : le `Record<IntelligenceSurface, IntelligenceMode>` force l'exhaustivité. Impossible d'ajouter une surface sans décider son mode.
- **Additif uniquement** : pas de suppression, pas de renommage user-visible.
- **i18n complet** : toutes les copies ont EN et FR.
- **Une seule source de vérité** : `src/lib/intelligence/mode.ts` est le dictionnaire central. Tout le reste délègue.
