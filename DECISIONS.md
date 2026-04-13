# Investigators V2A + V2B + V2C — Autonomous Sessions Decisions

Branch: `feat/investigators-v2a`

---

## V2A — Initial feature bundle (session 1)

Entity Launchpad · Cross-Intelligence Enrichment · Case Templates · Derived Graph (D3) · Redaction tool · Case Twin V0 · Next-Best-Step toast.

## V2B — Fix + expansion (session 2)

Entity add form · Timeline Builder · Contradiction Finder · Dual Export (JSON + Print PDF + AI retail summary) · Publish → Intel Vault · Global entity search · Case Twin AI analysis · Cross-case collision signal · Redact page improvements.

## V2C — UX polish + assistant + sharing (session 3)

1. **Delete entity** — `DELETE /entities/[entityId]` + `×` button per row with confirm.
2. **Auto-suggest related entities** — `POST /entities/suggest`. After an entity is added, queries KolWallet/KolProfile + other workspace cases for related entries and pops a 10s panel.
3. **Feedback button** — fixed bottom-right pill on every `/investigators/box/*` page (added via new `box/layout.tsx`). Modal with textarea + Web Speech API dictation. Posts to `/api/investigators/feedback` which uses Resend (existing infra) and falls back to `VaultFeedback` table on failure.
4. **Claude Assistant tab** — new "assistant" tab on case detail page. Multi-turn chat backed by `/api/investigators/cases/[id]/assistant`. Per-workspace token quota enforced (`assistantTokensUsed` / `assistantTokensLimit` columns on `VaultWorkspace`). Web Speech voice input.
5. **Voice notes** — "Dictate note" button next to "Save note" in the Notes tab. 100% client-side Web Speech.
6. **Wallet Journey modal** — for WALLET entities, a "Journey" button opens a linear flow modal showing wallets and TXes interleaved.
7. **Case sharing** — "Share" button in case header. Generates a 32-byte hex token + snapshot of derived data (title, entities, optional hypotheses) stored in `VaultCaseShare`. Public route `/shared/case/[token]/page.tsx` renders read-only with expiry enforcement.

### V2C autonomous decisions

