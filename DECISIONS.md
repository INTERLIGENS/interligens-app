# Investigators V2A + V2B — Autonomous Sessions Decisions

Branch: `feat/investigators-v2a`

---

## V2A — Initial feature bundle (session 1)

Covered: Entity Launchpad · Cross-Intelligence Enrichment · Case Templates · Derived Graph (D3) · Redaction tool · Case Twin V0 · Next-Best-Step toast. See V2A section below for the full list of V2A-specific autonomous decisions.

## V2B — Fix + expansion (session 2)

Blocs delivered:
1. **Entity add form** — `EntityAddForm.tsx` with manual add + bulk paste (regex-parsed preview).
2. **Timeline Builder** — `TimelineBuilder.tsx` replaces audit-log timeline tab. Full CRUD API routes.
3. **Contradiction Finder** — rule-based, rendered in CaseTwin between Gaps and Readiness. Per-conflict dismiss.
4. **Dual Export** — JSON (client-side), PDF via `/print` page (print-optimized, white bg), AI retail summary via Anthropic SDK.
5. **Publish → Intel Vault** — `VaultPublishCandidate` model, `POST /publish-candidate`, 3-step form in Export tab.
6. **Global entity search** — `GET /api/investigators/entities/search`, debounced dashboard search bar with client-side decryption.
7. **Case Twin AI analysis** — Section F, reuses `/ai-summary` with `mode=investigator`.
8. **Cross-case collision signal** — `GET /api/investigators/entities/collisions`, subtle notice in Section A. No reveal.
9. **Redact page improvements** — `caseId` param, back-to-case link, `z` shortcut, `escape` clears all, "Add to case files" upload flow.

Hypothesis form upgrade (Bloc 1 part): status chips, confidence slider, notes textarea, delete per hypothesis, colored status badges + confidence bar.

### V2B autonomous decisions

**1. Timeline tab fully replaced.** The old Timeline tab showed raw audit events (CASE_VIEWED etc.). V2B replaces it with manual `VaultTimelineEvent` data. Audit events still flow to `VaultAuditLog` unchanged. The prop `timelineEvents={timeline.length}` on CaseTwin was removed — CaseTwin now fetches its own timeline count from `VaultTimelineEvent`.

**2. Bulk paste regex uses a conservative ordering.** Order: ETH TX (64 hex) → EVM addr (40 hex) → URL → Telegram → Twitter → Solana base58. An EVM address that is a prefix of a TX hash is skipped to prevent double-counting. The Solana regex is 32–44 base58 which can false-positive on long alphanumeric strings — investigator can remove in preview before submission.

**3. AI summary route uses `claude-sonnet-4-20250514` per spec.** Spec asked for this exact model. That model ID may not be currently available — the route falls back to mock if the API returns an error. If `ANTHROPIC_API_KEY` is missing, the route returns mock responses for both modes and logs `AI_SUMMARY_MOCK`. Human action: verify the model ID; swap to a current one if needed (e.g., `claude-sonnet-4-5-20250929`).

**4. PDF "export" is a print page, not a real PDF.** A dedicated `/investigators/box/cases/[caseId]/print/page.tsx` renders a print-optimized layout (white bg, black text, tables). User opens it in a new tab and uses browser Print / Save as PDF. No `html2canvas` / `jspdf` dependency added. Notes opt-in via `?includeNotes=true` query param. The print page is **client-rendered inside VaultGate** because notes need client-side decryption — this also means users must be unlocked in the new tab, which they will be since cookies + session are shared.

**5. Investigator handle display on print page.** Spec said "investigator handle". I query `/api/investigators/me` but that route likely doesn't exist. The `.catch()` returns `"—"` and the page gracefully continues. Not a blocker. Follow-up: add `/api/investigators/me` returning the vault profile handle.

**6. Contradiction Rule 4 skipped.** Rule 4 depends on `tigerVerdict` being populated on `VaultCaseEntity`. That field exists in schema but is never written by any code path. Rule 4 is skipped with no warning — would always be false. Documented here.

**7. Collision API: "other workspace" means `workspaceId: { not: ctx.workspace.id }`.** Spec said "cases NOT belonging to this workspace". Implemented literally. No caseId/workspaceId/investigator ever leaks back — only the unique count of matched values.

**8. Global search API decrypts nothing server-side.** The API returns `caseTitleEnc` + `caseTitleIv` — decryption happens in the dashboard client using `keys.metaKey`. Search is on ciphertext-free columns only (`value`, `label`). This is correct: the `value` and `label` columns are stored in plaintext as derived-layer data (per existing schema design), so server-side `ILIKE` search is safe. Encrypted fields (title, tags, notes, filename) are never searched server-side.

**9. Publish form min summary length = 100 chars, enforced client+server.** Spec said "min 100 chars". Both sides validate.

**10. `VaultHypothesis.supportingEntityIds`** — still not exposed in the UI form. Schema supports it. V2B hypothesis form only captures title, status, confidence, notes. Linking supporting entities is deferred.

