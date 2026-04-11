import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const HELIUS_META = `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_API_KEY}`;

type CacheEntry = {
  data: any;
  ts: number;
};
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1h

async function heliusRpc(method: string, params: any[]) {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.result ?? null;
  } catch (err) {
    console.warn("[wallet-history] helius rpc error", method, err);
    return null;
  }
}

async function fetchTokenMetadata(mints: string[]) {
  const out: Record<string, { symbol?: string; name?: string }> = {};
  if (!mints.length) return out;

  for (let i = 0; i < mints.length; i += 100) {
    const batch = mints.slice(i, i + 100);
    try {
      const res = await fetch(HELIUS_META, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintAccounts: batch }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      if (Array.isArray(j)) {
        for (const item of j) {
          const mint = item?.account;
          if (!mint) continue;
          out[mint] = {
            symbol: item?.onChainMetadata?.metadata?.data?.symbol ??
                    item?.offChainMetadata?.metadata?.symbol,
            name: item?.onChainMetadata?.metadata?.data?.name ??
                  item?.offChainMetadata?.metadata?.name,
          };
        }
      }
    } catch (err) {
      console.warn("[wallet-history] metadata batch error", err);
    }
  }
  return out;
}

async function scanWallet(address: string) {
  const mints = new Map<string, { lastSeen: number; txCount: number }>();

  const sigs = await heliusRpc("getSignaturesForAddress", [
    address,
    { limit: 150 },
  ]);
  if (!sigs || !Array.isArray(sigs)) return mints;

  const toProcess = sigs.slice(0, 150);
  // Fetch tx in small batches to avoid bursts
  for (let i = 0; i < toProcess.length; i += 10) {
    const batch = toProcess.slice(i, i + 10);
    const results = await Promise.all(
      batch.map((s: any) =>
        heliusRpc("getTransaction", [
          s.signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ])
      )
    );
    for (let j = 0; j < results.length; j++) {
      const tx = results[j];
      const sigInfo = batch[j];
      if (!tx || tx.meta?.err) continue;
      const blockTime: number | undefined = tx.blockTime ?? sigInfo?.blockTime;
      const ts = blockTime ? blockTime * 1000 : Date.now();

      const post = tx.meta?.postTokenBalances ?? [];
      const pre = tx.meta?.preTokenBalances ?? [];
      const seen = new Set<string>();
      for (const b of [...post, ...pre]) {
        const mint: string | undefined = b?.mint;
        if (!mint) continue;
        seen.add(mint);
      }
      for (const mint of seen) {
        const prev = mints.get(mint);
        if (!prev) {
          mints.set(mint, { lastSeen: ts, txCount: 1 });
        } else {
          prev.txCount += 1;
          if (ts > prev.lastSeen) prev.lastSeen = ts;
        }
      }
    }
  }

  return mints;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const cached = CACHE.get(handle);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  if (!process.env.HELIUS_API_KEY) {
    return NextResponse.json(
      { handle, wallets: [], tokens: [], cached: false, error: "HELIUS_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const wallets = await prisma.kolWallet.findMany({
      where: { kolHandle: handle },
    });

    const solWallets = wallets.filter((w) => (w.chain ?? "").toUpperCase() === "SOL");

    const merged = new Map<string, { lastSeen: number; txCount: number }>();
    for (const w of solWallets) {
      const m = await scanWallet(w.address);
      for (const [mint, info] of m) {
        const prev = merged.get(mint);
        if (!prev) merged.set(mint, { ...info });
        else {
          prev.txCount += info.txCount;
          if (info.lastSeen > prev.lastSeen) prev.lastSeen = info.lastSeen;
        }
      }
    }

    const allMints = Array.from(merged.keys());
    const metadata = await fetchTokenMetadata(allMints);

    const tokens = allMints.map((mint) => {
      const info = merged.get(mint)!;
      const meta = metadata[mint] ?? {};
      return {
        mint,
        symbol: meta.symbol ?? null,
        name: meta.name ?? null,
        lastSeen: info.lastSeen,
        txCount: info.txCount,
      };
    });
    tokens.sort((a, b) => b.lastSeen - a.lastSeen);

    const data = {
      handle,
      wallets: wallets.map((w) => ({ address: w.address, chain: w.chain })),
      tokens,
      cached: false,
    };

    CACHE.set(handle, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[wallet-history] error", err);
    return NextResponse.json(
      { handle, wallets: [], tokens: [], cached: false, error: err?.message ?? "error" },
      { status: 500 }
    );
  }
}
