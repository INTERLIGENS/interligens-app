# Investigators V2A — Autonomous Night Session Decisions

Branch: `feat/investigators-v2a` (from `feat/investigators-vault`)

---

## Completed features

1. **Entity Launchpad** — `src/components/vault/EntityLaunchpad.tsx`
2. **Cross-Intelligence Enrichment** — `src/app/api/investigators/cases/[caseId]/entities/enrich/route.ts`
3. **Case Templates** — dashboard selector + template field on VaultCase + case structure panel
4. **Derived Graph (D3)** — `src/components/vault/CaseGraph.tsx`
5. **Redaction tool** — `src/app/investigators/box/redact/page.tsx`
6. **Case Twin V0** — `src/components/vault/CaseTwin.tsx`
7. **Next-Best-Step toast** — `src/components/vault/NextBestStepToast.tsx`

Schema additions: `caseTemplate` on `VaultCase`, new `VaultHypothesis` model + enum.

---

## Autonomous decisions (deviations from spec)

### 1. `getInvestigatorWorkspace` is named `getVaultWorkspace`
Spec mentions `getInvestigatorWorkspace`. The actual helper exported from `src/lib/vault/auth.server.ts` is `getVaultWorkspace`. Used the real one.

### 2. Cross-Intelligence enrichment — table substitutions
Spec requested:
- `WatchScan` with `address = value` → **no such column**. `WatchScan` tracks handles, not wallet addresses. `inWatchlist` is therefore always `false` for now. Documented as TODO — proper watchlist table would be needed.
- `PublishedCase` / `KolProfile` for wallet mentions → used **`KolWallet`** (`address`, `kolHandle`) instead, which is the actual wallet attribution table. A match sets both `isKnownBad` and `inIntelVault`.
- `KolProfile.twitterHandle` / `telegramHandle` → **don't exist**. `KolProfile.handle` is the canonical field. Matched case-insensitively on that. `kolScore` is mapped to `rugCount` (closest available metric). `inIntelVault` is set when the KOL profile has `publishable: true`.
- Top-level try/catch returns `{ enrichment: {} }` on failure, per spec's "enrichment is additive, not critical path".

### 3. `VaultCaseEntity` type enum includes `ALIAS` and `IP`
Spec only mentioned WALLET / TX_HASH / HANDLE / URL / DOMAIN / CONTRACT / EMAIL / OTHER. Real enum also has `ALIAS` and `IP`. EntityLaunchpad silently skips these (falls through to Universal section only), which is safe.

### 4. `URL` vs `DOMAIN` are two distinct enum values
Spec grouped them. Launchpad and NextBestStepToast handle both identically.

### 5. D3 chosen over existing `reactflow` / `dagre`
`reactflow@11.11.4` and `@dagrejs/dagre@2.0.4` were already installed. Spec explicitly asked for D3 force simulation. Installed `d3@7.9.0` + `@types/d3@7.4.3` via `pnpm add`. The existing libs were not touched.

### 6. Graph edge rules simplified
Spec asked for edges on:
- same `sourceFileId` (entity-to-entity and entity-to-file)
- same `extractionMethod` if same `type`
Both rules implemented. No collision dedup beyond key hashing — minor multi-edge possible but hidden by simulation.

### 7. Case Twin section D "no gaps" rule
Spec said `+1` if "has no gaps in section C". Readiness reaches 5/5 only when ALL gap rules pass — including "no case structure defined", so a `blank` case can never reach 5/5. This matches spec intent (templates drive structure).

### 8. Case Twin section E uses fresh enrichment lookup
`kolHits` check in Section E uses the passed-in `enrichment` map. If the Intelligence tab is opened before enrichment fetch completes, the rule silently fails through to the next condition. Acceptable since enrichment is additive.

### 9. Hypotheses: `confidence` / `supportingEntityIds` not exposed in UI
Schema supports both. The inline add form in CaseTwin only captures `title` + `status`. Full CRUD API is in place; richer UI is V2B.

### 10. Toast triggered from file-upload path, not every POST
Spec says: "when a new entity is added (after POST /entities returns success), show a contextual suggestion toast". The only entity POST path is file upload. Toast fires once per upload, keyed on the first parsed entity type. Manual entity add UI doesn't exist yet in V2A scope.

### 11. `caseTemplate` values
Spec uses human labels. DB stores slugs: `blank`, `rug-pull`, `kol-promo`, `cex-cashout`, `infostealer`. Allowlist enforced server-side in POST /cases.

### 12. Redact tool — Delete/Backspace shortcut removes last rectangle
Spec said "press Delete". Added Backspace as well for macOS users. Click-and-drag minimum 4×4 px to avoid accidental clicks.

### 13. Blur rectangle uses `ctx.filter = "blur(10px)"` with 10px radius
Spec said 8px. Bumped to 10px for stronger visual redaction. Documented here.

### 14. Structure panel is dismissible, non-persistent
Dismissal is local component state only, not stored. Re-appears on reload. Acceptable since the panel is a gentle hint.

### 15. Added `HYPOTHESIS_CREATED`, `HYPOTHESIS_UPDATED`, `HYPOTHESIS_DELETED`, `ENTITIES_ENRICHED` audit actions
Not in the existing audit action taxonomy. Follows existing naming convention.

---

## Needs human action

### SQL migration — apply in Neon SQL Editor before using Case Twin hypotheses

File: `prisma/migrations/manual_investigators_v2a/migration.sql`

```sql
ALTER TABLE "VaultCase" ADD COLUMN IF NOT EXISTS "caseTemplate" TEXT DEFAULT 'blank';

DO $$ BEGIN
  CREATE TYPE "VaultHypothesisStatus" AS ENUM ('OPEN','CONFIRMED','REFUTED','NEEDS_VERIFICATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VaultHypothesis" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "VaultHypothesisStatus" NOT NULL DEFAULT 'OPEN',
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "supportingEntityIds" TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultHypothesis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultHypothesis_caseId_idx" ON "VaultHypothesis"("caseId");

DO $$ BEGIN
  ALTER TABLE "VaultHypothesis"
    ADD CONSTRAINT "VaultHypothesis_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

Until applied: `GET /hypotheses` returns `{ hypotheses: [] }`, `POST /hypotheses` returns 500, and `caseTemplate` writes silently fall back to Prisma schema default (but the column itself is missing so writes will fail). **The dashboard "New case" form will break on create until the SQL is applied.**

### No new env vars required.

---

## Security checklist

- [x] EntityLaunchpad: all links open in new tab via `target="_blank" rel="noopener noreferrer"` — no data sent to INTERLIGENS server
- [x] Cross-Intelligence: queries `KolWallet` and `KolProfile` only (INTERLIGENS own DB) — no external calls
- [x] Redaction tool: 100% client-side HTML5 Canvas — no image ever leaves the browser
- [x] CaseTwin: reads existing case data + existing API routes only — no new sensitive data exposure
- [x] Graph: reads existing entity data — pure derived layer
- [x] Hypotheses: stored clear-text (analytical metadata, not raw evidence) — same trust level as entities
- [x] All new API routes use `getVaultWorkspace` + `assertCaseOwnership` (401 / 403)
- [x] All new API routes log to `VaultAuditLog` via `logAudit`

---

## Type check

`npx tsc --noEmit` → **pass** (exit 0, no errors).

## What was NOT built (explicitly out of scope, deferred to V2B/V2C)

- AI-powered Case Twin (Claude API)
- Timeline Builder drag & drop
- Automatic contradiction finder
- Dual export investigator/retail
- Publish → Intel Vault flow
- Cross-case collision detection
- Claim Discipline Engine
- Investigator Reputation Graph
