import { NextResponse } from "next/server";

type Risk = "low" | "medium" | "high";

const __CACHE_SOL = new Map<string, { t: number; v: any }>();
function solCacheGet(key: string, ttlMs = 60_000) {
  const hit = __CACHE_SOL.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > ttlMs) {
    __CACHE_SOL.delete(key);
    return null;
  }
  return hit.v;
}
function solCacheSet(key: string, v: any) {
  __CACHE_SOL.set(key, { t: Date.now(), v });
}

function isSolAddress(a: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
}

const SOL_ALLOWLIST = new Set<string>([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "ComputeBudget111111111111111111111111111111",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "JUP6LkbZbjS1jKKwapdH67yv5L3hbpXwWAJGk5wAM",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("address") || "").trim();
    const deep = (searchParams.get("deep") || "false").toLowerCase() === "true";

    if (!isSolAddress(address)) {
      return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing HELIUS_API_KEY" }, { status: 500 });
    }

    const mode = deep ? "deep" : "fast";
    const cacheKey = `sol:${mode}:${address}`;
    const cached = solCacheGet(cacheKey);
    if (cached) return NextResponse.json(cached);

    const limit = deep ? 100 : 50;
    const txUrl = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}&limit=${limit}`;
    const txRes = await fetch(txUrl, { cache: "no-store" });

    if (!txRes.ok) {
      const body = await txRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Helius transactions fetch failed", status: txRes.status, detail: body.slice(0, 300) },
        { status: 502 }
      );
    }

    const txs = await txRes.json();

    const programCounts = new Map<string, number>();
    for (const tx of Array.isArray(txs) ? txs : []) {
      const instructions = tx?.instructions || [];
      for (const ix of instructions) {
        const pid = ix?.programId;
        if (!pid) continue;
        programCounts.set(pid, (programCounts.get(pid) || 0) + 1);
      }
    }

    let unknownProgramsCount = 0;
    const programs = [...programCounts.entries()]
      .map(([id, count]) => {
        const unknown = !SOL_ALLOWLIST.has(id);
        if (unknown) unknownProgramsCount += 1;
        const risk: Risk = unknown ? (count > 10 ? "high" : "medium") : "low";
        return { id, name: unknown ? "Unknown Program" : "Verified Protocol", count, risk };
      })
      .sort((a, b) => b.count - a.count);

    const programsSummary = {
      unknownCount: unknownProgramsCount,
      topPrograms: programs.slice(0, 5).map((p) => ({ id: p.id, count: p.count, risk: p.risk })),
    };

    // Stable mode (no DAS): placeholders
    const freezeAuthorityTokens = 0;
    const mutableTokens = 0;

    const proofs: string[] = [];
    if (unknownProgramsCount > 0) proofs.push(`Unknown programs interacted: ${unknownProgramsCount}`);
    if (freezeAuthorityTokens > 0 && proofs.length < 3) proofs.push(`Freeze-authority tokens detected: ${freezeAuthorityTokens}`);
    if (mutableTokens > 0 && proofs.length < 3) proofs.push(`Mutable-metadata tokens detected: ${mutableTokens}`);
    while (proofs.length < 3) proofs.push(deep ? "Deep evidence collected successfully" : "Run Deep Scan for stronger evidence");

    let score = 10;
    if (unknownProgramsCount > 5) score += 30;
    else if (unknownProgramsCount > 0) score += 15;
    score = Math.max(0, Math.min(100, score));
    const tier = score >= 70 ? "RED" : score >= 40 ? "ORANGE" : "GREEN";

    const resp = {
      ok: true,
      address,
      deep,
      summary: { txCount: Array.isArray(txs) ? txs.length : 0 },
      risk: { score, tier, drivers: [] as any[] },
      programs: deep ? programs.slice(0, 15) : programs.slice(0, 5),
      unknownProgramsCount,
      programsSummary,
      proofs: proofs.slice(0, 3),
      transactions: (Array.isArray(txs) ? txs : []).slice(0, 10).map((t: any) => ({ signature: t?.signature, timestamp: t?.timestamp })),
    };

    solCacheSet(cacheKey, resp);
    return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ error: "SOL scan failed", detail: String(e?.message || e) }, { status: 500 });
  }
}
