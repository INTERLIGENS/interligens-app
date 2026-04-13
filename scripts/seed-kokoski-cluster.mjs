#!/usr/bin/env node
// Seed kokoski cluster tokens: resolve mint via DexScreener, verify on Helius,
// create TokenLaunchMetric + KolTokenInvolvement, scan holders for target prefixes.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/HELIUS_API_KEY="?([^"\n]+)"?/)[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const SYMBOLS = ['AMARA', 'OPENVPP', 'STUDY', 'PUPPET', 'EBE', 'TOBE', 'XMEN'];
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

async function dexSearch(sym) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`);
  const j = await r.json();
  const pairs = j.pairs || [];
  // Solana pairs where baseToken.symbol matches exactly (case-insensitive)
  const candidates = new Map(); // mint → {symbol,name,liq,vol,pairAddr}
  for (const p of pairs) {
    if (p.chainId !== 'solana') continue;
    if ((p.baseToken?.symbol || '').toUpperCase() !== sym.toUpperCase()) continue;
    const mint = p.baseToken.address;
    const liq = p.liquidity?.usd ?? 0;
    const vol = p.volume?.h24 ?? 0;
    const prev = candidates.get(mint);
    if (!prev || liq + vol > prev.score) {
      candidates.set(mint, {
        mint,
        symbol: p.baseToken.symbol,
        name: p.baseToken.name,
        liq, vol, score: liq + vol,
        pairCreatedAt: p.pairCreatedAt,
        pairAddr: p.pairAddress,
      });
    }
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score);
}

async function verifyMint(mint) {
  const r = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
  const v = r.result?.value;
  if (!v) return null;
  return v.data?.parsed?.info || {};
}

async function getAllOwners(mint) {
  const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const res = await rpc('getProgramAccounts', [
    TOKEN_PROGRAM,
    { encoding: 'jsonParsed', filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }] },
  ]);
  if (res.error) return [];
  const owners = new Set();
  for (const a of res.result || []) {
    const o = a.account?.data?.parsed?.info?.owner;
    if (o) owners.add(o);
  }
  return [...owners];
}

async function seedToken({ symbol, mint, name, launchAt }) {
  const launch = await prisma.tokenLaunchMetric.upsert({
    where: { chain_tokenMint: { chain: 'SOL', tokenMint: mint } },
    update: {},
    create: {
      chain: 'SOL',
      tokenMint: mint,
      launchAt: launchAt ? new Date(launchAt) : null,
      source: SOURCE,
      raw: { name, symbol },
    },
  });
  console.log(`  TokenLaunchMetric ${launch.id}`);

  for (const handle of HANDLES) {
    const prof = await prisma.kolProfile.findUnique({ where: { handle } });
    if (!prof) { console.log(`    SKIP ${handle}: profile missing`); continue; }
    const row = await prisma.kolTokenInvolvement.upsert({
      where: { kolHandle_chain_tokenMint: { kolHandle: handle, chain: 'SOL', tokenMint: mint } },
      update: {
        isPromoted: true,
        firstPromotionAt: launchAt ? new Date(launchAt) : undefined,
        launchMetricId: launch.id,
      },
      create: {
        kolHandle: handle, chain: 'SOL', tokenMint: mint,
        isPromoted: true,
        firstPromotionAt: launchAt ? new Date(launchAt) : null,
        launchMetricId: launch.id,
      },
    });
    console.log(`    involvement  ${handle}  ${row.id}`);
  }
}

async function crossrefHolders(symbol, mint) {
  const owners = await getAllOwners(mint);
  console.log(`  holders: ${owners.length} owners`);
  const matches = [];
  for (const { label, pfx, handle } of PREFIXES) {
    const hits = owners.filter((o) => o.startsWith(pfx));
    if (hits.length) {
      for (const h of hits) {
        console.log(`    ✅ ${label} ${pfx} → ${h}  (handle=${handle})`);
        matches.push({ label, handle, address: h });
      }
    }
  }
  for (const m of matches) {
    const prof = await prisma.kolProfile.findUnique({ where: { handle: m.handle } });
    if (!prof) continue;
    const existing = await prisma.kolWallet.findFirst({
      where: { kolHandle: m.handle, address: m.address, chain: 'SOL' },
    });
    const data = {
      attributionSource: `${symbol.toLowerCase()}_onchain_crossref`,
      attributionStatus: 'confirmed',
      isPubliclyUsable: false,
      attributionNote: `Confirmé on-chain via holders ${symbol} (cluster kokoski) — préfixe ${m.label}`,
    };
    if (existing) {
      await prisma.kolWallet.update({ where: { id: existing.id }, data });
      console.log(`    UPDATED KolWallet ${existing.id}`);
    } else {
      const cr = await prisma.kolWallet.create({
        data: {
          kolHandle: m.handle, address: m.address, chain: 'SOL',
          confidence: 'high', claimType: 'onchain_confirmed', ...data,
        },
      });
      console.log(`    CREATED KolWallet ${cr.id}`);
    }
  }
}

async function main() {
  const summary = [];
  for (const sym of SYMBOLS) {
    console.log(`\n=== ${sym} ===`);
    const candidates = await dexSearch(sym);
    if (!candidates.length) {
      console.log(`  ❌ DexScreener: no Solana match`);
      summary.push({ sym, status: 'not_found' });
      continue;
    }
    console.log(`  ${candidates.length} Solana candidate(s):`);
    candidates.slice(0, 5).forEach((c, i) =>
      console.log(`    [${i}] ${c.mint}  name="${c.name}"  liq=$${Math.round(c.liq)}  vol24=$${Math.round(c.vol)}  created=${c.pairCreatedAt ? new Date(c.pairCreatedAt).toISOString().slice(0,10) : '?'}`)
    );
    // Pick top by liq+vol score
    const top = candidates[0];
    // If multiple with meaningful score, warn (ambiguity)
    const ambiguous = candidates.length > 1 && candidates[1].score > top.score * 0.2 && candidates[1].score > 1000;
    if (ambiguous) {
      console.log(`  ⚠️  ambiguous: multiple high-liq candidates — picking top=${top.mint}`);
    }
    const info = await verifyMint(top.mint);
    if (!info) {
      console.log(`  ❌ Helius: mint not found`);
      summary.push({ sym, status: 'helius_null', mint: top.mint });
      continue;
    }
    console.log(`  ✅ mint confirmed  supply=${info.supply} dec=${info.decimals}`);
    await seedToken({
      symbol: sym,
      mint: top.mint,
      name: top.name || sym,
      launchAt: top.pairCreatedAt,
    });
    await crossrefHolders(sym, top.mint);
    summary.push({ sym, status: 'seeded', mint: top.mint, name: top.name });
  }

  console.log('\n\n===== SUMMARY =====');
  for (const s of summary) console.log(`  ${s.sym}: ${s.status}${s.mint ? `  ${s.mint}` : ''}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
