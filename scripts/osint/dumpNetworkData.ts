/**
 * scripts/osint/dumpNetworkData.ts
 *
 * Read-only extract of the Kokoski / BOTIFY / Dione / OVPP / GHOST
 * investigation state as currently seeded in prod. Produces a single JSON
 * blob on stdout for downstream graph building.
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/osint/dumpNetworkData.ts > /tmp/network.json
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_HANDLES = [
  "bkokoski",
  "sxyz500",
  "GordonGekko",
  "planted",
  "kapadia23",
  "ParthKapadiaX",
  "TheFudHound",
  "MalXBT",
];

async function main() {
  const profiles = await prisma.kolProfile.findMany({
    where: { handle: { in: TARGET_HANDLES } },
    select: {
      handle: true,
      displayName: true,
      platform: true,
      riskFlag: true,
      label: true,
      confidence: true,
      verified: true,
      rugCount: true,
      totalScammed: true,
      totalDocumented: true,
      evmAddress: true,
      exitDate: true,
      exitNarrative: true,
      notes: true,
    },
  });

  const evidences = await prisma.kolEvidence.findMany({
    where: { kolHandle: { in: TARGET_HANDLES } },
    select: {
      id: true,
      kolHandle: true,
      type: true,
      label: true,
      description: true,
      wallets: true,
      amountUsd: true,
      txCount: true,
      dateFirst: true,
      dateLast: true,
      token: true,
      sampleTx: true,
      sourceUrl: true,
      dedupKey: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // KolWallet
  let wallets: unknown[] = [];
  try {
    wallets = await (prisma as any).kolWallet.findMany({
      where: { kolHandle: { in: TARGET_HANDLES } },
      select: {
        kolHandle: true,
        address: true,
        chain: true,
        label: true,
        claimType: true,
      },
    });
  } catch (e) {
    wallets = [{ error: String((e as Error).message) }];
  }

  // TokenLaunchMetric
  let launches: unknown[] = [];
  try {
    launches = await (prisma as any).tokenLaunchMetric.findMany({
      select: {
        id: true,
        chain: true,
        tokenMint: true,
        source: true,
        raw: true,
      },
    });
  } catch (e) {
    launches = [{ error: String((e as Error).message) }];
  }

  // KolTokenInvolvement
  let involvements: unknown[] = [];
  try {
    involvements = await (prisma as any).kolTokenInvolvement.findMany({
      where: { kolHandle: { in: TARGET_HANDLES } },
      select: {
        kolHandle: true,
        chain: true,
        tokenMint: true,
        isPromoted: true,
        launchMetricId: true,
      },
    });
  } catch (e) {
    involvements = [{ error: String((e as Error).message) }];
  }

  const out = {
    generatedAt: new Date().toISOString(),
    profiles,
    evidences,
    wallets,
    launches,
    involvements,
    profileCount: profiles.length,
    evidenceCount: evidences.length,
  };

  process.stdout.write(JSON.stringify(out, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
