#!/usr/bin/env tsx
/**
 * scripts/grandfather-beta-users.ts
 *
 * For every existing InvestigatorAccess (the legacy "beta access" record per
 * docs/audit-billing.md §5), create one Entitlement with:
 *   - userId       = InvestigatorAccess.id
 *   - type         = "beta_founder_access"
 *   - source       = "grandfathered"
 *   - sourceId     = null
 *   - status       = "active"
 *   - startsAt     = now (default)
 *   - endsAt       = null
 *
 * Idempotent: an Entitlement is skipped when one already exists with the same
 * (userId, type, source) tuple, regardless of sourceId or status. Re-running
 * the script is a no-op for users already covered.
 *
 * Usage:
 *   DATABASE_URL=<...> pnpm tsx scripts/grandfather-beta-users.ts
 *   DRY_RUN=true pnpm tsx scripts/grandfather-beta-users.ts   # report only
 *
 * Must be run BEFORE main merge and BEFORE flipping BILLING_ENABLED=true,
 * per the brief's "Grandfathered access (CRITIQUE)" section.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TYPE = "beta_founder_access";
const SOURCE = "grandfathered";

interface ScanInput {
  includeRevoked?: boolean;
}

export async function run(opts: ScanInput = {}): Promise<{
  scanned: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  // Read env each invocation so tests can flip flags before calling run().
  const DRY_RUN = process.env.DRY_RUN === "true";
  const VERBOSE = process.env.VERBOSE === "true";
  // We grandfather *active* InvestigatorAccess only by default. A revoked or
  // expired access loses its beta — re-include them via opts.includeRevoked.
  const accesses = await prisma.investigatorAccess.findMany({
    where: opts.includeRevoked
      ? {}
      : {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
    select: { id: true, label: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const access of accesses) {
    try {
      const existing = await prisma.entitlement.findFirst({
        where: {
          userId: access.id,
          type: TYPE,
          source: SOURCE,
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        if (VERBOSE) console.log(`[skip] ${access.id} (${access.label}) — entitlement ${existing.id} exists`);
        continue;
      }
      if (DRY_RUN) {
        created++;
        console.log(`[dry-run] would create entitlement for ${access.id} (${access.label})`);
        continue;
      }
      await prisma.entitlement.create({
        data: {
          userId: access.id,
          type: TYPE,
          source: SOURCE,
          sourceId: null,
          status: "active",
          metadata: { label: access.label } as Record<string, string>,
        },
      });
      created++;
      if (VERBOSE) console.log(`[create] ${access.id} (${access.label})`);
    } catch (err) {
      errors++;
      console.error(`[error] ${access.id}:`, err);
    }
  }

  return { scanned: accesses.length, created, skipped, errors };
}

async function main() {
  const start = Date.now();
  const stats = await run();
  const ms = Date.now() - start;
  console.log(
    `grandfather-beta-users :: scanned=${stats.scanned} created=${stats.created} skipped=${stats.skipped} errors=${stats.errors} dryRun=${process.env.DRY_RUN === "true"} ms=${ms}`,
  );
  await prisma.$disconnect();
  process.exit(stats.errors > 0 ? 1 : 0);
}

const isDirectRun = (() => {
  if (typeof require !== "undefined" && require.main === module) return true;
  if (typeof process !== "undefined" && process.argv?.[1]?.includes("grandfather-beta-users")) return true;
  return false;
})();

if (isDirectRun) {
  main().catch(async (err) => {
    console.error("grandfather-beta-users failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
