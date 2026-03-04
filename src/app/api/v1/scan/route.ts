import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextResponse } from "next/server";

type Tier = "GREEN" | "ORANGE" | "RED";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function tierFromScore(score: number): Tier {
  if (score <= 20) return "GREEN";
  if (score <= 79) return "ORANGE";
  return "RED";
}
function isEvmAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}
function isSolAddress(s: string) {
  const t = s.trim();
  if (t.length < 32 || t.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}
function hashSeed(input: string) {
  let seed = 0;
  for (let i = 0; i < input.length; i++) seed = (seed * 31 + input.charCodeAt(i)) >>> 0;
  return seed >>> 0;
}

function pickDrivers(seed: number, tier: Tier) {
  const pool = [
    "Recent suspicious inflows",
    "High-risk counterparties",
    "Fresh wallet / limited history",
    "Contract interaction anomalies",
    "Unusual token distribution",
    "Known scam cluster proximity",
    "Rapid behavior change",
    "Blacklisted tag match (OSINT)",
  ];

  const target =
    tier === "GREEN" ? (seed % 4 === 0 ? 1 : 0) :
    tier === "ORANGE" ? 2 + (seed % 2) :
    3 + (seed % 2);

  const picked: string[] = [];
  let s = seed;
  while (picked.length < target) {
    const idx = s % pool.length;
    const v = pool[idx];
    if (!picked.includes(v)) picked.push(v);
    s = (s * 1103515245 + 12345) >>> 0;
  }
  return picked;
}

function mockHoldings(seed: number, tier: Tier) {
  if (seed % 3 !== 0) return [];
  return [
    { token: "USDC", usd: "$1,240", flags: tier === "RED" ? "risk" : "" },
    { token: "SOL", usd: "$620", flags: tier === "ORANGE" ? "watch" : "" },
  ];
}

export async function POST(req: Request) {
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));

  try {
    const body = await req.json().catch(() => ({}));
    const address = String(body?.address ?? "").trim();

    const isSol = isSolAddress(address);
    const isEvm = isEvmAddress(address);

    if (!address || (!isSol && !isEvm)) {
      return NextResponse.json({ ok: false, error: "Invalid address format." }, { status: 400 });
    }

    const chain = isSol ? "sol" : "evm";
    const seed = hashSeed(address);
    const score = clamp(seed % 101, 0, 100);
    const tier = tierFromScore(score);

    const drivers = pickDrivers(seed, tier);
    const holdings = mockHoldings(seed, tier);

    const warnings: string[] = [];
    if (chain === "sol") {
      const heliusKey = process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY;
      if (!heliusKey) warnings.push("Missing Helium env vars");
    }

    return NextResponse.json({
      ok: true,
      chain,
      address,
      score,
      tier,
      drivers,
      holdings,
      warnings,
      privacy: "This demo does not store your address. It only fetches a public on-chain summary.",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Scan failed." }, { status: 500 });
  }
}
