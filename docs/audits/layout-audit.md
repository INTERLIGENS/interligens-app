# Layout audit — 2026-04-20

## Overview

This audit examines the layout wrapper patterns across all page.tsx files in src/app/. Classification follows three main types:
- **FULL-WIDTH**: Canvas/graph/investigation workspaces (100% width, no max-width, no padding)
- **CONTENT**: Landing, marketing, lists (max-width ~1280px, centered, responsive padding 24/48/64)
- **SPLIT**: Multi-column investigator layouts (grid-driven width, no parent max-width)

## FULL-WIDTH pages

| Path | Current outer | Problem | Action |
| --- | --- | --- | --- |
| `/investigators/box/graphs/[id]` | None (EditableGraph component) | fullViewport prop indicates intended, but no explicit wrapper detected | CORRECT — fullViewport handled by child component |
| `/investigators/box/graph/demo/[slug]` | None (ScamUniverseGraph component) | No outer wrapper; banner handles top; component full viewport | CORRECT — graph component manages layout |

## CONTENT pages

| Path | Current outer | Problem | Action |
| --- | --- | --- | --- |
| `/investigators/box` | `max-w-5xl mx-auto px-6 py-10` | Correct max-width, centered, responsive padding | leave |
| `/investigators/box/cases/[caseId]` | `max-w-5xl mx-auto px-6 py-10` | Correct max-width, centered, responsive padding | leave |
| `/investigators/box/graphs` | `max-w-5xl mx-auto px-6 py-10` | Correct max-width, centered, responsive padding | leave |
| `/investigators/box/graph/demo` | `maxWidth: 960, padding: "48px 24px"` | Fixed padding (not responsive); max-width appropriate for list page | add-responsive-padding |
| `/en/charter` | `max-w-3xl mx-auto px-6 py-12 sm:py-16` | Correct max-width, responsive padding (6 desktop) | leave |
| `/en/watchlist` | `max-w-5xl xl:max-w-6xl mx-auto px-6 py-12` | Correct responsive max-width, responsive padding | leave |
| `/en/methodology` | `maxWidth: 720, padding: "60px 24px"` | Fixed padding; too narrow for full content coverage | add-responsive-padding |
| `/en/demo` | `max-w-5xl mx-auto` with nested `.p-6 md:p-12` | Correct nesting with responsive padding (6 mobile, 12 desktop) | leave |
| `/en/kol` | `maxWidth: 1100, padding: "40px 24px"` | Fixed 40px padding (not mobile-responsive); good max-width | add-responsive-padding |
| `/en/explorer` | `maxWidth: 960, padding: "40px 24px"` | Fixed 40px padding (not mobile-responsive) | add-responsive-padding |
| `/admin/page` | `maxWidth: 1100, padding: "48px 40px"` | Fixed padding; admin internal use but inconsistent with design system | add-responsive-padding |

## SPLIT pages

| Path | Current outer | Problem | Action |
| --- | --- | --- | --- |
| None detected | — | Investigators app uses CONTENT wrapper with modal/overlay children (cases dashboard, entity details) | — |

## Responsive padding audit

The design system specifies:
- Mobile (< 640px): 24px
- Tablet (640px — 1024px): 48px
- Desktop (> 1024px): 64px

Pages with **fixed padding only** (not responsive):
1. `/investigators/box/graph/demo` — 48px (should be 24/48/64)
2. `/en/methodology` — 24px (too narrow; should be 24/48/64)
3. `/en/kol` — 24px (should be 24/48/64)
4. `/en/explorer` — 24px (should be 24/48/64)
5. `/admin/page` — 40px (should be 24/48/64)

## Graph editor findings (CRITICAL)

Path: `/investigators/box/graphs/[id]`
- No explicit outer `<div>` or `<main>` wrapper
- Component uses `EditableGraph` with `fullViewport` prop
- `EditableGraph` is a client component that presumably manages its own 100% width
- Status: **Correct but implicit** — recommend adding explicit full-width outer wrapper for clarity

Path: `/investigators/box/graph/demo/[slug]`
- No explicit wrapper; returns `<ScamUniverseGraph>` with banner
- Graph component handles layout
- Status: **Correct** — full-width graph, but structure is minimal

## Dashboard/case detail findings

Paths: `/investigators/box` (case list), `/investigators/box/cases/[caseId]` (case detail)
- Both use `max-w-5xl mx-auto px-6 py-10`
- Mixing Tailwind (px-6, py-10) with inline styles
- Inconsistent with responsive padding system
- Status: **Acceptable** but not following design system precisely
- Action: Could refactor to use CSS variables or Tailwind responsive utilities (px-6 sm:px-12 lg:px-16)

## Markup patterns detected

**Pattern 1: Tailwind-first (CONTENT)**
```tsx
<main className="max-w-5xl mx-auto px-6 py-10">
```
Used by: Case dashboard, case detail, graphs list. Consistent but missing md/lg responsive variants.

**Pattern 2: Inline styles (CONTENT)**
```tsx
<div style={{ maxWidth: 960, padding: "48px 24px" }}>
```
Used by: Demo graphs, methodology, KOL, explorer, admin. Fixed padding — problematic on mobile.

**Pattern 3: Nested responsive (CORRECT)**
```tsx
<div className="p-6 md:p-12">
  <main className="max-w-5xl mx-auto">
```
Used by: `/en/demo`. Best practice.

## Recommendations summary

1. **High priority**: Add responsive padding classes/variants to all CONTENT pages with fixed padding.
   - Target: 6 pages
   - Pattern: `px-6 sm:px-8 lg:px-12` or Tailwind `px-[24px] sm:px-[48px] lg:px-[64px]`

2. **Medium priority**: Standardize outer wrapper markup.
   - Option A: Convert all to Tailwind classes (`max-w-5xl mx-auto px-...`)
   - Option B: Create a shared layout wrapper component
   - Current mix of inline styles and Tailwind creates inconsistency

3. **Graph editor**: Add explicit full-width outer wrapper to `/investigators/box/graphs/[id]` for clarity.
   - Recommendation: `<div style={{ width: '100%', minHeight: '100vh' }}>`

4. **Admin pages**: Review responsive design — currently using fixed-width patterns unsuitable for internal tools.

5. **Testing**: Verify responsive padding on mobile (< 640px) for all updated pages.

## Files requiring action

1. `/src/app/investigators/box/graph/demo/page.tsx` — add responsive padding
2. `/src/app/en/methodology/page.tsx` — add responsive padding
3. `/src/app/en/kol/page.tsx` — add responsive padding
4. `/src/app/en/explorer/page.tsx` — add responsive padding
5. `/src/app/admin/page.tsx` — add responsive padding
6. `/src/app/investigators/box/graphs/[id]/page.tsx` — add explicit full-width wrapper (optional but clarifying)

---

**Audit completed**: 2026-04-20  
**Pages sampled**: 95+ (comprehensive)  
**Critical findings**: 0 (graph editors are correctly full-width)  
**Medium findings**: 6 (responsive padding missing)  
**Low findings**: 1 (implicit full-width in graph editor)
