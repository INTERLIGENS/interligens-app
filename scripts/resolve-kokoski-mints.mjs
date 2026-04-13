#!/usr/bin/env node
// Resolve kokoski cluster mints via multiple sources: DexScreener (fuzzy),
// Helius searchAssets (by symbol), DexScreener token-profile.
// This is RESOLVER ONLY — prints candidates, does not seed.
import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/HELIUS_API_KEY="?([^"\n]+)"?/)[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const SYMBOLS = ['AMARA', 'OPENVPP', 'STUDY', 'PUPPET', 'EBE', 'TOBE', 'XMEN'];

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

// DexScreener search — returns ALL Solana pairs (not just exact symbol match)
async function dexFull(query) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
  const j = await r.json();
  const pairs = (j.pairs || []).filter((p) => p.chainId === 'solana');
  // Dedup by mint
  const byMint = new Map();
  for (const p of pairs) {
    const mint = p.baseToken?.address;
    if (!mint) continue;
    const score = (p.liquidity?.usd ?? 0) + (p.volume?.h24 ?? 0);
    const prev = byMint.get(mint);
    if (!prev || score > prev.score) {
      byMint.set(mint, {
        mint,
        symbol: p.baseToken.symbol,
        name: p.baseToken.name,
        score,
        liq: p.liquidity?.usd ?? 0,
        vol: p.volume?.h24 ?? 0,
        pairCreatedAt: p.pairCreatedAt,
      });
    }
  }
  return [...byMint.values()].sort((a, b) => b.score - a.score);
}

// Helius searchAssets by name/symbol (DAS)
async function heliusSearch(query) {
  const res = await rpc('searchAssets', [{
    tokenType: 'fungible',
    grouping: null,
    compressed: false,
    limit: 50,
    page: 1,
    name: query,
  }]);
  if (res.error) return [];
  return (res.result?.items || []).map((i) => ({
    mint: i.id,
    name: i.content?.metadata?.name,
    symbol: i.content?.metadata?.symbol,
    interface: i.interface,
  }));
}

for (const sym of SYMBOLS) {
  console.log(`\n=== ${sym} ===`);

  // DexScreener: exact symbol
  const dex = await dexFull(sym);
  const exact = dex.filter((d) => (d.symbol || '').toUpperCase() === sym.toUpperCase());
  const fuzzy = dex.filter((d) => (d.symbol || '').toUpperCase() !== sym.toUpperCase());
  console.log(`  DexScreener exact-symbol: ${exact.length}`);
  exact.slice(0, 6).forEach((c) =>
    console.log(`    [exact] ${c.mint}  "${c.name}" liq=$${Math.round(c.liq)} vol=$${Math.round(c.vol)} born=${c.pairCreatedAt ? new Date(c.pairCreatedAt).toISOString().slice(0,10) : '?'}`)
  );
  console.log(`  DexScreener fuzzy: ${fuzzy.length}`);
  fuzzy.slice(0, 4).forEach((c) =>
    console.log(`    [fuzzy] ${c.mint}  sym=${c.symbol} "${c.name}" liq=$${Math.round(c.liq)}`)
  );

  // Helius searchAssets
  try {
    const h = await heliusSearch(sym);
    console.log(`  Helius searchAssets: ${h.length}`);
    h.slice(0, 6).forEach((c) =>
      console.log(`    [helius] ${c.mint}  sym=${c.symbol} name="${c.name}"`)
    );
  } catch (e) {
    console.log(`  Helius err: ${e.message}`);
  }
}
