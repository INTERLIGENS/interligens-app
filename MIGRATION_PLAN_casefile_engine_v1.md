# MIGRATION PLAN — Casefile Engine V1

**Status:** ⏸ **MIGRATION SQL GENERATED — AWAITING HUMAN APPROVAL**
**Script:** [`MIGRATION_casefile_engine_v1.sql`](./MIGRATION_casefile_engine_v1.sql)
**Target schema:** `prisma/schema.prod.prisma`
**Target DB:** Neon prod `ep-square-band` (port 6543, pgbouncer) — **execute manually via Neon SQL Editor only**
**Branch:** `feat/casefile-engine-v1`

## Tables added

| Table | Purpose |
|---|---|
| `CasefileDraft` | Wizard-driven casefile draft. Synthetic-demo only in V1. Admin-only. |
| `Exhibit` | Exhibits attached to a draft (1-to-N, ON DELETE CASCADE). |

## Tables modified

None. The diff was produced by `prisma migrate diff` from a snapshot
(`/tmp/schema.prod.before.prisma`) taken before any edits. The resulting SQL
contains **only** `CREATE TABLE`, `CREATE UNIQUE INDEX`, and
`ADD CONSTRAINT ... FOREIGN KEY` statements. No `ALTER TABLE ... DROP`, no
column type changes on existing tables, no destructive operations.

Verified with:

```bash
grep -Ei "drop|alter table .* drop|alter column" MIGRATION_casefile_engine_v1.sql
# → no matches
```

## Data impact

Zero rows of existing data are read, modified, or deleted. The migration only
introduces new empty tables and their constraints.

## Indexes & constraints added

- `CasefileDraft_pkey` (PK on `id`)
- `CasefileDraft_casefileId_key` (UNIQUE on `casefileId`)
- `Exhibit_pkey` (PK on `id`)
- `Exhibit_casefileDraftId_exhibitId_key` (UNIQUE on `(casefileDraftId, exhibitId)`)
- `Exhibit_casefileDraftId_fkey` (FK Exhibit → CasefileDraft ON DELETE CASCADE)

## Rollback

```sql
-- Run in Neon SQL Editor if rollback needed.
ALTER TABLE "Exhibit" DROP CONSTRAINT IF EXISTS "Exhibit_casefileDraftId_fkey";
DROP TABLE IF EXISTS "Exhibit";
DROP TABLE IF EXISTS "CasefileDraft";
```

The rollback is also non-destructive to other tables because no FK from
existing tables points into `CasefileDraft` or `Exhibit`.

## Diff vs `schema.prod.before.prisma` (summary)

Two new model blocks appended at the tail of `prisma/schema.prod.prisma`,
guarded by a section comment:

```
// =============================================================================
// CASEFILE ENGINE V1 — admin-only, feature-flagged (FEATURE_CASEFILE_ENGINE_V1)
// =============================================================================

model CasefileDraft { … }
model Exhibit       { … }
```

No edits to any pre-existing model. Verified by:

```bash
diff /tmp/schema.prod.before.prisma prisma/schema.prod.prisma | head
# → shows only appended lines (`>` direction).
```

## Stop conditions — none triggered

- ✅ No `DROP TABLE` on any existing table
- ✅ No `ALTER TABLE ... DROP COLUMN`
- ✅ No column type changes on existing tables
- ✅ No data movement statements

## Execution checklist (for David — manual, after review)

1. Open Neon SQL Editor on the prod branch (`ep-square-band`).
2. Paste the contents of `MIGRATION_casefile_engine_v1.sql`.
3. Run inside a transaction (`BEGIN; … COMMIT;`).
4. Verify with:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_name IN ('CasefileDraft', 'Exhibit');
   ```
5. Locally run `pnpm prisma:generate` to refresh the client.
6. Set `FEATURE_CASEFILE_ENGINE_V1=true` in Vercel env (preview only first).

**Do not run `prisma migrate deploy` or `prisma db push` against prod.**
