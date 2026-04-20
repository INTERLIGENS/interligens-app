# Design system audit — 2026-04-20

## Summary
- **Cyan #00E5FF in app UI**: 4 violations (app UI scope) / 1 PDF-exempt
  - APP-VIOLATION count: 4 (investigate/login, investigator dashboard, history page, LaundryTrailCard component)
  - PDF-exempt count: 1 (src/lib/pdf/kol/templateKol.ts)
- **Non-canonical accent usage**: 
  - #F85B05 (legacy accent): 247 occurrences in app UI (src/components, src/app/*)
  - #F97316 (orangish): 55 occurrences in app UI
  - Other reds/oranges: #FF3B5C (64), #FFB800 (23)
- **Off-spec backgrounds**: 3 minor violations (PDF rendering context, acceptable)
- **Off-spec borders**: 0 major violations (all compliant with rgba white, dark grays, or hex blacks)
- **Off-spec fonts**: 1 violation in PDF renderer (Helvetica Neue/Arial in PDF—acceptable, not app UI)

---

## CYAN VIOLATIONS (fix priority 1)

Cyan (#00E5FF) is **forbidden in app UI** (allowed only in PDF/casefile templates).

| file:line | context | scope |
|-----------|---------|-------|
| src/components/LaundryTrailCard.tsx:29 | `BRIDGE: '#00E5FF'` in signal color palette | APP-VIOLATION (investigator UI color token) |
| src/app/en/investigator/login/page.tsx:8 | `const CYAN = "#00E5FF"` theme color constant | APP-VIOLATION (investigator auth page) |
| src/app/en/investigator/page.tsx:10 | `const CYAN = "#00E5FF"` theme color constant | APP-VIOLATION (investigator dashboard) |
| src/app/history/page.tsx:9 | `const CYAN = "#00E5FF"` theme color constant | APP-VIOLATION (scan history page) |
| src/lib/pdf/kol/templateKol.ts:222 | `BRIDGE: '#00E5FF'` in laundry trail signal colors | PDF-EXEMPT (legal PDF template) |

**Impact**: Cyan is used in multiple investigator UI pages for:
- Case code/chain badges in investigator dashboard (lines 248, 257, 302)
- KOL handle links (line 391)
- Domain risk signal type classification (line 448)
- PDF titles and UI text spans throughout investigator section

---

## ACCENT DRIFT (orange variants that are not #FF6B00)

The canonical accent is **#FF6B00**. Historical accent was #F85B05 (near-twin, ~4.5% darker orange).

### #F85B05 Usage (Legacy Accent—Pervasive)

**Count**: 247 occurrences in app UI (src/components + src/app/*)
**Assessment**: Pre-rebrand color, widespread across:
- Component UI (ErrorBoundary, CaseSnapshot, ScanSkeleton, TigerRevealCard, etc.)
- App pages (demo, explorer, kol profiles, victim report, transparency, legal)
- PDF generation (templateKol.ts and pdfRenderer.ts)

**Representative locations** (sample only):
- src/components/ErrorBoundary.tsx:21 → `bg-[#F85B05]`
- src/components/case/CaseSnapshot.tsx:36-38 → `ACCENT = "#F85B05"` (3 token definitions)
- src/app/en/demo/page.tsx:568 → Tier color function uses `#F85B05`
- src/app/en/explorer/page.tsx:109 → Stats widget color
- src/lib/pdf/kol/templateKol.ts:44 → PDF border color

**Note**: This is systematic legacy branding, not isolated bugs. Appears to be pre-unified-design state.

### #F97316 Usage (Off-Spec Orange-Red)

**Count**: 55 occurrences in app UI
**Found in**: investigator dashboard, watchlist signals, risk classification logic

| file:line | context | scope |
|-----------|---------|-------|
| src/app/en/investigator/page.tsx:44 | `tierColor()` function—HIGH risk → `#F97316` | APP-VIOLATION (investigator tier color) |
| src/app/en/investigator/page.tsx:336 | `classifyRisk()` HIGH risk → `#F97316` | APP-VIOLATION (KOL risk badge) |
| src/app/en/investigator/page.tsx:447 | `signalColor()` CA_DETECTED → `#F97316` | APP-VIOLATION (alert signal type) |
| src/app/en/investigator/page.tsx:458 | `severityColor()` HIGH severity → `#F97316` | APP-VIOLATION (alert severity indicator) |
| src/app/en/investigator/page.tsx:750 | Entity type classification (cluster) → `#F97316` | APP-VIOLATION (proceeds table) |

**Assessment**: Intentional off-spec orange for "high risk" differentiation from amber (#FFB800). Used in investigator risk/severity theming. May be deliberate design choice, warrants review.

---

## BACKGROUND DRIFT

No critical off-spec backgrounds in app UI. All backgrounds comply with dark spec (#0A0A0A, #111318, #161920, #0a0a0a, or transparent).

**Minor note**: src/components/pdf/pdfRenderer.ts contains PDF rendering with:
- `background:#fff` (white) on line 108 → PDF-exempt (not app UI)
- `background:#ffffff10`, `background:#ffffff08` (light overlays) → PDF-exempt

**Assessment**: 0 violations in app UI scope.

---

## BORDER DRIFT

All borders are compliant. Codebase uses:
- Neutral dark borders: `rgba(255,255,255,0.06)` to `rgba(255,255,255,0.12)` (canonical spec)
- Dark grays: #1E2028, #111, #0d0d0d
- Zinc/slate Tailwind equivalents: `border-zinc-800`, `border-slate-700`

No off-spec colored borders (blue, red, green) detected in investigator UI. Status badges use themed colors but are intentional (e.g., risk badges with matching background + border + text).

**Assessment**: 0 violations in app UI scope.

---

## FONT DRIFT

### Investigator UI (app/investigators)

All fonts in investigator UI use **system-safe stacks** or **Inter/monospace**, compliant:
- `fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"` → system-ui equivalent
- `fontFamily: "monospace"` → compliant
- `fontFamily: "Inter, system-ui, sans-serif"` → compliant
- Inline `fontFamily: "inherit"` → compliant

### PDF Rendering (src/components/pdf/pdfRenderer.ts:108)

```
body { font-family:'Helvetica Neue',Arial,sans-serif; background:#fff; color:#111; }
```

**Violation**: Hard-coded Helvetica Neue + Arial in PDF CSS template (line 108)

**Assessment**: PDF-exempt from app UI enforcement (not rendered in investigator/admin UI). However, CSS should ideally use system-safe or specified font stack if this PDF is user-facing.

---

## Summary of fixable vs product-decision

### Fixable (low-risk string replace):
1. **Cyan #00E5FF in app UI** (4 instances)
   - src/components/LaundryTrailCard.tsx:29 → Replace with canonical accent or neutral color
   - src/app/en/investigator/login/page.tsx:8 → Replace CYAN constant with neutral/accent
   - src/app/en/investigator/page.tsx:10 → Replace CYAN constant
   - src/app/history/page.tsx:9 → Replace CYAN constant
   - **Fix complexity**: Medium (CYAN used in badge colors, text colors, borders throughout pages)
   - **Risk**: Low (color tokens are localized, search-replace safe)

### Needs review (product decision):
1. **#F85B05 legacy accent** (247 occurrences)
   - Decision: Migrate to #FF6B00 across codebase (branding refresh) OR keep as legacy (pages not yet rebrand-updated)
   - **Recommendation**: If on feat/foundations-audit-fix, this is the time to unify. Otherwise, acceptable technical debt.

2. **#F97316 off-spec orange** (55 occurrences, investigator risk colors)
   - Lines 44, 336, 447, 458, 750 in src/app/en/investigator/page.tsx
   - Decision: Is HIGH risk intended to be visually distinct from #FFB800 (MEDIUM)? If yes, standardize the choice. If no, replace with canonical.
   - **Recommendation**: Clarify if intentional differentiation or oversight. If intentional, document in design tokens.

3. **Helvetica Neue in PDF CSS** (src/components/pdf/pdfRenderer.ts:108)
   - Non-critical (PDF-exempt), but should ideally match font spec if possible.
   - **Recommendation**: Use system-safe stack or leave as-is if PDF rendering is working.

---

## Recommendations for this PR (feat/foundations-audit-fix)

1. **High Priority**: Replace all `#00E5FF` in app UI with canonical accent `#FF6B00` or neutral color (4 fixes, ~10 min)
   - LaundryTrailCard: `BRIDGE: '#00E5FF'` → use neutral bridge color or accent
   - Investigator pages: Replace CYAN constant → use accent/neutral for badges

2. **Medium Priority**: Audit and unify orange usage (#F85B05 vs #FF6B00 vs #F97316)
   - Decide: Is this PR scope? Or separate rebrand effort?
   - If in scope: Batch replace #F85B05 with #FF6B00 across codebase

3. **Low Priority**: Clarify #F97316 usage in risk classification
   - Document if intentional or technical debt

---

## Audit Metadata
- **Branch**: feat/foundations-audit-fix
- **Audit Date**: 2026-04-20
- **Scope**: src/components/, src/app/ (excluding PDF/casefile exempt paths)
- **Canonical Design Tokens**:
  - Background: #000000
  - Accent (primary): #FF6B00
  - Text: #FFFFFF
  - Borders: rgba(255,255,255,0.06)–0.12
  - Fonts: Inter + JetBrains Mono (variable)
  - Forbidden in app UI: #00E5FF (cyan)