**11. Retail AI summary "Risk level"** — spec said LOW/MEDIUM/HIGH. Risk color mapping: LOW=green, MEDIUM=orange (reuses #FF6B00 accent), HIGH=red.

**12. `/print` page is accessible to anyone who can authenticate against the vault for that case.** VaultGate check + authenticated API routes guarantee ownership. No new route-level ACL needed.

**13. `ai-summary` route is `POST` not `GET`** — spec said POST. Even though retail and investigator modes are "read-only", we use POST to keep the body `{ mode }` semantic and to prevent accidental caching of AI output.

**14. Content block text extraction (Anthropic SDK).** The Anthropic SDK 0.80 `ContentBlock` type is a union including `TextBlock` and `ThinkingBlock`. The strict type predicate failed TS because `TextBlock` requires `citations`. Fixed by narrowing with `"text" in textBlock && typeof textBlock.text === "string"`.

**15. Redact page keyboard shortcuts extended.** Spec said Delete / Z. I also wired Backspace (mac habit) and Escape (clear all) to match the UI text.

**16. "Add to case files" reuses existing draft → presign → R2 PUT → finalize flow.** parseStatus set to `MANUAL_REQUIRED`, parseMode `redacted_screenshot`. Filename is `redacted-{timestamp}.png`, encrypted with metaKey like all other filenames. Blob encrypted with fileKey.

**17. Suspense wrapper around RedactInner.** `useSearchParams` in Next 16 requires a Suspense boundary. Added `<Suspense fallback={null}>`.

**18. All new audit actions** — `AI_SUMMARY_GENERATED`, `AI_SUMMARY_MOCK`, `TIMELINE_EVENT_CREATED/UPDATED/DELETED`, `PUBLISH_SUBMITTED`, `ENTITIES_SEARCHED`. Follow existing naming.

---

## Type check

`npx tsc --noEmit` → **pass** (exit 0, zero errors).

---

## SQL migrations — human must apply via Neon SQL Editor

### V2A migration (already documented in earlier session)

File: `prisma/migrations/manual_investigators_v2a/migration.sql` — adds `VaultCase.caseTemplate` + `VaultHypothesis` + enum.

### V2B migration (new)

File: `prisma/migrations/manual_investigators_v2b/migration.sql`

```sql
CREATE TABLE IF NOT EXISTS "VaultTimelineEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "entityIds" TEXT[],
  "eventType" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultTimelineEvent_caseId_idx"
  ON "VaultTimelineEvent"("caseId");
CREATE INDEX IF NOT EXISTS "VaultTimelineEvent_eventDate_idx"
  ON "VaultTimelineEvent"("eventDate");

DO $$ BEGIN
  ALTER TABLE "VaultTimelineEvent"
    ADD CONSTRAINT "VaultTimelineEvent_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VaultPublishCandidate" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "entityIds" TEXT[],
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  CONSTRAINT "VaultPublishCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultPublishCandidate_caseId_idx"
  ON "VaultPublishCandidate"("caseId");
CREATE INDEX IF NOT EXISTS "VaultPublishCandidate_status_idx"
  ON "VaultPublishCandidate"("status");

DO $$ BEGIN
  ALTER TABLE "VaultPublishCandidate"
    ADD CONSTRAINT "VaultPublishCandidate_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

**Apply both V2A and V2B migrations before using the features that depend on them.** Until then:
- V2A: `VaultHypothesis` routes return empty or 500, `caseTemplate` writes silently use schema default.
- V2B: Timeline Builder GET returns empty (safe), POST returns 500. Publish-candidate POST returns 500.

---

## Needs human action

1. **Apply V2A SQL** via Neon SQL Editor.
2. **Apply V2B SQL** via Neon SQL Editor.
3. **Set `ANTHROPIC_API_KEY`** in Vercel env vars. Without it, AI summary routes return a documented mock response. Set via Vercel UI (not `vercel env pull`).
4. **Verify Claude model ID** — spec pins `claude-sonnet-4-20250514`. If unavailable, edit `src/app/api/investigators/cases/[caseId]/ai-summary/route.ts` to use `claude-sonnet-4-5-20250929` or similar current Sonnet.
5. **Optional**: implement `/api/investigators/me` returning `{ handle }` for the print page header. Currently shows `—`.

---

## Security checklist (V2A + V2B)

- [x] EntityLaunchpad: external links only, no server calls
- [x] Cross-Intelligence: internal Prisma queries only (KolWallet, KolProfile)
- [x] Redaction tool: client-side canvas, opt-in "Add to case files" uses existing encrypted file flow
- [x] CaseTwin / Graph / TimelineBuilder: derived layer only
- [x] AI Summary API: sends only `{ type, value, label, tigerScore }` for entities, `{ title, status, confidence }` for hypotheses, `{ date, title, description }` for timeline events. **Never notes, never file content, never raw filename.**
- [x] Collision API: returns only `{ hasCollisions, collisionCount }` — never caseId, workspaceId, or investigator identity
- [x] Publish candidate: only `entityIds` + `summary` stored. Entity IDs validated against case ownership before insert.
- [x] Global search API: scoped to authenticated workspace via `case: { workspaceId: ctx.workspace.id }`. Returns encrypted case title for client-side decryption.
- [x] Print page: wrapped in VaultGate, requires unlocked vault
- [x] All new API routes: `getVaultWorkspace` + `assertCaseOwnership` + `logAudit`
- [x] No cyan, no emoji, design tokens respected throughout

---

## What is still out of scope (deferred to V2C)

- Claim Discipline Engine
- Investigator Reputation Graph
- Live review dashboard for `VaultPublishCandidate`
- Timeline PNG export (spec mentioned html2canvas fallback — skipped since lib not installed)
- Entity drag-and-drop on graph→timeline
- Supporting entity linker on hypotheses

---

## V2A — earlier decisions (session 1, preserved)

_(All 15 V2A-specific autonomous decisions from the prior session remain valid. Key ones restated: `getVaultWorkspace` not `getInvestigatorWorkspace`; WatchScan has no wallet address column — inWatchlist always false; KolProfile uses `handle` not `twitterHandle/telegramHandle`; D3 force simulation chosen over reactflow; caseTemplate values are slugs `blank|rug-pull|kol-promo|cex-cashout|infostealer`.)_
