import { NextResponse } from "next/server";
import { rpcCall } from "@/lib/rpc";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";

type Severity = "low" | "medium" | "high";

type EthRiskSignal = {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
};

type EthApproval = {
  token: string;
  spender: string;
  allowance: string;
  isUnlimited: boolean;
  risk: "low" | "medium" | "high";
  detail: string;
};

const __CACHE_ETH = new Map<string, { t: number; v: any }>();
function ethCacheGet(key: string, ttlMs = 60_000) {
  const hit = __CACHE_ETH.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > ttlMs) {
    __CACHE_ETH.delete(key);
    return null;
  }
  return hit.v;
}
function ethCacheSet(key: string, v: any) {
  __CACHE_ETH.set(key, { t: Date.now(), v });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isEthAddress(a: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

function toEth(rawWei: string) {
  try {
    const w = BigInt(rawWei);
    const whole = w / 10n ** 18n;
    const frac = (w % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
    return `${whole.toString()}.${frac}`;
  } catch {
    return "0.000000";
  }
}

function padTopicAddress(addr: string) {
  return "0x000000000000000000000000" + addr.slice(2).toLowerCase();
}

function isUnlimitedAllowance(dataHex: string) {
  const d = (dataHex || "").toLowerCase();
  return (
    d === "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" ||
    d.startsWith("0xffffffffffffffffffffffff")
  );
}

async function etherscanV2<T>(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (json?.result === undefined) return json as T;

  if (json?.status === "0") {
    const msg = String(json?.result || json?.message || "Etherscan error");
    throw new Error(msg);
  }

  return json as T;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("address") || "").trim();
    const deep = (searchParams.get("deep") || "false").toLowerCase() === "true";

    if (!isEthAddress(address)) {
      return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
    }

    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing ETHERSCAN_API_KEY" }, { status: 500 });
    }

    const mode = deep ? "deep" : "fast";
    const cacheKey = `eth:${mode}:${address.toLowerCase()}`;
    const cached = ethCacheGet(cacheKey);
    if (cached) return NextResponse.json(cached);

    const base = "https://api.etherscan.io/v2/api";
    const chainid = 1;

    // 1) balance (Etherscan primary)
    const balUrl = `${base}?chainid=${chainid}&module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;
    const balResp = await etherscanV2<{ status: string; message: string; result: string }>(balUrl);
    const balRaw = String((balResp as any).result || "0");

    await sleep(350);

    // 1b) eth_getCode via RPC (detect contract vs EOA) + balance fallback
    let isContract = false;
    let rpcDataSource: "rpc_primary" | "rpc_fallback" | null = null;
    let rpcSourceDetail: string | null = null;
    let rpcFallbackUsed = false;
    let rpcCacheHit = false;
    let balRpcFallback: string | null = null;
    let rpcDown = false;
    let rpcError: string | null = null;
    try {
      const codeResult = await rpcCall("ETH", "eth_getCode", [address, "latest"]);
      isContract = codeResult.result !== "0x" && codeResult.result !== "0x0";
      rpcDataSource = codeResult.didFallback ? "rpc_fallback" : "rpc_primary";
      rpcSourceDetail = codeResult.provider_used;
      rpcFallbackUsed = codeResult.didFallback;
      rpcCacheHit = codeResult.cached;
    } catch (e: any) {
      rpcDown = true;
      rpcError = String(e?.message || "RPC unavailable").slice(0, 120);
    }

    // 1c) eth_getBalance via RPC (fallback if balRaw=0 and Etherscan unreliable)
    if (balRaw === "0") {
      try {
        const balRpc = await rpcCall("ETH", "eth_getBalance", [address, "latest"]);
        if (balRpc.result && balRpc.result !== "0x0") {
          balRpcFallback = BigInt(balRpc.result).toString();
          if (!rpcDataSource) {
            rpcDataSource = balRpc.didFallback ? "rpc_fallback" : "rpc_primary";
            rpcSourceDetail = balRpc.provider_used;
            rpcFallbackUsed = balRpc.didFallback;
          }
        }
      } catch {
        // best-effort
      }
    }

    const finalBalRaw = balRpcFallback ?? balRaw;

    // 2) txlist
    const txUrl = `${base}?chainid=${chainid}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${
      deep ? 80 : 25
    }&sort=desc&apikey=${apiKey}`;
    const txResp = await etherscanV2<{ status: string; message: string; result: any[] }>(txUrl);
    const txsRaw = Array.isArray((txResp as any).result) ? (txResp as any).result : [];

    await sleep(350);

    // 3) erc20 tokentx
    const tokUrl = `${base}?chainid=${chainid}&module=account&action=tokentx&address=${address}&page=1&offset=${
      deep ? 80 : 25
    }&sort=desc&apikey=${apiKey}`;
    const tokResp = await etherscanV2<{ status: string; message: string; result: any[] }>(tokUrl);
    const tokRaw = Array.isArray((tokResp as any).result) ? (tokResp as any).result : [];

    const normTxs = txsRaw.slice(0, 200).map((t: any) => ({
      hash: String(t.hash || ""),
      timestamp: Number(t.timeStamp || t.timestamp || 0),
      from: String(t.from || "").toLowerCase(),
      to: String(t.to || "").toLowerCase(),
      valueRaw: String(t.value || "0"),
      valueFormatted: toEth(String(t.value || "0")),
      status: String(t.isError) === "1" ? "fail" : "success",
      feeRaw: String(
        t.gasUsed && t.gasPrice ? (BigInt(t.gasUsed) * BigInt(t.gasPrice)).toString() : "0"
      ),
      method: String(t.functionName || ""),
      blockNumber: Number(t.blockNumber || 0),
    }));

    const cpsMap = new Map<string, number>();
    for (const t of normTxs) {
      const other = t.from === address.toLowerCase() ? t.to : t.from;
      if (!other || other === "0x0000000000000000000000000000000000000000") continue;
      cpsMap.set(other, (cpsMap.get(other) || 0) + 1);
    }
    const counterparties = [...cpsMap.entries()]
      .map(([a, count]) => ({ address: a, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const tokAgg = new Map<string, { contract: string; symbol: string; name: string; decimals: number; raw: bigint }>();
    for (const x of tokRaw) {
      const contract = String(x.contractAddress || "").toLowerCase();
      if (!contract) continue;
      const decimals = Number(x.tokenDecimal || 0);
      const sym = String(x.tokenSymbol || "");
      const name = String(x.tokenName || "");
      const v = BigInt(String(x.value || "0"));
      const prev = tokAgg.get(contract);
      if (!prev) tokAgg.set(contract, { contract, symbol: sym, name, decimals, raw: v });
      else prev.raw = prev.raw + v;
    }
    const tokens = [...tokAgg.values()]
      .map((t) => {
        const denom = 10n ** BigInt(Math.max(0, Math.min(30, t.decimals)));
        const whole = denom > 0n ? t.raw / denom : t.raw;
        const frac = denom > 0n ? (t.raw % denom).toString().padStart(Number(t.decimals), "0").slice(0, 6) : "0";
        return {
          contract: t.contract,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          raw: t.raw.toString(),
          formatted: `${whole.toString()}.${frac}`,
        };
      })
      .slice(0, 40);

    const approvals: EthApproval[] = [];
    if (deep) {
      try {
        await sleep(450);
        const topic0 = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
        const padded = padTopicAddress(address);
        const latestBlock = normTxs[0]?.blockNumber || 0;
        const fromBlock = latestBlock > 0 ? Math.max(0, latestBlock - 200_000) : 0;

        const logsUrl = `${base}?chainid=${chainid}&module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=latest&topic0=${topic0}&topic0_1_opr=and&topic1=${padded}&page=1&offset=40&apikey=${apiKey}`;
        const logsResp = await etherscanV2<{ status: string; message: string; result: any[] }>(logsUrl);
        const rows = Array.isArray((logsResp as any).result) ? (logsResp as any).result : [];

        const seen = new Set<string>();
        for (const log of rows) {
          if (!log?.topics || log.topics.length < 3) continue;
          const spender = "0x" + String(log.topics[2]).slice(26);
          const token = String(log.address || "").toLowerCase();
          const key = token + ":" + spender;
          if (seen.has(key)) continue;
          seen.add(key);

          const allowance = String(log.data || "0x0");
          const unlimited = isUnlimitedAllowance(allowance);

          approvals.push({
            token,
            spender,
            allowance,
            isUnlimited: unlimited,
            risk: unlimited ? "high" : "low",
            detail: unlimited ? "Unlimited ERC20 allowance (Approval event)" : "Approval event detected",
          });
        }
      } catch {
        // best-effort
      }
    }

    const unlimitedCount = approvals.filter((a) => a.isUnlimited).length;

    const risk_signals: EthRiskSignal[] = [];
    if (isContract) {
      risk_signals.push({
        code: "IS_CONTRACT",
        severity: "medium",
        title: "Contract address",
        detail: "This address is a smart contract, not an EOA — verify source code.",
      });
    }
    if (normTxs.length < 5) {
      risk_signals.push({
        code: "LOW_HISTORY",
        severity: "medium",
        title: "Very low transaction history",
        detail: "New/burner wallets are common in scams and drains.",
      });
    }
    if (counterparties.length > 15) {
      risk_signals.push({
        code: "MANY_COUNTERPARTIES",
        severity: "medium",
        title: "Many counterparties",
        detail: "Interacting with many unknown addresses increases exposure.",
      });
    }
    if (unlimitedCount > 0) {
      risk_signals.push({
        code: "UNLIMITED_APPROVALS",
        severity: "high",
        title: "Unlimited approvals detected",
        detail: "Unlimited approvals are a common drain vector.",
      });
    }

    const approvalsSummary = {
      total: approvals.length,
      unlimited: unlimitedCount,
      topSpenders: Array.from(new Set(approvals.map((a) => a.spender))).slice(0, 5),
    };

    const proofs: string[] = [];
    if (approvalsSummary.unlimited > 0) proofs.push(`Unlimited approvals detected: ${approvalsSummary.unlimited}`);
    else if (approvalsSummary.total > 8) proofs.push(`Many approvals found (${approvalsSummary.total}) — higher drain exposure`);
    if (counterparties.length > 15 && proofs.length < 3) proofs.push(`Many unknown counterparties: ${counterparties.length}`);
    for (const r of risk_signals) {
      if (proofs.length >= 3) break;
      proofs.push(r.title);
    }
    while (proofs.length < 3) proofs.push(deep ? "Deep evidence collected successfully" : "Run Deep Scan for stronger evidence");

    let score = 10;
    for (const s of risk_signals) score += s.severity === "high" ? 30 : s.severity === "medium" ? 15 : 5;
    score = Math.max(0, Math.min(100, score));
    const tier = score >= 70 ? "RED" : score >= 40 ? "ORANGE" : "GREEN";

    const spenders = Array.from(new Set(approvals.map((a) => a.spender))).slice(0, 5);
    const counterparties_top = counterparties.slice(0, 5).map(cp => cp.address);

    const tigerScan = computeTigerScoreFromScan({
      chain: "ETH",
      is_contract: isContract,
      rpc_fallback_used: rpcFallbackUsed,
      rpc_down: rpcDown,
      rpc_error: rpcError,
      data_source: rpcDataSource ?? "etherscan",
      source_detail: rpcSourceDetail,
      deep,
      signals: {
        unlimitedApprovals: unlimitedCount,
        approvalsTotal: approvals.length,
        txCount: normTxs.length,
        freezeAuthority: false,
        mintAuthorityActive: false,
        spenders,
        counterparties: counterparties_top,
        confirmedCriticalClaims: 0,
        knownBadAddresses: 0,
      },
    });

    const resp = {
      chain: "eth",
      address,
      native_balance: { symbol: "ETH", raw: finalBalRaw, formatted: toEth(finalBalRaw) },
      tokens,
      nfts: [],
      txs: normTxs.slice(0, 50),
      counterparties,
      risk_signals,
      approvals: deep ? approvals.slice(0, 30) : [],
      approvalsSummary,
      spenders,
      counterparties_top,
      proofs: proofs.slice(0, 3),
      score,
      tier,
      tiger_score: tigerScan.score,
      tiger_tier: tigerScan.tier,
      tiger_drivers: tigerScan.drivers,
      tiger_evidence: tigerScan.evidence,
      tiger_meta: tigerScan.meta,
      data_source: rpcDataSource ?? ("etherscan" as const),
      source_detail: rpcSourceDetail ?? "api.etherscan.io",
      provider_used: rpcSourceDetail ?? "api.etherscan.io", // @deprecated
      is_contract: isContract,
      rpc_fallback_used: rpcFallbackUsed,
      cache_hit: rpcCacheHit,
      rpc_down: rpcDown,
      rpc_error: rpcError,
    };

    ethCacheSet(cacheKey, resp);
    return NextResponse.json(resp);
  } catch (e: any) {
    const msg = String(e?.message || "ETH scan failed");
    if (msg.toLowerCase().includes("rate limit")) {
      return NextResponse.json({ error: "ETH scan failed", detail: msg }, { status: 429 });
    }
    return NextResponse.json({ error: "ETH scan failed", detail: msg }, { status: 500 });
  }
}
