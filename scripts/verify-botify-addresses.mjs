#!/usr/bin/env node
// Verify & repair SOL addresses from BOTIFY leak doc (OCR errors)
// Strategy: for each address, query Helius. If no activity, try OCR variants.

import 'dotenv/config';
import { readFileSync } from 'node:fs';

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = envFile.match(/HELIUS_API_KEY="?([^"\n]+)"?/)?.[1];
if (!KEY) throw new Error('HELIUS_API_KEY missing');

const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_SET = new Set(BASE58);

// OCR confusion clusters — characters likely to be misread for one another
// in low-res screenshots. We'll expand each position with members of its cluster.
const CLUSTERS = [
  ['0', 'O', 'o', 'Q', 'D'],       // 0/O invalid in base58 → try o,Q,D
  ['1', 'l', 'I', 'i', 'L', 'j'],  // l/I invalid → try 1,i,L,j
  ['B', '8', '3'],
  ['5', 'S', 's', '6'],
  ['2', 'Z', 'z'],
  ['6', 'G', 'b'],
  ['c', 'e', 'o'],
  ['n', 'm', 'h', 'u'],
  ['v', 'y', 'u'],
  ['k', 'K', 'x', 'X'],
  ['f', 't', 'F'],
  ['g', '9', 'q'],
  ['r', 't', 'f'],
  ['p', 'P', 'q'],
  ['W', 'w', 'M'],
  ['A', '4'],
  ['E', 'F'],
  ['J', 'j', '7'],
  ['T', '7', 'f'],
  ['H', 'h', 'N'],
  ['V', 'v', 'Y'],
  ['R', 'P', 'K'],
  ['N', 'M', 'H'],
];

function clusterFor(ch) {
  const found = new Set();
  for (const c of CLUSTERS) {
    if (c.includes(ch)) c.forEach((x) => found.add(x));
  }
  found.add(ch);
  // keep only valid base58 chars
  return [...found].filter((x) => BASE58_SET.has(x));
}

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

async function checkAddr(addr) {
  // Returns { ok, hasActivity, err }
  const sig = await rpc('getSignaturesForAddress', [addr, { limit: 1 }]);
  if (sig.error) return { ok: false, err: sig.error.message };
  if (Array.isArray(sig.result) && sig.result.length > 0) {
    return { ok: true, hasActivity: true, firstSig: sig.result[0].signature };
  }
  // No activity but address format valid — also check balance
  const bal = await rpc('getBalance', [addr]);
  if (bal.error) return { ok: false, err: bal.error.message };
  const lamports = bal.result?.value ?? 0;
  return { ok: true, hasActivity: false, lamports };
}

function normalizeLen(addr) {
  // Solana: 32 bytes → base58 length 32..44 but almost always 43-44.
  // If length is wrong, try deletions (for too long) or insertions (too short).
  const out = new Set();
  if (addr.length > 44) {
    for (let i = 0; i < addr.length; i++) {
      out.add(addr.slice(0, i) + addr.slice(i + 1));
    }
  }
  if (addr.length < 43) {
    for (let i = 0; i <= addr.length; i++) {
      for (const ch of BASE58) out.add(addr.slice(0, i) + ch + addr.slice(i));
    }
  }
  if (addr.length >= 43 && addr.length <= 44) out.add(addr);
  return [...out];
}

function subVariants(addr, maxEdits = 2) {
  // Generate candidates with up to maxEdits single-char substitutions within OCR clusters.
  // Also: force-fix invalid chars (0, O, I, l) since base58 excludes them.
  let bases = [addr];
  for (let e = 0; e < maxEdits; e++) {
    const next = new Set();
    for (const b of bases) {
      for (let i = 0; i < b.length; i++) {
        const ch = b[i];
        const repl = clusterFor(ch);
        for (const r of repl) {
          if (r === ch) continue;
          next.add(b.slice(0, i) + r + b.slice(i + 1));
        }
        // also force-fix if invalid
        if (!BASE58_SET.has(ch)) {
          for (const r of BASE58) next.add(b.slice(0, i) + r + b.slice(i + 1));
        }
      }
      next.add(b);
    }
    bases = [...next];
  }
  return bases;
}

async function investigate(label, addr) {
  console.log(`\n=== ${label}: ${addr} (len=${addr.length}) ===`);
  const candidates = new Set();

  // 1. Original if length OK
  if (addr.length >= 43 && addr.length <= 44 && [...addr].every((c) => BASE58_SET.has(c))) {
    candidates.add(addr);
  }
  // 2. Length normalizations (deletions/insertions)
  const lenNorm = normalizeLen(addr);
  for (const n of lenNorm) {
    if ([...n].every((c) => BASE58_SET.has(c))) candidates.add(n);
  }
  // 3. For each length-normalized candidate, single-edit OCR substitutions
  for (const n of lenNorm.slice(0, 200)) {
    const valid = [...n].every((c) => BASE58_SET.has(c));
    if (!valid) continue;
    for (const v of subVariants(n, 1)) {
      if ([...v].every((c) => BASE58_SET.has(c))) candidates.add(v);
    }
  }

  console.log(`  candidates: ${candidates.size}`);

  // Query each: check activity. First with activity wins.
  let checked = 0;
  const valid = [];
  const withActivity = [];
  const sorted = [...candidates];
  // put original first
  sorted.sort((a, b) => (a === addr ? -1 : b === addr ? 1 : 0));

  for (const c of sorted) {
    if (checked >= 400) break;
    checked++;
    try {
      const res = await checkAddr(c);
      if (res.ok) {
        valid.push(c);
        if (res.hasActivity) {
          console.log(`  ✅ ACTIVE: ${c}  (sig: ${res.firstSig?.slice(0, 20)}...)`);
          withActivity.push({ addr: c, sig: res.firstSig });
        } else if (res.lamports > 0) {
          console.log(`  💰 funded no-sig: ${c}  (${res.lamports} lamports)`);
        }
      }
    } catch (e) {
      // ignore
    }
  }
  console.log(`  checked=${checked}, format-valid=${valid.length}, active=${withActivity.length}`);
  return { original: addr, valid, withActivity };
}

const INPUTS = [
  ['SAM-1', '57bvBCbJMpTEuQGkNJeLm8qycMfWFHVkGwT1JE2aKFWn'],
  ['SAM-2', '5XJduTqthJTpfFQEGHAV3heafhgJpkwnvARBiMWmhUDoS'],
  ['GORDON-1', '4pacBgfbcB1wmvW44854CTgVzr1KgJKoKRpg4u5O45Le3'],
  ['GORDON-2', '3X9REtemTuNhpqYbJrN5bTvncxqpbZB15tkKasqnaqA6'],
  ['GEPPETTO', 'EmrRjTTfhRcSMfY2GKygTSbpu8QyFTTVZeK1DHk3hhc'],
];

const results = {};
for (const [label, addr] of INPUTS) {
  results[label] = await investigate(label, addr);
}

console.log('\n\n===== SUMMARY =====');
for (const [label, r] of Object.entries(results)) {
  console.log(`${label}: active=${r.withActivity.length}`);
  for (const a of r.withActivity.slice(0, 3)) console.log(`  → ${a.addr}`);
}
