# Vault Evidence Snapshots — V1 Implementation

Branch: `feat/vault-evidence-snapshots`
Date: 2026-05-02

---

## What Was Added

V1 of the Evidence Snapshot system inside the Investigator Vault. An investigator
can now record structured evidence references within a casefile — capturing a URL,
title, source type, analyst note, tags, publication status, and a linked case entity.
Each snapshot receives a server-generated SHA-256 record hash and timestamp.

---

## Files Modified

| File | Change |
|---|---|
| `prisma/schema.prod.prisma` | Added 2 enums + `VaultEvidenceSnapshot` model + relation on `VaultCase` |
| `src/app/investigators/box/cases/[caseId]/page.tsx` | Added `"evidence"` tab + render block + import |

---

## Files Created

| File | Purpose |
|---|---|
| `prisma/migrations/20260502_vault_evidence_snapshots/migration.sql` | Additive SQL for Neon SQL Editor |
| `src/lib/vault/evidenceSnapshotHash.ts` | SHA-256 record hash utility |
| `src/app/api/investigators/cases/[caseId]/evidence-snapshots/route.ts` | GET + POST API route |
| `src/components/vault/EvidenceSnapshotsSection.tsx` | UI component (list + add form) |
| `src/app/api/investigators/cases/__tests__/evidence-snapshots.test.ts` | 13 route tests |
| `src/lib/vault/__tests__/evidenceSnapshotHash.test.ts` | 7 hash unit tests |

---

## Migration

Run in Neon SQL Editor before deploying:

```
prisma/migrations/20260502_vault_evidence_snapshots/migration.sql
```

Creates:
- `VaultEvidenceSourceType` enum
- `VaultEvidencePublishability` enum
- `VaultEvidenceSnapshot` table with FK to `VaultCase` (CASCADE delete)

---

## Data Model

```prisma
model VaultEvidenceSnapshot {
  id                   String                      @id @default(cuid())
  caseId               String                      // FK → VaultCase
  workspaceId          String
  investigatorAccessId String                      // who created it
  url                  String?
  title                String
  sourceType           VaultEvidenceSourceType     @default(OTHER)
  note                 String?
  tags                 String[]
  relatedEntityId      String?                     // entity in same case
  publishability       VaultEvidencePublishability @default(PRIVATE)
  contentHashSha256    String                      // snapshot record hash
  capturedAt           DateTime                    // server-set
  createdAt            DateTime                    @default(now())
  updatedAt            DateTime                    @updatedAt
}
```

---

## Snapshot Record Hash

The `contentHashSha256` is a SHA-256 digest of a canonical JSON object containing:
`caseId`, `url`, `title`, `sourceType`, `note`, `tags` (sorted), `relatedEntityId`, `capturedAt`.

**What it proves:** the integrity of the record as it was written at capture time.
**What it does NOT prove:** that the URL's content is authentic or has not changed.

UI wording: "Snapshot record hash" — never "verified proof" or "authentic".

---

## API

### GET `/api/investigators/cases/[caseId]/evidence-snapshots`
- Auth: `getVaultWorkspace` + `assertCaseOwnership`
- Returns: `{ snapshots: VaultEvidenceSnapshot[] }` ordered by `capturedAt desc`

### POST `/api/investigators/cases/[caseId]/evidence-snapshots`
- Auth: same
- Body: `{ url?, title?, sourceType?, publishability?, note?, tags?, relatedEntityId? }`
- `capturedAt` and `contentHashSha256` are generated server-side
- Default `publishability`: `PRIVATE`
- Validates URL (http/https only), title (required or derived from URL hostname)
- Validates `relatedEntityId` belongs to the same case
- Writes `EVIDENCE_SNAPSHOT_CREATED` to `VaultAuditLog`

---

## Security & Privacy

- Default publishability = `PRIVATE`. Never auto-promoted.
- Only accessible via authenticated investigator session. Auth is enforced in the route handler via `getVaultWorkspace()` (full DB session validation), consistent with all `/api/investigators/` routes. Do not expose via any public route.
- Workspace isolation enforced: `assertCaseOwnership` returns 403 for cross-workspace access.
- `relatedEntityId` validated against the case — cross-case linking is rejected with 400.
- No external URL fetching or content scraping (V2 extension responsibility).
- Snapshots are never exposed on public retail routes.

---

## V1 Limits

- No PATCH/DELETE on existing snapshots (read + append only)
- No content download from URL (no scraping, no screenshot, no archive.org lookup)
- No browser extension integration
- No export to Timeline or IOC Export (those will consume snapshots in V2)
- No pagination on GET (in-memory list fine for investigator scale)

---

## TODO V2

- Browser extension: capture URL + screenshot → POST to this route automatically
- Timeline integration: `VaultEvidenceSnapshot` as timeline event source
- IOC Export: include publishable snapshots in export package
- Admin review workflow: surface PUBLISHABLE snapshots for editorial review
- PATCH: allow investigator to update note, tags, publishability
- Content hash for actual page: if screenshot is stored in R2, hash the binary too
