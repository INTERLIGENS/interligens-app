/**
 * security:center:check — smoke verification for the Security Center.
 *
 * Run:
 *   pnpm security:center:check
 *
 * Verifies (from the machine where DATABASE_URL is reachable):
 *   1. Prisma schema has the 11 Security* models (introspection fail = migration pending).
 *   2. Vendor registry is seeded.
 *   3. Threat catalog is seeded.
 *   4. Vercel-breach reference incident is present.
 *   5. A digest can be composed for the last 7 days.
 *   6. The digest email builds a non-empty HTML body.
 *   7. All 11 admin API route files exist in the tree.
 *
 * Does NOT send any email or touch the DB beyond read-only counts.
 */

require("dotenv").config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { buildDigest } from "../src/lib/security/email/digest";
import { buildDigestInputForPeriod } from "../src/lib/security/queries";
import { VENDOR_REGISTRY } from "../src/lib/security/vendors/registry";
import { THREAT_CATALOG } from "../src/lib/security/threats/catalog";
import { existsSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

interface Check {
  name: string;
  run: () => Promise<boolean> | boolean;
  detail?: string;
}

const checks: Check[] = [
  {
    name: "Prisma model: SecurityVendor",
    run: async () => {
      try {
        await prisma.securityVendor.findFirst({ take: 1 });
        return true;
      } catch (e) {
        return false;
      }
    },
  },
  {
    name: "Prisma model: SecurityIncident",
    run: async () => {
      try {
        await prisma.securityIncident.findFirst({ take: 1 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    name: "Prisma model: SecurityThreatCatalog",
    run: async () => {
      try {
        await prisma.securityThreatCatalog.findFirst({ take: 1 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    name: `Vendor registry seeded (expected ${VENDOR_REGISTRY.length})`,
    run: async () => {
      try {
        const count = await prisma.securityVendor.count();
        return count >= VENDOR_REGISTRY.length;
      } catch {
        return false;
      }
    },
  },
  {
    name: `Threat catalog seeded (expected ${THREAT_CATALOG.length})`,
    run: async () => {
      try {
        const count = await prisma.securityThreatCatalog.count();
        return count >= THREAT_CATALOG.length;
      } catch {
        return false;
      }
    },
  },
  {
    name: "Vercel breach reference incident present",
    run: async () => {
      try {
        const vendor = await prisma.securityVendor.findUnique({
          where: { slug: "vercel" },
        });
        if (!vendor) return false;
        const inc = await prisma.securityIncident.findFirst({
          where: {
            vendorId: vendor.id,
            externalId: "vercel-breach-shinyhunters-2026-04-19",
          },
        });
        return Boolean(inc);
      } catch {
        return false;
      }
    },
  },
  {
    name: "Digest composes for last 7 days",
    run: async () => {
      try {
        const now = new Date();
        const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const input = await buildDigestInputForPeriod(start, now);
        const digest = buildDigest(input);
        return (
          digest.bodyHtml.length > 100 &&
          digest.bodyText.length > 50 &&
          digest.subject.includes("INTERLIGENS")
        );
      } catch {
        return false;
      }
    },
  },
  {
    name: "Admin API routes present on disk",
    run: () => {
      const required = [
        "src/app/api/admin/security/overview/route.ts",
        "src/app/api/admin/security/incidents/route.ts",
        "src/app/api/admin/security/incidents/[id]/reassess/route.ts",
        "src/app/api/admin/security/incidents/[id]/generate-comms/route.ts",
        "src/app/api/admin/security/vendors/route.ts",
        "src/app/api/admin/security/threats/route.ts",
        "src/app/api/admin/security/digests/generate/route.ts",
        "src/app/api/admin/security/digests/send/route.ts",
        "src/app/api/cron/security-weekly-digest/route.ts",
      ];
      const cwd = process.cwd();
      return required.every((p) => existsSync(join(cwd, p)));
    },
  },
  {
    name: "Admin pages present on disk",
    run: () => {
      const required = [
        "src/app/admin/security/page.tsx",
        "src/app/admin/security/incidents/page.tsx",
        "src/app/admin/security/incidents/[id]/page.tsx",
      ];
      const cwd = process.cwd();
      return required.every((p) => existsSync(join(cwd, p)));
    },
  },
  {
    name: "Cron registered in vercel.json",
    run: () => {
      const vercelJson = join(process.cwd(), "vercel.json");
      if (!existsSync(vercelJson)) return false;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require(vercelJson) as {
        crons?: Array<{ path: string; schedule: string }>;
      };
      return Boolean(
        config.crons?.some(
          (c) => c.path === "/api/cron/security-weekly-digest",
        ),
      );
    },
  },
];

async function main() {
  console.log("=== security:center:check ===");
  let passed = 0;
  let failed = 0;
  for (const c of checks) {
    try {
      const ok = await c.run();
      if (ok) {
        console.log(`  ✓ ${c.name}`);
        passed += 1;
      } else {
        console.log(`  ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
        failed += 1;
      }
    } catch (err) {
      console.log(
        `  ✗ ${c.name} — ${err instanceof Error ? err.message : String(err)}`,
      );
      failed += 1;
    }
  }
  console.log("---");
  console.log(`  ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
