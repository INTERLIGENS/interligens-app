#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const prisma = new PrismaClient();

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/HELIUS_API_KEY="?([^"\n]+)"?/)[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const BOTIFY = 'BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb';
const HANDLES = ['bkokoski', 'sxyz500', 'GordonGekko'];

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

async function main() {
  console.log('=== KolProceedsEvent ===');
  const proceeds = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "kolHandle", "tokenAddress", "tokenSymbol", chain FROM "KolProceedsEvent" WHERE "kolHandle" = ANY($1)`,
    HANDLES
  );
  for (const r of proceeds) console.log(`  ${r.kolHandle} [${r.chain}] ${r.tokenSymbol} ${r.tokenAddress}`);

  console.log('\n=== KolTokenInvolvement ===');
  const inv = await prisma.kolTokenInvolvement.findMany({
    where: { kolHandle: { in: HANDLES } },
    select: { kolHandle: true, chain: true, tokenMint: true, isPromoted: true, proceedsUsd: true },
  });
  for (const r of inv) {
    console.log(`  ${r.kolHandle} [${r.chain}] promoted=${r.isPromoted} proceeds=${r.proceedsUsd} ${r.tokenMint}`);
  }

  // Collect all unique non-BOTIFY SOL mints
  const mints = new Set();
  for (const r of proceeds) if (r.chain === 'SOL' && r.tokenAddress && r.tokenAddress !== BOTIFY) mints.add(r.tokenAddress);
  for (const r of inv) if (r.chain === 'SOL' && r.tokenMint && r.tokenMint !== BOTIFY) mints.add(r.tokenMint);

  console.log(`\n=== Candidate non-BOTIFY SOL mints: ${mints.size} ===`);
  for (const m of mints) {
    const info = await rpc('getAccountInfo', [m, { encoding: 'jsonParsed' }]);
    const v = info.result?.value;
    if (!v) { console.log(`  ❌ ${m}  (null)`); continue; }
    const parsed = v.data?.parsed;
    const supply = parsed?.info?.supply;
    const dec = parsed?.info?.decimals;
    console.log(`  ✅ ${m}  type=${parsed?.type}  supply=${supply}  dec=${dec}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
