/**
 * Retail Vision Phase 4 — Batch-02 KolProfile bootstrap.
 *
 * Creates minimal KolProfile rows for the Batch-02 handles confirmed for
 * tracking. No scoring, no publication, no fabricated metadata.
 *
 *   handle | displayName | platform = "x" | label = "unknown" (default)
 *   publishable = false (default) | publishStatus = "draft" (default)
 *
 * Note: the Phase 4 brief says `platform = "twitter"` but every existing
 * KolProfile row in prod uses "x" (post-rebrand convention, also the schema
 * default). We use "x" for consistency and document the mapping.
 *
 * Idempotent. Dry-run par défaut. Pour écrire :
 *     SEED_BATCH02=1 pnpm tsx src/scripts/seed/batch02Profiles.ts
 */
import { prisma } from "@/lib/prisma";

const HANDLES = [
  "DegnBen",
  "JammaPelson",
  "AnonymousCFS",
  "Cheatcoiner",
  "UnitedTradersComm",
];

async function main() {
  const dryRun = process.env.SEED_BATCH02 !== "1";
  console.log(`[batch02] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const existing = await prisma.kolProfile.findMany({
    where: { handle: { in: HANDLES, mode: "insensitive" } },
    select: { handle: true },
  });
  const existingLower = new Set(existing.map(e => e.handle.toLowerCase()));

  let created = 0;
  let skipped = 0;
  for (const handle of HANDLES) {
    if (existingLower.has(handle.toLowerCase())) {
      console.log(`[batch02] skip ${handle} (already exists)`);
      skipped += 1;
      continue;
    }
    console.log(`[batch02] create ${handle}`);
    if (dryRun) { created += 1; continue; }
    await prisma.kolProfile.create({
      data: {
        handle,
        displayName: handle,
        platform: "x",
        // label, riskFlag, confidence, status, publishable, publishStatus
        // all use schema defaults — "unknown" / "unverified" / "low" / "active"
        // / false / "draft". No scoring, no publication.
      },
    });
    created += 1;
  }

  console.log("[batch02] summary", {
    handles: HANDLES.length,
    created: dryRun ? `${created} (preview)` : created,
    skipped,
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[batch02] fatal", e);
  process.exit(1);
});