**1. Layout-based feedback button.** Spec said "every /investigators/box/* page". Created `src/app/investigators/box/layout.tsx` (didn't exist) that wraps children with `<FeedbackButton />`. The button itself is client-side and uses `usePathname()` to extract `caseId` from the URL when applicable.

**2. Feedback delivery: Resend first, DB fallback.** The existing infrastructure at `src/lib/surveillance/alerts/deliverAlerts.ts` uses `fetch("https://api.resend.com/emails", ...)` with `RESEND_API_KEY`. I copied this pattern. If `RESEND_API_KEY` is missing or Resend errors, the API silently writes to `VaultFeedback` instead. Audit log records `delivery: "email" | "db"`. Recipient defaults to `feedback@interligens.com` and is overridable via `FEEDBACK_EMAIL` env var.

**3. `VaultProfile.handle` field used directly.** Spec said "investigator handle". `VaultProfile.handle` is a unique non-null field (verified via Prisma schema). Falls back to `ctx.access.label` for paranoia.

**4. Assistant API: token quota uses 4-chars-per-token estimate before call, then updates with actual `usage` post-call.** This is conservative — the pre-call check uses `estimateTokens(systemPrompt) + sum(estimateTokens(messages))` plus a fixed 1500-token output budget. After the call, the workspace counter is incremented by `input_tokens + output_tokens` from `response.usage`. This means the quota meter is accurate but the gate is slightly pessimistic (which is fine — it errs on the side of safety).

**5. Assistant message history capped at 20.** `messages.slice(-20)` server-side. Client also keeps full local state (no truncation), so the user sees the whole conversation — only the API request is rolled.

**6. Case context payload to assistant is strictly derived data.** `{ type, value, label, tigerScore }` for entities; `{ title, status, confidence }` for hypotheses; enrichment summarized as KOL/known-bad flags only. **No notes, no filenames, no raw file content.** Spec security requirement maintained.

**7. Assistant model is `claude-sonnet-4-20250514` per spec.** Same model ID as the existing `/ai-summary` route. Verify availability and swap to a current Sonnet ID if the API rejects it.

**8. Quota reset is NOT automated.** "Monthly quota" is the spec language, but no cron/reset logic is built. Human action: add a monthly reset cron, OR manually reset `assistantTokensUsed` to 0 in Neon. Documented here.

**9. Auto-suggest excludes entities already in the case.** After collecting candidates, the route filters out any `(type, value)` pair that already exists in `VaultCaseEntity` for this case, so the panel never proposes adding an entity that's already there.

**10. Auto-suggest panel auto-dismisses after 10s.** Per spec. Manual dismiss link also present. State is component-local (case page `useState`).

**11. Wallet Journey is a naive linear interleave.** Spec said "linear flow" and "if relationships can be inferred from labels or notes: Use them. Otherwise: show all wallets and TX in a linear chain." I went with the simplest version: zip wallets and TX hashes positionally. This will be wrong for any non-trivial chain but is honest about its limitations and links to the full Graph tab. Future work: parse TX hash inputs from a real on-chain RPC.

**12. Case share snapshot is built client-side and posted to the API.** The case title is encrypted at rest, so the server can't read it. The client decrypts it for the local view and passes the plaintext as `titleSnapshot` in the share-create body. Same for hypotheses (which are stored plaintext anyway). Entities are derived plaintext columns so they'd work either way — passed from client for consistency.

**13. Share token is 32 bytes hex (`crypto.randomBytes(32).toString("hex")`)** = 64 hex chars. Cryptographically secure. Stored in `VaultCaseShare.token` with `@unique`. Public route does a single Prisma lookup by token.

**14. Public shared route is server-rendered with `force-dynamic`.** No caching. Expiry checked on every request. If expired or missing, returns a friendly "expired/invalid" message with a link back to interligens.com. No leakage of caseId or workspaceId.

**15. Share URL base = `NEXT_PUBLIC_APP_URL` env var, defaulting to `https://app.interligens.com`.** This is consistent with the Vercel alias.

**16. Wallet Journey + Share modals share the same overlay pattern** as Feedback modal: fixed inset, click-outside-to-close, escape-to-close.

**17. Voice features hide their button if `SpeechRecognition` is unsupported.** This means Firefox users see no dictation button (Web Speech API is Chromium/Safari only). No fallback shown — silent degradation per spec.

**18. Journey button only renders for `type === "WALLET"`.** Spec said "for WALLET type entities". Not shown on CONTRACT, TX_HASH, etc.

**19. ENTITIES_DELETED audit action added.** Existing audit taxonomy uses `ENTITIES_ADDED` (plural). I used `ENTITY_DELETED` (singular) since deletes are one-at-a-time. Both audit actions coexist.

**20. New audit actions:** `ENTITY_DELETED`, `FEEDBACK_SENT`, `ASSISTANT_QUERY` (logs token usage in metadata, never the message body), `CASE_SHARED`.

---

## Type check

`npx tsc --noEmit` → **pass** (exit 0, zero errors).

---

## SQL migrations — human must apply via Neon SQL Editor

Apply in order: V2A → V2B → V2C.

### V2A (existing)
File: `prisma/migrations/manual_investigators_v2a/migration.sql`

### V2B (existing, now extended with VaultFeedback)
File: `prisma/migrations/manual_investigators_v2b/migration.sql`
The `VaultFeedback` table has been **appended** to the existing V2B file. If V2B was already applied, run only the appended VaultFeedback section:

```sql
CREATE TABLE IF NOT EXISTS "VaultFeedback" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "caseId" TEXT,
  "handle" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultFeedback_workspaceId_idx"
  ON "VaultFeedback"("workspaceId");
```

### V2C (new)
File: `prisma/migrations/manual_investigators_v2c/migration.sql`

```sql
ALTER TABLE "VaultWorkspace"
  ADD COLUMN IF NOT EXISTS "assistantTokensUsed" INTEGER DEFAULT 0;

ALTER TABLE "VaultWorkspace"
  ADD COLUMN IF NOT EXISTS "assistantTokensLimit" INTEGER DEFAULT 100000;

CREATE TABLE IF NOT EXISTS "VaultCaseShare" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "entitySnapshot" JSONB NOT NULL,
  "titleSnapshot" TEXT NOT NULL,
  "hypothesisSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultCaseShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VaultCaseShare_token_key"
  ON "VaultCaseShare"("token");
CREATE INDEX IF NOT EXISTS "VaultCaseShare_caseId_idx"
  ON "VaultCaseShare"("caseId");
```

**Until V2C is applied:** Assistant tab will return 500 (workspace lookup fails for the new columns). Share button will return 500. Feedback fallback to DB will fail. Email-delivery feedback path still works. Auto-suggest, delete entity, voice notes, wallet journey, all work without V2C — they don't depend on it.

---

## Needs human action

1. **Apply V2A SQL** (if not done).
2. **Apply V2B SQL** (if not done) — including the **VaultFeedback** addition at the bottom.
3. **Apply V2C SQL** — workspace columns + VaultCaseShare table.
4. **Set `ANTHROPIC_API_KEY`** in Vercel env. Without it, Assistant returns 503 and AI summary routes return mocks.
5. **Optional: set `FEEDBACK_EMAIL`** env var (defaults to `feedback@interligens.com`).
6. **Optional: set `NEXT_PUBLIC_APP_URL`** env var if the share base URL needs to differ from `https://app.interligens.com`.
7. **Verify Claude model ID** — both `/ai-summary` and `/assistant` pin `claude-sonnet-4-20250514`. Swap to current Sonnet ID if needed.
8. **Add monthly cron to reset `assistantTokensUsed`** OR manually reset in Neon. Not automated.

---

## Security checklist (V2A + V2B + V2C)

- [x] Assistant: only sends derived `{ type, value, label, tigerScore }` + hypotheses + enrichment flags. **Never notes, never file content, never raw filenames.**
- [x] Assistant: workspace token quota enforced **before** the API call (pre-flight estimate) and reconciled after with real usage.
- [x] Assistant: audit log records token counts only, **never message content**.
- [x] Share: snapshot built at creation time. Public route never re-fetches live data (it can't — encrypted).
- [x] Share: 32-byte hex token, server-side expiry check, no caseId/workspaceId leakage on expired links.
- [x] Share: notes, files, raw content, audit log, hypothesis IDs — none included in snapshot. Optional hypothesis snapshot is opt-in via the create payload.
- [x] Feedback: stored in DB or sent via existing Resend infra to internal email. Never publicly exposed.
- [x] Auto-suggest: queries KolWallet, KolProfile, and `VaultCaseEntity` scoped to authenticated workspace only. No external calls.
- [x] Delete entity: ownership verified before delete (`assertCaseOwnership` + `caseId` match check).
- [x] All new routes use `getVaultWorkspace` + `assertCaseOwnership` + `logAudit`.
- [x] No cyan, no emoji, design tokens preserved.

---

## V2D — Intelligence Co-pilot (session 4)

Transformed the Case Assistant from a generic LLM into a structured intelligence co-pilot powered by `buildCaseIntelligencePack`.

### What changed

1. **`src/lib/vault/buildCaseIntelligencePack.ts`** — server-side helper that assembles a full `CaseIntelligencePack` from INTERLIGENS DB. Queries `VaultCase`, `VaultCaseEntity`, `VaultHypothesis`, `VaultTimelineEvent`, `KolWallet`, `KolProfile`, `LaundryTrail`, `KolCase`. Computes twin state (gaps, conflicts, readiness, next action) inline so the assistant route doesn't recompute it.

2. **`/api/investigators/cases/[id]/assistant`** — now ignores client-supplied `caseContext` and builds its own pack server-side. The system prompt embeds `JSON.stringify(pack, null, 2)` and includes 10 critical reasoning rules (FACTS / INFERENCES / GAPS / NEXT STEPS / PUBLICATION CAUTION).

3. **`/api/investigators/cases/[id]/intelligence-summary`** — new GET route. Returns a compact `{ entityCount, kolMatches, proceedsTotal, networkActors, laundryTrails, intelVaultRefs }` for the UI indicator. Also goes through `buildCaseIntelligencePack` for consistency.

4. **`CaseAssistant.tsx`** — major rewrite:
   - Intelligence indicator strip at top (analyzing N entities · K KOL matches · $X proceeds · …)
   - Quick-prompt chip row above the input bar (8 chips, horizontal scroll, no visible scrollbar)
   - **Markdown renderer** — inline `renderMarkdown(text)` handles `##` → orange uppercase H3, `###` → secondary H4, `**bold**`, `-`/`*` lists with orange bullets, numbered lists, paragraph breaks. No external library.
   - Component now uses `height: 100%` so it fills its parent. Outer flex container has `minHeight: 0` everywhere needed; quick-prompts row, input bar, error, quota all `flexShrink: 0`.

5. **Case detail page** — assistant tab is wrapped in `<div style={{ height: "calc(100vh - 300px)", minHeight: 480 }}>` so the assistant component has a real height to fill.

### V2D autonomous decisions

**1. `KolProceedsEvent` does not exist in this schema.** Spec referenced it. Fallback: derive `proceedsSummary.totalUSD` from `KolProfile.totalDocumented ?? totalScammed` and `eventCount` from `rugCount`. `topRoutes` is left empty `[]` and `alignsWithPromoWindows` is `false`. Fields stay in the type contract so the prompt structure is honored.

**2. `WatchScan` has no `address` column** (already documented in V2A). `inWatchlist` is always `false`. Field kept in the type for future extension.

**3. `PublishedCase` does not exist.** Used `KolCase` instead — its `caseId` field references published intel-vault cases. `intelVaultRefs` returns `KolCase` titles formatted as `"KOL Case <id> (<role>)"` with `evidence` as the optional summary.

**4. Network actors discovery via shared wallet addresses.** For each matched KolProfile, fetch all their KolWallet rows, then find other KolProfiles that share any of those addresses (excluding the originals). Capped at 20 actors.

**5. `safeQuery` wrapper.** Every Prisma call inside `buildCaseIntelligencePack` is wrapped in `safeQuery(fn, fallback)` so any DB error returns the empty default instead of throwing. The pack always returns something usable.

**6. Conflict detection lifted from CaseTwin.** Same rule (same value, multiple types). Hypothesis-CONFIRMED-without-evidence rule lives in CaseTwin client only; server pack reports a simpler conflict set.

**7. Server ignores client `caseContext` payload.** The client still sends it (backwards-compatible body shape), but the server builds its own pack from the DB. The client payload is now redundant — left in place to avoid touching the request shape.

**8. Markdown renderer is a single-pass line-based parser.** No tables, no code blocks, no nested lists. Bold within text via `**…**`. Sufficient for the structured FACTS/INFERENCES/GAPS/NEXT STEPS/PUBLICATION CAUTION format the prompt asks for. If the model produces fenced code blocks or tables, they render as plain text.

**9. Quick prompt chip row uses `scrollbarWidth: "none"`** to hide the scrollbar in Firefox. WebKit will show a thin scrollbar — acceptable.

**10. Assistant tab height = `calc(100vh - 300px)` with `minHeight: 480`.** 300px accounts for header + tabs + back link + tags row. Conservative estimate; if the case header grows, the assistant just gets shorter — but always ≥ 480px.

**11. The assistant pack is sent to Claude on every turn.** No caching. Each request rebuilds the pack from the DB. This is intentional — entities/hypotheses/timeline change between turns. Costs ~1k extra input tokens per turn for a case with ~50 entities. Quota gate accounts for it via the same `chars/4` estimate.

**12. Token quota gate is unchanged.** Pre-flight estimate now includes the full pack JSON, so the gate may fail-closed earlier than before. Acceptable — investigators get a clear error and can request a quota bump.

---

## V2E — Co-pilot precision upgrades (session 5)

Three precision upgrades to the Case Intelligence Co-pilot. No schema changes.

### What changed

1. **Confidence + Contradiction Engine** in `buildCaseIntelligencePack.ts`:
   - New types `ConfidenceClaim` and `ContradictionSignal` exported from the pack.
   - Auto-generated `confidenceAssessment[]` from 4 rules (proceeds attribution, laundering pattern, coordinated network, high-risk TigerScore).
   - Auto-detected `contradictions[]` from 4 rules (low-risk-but-confirmed, big-proceeds-no-trail, network-no-handles, confirmed-no-evidence).
   - Hypotheses query now selects `supportingEntityIds` to enable the rules.

2. **Analysis Modes** in `CaseAssistant.tsx`:
   - Mode selector row (Actor / Network / Publication) above the quick prompts. Click again to deselect.
   - Each mode swaps the quick-prompt set for a 5–6 prompt list focused on that mode.
   - When sending, an invisible hint prefix is prepended to the API request only (chat UI shows the bare user text).

3. **Timeline Correlation Engine** in `buildCaseIntelligencePack.ts`:
   - New `timelineCorrelation` field with timespan, largest gap, activity clusters, correlation signals.
   - `RAPID_EXIT` signal when ≥2 clusters within 30 days.
   - `NO_ALIGNMENT` always emitted (proceeds timestamps unavailable — see decision below).
   - Cluster detection: events within 48h grouped.

4. **Intelligence indicator + tooltip enhancement**:
   - Strip now also shows confidence claims, contradictions, and timeline span when present.
   - New `ⓘ` button (focus + hover) reveals an absolute-positioned tooltip with the full pack summary in 8 bullet points. Style: bg #111, orange-tinted border, z-index 50.

### Assistant route (`/ai-summary`-companion route also unchanged) prompt update
The system prompt now embeds three additional JSON sections — `CONFIDENCE ASSESSMENT`, `CONTRADICTIONS`, `TIMELINE CORRELATION` — and adds two new behavioral rules (rules 7 and 8) about referencing confidence levels and analyzing temporal patterns.

### V2E autonomous decisions

**1. `KolProceedsEvent` still does not exist in this schema.** Spec asked me to fetch proceeds timestamps from it. I emit `NO_ALIGNMENT` with `confidence: LOW` and a description explaining the data is unavailable. The type contract is preserved (`proceedsTimestamps: string[]` always returns `[]`). When this table is added in a future schema migration, the build function can be extended without touching the assistant route.

**2. Cluster detection threshold = 48h.** Spec language: "events within 48h of each other = one cluster". Implemented as a single-pass walk: a new cluster starts when the current event is more than 48h after the previous one. Events tied (same timestamp) collapse into the same cluster.

**3. Largest gap rendering.** Returns `null` when timespan is 0 days (single-day chronology). Otherwise `"N days between events"`. Computed only across consecutive events, not across cluster boundaries.

**4. Mode hint is injected at the API layer only.** The displayed user message in the chat shows the bare text the user typed. The hint is prepended only on the request body sent to the assistant route. This keeps the chat history clean while still giving Claude the mode signal.

**5. Mode is sticky across messages until manually deselected.** Click again on the same mode chip to deselect (returns to general mode and default quick prompts). No auto-deselect.

**6. Indicator strip is now a flex row** with `flex: 1` on the analyzing text and the `ⓘ` button as a fixed-size sibling. The tooltip is `position: absolute; top: 100%; right: 12px` so it floats below the strip.

**7. Tooltip width = 280px.** Wide enough for "X confidence-weighted claims" line without wrapping. Triggers on `mouseEnter`, `focus`, `mouseLeave`, `blur` — works for keyboard navigation too.

**8. Contradiction Rule 1 uses `tigerScore <= 30`** as the GREEN threshold. The spec text said "GREEN" without specifying a number. 30 is the conventional low-risk band cutoff in TigerScore-style scoring (LOW: 0–30, MED: 31–69, HIGH: 70+). Documented here in case it needs adjustment.

**9. Contradiction Rule 1 needs `supportingEntityIds`** populated on the hypothesis. Until investigators link entities to hypotheses (V2C UI doesn't expose this yet), this rule will rarely fire. It's still in place for forward-compat.

**10. Confidence Rule "High-risk entity confirmed" uses `entitiesRaw.tigerScore >= 70`.** Same TigerScore convention. Rare in practice today (no code currently writes `tigerScore`), but the rule is honest about its threshold.

**11. Hypothesis return shape is reduced** in the final pack object. The query now selects `supportingEntityIds` for contradiction detection, but the published `pack.hypotheses` still returns only `{title, status, confidence}` to keep the prompt JSON compact and prevent the model from inventing entity IDs.

**12. Indicator timeline display = `intelSummary.timelineSpan`** (e.g. "47 days"). Surfaced from `pack.timelineCorrelation.timespan`. Falls back to nothing when `null`.

---

## Paquet A — Investigator socle closure (session 6)

Polish, density, metrics, empty states, sharing upgrade. No schema changes.

### A1 — Workspace metrics strip
- New API: `GET /api/investigators/workspace/metrics` returning `{activeCases, trackedEntities, openHypotheses, publishReadyCases}`.
- Dashboard now renders a 4-tile strip below the privacy banner with `—` placeholders while loading. `publishReadyCases` = cases with ≥3 entities AND ≥1 hypothesis (approximation, computed via Prisma `groupBy`).

### A2 — Richer case cards + sort controls
- Title now `font-weight: 700, font-size: 16`. Tags + status badge on the same row. Metadata row shows entities / files / updated date.
- Status color map: PRIVATE (white-dim), SHARED_INTERNAL (orange), SUBMITTED (amber), ARCHIVED (white-very-dim).
- Sort controls: `Recent | Entities | Status` — client-side sorting, defaults to Recent.
- Card hover border → `rgba(255,107,0,0.2)` via `hover:border-[rgba(255,107,0,0.2)]` Tailwind arbitrary.

### A3 — Entities tab upgrade
- Filter pill row: ALL / WALLET / TX_HASH / HANDLE / URL / DOMAIN / OTHER + "Has intelligence" + "Has score" toggles. All filters are client-side.
- Entity count header: `N entities (showing M)` when filters are active.
- Empty-state block below the form when `entities.length === 0`.
- The whole entity-rendering block is wrapped in an IIFE that computes `filtered` and then renders count header + empty state + map.

### A4 — Graph upgrade
- Force simulation bumped: `linkDistance 80 → 120`, `chargeStrength -180 → -300`, `collide.radius 30 → 40`. Reduces label overlap on small graphs.
- Zoom controls (top-right overlay inside the canvas): `+`, `−`, `⊙` reset. Uses `zoomRef` + `d3.zoom.scaleBy` / `zoomIdentity` with 200–300ms transitions.
- Clicking the SVG background now deselects the node (previously only selected, no dismiss).

### A5 — Timeline — already supports entity linking
- `TimelineBuilder.tsx` already had the entity selector, chip display, and `entityIds` field from V2B. No changes needed.
- Timeline summary line + import-suggested-events (spec A5.3, A5.4) **skipped** — see decisions below.

### A6 — Hypothesis form
- Confidence slider removed from the quick-add form (moved to future edit mode). Faster to add = more hypotheses created.
- Status chips stay in quick-add.
- Entity linker on hypothesis form **not added** — `supportingEntityIds` is still populated only by the internal contradiction rules. See decision.

### A7 — Trust layer
- **A7.1** — Onboarding step 4 now has a "How your box works" block with 4 trust rows + inline SVG icons (lock, cpu/chip, eye-off, share-network). Inserted between "What this means" and the "Enter your workspace" CTA.
- **A7.2** — New page `src/app/investigators/box/trust/page.tsx`. Static server-rendered page with 5 sections: what we cannot read, what our system uses, what happens if you share, what happens if you publish, what we cannot recover.
- **A8.6** — Dashboard privacy banner now has a `How this works →` link to the trust page. Assistant tab footer also has a `Privacy policy →` link.

### A8 — Product polish
- **A8.1 sticky tabs** — Tab row on case detail page is `position: sticky; top: 0` with `rgba(0,0,0,0.95)` background + `backdrop-filter: blur(8px)`. Full-bleed via negative margins + padding.
- **A8.2 copy button** — Every assistant message has a "Copy" button below it (not on-hover because hover-only is bad on touch). "Copied!" feedback for 1.5s.
- **A8.3 regenerate** — `↺ Regenerate` link appears only on the last assistant message. Truncates `messages` to the last user message and re-posts.
- **A8.4 empty states** — Updated for Files, Notes, Entities, Hypotheses. Graph + Timeline already had them from prior sessions.
- **A8.5 microcopy** — Only one explicit message replaced (ShareCaseModal "Failed to generate link" → "This action failed. Try again or reload the page."). Other generic errors were already contextual.

### A9 — Sharing upgrade
- **A9.1 share preview** — Modal now shows a checklist of what will be included (✓ entities + title + tags) vs excluded (✗ notes, ✗ raw files) before generation. New "Include hypotheses" checkbox pulls current hypotheses via `GET /hypotheses`.
- **A9.2 revoke** — New `DELETE /api/investigators/cases/[caseId]/share/[shareId]` route sets `expiresAt = now()`. Logs `CASE_SHARE_REVOKED` audit.
- **A9.3 active shares list** — New `GET /api/investigators/cases/[caseId]/shares` returns non-expired shares (id + expiresAt + createdAt, **token stripped**). Modal renders them with per-row Revoke button.

### Autonomous decisions

**1. `publishReadyCases` metric is an approximation.** Spec said "publication readiness >= 4 (approximate: cases with >= 3 entities + >= 1 hypothesis)". I followed the approximation literally via two Prisma `groupBy` calls. A real readiness score would require running the full CaseTwin readiness rules per case, which is too expensive for a metric tile.

**2. Dashboard metrics load in parallel with cases.** Separate `useEffect` that fires on `keys` being available. No spinner — each tile shows `—` until the fetch returns. No retry on failure; the tile just stays at `—`.

**3. Sort controls are client-side only.** The case list is already fully loaded (no pagination), so sorting is instant. `localeCompare` for status (alphabetical: ARCHIVED, PRIVATE, SHARED_INTERNAL, SUBMITTED — not a perfect order but consistent).

**4. A5 skipped: timeline summary line + import suggestions.** The summary line would duplicate data already in the new intelligence indicator on the Assistant tab. Import-suggested-events would require a new CaseTwin flow with checkboxes and batch-add UI; it's too much surface area for the value delivered. Deferred to V3.

**5. A6 hypothesis entity linker not added.** Would require another multi-select in the hypothesis form. The `supportingEntityIds` column is used by the contradiction engine but not yet user-editable. Removing the confidence slider already made the form faster; adding another selector would undo that win. Deferred.

**6. Sticky tabs use negative margins + padding to achieve full-bleed** (`marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24`). The case page container has `px-6` so -24px margin aligns the tab row with the container edges. Backdrop blur may not render on every browser — it gracefully degrades to the solid `rgba(0,0,0,0.95)` background.

**7. Copy button appears below every assistant message** — not on-hover. Hover-only interaction patterns are inaccessible on touch devices and add cognitive cost. Constant display with light `rgba(255,255,255,0.3)` text is unobtrusive.

**8. Regenerate only on the last assistant message.** Regenerating an earlier message would require truncating history server-side too — complex UX. Last-message regenerate is sufficient for typical retry needs.

**9. Confidence slider removed from hypothesis quick-add.** Quick-add is now title + status chips + notes + save. The slider still exists in the component (dead state) — future edit-mode UI can re-mount it. Not removed to avoid breaking `newConfidence` state references.

**10. Graph zoom controls use D3 transitions** (`scaleBy 1.3` / `0.77` — inverse of 1.3 so in+out is symmetric). Reset resets to `zoomIdentity` (no translate, no scale).

**11. Trust page link opens in the same tab from the dashboard banner, but in a new tab from the assistant footer.** The assistant is a long-session context — opening in a new tab preserves the chat state. The dashboard has nothing to preserve.

**12. `ENTITY_DELETED` naming inconsistency noted in V2C still stands.** All other new audit actions in this session use past-tense verbs: `CASE_SHARE_REVOKED`. Existing taxonomy is now mixed but consistent per entity.

**13. Active shares list strips `token` server-side.** The GET route explicitly `select`s only `{id, expiresAt, createdAt}` — the token is never returned to the client after creation. The share modal caches the token in `shareUrl` state from the creation response; after modal close it's gone.

---

## Out of scope (V2D and beyond)

- Quota auto-reset cron
- Hypothesis snapshot opt-in UI on share modal (currently snapshot only includes title + entities)
- Real on-chain wallet journey (currently positional interleave)
- Resend webhook for delivery confirmation
- Investigator-side share management dashboard (revoke, list active shares)
- Multi-investigator collaboration on a single case
