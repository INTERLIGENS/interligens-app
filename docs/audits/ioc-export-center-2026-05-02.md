# IOC Export Center — Audit V1
Date: 2026-05-02  
Branch: feat/ioc-export-center  
Author: INTERLIGENS

## Formats added

| Format | ID | Content-Type | Publishability filter |
|--------|-----|-------------|----------------------|
| CSV Full | `CSV_FULL` | text/csv | SHAREABLE + PUBLISHABLE |
| JSON Structured | `JSON_STRUCTURED` | application/json | All (PRIVATE included for internal use) |
| STIX-like JSON | `STIX_LIKE_JSON` | application/json | SHAREABLE + PUBLISHABLE |
| Police Annex PDF | `POLICE_ANNEX_PDF` | application/pdf | SHAREABLE + PUBLISHABLE |
| Threat Intel Feed | `THREAT_INTEL_CSV` | text/csv | PUBLISHABLE only |

## Publishability rules

- **VaultCaseEntity** records have no publishability field — all entities default to `SHAREABLE` (they are derived, investigator-annotated).
- **VaultEvidenceSnapshot** records use their own `VaultEvidencePublishability` enum: `PRIVATE / SHAREABLE / PUBLISHABLE / REDACTED`.
- `PRIVATE` is excluded from all shareable exports. It is included in `JSON_STRUCTURED` only when `includePrivate: true` is passed by the client.
- The count of excluded private material is logged in `privateExcluded` and shown in the export result / police annex footer.

## IOC canonical fields

```typescript
{
  id: string;               // "entity-{id}" or "snapshot-{id}"
  type: IocType;            // WALLET | TX_HASH | CONTRACT | DOMAIN | URL | X_HANDLE | TELEGRAM | GITHUB_REPO | EVIDENCE_SNAPSHOT | OTHER
  value: string;
  chain: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  source: string;           // "vault-case-entity" or "vault-evidence-snapshot:WEBSITE"
  confidence: number | null;
  relatedCaseId: string;
  relatedEntityId: string | null;
  relatedEvidenceSnapshotId: string | null;
  publishability: IocPublishability;
  notes: string | null;
  tags: string[];
  createdAt: string;
}
```

## Export hash

`computeExportHash(iocs: CanonicalIoc[]): string` — SHA-256 over canonical JSON of the included IOC list.

Canonicalisation rules:
- IOCs sorted by `id` ascending
- Tags sorted within each IOC
- Nulls normalised to empty string
- The hash itself is not included in its own input
- Algorithm: Node `crypto.createHash("sha256")`

The hash covers only the indicators included in the export (after publishability filter). It is an integrity hash of the generated record, not an authenticity proof of any external source.

## Files modified / created

| File | Action |
|------|--------|
| `prisma/schema.prod.prisma` | + `CaseExportFormat` enum, + `CaseExport` model, + `VaultCase.exports` relation |
| `prisma/migrations/20260502_case_export_model/migration.sql` | New — apply in Neon SQL Editor |
| `src/lib/vault/iocExportBuilder.ts` | New — IOC normalization from entities + snapshots |
| `src/lib/vault/iocExportHash.ts` | New — deterministic SHA-256 export integrity hash |
| `src/lib/vault/iocExportFormats.ts` | New — CSV, JSON, STIX-like, Threat Intel serializers |
| `src/lib/vault/iocExportPdf.ts` | New — Police Annex HTML builder + Puppeteer renderer |
| `src/app/api/investigators/cases/[caseId]/exports/route.ts` | New — GET (history) + POST (generate) |
| `src/components/vault/CaseExport.tsx` | Extended — IOC Export Center section added at top |
| `src/lib/vault/__tests__/iocExportBuilder.test.ts` | New — 8 unit tests |
| `src/lib/vault/__tests__/iocExportHash.test.ts` | New — 9 unit tests |
| `src/app/api/investigators/cases/__tests__/exports.test.ts` | New — 18 integration tests |

## Migration status

**NOT applied** — migration SQL is at:
```
prisma/migrations/20260502_case_export_model/migration.sql
```

Apply in Neon SQL Editor before deploying. The `CaseExport` model creates a new table and enum. The route handles the case where the table doesn't exist yet (graceful error on `persistExportRecord`, format generation still works).

## Tests

```
pnpm test src/lib/vault/__tests__/iocExportBuilder.test.ts   → 8/8 pass
pnpm test src/lib/vault/__tests__/iocExportHash.test.ts      → 9/9 pass
pnpm test src/app/api/investigators/cases/__tests__/exports.test.ts → 18/18 pass
Full suite: 1523/1523 pass
tsc --noEmit: 0 errors
prisma validate: valid
```

## Security

- All export endpoints gated by `getVaultWorkspace` (session cookie) + `assertCaseOwnership` (workspace isolation)
- No public endpoint
- PRIVATE material excluded from all shareable exports
- Audit log entry `CASE_EXPORT_CREATED` written per export with: exportId, format, iocCount, snapshotCount, privateExcluded, exportHashSha256
- Export content never stored server-side (returned inline); only metadata stored in `CaseExport`
- Client-side encrypted fields (titleEnc, contentEnc, etc.) never exposed through this API

## STIX-like limitations

The export uses `spec_version: "interligens-stix-like-1.0"` and is explicitly NOT claimed to be STIX 2.1 compliant. It is a compatible approximation. Pattern syntax uses `[type:value = '...']` but is not validated against STIX TAXII or OASIS specifications.

## Police Annex PDF limitations

- Requires `@sparticuz/chromium-min` + `puppeteer-core` (already in project dependencies via KOL PDF engine)
- Falls back to HTML if Puppeteer is unavailable in the environment
- English only in V1 (FR TODO)
- No digital signature (TODO V2)

## Legal wording

All exports include the notice:
> "Documented risk indicators. Not a legal determination. Not financial advice. Source-attributed investigative material generated by INTERLIGENS."

Forbidden wording in all output: "criminal", "scammer confirmed", "fraudster", "legal proof", "authenticity guaranteed", "court-ready proof".

## Risks remaining

- PDF generation via Puppeteer on Vercel: function timeout risk on large cases (>200 entities). Monitor.
- `CaseExport.includedCounts` is `Json` in DB — no typed enforcement on shape.
- No rate limit on POST /exports. Add Redis rate limit in V2.
- Entity chain detection is heuristic (label parsing). Can be wrong for multi-chain wallets.

## TODO V2

- [ ] STIX 2.1 strict validation
- [ ] TAXII feed endpoint
- [ ] Scheduled exports (cron)
- [ ] Partner API export
- [ ] Signed public evidence bundle (ed25519 signature)
- [ ] Advanced redaction workflow (selective field masking)
- [ ] FR bilingual Police Annex
- [ ] Rate limit on POST /exports (Redis)
- [ ] R2 storage for large PDF exports (avoid Vercel response size limit)
- [ ] Export expiry / cleanup cron
