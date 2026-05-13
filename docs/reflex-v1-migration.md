# REFLEX V1 — Prisma migration runbook

Commit 4/15. Applies the additive schema needed for Commits 5 (narrative
seed) and 7 (API routes).

## What this migrates

Three new tables, strictly additive, no impact on any existing table:

| Table              | Purpose                                                     |
|--------------------|-------------------------------------------------------------|
| `ReflexAnalysis`   | One row per `/api/reflex` call — verdict, manifest, hash    |
| `NarrativeScript`  | The 15 narrative scripts seeded in Commit 5                 |
| `ReflexWatch`      | TTL-30j watch queue (POST `/api/reflex/:id/watch`)          |

Indexed columns: lookup paths the verdict layer and admin pages need
(by address, handle, verdict, mode, createdAt; by script category +
active; by watch target, status, nextCheckAt).

## Hard rules

- **Target DB: `ep-square-band` ONLY.** Never `ep-bold-sky`, never the
  local `dev.db`. Verify the Neon dashboard branch before pasting.
- **No `prisma db push`, ever.** This file is the only way the schema
  changes in prod.
- **Run inside the embedded `BEGIN; … COMMIT;`.** If anything fails, the
  whole transaction rolls back — no half-applied state.
- **Idempotent.** Every `CREATE TABLE` / `CREATE INDEX` is guarded by
  `IF NOT EXISTS`, so re-running the script is a no-op.

## Procedure

1. Open the Neon SQL Editor on `ep-square-band`.
2. Open `docs/reflex-v1.sql` in the editor of your choice.
3. Copy the entire file (including `BEGIN;` and `COMMIT;`) into the
   Neon SQL Editor.
4. Run.
5. Verify the three tables exist:
   ```sql
   \dt "ReflexAnalysis" "NarrativeScript" "ReflexWatch"
   ```
   You should see all three listed.
6. Spot-check the indexes:
   ```sql
   \d "ReflexAnalysis"
   \d "NarrativeScript"
   \d "ReflexWatch"
   ```

## Rollback

If anything goes wrong before users start writing to these tables:

```sql
BEGIN;
DROP TABLE IF EXISTS "ReflexWatch";
DROP TABLE IF EXISTS "NarrativeScript";
DROP TABLE IF EXISTS "ReflexAnalysis";
COMMIT;
```

Indexes drop automatically with their parent table.

## After the migration

- The local Prisma client was already regenerated during Commit 4
  (`npx prisma generate` is part of that commit). No additional local
  step is required.
- Commit 5 (`feat(reflex): narrative library + matcher`) will run
  `npm run seed:narrative-scripts` against `ep-square-band` to insert
  the 15 scripts. That step requires the tables to exist, which is why
  this migration must be applied **before** Commit 5 lands.

## What if the build deploys before the migration?

- The API routes that read/write these tables ship in Commit 7. The
  Vercel build itself does not query the new tables.
- `prisma generate` runs at build time and embeds the new model types,
  but no Prisma query against the new tables exists in the codebase
  before Commit 7. The window between "schema known to client" and
  "tables exist in prod" is therefore non-load-bearing for Commits 4–6.

## Sanity check after Commit 7 ships

```sql
SELECT mode, verdict, COUNT(*) FROM "ReflexAnalysis"
GROUP BY mode, verdict
ORDER BY mode, verdict;
```

Should return at least one row per (SHADOW, verdict) once the first
shadow analyses run via `/investigator/reflex`.
