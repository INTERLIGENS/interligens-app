import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

async function helius(method: string, params: any[]) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  return j.result ?? null;
}

async function getTokenTransfers(walletAddress: string, tokenCA: string) {
  const receives: any[] = [];
  const sells: any[] = [];

  // 1. Trouver le token account du wallet pour ce CA
  const tokenAccounts = await helius("getTokenAccountsByOwner", [
    walletAddress,
    { mint: tokenCA },
    { encoding: "jsonParsed" },
  ]);

  if (!tokenAccounts?.value?.length) return { receives, sells };

  const tokenAccount = tokenAccounts.value[0].pubkey;

  // 2. Récupérer les signatures sur ce token account
  const sigs = await helius("getSignaturesForAddress", [
    tokenAccount,
    { limit: 40 },
  ]);
  if (!sigs?.length) return { receives, sells };

  // 3. Parser chaque transaction
  for (const sigInfo of sigs.slice(0, 30)) {
    try {
      const tx = await helius("getTransaction", [
        sigInfo.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (!tx || tx.meta?.err) continue;

      const blockTime = tx.blockTime;
      const date = blockTime ? new Date(blockTime * 1000).toISOString() : null;
      const solscanUrl = `https://solscan.io/tx/${sigInfo.signature}`;

      const pre = tx.meta?.preTokenBalances ?? [];
      const post = tx.meta?.postTokenBalances ?? [];

      // Trouver les changements de balance pour ce wallet
      for (const preEntry of pre) {
        if (preEntry.mint !== tokenCA) continue;
        const postEntry = post.find((p: any) => p.accountIndex === preEntry.accountIndex);
        const preBal = parseFloat(preEntry.uiTokenAmount?.uiAmountString ?? "0");
        const postBal = parseFloat(postEntry?.uiTokenAmount?.uiAmountString ?? "0");
        const diff = postBal - preBal;

        if (diff > 0.01) {
          // tokens reçus = receive (insider allocation / transfer entrant)
          const from = tx.transaction?.message?.accountKeys?.[0]?.pubkey ?? "unknown";
          receives.push({
            tokenAmount: diff.toFixed(2),
            date,
            from,
            solscanUrl,
          });
        } else if (diff < -0.01) {
          // tokens sortants = sell / swap
          sells.push({
            tokenAmount: Math.abs(diff).toFixed(2),
            date,
            walletAddress,
            solscanUrl,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return { receives, sells };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const { searchParams } = new URL(req.url);
  const ca = searchParams.get("ca");

  try {
    const profile = await prisma.kolProfile.findUnique({
      where: { handle },
      include: { kolWallets: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    if (!ca) {
      return NextResponse.json({ found: false, receives: [], sells: [], total: 0, reason: "No token CA provided" });
    }

    if (!process.env.HELIUS_API_KEY) {
      return NextResponse.json({ fallback: true, message: "Helius API key not configured" }, { status: 503 });
    }

    const solWallets = profile.kolWallets.filter(
      (w) => w.status === "active" && w.chain?.toUpperCase() === "SOL"
    );

    if (!solWallets.length) {
      return NextResponse.json({ found: false, receives: [], sells: [], total: 0, reason: "No SOL wallets on record" });
    }

    const allReceives: any[] = [];
    const allSells: any[] = [];

    for (const wallet of solWallets) {
      const { receives, sells } = await getTokenTransfers(wallet.address, ca);
      allReceives.push(...receives);
      allSells.push(...sells);
    }

    // Trier par date décroissante
    const sortByDate = (a: any, b: any) =>
      new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();
    allReceives.sort(sortByDate);
    allSells.sort(sortByDate);

    const total = allReceives.length + allSells.length;

    return NextResponse.json({
      found: total > 0,
      receives: allReceives,
      sells: allSells,
      total,
      walletCount: solWallets.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[cashout]", err);
    return NextResponse.json(
      { fallback: true, message: "RPC unavailable", error: err.message },
      { status: 503 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
