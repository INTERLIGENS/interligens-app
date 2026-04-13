#!/usr/bin/env node
// Seed KolTokenInvolvement rows for GHOST ($GhostwareOS) for 3 KOLs.
// Schema note: no `role` / `sourceNote` / `tokenAddress` columns exist.
// Mapping: tokenAddress → tokenMint; role=PROMOTER → isPromoted=true.
// sourceNote has no home in schema → stored as context via firstPromotionAt + log.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const GHOST_MINT = 'BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST';
const LAUNCH = new Date('2025-10-22T00:00:00Z');
const HANDLES = ['bkokoski', 'sxyz500', 'GordonGekko'];

async function main() {
  // Ensure TokenLaunchMetric exists for linkage
  const launch = await prisma.tokenLaunchMetric.upsert({
    where: { chain_tokenMint: { chain: 'SOL', tokenMint: GHOST_MINT } },
    update: {},
    create: {
      chain: 'SOL',
      tokenMint: GHOST_MINT,
      launchAt: LAUNCH,
      source: 'botify_onchain_crossref',
      raw: { name: 'GhostwareOS', symbol: 'GHOST' },
    },
  });
  console.log(`TokenLaunchMetric ${launch.id}  ${GHOST_MINT}`);

  for (const handle of HANDLES) {
    const profile = await prisma.kolProfile.findUnique({ where: { handle } });
    if (!profile) {
      console.log(`  SKIP ${handle}: profile missing`);
      continue;
    }
    const row = await prisma.kolTokenInvolvement.upsert({
      where: { kolHandle_chain_tokenMint: { kolHandle: handle, chain: 'SOL', tokenMint: GHOST_MINT } },
      update: {
        isPromoted: true,
        firstPromotionAt: LAUNCH,
        launchMetricId: launch.id,
      },
      create: {
        kolHandle: handle,
        chain: 'SOL',
        tokenMint: GHOST_MINT,
        isPromoted: true,
        firstPromotionAt: LAUNCH,
        launchMetricId: launch.id,
      },
    });
    console.log(`  UPSERT ${handle}  id=${row.id}  promoted=${row.isPromoted}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
