#!/usr/bin/env node
// Seed PREDIC ($PredicTools) TokenLaunchMetric + KolTokenInvolvement + holders crossref
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/HELIUS_API_KEY="?([^"\n]+)"?/)[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const MINT = 'AaRLHCvt6G8e3dbxLvN6BQi2S34Lvv3eeBjKNzc2QZB9';
const LAUNCH = new Date('2026-01-16T00:00:00Z');
const HANDLES = ['bkokoski', 'sxyz500', 'GordonGekko'];
const PREFIXES = {
  'SAM-1':    { pfx: '57bvBCb', handle: 'sxyz500' },
  'GORDON-1': { pfx: '4pacBgf', handle: 'GordonGekko' },
  'GEPPETTO': { pfx: 'EmrRjTT', handle: 'MalXBT' },
};

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

async function getAllOwners() {
  const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const res = await rpc('getProgramAccounts', [
    TOKEN_PROGRAM,
    { encoding: 'jsonParsed', filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: MINT } }] },
  ]);
  if (res.error) { console.log('err', res.error); return []; }
  const owners = new Set();
  for (const a of res.result || []) {
    const owner = a.account?.data?.parsed?.info?.owner;
    if (owner) owners.add(owner);
  }
  console.log(`  token accounts: ${(res.result || []).length} | unique owners: ${owners.size}`);
  return [...owners];
}

async function main() {
  // Verify mint exists
  const mintInfo = await rpc('getAccountInfo', [MINT, { encoding: 'jsonParsed' }]);
  const v = mintInfo.result?.value;
  if (!v) throw new Error(`PREDIC mint ${MINT} not found on-chain`);
  console.log(`PREDIC mint OK — supply=${v.data?.parsed?.info?.supply} dec=${v.data?.parsed?.info?.decimals}`);

  // 1. TokenLaunchMetric
  const launch = await prisma.tokenLaunchMetric.upsert({
    where: { chain_tokenMint: { chain: 'SOL', tokenMint: MINT } },
    update: {},
    create: {
      chain: 'SOL',
      tokenMint: MINT,
      launchAt: LAUNCH,
      source: 'mariaqueennft_grok_crossref',
      raw: { name: 'PredicTools', symbol: 'PREDIC' },
    },
  });
  console.log(`\nTokenLaunchMetric ${launch.id}  ${MINT}`);

  // 2. KolTokenInvolvement for 3 KOLs
  for (const handle of HANDLES) {
    const profile = await prisma.kolProfile.findUnique({ where: { handle } });
    if (!profile) { console.log(`  SKIP ${handle}: profile missing`); continue; }
    const row = await prisma.kolTokenInvolvement.upsert({
      where: { kolHandle_chain_tokenMint: { kolHandle: handle, chain: 'SOL', tokenMint: MINT } },
      update: { isPromoted: true, firstPromotionAt: LAUNCH, launchMetricId: launch.id },
      create: {
        kolHandle: handle, chain: 'SOL', tokenMint: MINT,
        isPromoted: true, firstPromotionAt: LAUNCH, launchMetricId: launch.id,
      },
    });
    console.log(`  UPSERT involvement  ${handle}  id=${row.id}`);
  }

  // 3. Scan holders + prefix crossref
  console.log('\n=== PREDIC holder scan ===');
  const owners = await getAllOwners();
  const matches = [];
  for (const [label, { pfx, handle }] of Object.entries(PREFIXES)) {
    const hits = owners.filter((o) => o.startsWith(pfx));
    console.log(`  ${label} pfx=${pfx}: ${hits.length} match(es)`);
    for (const h of hits) {
      console.log(`    → ${h}`);
      matches.push({ label, handle, address: h });
    }
  }

  // 4. Upsert KolWallet for matches
  if (matches.length) {
    console.log('\n=== KolWallet upserts ===');
    for (const m of matches) {
      const profile = await prisma.kolProfile.findUnique({ where: { handle: m.handle } });
      if (!profile) { console.log(`  SKIP ${m.handle}: profile missing`); continue; }
      const existing = await prisma.kolWallet.findFirst({
        where: { kolHandle: m.handle, address: m.address, chain: 'SOL' },
      });
      if (existing) {
        const upd = await prisma.kolWallet.update({
          where: { id: existing.id },
          data: {
            attributionSource: 'predic_onchain_crossref',
            attributionStatus: 'confirmed',
            isPubliclyUsable: false,
            attributionNote: `Confirmé on-chain via PREDIC holders — préfixe ${m.label}`,
          },
        });
        console.log(`  UPDATE ${upd.id}  ${upd.kolHandle}  ${upd.address}`);
      } else {
        const cr = await prisma.kolWallet.create({
          data: {
            kolHandle: m.handle,
            address: m.address,
            chain: 'SOL',
            attributionSource: 'predic_onchain_crossref',
            attributionStatus: 'confirmed',
            isPubliclyUsable: false,
            attributionNote: `Confirmé on-chain via PREDIC holders — préfixe ${m.label}`,
            confidence: 'high',
            claimType: 'onchain_confirmed',
          },
        });
        console.log(`  CREATE ${cr.id}  ${cr.kolHandle}  ${cr.address}`);
      }
    }
  } else {
    console.log('\nAucune wallet KolWallet créée (pas de match préfixe parmi les holders PREDIC).');
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
