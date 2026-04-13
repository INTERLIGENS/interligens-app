#!/usr/bin/env node
// OPENVPP seed — Token-2022 program. Only confidently resolved kokoski cluster token.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const prisma = new PrismaClient();
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/HELIUS_API_KEY="?([^"\n]+)"?/)[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const MINT = '81ahKAxqHxj9qsHVNK7uZY6wteK8peoe3Heyxq3Lpump';
const TOKEN2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const HANDLES = ['bkokoski', 'sxyz500'];
const SOURCE = 'mariaqueennft_kokoski_cluster';
const PREFIXES = [
  { label: 'SAM-1',    pfx: '57bvBCb', handle: 'sxyz500' },
  { label: 'GORDON-1', pfx: '4pacBgf', handle: 'GordonGekko' },
  { label: 'GEPPETTO', pfx: 'EmrRjTT', handle: 'MalXBT' },
];

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

async function main() {
  // TokenLaunchMetric
  const launch = await prisma.tokenLaunchMetric.upsert({
    where: { chain_tokenMint: { chain: 'SOL', tokenMint: MINT } },
    update: {},
    create: {
      chain: 'SOL', tokenMint: MINT,
      source: SOURCE,
      raw: { name: 'OpenVPP', symbol: 'OVPP', tokenProgram: 'token-2022', note: 'listed as OPENVPP in kokoski cluster doc' },
    },
  });
  console.log(`TokenLaunchMetric ${launch.id}  ${MINT}`);

  for (const handle of HANDLES) {
    const prof = await prisma.kolProfile.findUnique({ where: { handle } });
    if (!prof) { console.log(`  SKIP ${handle}`); continue; }
    const row = await prisma.kolTokenInvolvement.upsert({
      where: { kolHandle_chain_tokenMint: { kolHandle: handle, chain: 'SOL', tokenMint: MINT } },
      update: { isPromoted: true, launchMetricId: launch.id },
      create: { kolHandle: handle, chain: 'SOL', tokenMint: MINT, isPromoted: true, launchMetricId: launch.id },
    });
    console.log(`  involvement ${handle} ${row.id}`);
  }

  // Holder scan via Token-2022 program
  // Token-2022 accounts aren't fixed at 165 bytes (extensions). Try without dataSize filter.
  const res = await rpc('getProgramAccounts', [
    TOKEN2022,
    { encoding: 'jsonParsed', filters: [{ memcmp: { offset: 0, bytes: MINT } }] },
  ]);
  if (res.error) {
    console.log(`  holder scan err: ${res.error.message}`);
  } else {
    const owners = new Set();
    for (const a of res.result || []) {
      const o = a.account?.data?.parsed?.info?.owner;
      if (o) owners.add(o);
    }
    console.log(`  holders: ${(res.result || []).length} accts  ${owners.size} unique owners`);
    for (const { label, pfx, handle } of PREFIXES) {
      const hits = [...owners].filter((o) => o.startsWith(pfx));
      if (hits.length) {
        for (const h of hits) console.log(`    ✅ ${label} ${pfx} → ${h}`);
      } else {
        console.log(`    ❌ ${label} ${pfx}: 0`);
      }
    }
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
