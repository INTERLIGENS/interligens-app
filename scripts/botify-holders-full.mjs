#!/usr/bin/env node
// Fetch all BOTIFY holders via Helius getTokenAccounts, resolve owners, match prefixes.
import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/HELIUS_API_KEY="?([^"\n]+)"?/)[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;
const MINT = 'BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb';

const PREFIXES = {
  'SAM-1': '57bvBCb',
  'SAM-2': '5XJduTq',
  'GORDON-1': '4pacBgf',
  'GEPPETTO': 'EmrRjTT',
};

async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return r.json();
}

// getProgramAccounts on SPL Token program, filter by mint at offset 0
async function getAllHolders() {
  const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const res = await rpc('getProgramAccounts', [
    TOKEN_PROGRAM,
    {
      encoding: 'jsonParsed',
      filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: MINT } }],
    },
  ]);
  if (res.error) { console.log('err', res.error); return []; }
  const accts = res.result || [];
  console.log(`  fetched ${accts.length} token accounts`);
  const owners = new Set();
  for (const a of accts) {
    const info = a.account?.data?.parsed?.info;
    if (info?.owner) owners.add(info.owner);
  }
  return [...owners];
}

const owners = await getAllHolders();
console.log(`\nTotal unique owners: ${owners.length}`);

for (const [label, pfx] of Object.entries(PREFIXES)) {
  const hits = owners.filter((o) => o.startsWith(pfx));
  console.log(`\n${label} prefix=${pfx}: ${hits.length} match(es)`);
  for (const h of hits) console.log(`  → ${h}`);
}

// Also check broader "starts with first 4 chars" for awareness
console.log('\n--- First-4-char fuzzy matches ---');
for (const [label, pfx] of Object.entries(PREFIXES)) {
  const short = pfx.slice(0, 4);
  const hits = owners.filter((o) => o.startsWith(short));
  if (hits.length) {
    console.log(`${label} short=${short}: ${hits.length}`);
    hits.slice(0, 10).forEach((h) => console.log(`  ${h}`));
  }
}
