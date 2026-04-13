#!/usr/bin/env node
// Step 3: query KolProceedsEvent for addresses with known prefixes (sxyz500 / SAM, etc.)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PREFIXES = {
  'SAM-1': '57bvBCb',
  'SAM-2': '5XJduTq',
  'GORDON': '4pacBgf',
  'GEPPETTO': 'EmrRjTT',
};

async function main() {
  // All wallets seen in KolProceedsEvent, with related handle
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "kolHandle", "walletAddress" FROM "KolProceedsEvent"`
  );
  console.log(`KolProceedsEvent distinct (handle, wallet): ${rows.length}`);

  // Prefix match
  for (const [label, pfx] of Object.entries(PREFIXES)) {
    const hits = rows.filter((r) => r.walletAddress?.startsWith(pfx));
    console.log(`\n${label} (prefix ${pfx}):`);
    if (hits.length === 0) console.log('  (no match)');
    for (const h of hits) console.log(`  handle=${h.kolHandle}  wallet=${h.walletAddress}`);
  }

  // Also check KolWallet table for known handles + prefixes
  console.log('\n--- KolWallet scan ---');
  const wallets = await prisma.kolWallet.findMany({
    where: {
      OR: [
        { kolHandle: 'sxyz500' },
        { kolHandle: 'GordonGekko' },
        { kolHandle: 'MalXBT' },
      ],
    },
    select: { kolHandle: true, address: true, chain: true, attributionSource: true, attributionStatus: true },
  });
  for (const w of wallets) console.log(`  ${w.kolHandle} [${w.chain}] ${w.address}  src=${w.attributionSource} st=${w.attributionStatus}`);

  // Prefix search across KolWallet (any handle)
  for (const [label, pfx] of Object.entries(PREFIXES)) {
    const hits = await prisma.kolWallet.findMany({ where: { address: { startsWith: pfx } } });
    if (hits.length) {
      console.log(`\nKolWallet prefix ${pfx} (${label}):`);
      for (const h of hits) console.log(`  handle=${h.kolHandle} addr=${h.address}`);
    }
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
