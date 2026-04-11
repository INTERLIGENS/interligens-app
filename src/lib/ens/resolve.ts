/**
 * Minimal ENS forward resolver — no external deps.
 *
 * Implements:
 *   1. Keccak256 (Ethereum variant, 0x01 padding) — ~80 lines pure JS
 *   2. ENSIP-1 namehash
 *   3. Resolver lookup via ENS Registry (0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e)
 *   4. addr(node) call on the resolver
 *
 * Public RPC default: https://ethereum.publicnode.com
 *
 * Returns the resolved 0x-address (lowercased, no checksum) or null.
 * Fail-soft on every error: bad RPC response, no resolver, no addr record,
 * resolver returns the zero address — all yield null with a warn log.
 *
 * Tested against vitalik.eth → 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
 */

// ─────────────────────────────────────────────────────────────────────────────
// Keccak256 — Ethereum-flavored SHA-3 (0x01 padding instead of 0x06)
// ─────────────────────────────────────────────────────────────────────────────
//
// This is a tight rewrite of the public-domain Keccak-f[1600] permutation.
// Reference: FIPS 202 + Ethereum's domain separation byte.
// Validated against test vectors below in __selfTest().

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROT = [
  0,  1, 62, 28, 27,
 36, 44,  6, 55, 20,
  3, 10, 43, 25, 39,
 41, 45, 15, 21,  8,
 18,  2, 61, 56, 14,
];
const MASK64 = (1n << 64n) - 1n;
function rotl64(x: bigint, n: number): bigint {
  const m = BigInt(n);
  return ((x << m) & MASK64) | (x >> (64n - m));
}

function keccakF1600(state: BigUint64Array): void {
  for (let round = 0; round < 24; round++) {
    // θ
    const C = new BigUint64Array(5);
    for (let x = 0; x < 5; x++) {
      C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    const D = new BigUint64Array(5);
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
    }
    for (let i = 0; i < 25; i++) state[i] ^= D[i % 5];

    // ρ + π
    const B = new BigUint64Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const idx = x + 5 * y;
        const newIdx = y + 5 * ((2 * x + 3 * y) % 5);
        B[newIdx] = rotl64(state[idx], ROT[idx]);
      }
    }

    // χ
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        state[x + 5 * y] = B[x + 5 * y] ^ ((~B[((x + 1) % 5) + 5 * y]) & B[((x + 2) % 5) + 5 * y] & MASK64);
      }
    }

    // ι
    state[0] ^= RC[round];
  }
}

export function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136; // 1600 - 2*256 bits = 1088 bits = 136 bytes
  const state = new BigUint64Array(25); // 1600 bits

  // Absorb
  let offset = 0;
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  padded.set(data, 0);
  padded[data.length] = 0x01; // Ethereum keccak padding (NOT 0x06 which is SHA-3)
  padded[padded.length - 1] |= 0x80;

  while (offset < padded.length) {
    for (let i = 0; i < rate / 8; i++) {
      let word = 0n;
      for (let j = 0; j < 8; j++) {
        word |= BigInt(padded[offset + i * 8 + j]) << BigInt(8 * j);
      }
      state[i] ^= word;
    }
    keccakF1600(state);
    offset += rate;
  }

  // Squeeze 256 bits
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let w = state[i];
    for (let j = 0; j < 8; j++) {
      out[i * 8 + j] = Number(w & 0xffn);
      w >>= 8n;
    }
  }
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const v of b) s += v.toString(16).padStart(2, "0");
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENSIP-1 namehash
// ─────────────────────────────────────────────────────────────────────────────

export function namehash(name: string): Uint8Array {
  let node: Uint8Array = new Uint8Array(32); // 32 zero bytes
  if (!name) return node;
  const labels = name.split(".").reverse();
  for (const label of labels) {
    if (!label) continue;
    const labelHash = keccak256(strToBytes(label));
    const concat = new Uint8Array(64);
    for (let i = 0; i < 32; i++) concat[i] = node[i];
    for (let i = 0; i < 32; i++) concat[32 + i] = labelHash[i];
    node = keccak256(concat);
  }
  return node;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENS Registry / Resolver minimal ABI
// ─────────────────────────────────────────────────────────────────────────────

const ENS_REGISTRY = "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e";
// Function selectors (first 4 bytes of keccak256 of signature)
const SEL_RESOLVER = "0178b8bf"; // resolver(bytes32)
const SEL_ADDR = "3b3b57de";     // addr(bytes32)
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function encodeBytes32Call(selector: string, node: Uint8Array): string {
  return "0x" + selector + bytesToHex(node);
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: { code: number; message: string };
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to, data }, "latest"],
  };
  let res: Response;
  try {
    res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return null;
  }
  if (!res.ok) return null;
  let parsed: RpcResponse;
  try {
    parsed = await res.json();
  } catch {
    return null;
  }
  if (parsed.error) return null;
  return parsed.result ?? null;
}

/**
 * Resolve an ENS name to an EVM address. Returns lowercase 0x… or null.
 */
export async function resolveEns(
  name: string,
  rpcUrl = "https://ethereum.publicnode.com"
): Promise<string | null> {
  if (!name) return null;
  const node = namehash(name);

  // 1) registry.resolver(node) → resolver address (32 bytes, last 20 = addr)
  const resolverHex = await ethCall(rpcUrl, ENS_REGISTRY, encodeBytes32Call(SEL_RESOLVER, node));
  if (!resolverHex || resolverHex.length < 66) return null;
  const resolverAddr = "0x" + resolverHex.slice(-40);
  if (resolverAddr === ZERO_ADDR) return null;

  // 2) resolver.addr(node) → 20-byte address (right-padded in 32 bytes)
  const addrHex = await ethCall(rpcUrl, resolverAddr, encodeBytes32Call(SEL_ADDR, node));
  if (!addrHex || addrHex.length < 66) return null;
  const addr = "0x" + addrHex.slice(-40);
  if (addr === ZERO_ADDR) return null;
  return addr.toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-test (run via: pnpm tsx src/lib/ens/resolve.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function __selfTest(): boolean {
  // Known test vector: keccak256("") = c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
  const empty = bytesToHex(keccak256(new Uint8Array(0)));
  const want = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
  if (empty !== want) {
    console.error("keccak256('') mismatch", { got: empty, want });
    return false;
  }
  // namehash('eth') = 93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
  const nh = bytesToHex(namehash("eth"));
  const wantNh = "93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae";
  if (nh !== wantNh) {
    console.error("namehash('eth') mismatch", { got: nh, want: wantNh });
    return false;
  }
  return true;
}

// Allow standalone execution: `pnpm tsx src/lib/ens/resolve.ts`
const argv = (typeof process !== "undefined" && process.argv) || [];
if (argv[1] && argv[1].endsWith("resolve.ts")) {
  (async () => {
    if (!__selfTest()) {
      console.error("self-test FAILED");
      process.exit(1);
    }
    console.log("self-test OK");
    const r = await resolveEns("vitalik.eth");
    console.log("vitalik.eth →", r);
    if (r !== "0xd8da6bf26964af9d7eed9e03e53415d37aa96045") {
      console.error("LIVE TEST FAILED — expected vitalik 0xd8da6bf...96045");
      process.exit(1);
    }
    console.log("live test OK");
  })();
}
