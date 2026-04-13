#!/usr/bin/env node
// Pass 2: edit-distance 2 with broader OCR clusters, parallel signature checks.

import { readFileSync } from 'node:fs';
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = envFile.match(/HELIUS_API_KEY="?([^"\n]+)"?/)?.[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_SET = new Set(BASE58);

// Broader clusters (merged transitively)
const RAW_CLUSTERS = [
  ['0', 'O', 'o', 'Q', 'D', 'G', '6'],
  ['1', 'l', 'I', 'i', 'L', 'j', 'J', '7'],
  ['B', '8', '3', 'R', 'P'],
  ['5', 'S', 's', '6'],
  ['2', 'Z', 'z'],
  ['c', 'e', 'o', 'a'],
  ['n', 'm', 'h', 'u', 'w', 'M', 'N', 'H', 'W'],
  ['v', 'y', 'u', 'Y', 'V', 'U'],
  ['k', 'K', 'x', 'X'],
  ['f', 't', 'F', 'T'],
  ['g', '9', 'q', 'p', 'P', 'y'],
  ['r', 't', 'f'],
  ['A', '4'],
  ['E', 'F'],
  ['b', '6', 'G', 'h'],
  ['d', 'a'],
];

function clusterFor(ch) {
  const set = new Set([ch]);
  for (const c of RAW_CLUSTERS) if (c.includes(ch)) c.forEach((x) => set.add(x));
  return [...set].filter((x) => BASE58_SET.has(x));
}

// Generate candidates: for each base (length-normalized), do up to N substitutions
function* genSubs(addr, edits) {
  if (edits === 0) {
    yield addr;
    return;
  }
  const seen = new Set();
  for (let i = 0; i < addr.length; i++) {
    const ch = addr[i];
    const opts = clusterFor(ch);
    for (const r of opts) {
      if (r === ch) continue;
      const next = addr.slice(0, i) + r + addr.slice(i + 1);
      for (const s of genSubs(next, edits - 1)) {
        if (!seen.has(s)) {
          seen.add(s);
          yield s;
        }
      }
    }
  }
  yield addr;
}

function normalizeLen(addr) {
  const out = new Set();
  if (addr.length > 44) {
    for (let i = 0; i < addr.length; i++) out.add(addr.slice(0, i) + addr.slice(i + 1));
  } else if (addr.length < 43) {
    for (let i = 0; i <= addr.length; i++) for (const ch of BASE58) out.add(addr.slice(0, i) + ch + addr.slice(i));
  } else {
    out.add(addr);
  }
  return [...out].filter((a) => [...a].every((c) => BASE58_SET.has(c)));
}

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

// Batch via getMultipleAccounts (100 max). Any non-null → funded now.
async function batchHasAccount(addrs) {
  const out = [];
  for (let i = 0; i < addrs.length; i += 100) {
    const chunk = addrs.slice(i, i + 100);
    const res = await rpc('getMultipleAccounts', [chunk, { encoding: 'base64' }]);
    if (res.error) continue;
    res.result.value.forEach((v, j) => {
      if (v) out.push(chunk[j]);
    });
  }
  return out;
}

// Parallel getSignaturesForAddress with concurrency
async function parallelSigs(addrs, concurrency = 15) {
  const out = [];
  let idx = 0;
  async function worker() {
    while (idx < addrs.length) {
      const i = idx++;
      const a = addrs[i];
      try {
        const res = await rpc('getSignaturesForAddress', [a, { limit: 1 }]);
        if (!res.error && res.result?.length > 0) out.push({ addr: a, sig: res.result[0].signature });
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

async function investigate(label, addr) {
  console.log(`\n=== ${label}: ${addr} (len=${addr.length}) ===`);

  // Base candidates: length-normalized versions
  const bases = normalizeLen(addr);
  console.log(`  length-normalized bases: ${bases.length}`);

  // Edit-distance 2 substitutions from each base
  const candidates = new Set();
  for (const b of bases) {
    let count = 0;
    for (const v of genSubs(b, 2)) {
      if (v.length < 43 || v.length > 44) continue;
      if (![...v].every((c) => BASE58_SET.has(c))) continue;
      candidates.add(v);
      if (++count > 20000) break;
    }
  }
  console.log(`  edit-2 candidates: ${candidates.size}`);

  const arr = [...candidates];
  // Also always include originals (bases) as-is
  bases.forEach((b) => candidates.add(b));

  // Step A: find funded (non-null accounts) via getMultipleAccounts
  const funded = await batchHasAccount(arr);
  console.log(`  funded accounts: ${funded.length}`);

  // Step B: getSignatures on funded (fast) — also run on a sample of others to catch emptied wallets
  const active = await parallelSigs(funded, 20);
  console.log(`  active (funded w/ sigs): ${active.length}`);

  // Also check the length-valid ORIGINAL (no edits) + every length-normalized base
  const baseActive = await parallelSigs(bases, 15);
  for (const a of baseActive) if (!active.find((x) => x.addr === a.addr)) active.push(a);

  for (const a of active.slice(0, 10)) console.log(`  ✅ ${a.addr}  sig=${a.sig.slice(0, 20)}...`);
  return { label, original: addr, active };
}

const INPUTS = [
  ['SAM-1', '57bvBCbJMpTEuQGkNJeLm8qycMfWFHVkGwT1JE2aKFWn'],
  ['SAM-2', '5XJduTqthJTpfFQEGHAV3heafhgJpkwnvARBiMWmhUDoS'],
  ['GORDON-1', '4pacBgfbcB1wmvW44854CTgVzr1KgJKoKRpg4u5O45Le3'],
  ['GORDON-2', '3X9REtemTuNhpqYbJrN5bTvncxqpbZB15tkKasqnaqA6'],
  ['GEPPETTO', 'EmrRjTTfhRcSMfY2GKygTSbpu8QyFTTVZeK1DHk3hhc'],
];

const summary = [];
for (const [l, a] of INPUTS) summary.push(await investigate(l, a));

console.log('\n===== FINAL =====');
for (const r of summary) {
  console.log(`${r.label}: ${r.active.length} active`);
  for (const a of r.active) console.log(`  → ${a.addr}`);
}
