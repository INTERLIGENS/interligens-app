import { TX_READ_CONFIG, classifyRpcRead, unreadable, type UnreadableTx } from "@/lib/solana/txRead";
// src/lib/freshness/engine.ts
// Freshness / Recency signal engine — V1

export type FreshnessSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface FreshnessSignal {
  id: string;
  label_en: string;
  label_fr: string;
  detail_en: string;
  detail_fr: string;
  hours_ago: number;
  severity: Exclude<FreshnessSeverity, "NONE">;
}

export interface FreshnessResult {
  severity: FreshnessSeverity;
  score_contribution: number;
  signals: FreshnessSignal[];
  computed_at: Date;
}

export interface FreshnessInput {
  chain: "solana" | "ethereum" | "base" | "arbitrum";
  mint?: string;
  wallet?: string;
  deployer?: string;
  poolCreatedAt?: Date;
  domain?: string;
}

// ── Age → severity ─────────────────────────────────────────────────────────

export function ageToSeverity(ageMs: number): FreshnessSeverity {
  const h = ageMs / 3_600_000;
  if (h < 6)   return "CRITICAL";
  if (h < 24)  return "HIGH";
  if (h < 72)  return "MEDIUM";
  if (h < 168) return "LOW";
  return "NONE";
}

function severityScore(s: FreshnessSeverity): number {
  return s === "CRITICAL" ? 5 : s === "HIGH" ? 3 : s === "MEDIUM" ? 1 : 0;
}

function shortAge(ageMs: number): string {
  const totalMin = Math.floor(ageMs / 60_000);
  if (totalMin < 60)  return `${totalMin}M`;
  const h = Math.floor(ageMs / 3_600_000);
  if (h < 24) return `${h}H`;
  return `${Math.floor(h / 24)}D`;
}

function detailAge(ageMs: number): { en: string; fr: string } {
  const h = Math.round(ageMs / 3_600_000);
  if (h < 1) {
    const m = Math.round(ageMs / 60_000);
    return { en: `${m} min ago`, fr: `il y a ${m} min` };
  }
  if (h < 24) return { en: `${h}h ago`, fr: `il y a ${h}h` };
  const d = Math.floor(h / 24);
  return { en: `${d} day${d > 1 ? "s" : ""} ago`, fr: `il y a ${d} jour${d > 1 ? "s" : ""}` };
}

// ── Helius helpers ──────────────────────────────────────────────────────────

const HELIUS_RPC = () =>
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

async function helius(
  method: string,
  params: unknown[],
  fetchFn: typeof fetch,
): Promise<unknown> {
  try {
    const r = await fetchFn(HELIUS_RPC(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json() as { result?: unknown };
    // P0 AGAVE TX V1 — la réponse brute est rendue ; l'appelant classe.
    return j;
  } catch {
    return null;
  }
}

async function getSolanaFirstTxTime(
  address: string,
  fetchFn: typeof fetch,
): Promise<Date | null> {
  const sigs = ((await helius(
    "getSignaturesForAddress",
    [address, { limit: 1000 }],
    fetchFn,
  )) as { result?: unknown })?.result as Array<{ signature: string; blockTime?: number }> | null;
  if (!sigs?.length) return null;
  const oldest = sigs[sigs.length - 1];
  if (!oldest.blockTime) return null;
  return new Date(oldest.blockTime * 1_000);
}

async function getSolanaMintAuthority(
  mint: string,
  fetchFn: typeof fetch,
): Promise<string | null> {
  const info = ((await helius(
    "getParsedAccountInfo",
    [mint, { encoding: "jsonParsed" }],
    fetchFn,
  )) as { result?: unknown })?.result as
    | { value?: { data?: { parsed?: { info?: { mintAuthority?: string } } } } }
    | null;
  return info?.value?.data?.parsed?.info?.mintAuthority ?? null;
}

async function countRecentLaunches(
  deployer: string,
  windowMs: number,
  fetchFn: typeof fetch,
): Promise<{ count: number; unreadable: UnreadableTx[] }> {
  const sigs = ((await helius(
    "getSignaturesForAddress",
    [deployer, { limit: 100 }],
    fetchFn,
  )) as { result?: unknown })?.result as Array<{ signature: string; blockTime?: number }> | null;
  if (!sigs?.length) return { count: 0, unreadable: [] };
  const cutoff = Date.now() - windowMs;
  const recent = sigs.filter((s) => s.blockTime && s.blockTime * 1_000 >= cutoff);
  if (!recent.length) return { count: 0, unreadable: [] };

  let count = 0;
  /** Signatures connues dont le corps n'a pas pu être lu. */
  const illisibles: UnreadableTx[] = [];
  for (const sig of recent.slice(0, 20)) {
    try {
      const lu = classifyRpcRead<{
        transaction?: { message?: { instructions?: Array<{ programId?: string; parsed?: { type?: string } }> } };
      }>(await helius("getTransaction", [sig.signature, TX_READ_CONFIG], fetchFn));
      // ─── P0 AGAVE TX V1 ──────────────────────────────────────────────
      // Un refus de lecture n'est pas « pas de mint ici ». Le compteur ne
      // l'absorbe pas : il le consigne à part, et le résultat dira sur
      // combien de transactions il a réellement porté.
      const refus = unreadable(sig.signature, lu);
      if (refus) {
        illisibles.push(refus);
        continue;
      }
      if (lu.kind !== "value") continue;
      const tx = lu.value;
      const instrs = tx.transaction?.message?.instructions ?? [];
      const hasInitMint = instrs.some(
        (i) =>
          i.programId === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" &&
          i.parsed?.type === "initializeMint",
      );
      if (hasInitMint) count++;
    } catch { /* skip */ }
  }
  // Le décompte voyage AVEC ce qu'il n'a pas pu lire. Un `0` obtenu sur 20
  // transactions refusées n'est pas le même fait qu'un `0` obtenu sur 20
  // transactions lues — et c'est exactement la confusion que ce P0 ferme.
  return { count, unreadable: illisibles };
}

// ── EVM helpers ─────────────────────────────────────────────────────────────

const EVM_RPC: Record<string, string> = {
  ethereum: "https://ethereum.publicnode.com",
  base:     "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
};

async function evmRpc(
  chain: string,
  method: string,
  params: unknown[],
  fetchFn: typeof fetch,
): Promise<unknown> {
  const url = EVM_RPC[chain] ?? EVM_RPC.ethereum;
  try {
    const r = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8_000),
    });
    const j = await r.json() as { result?: unknown };
    // P0 AGAVE TX V1 — la réponse brute est rendue ; l'appelant classe.
    return j;
  } catch {
    return null;
  }
}

async function getEvmContractDeployBlock(
  address: string,
  chain: string,
  fetchFn: typeof fetch,
): Promise<number | null> {
  const latestHex = await evmRpc(chain, "eth_blockNumber", [], fetchFn) as string | null;
  if (!latestHex) return null;
  let lo = 0;
  let hi = parseInt(latestHex, 16);
  let deployBlock: number | null = null;

  for (let i = 0; i < 12; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const code = await evmRpc(
      chain,
      "eth_getCode",
      [address, `0x${mid.toString(16)}`],
      fetchFn,
    ) as string | null;
    if (code && code !== "0x") {
      deployBlock = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
    if (lo > hi) break;
  }
  return deployBlock;
}

async function getEvmBlockTimestamp(
  blockNum: number,
  chain: string,
  fetchFn: typeof fetch,
): Promise<Date | null> {
  const block = await evmRpc(
    chain,
    "eth_getBlockByNumber",
    [`0x${blockNum.toString(16)}`, false],
    fetchFn,
  ) as { timestamp?: string } | null;
  if (!block?.timestamp) return null;
  return new Date(parseInt(block.timestamp, 16) * 1_000);
}

// ── Domain / RDAP ───────────────────────────────────────────────────────────

async function getDomainAge(domain: string, fetchFn: typeof fetch): Promise<Date | null> {
  try {
    const r = await fetchFn(`https://rdap.iana.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!r.ok) return null;
    const j = await r.json() as { events?: Array<{ eventAction: string; eventDate: string }> };
    const reg = j.events?.find((e) => e.eventAction === "registration");
    if (!reg?.eventDate) return null;
    return new Date(reg.eventDate);
  } catch {
    return null;
  }
}

// ── Main engine ─────────────────────────────────────────────────────────────

export async function computeFreshnessSignals(
  input: FreshnessInput,
  _fetchFn: typeof fetch = fetch,
): Promise<FreshnessResult> {
  const now = Date.now();
  const signals: FreshnessSignal[] = [];

  function maybeAdd(
    type: string,
    labelPrefix: string,
    detailPrefix: { en: string; fr: string },
    timestamp: Date | null,
  ): void {
    if (!timestamp) return;
    const ageMs = now - timestamp.getTime();
    if (ageMs < 0) return;
    const sev = ageToSeverity(ageMs);
    if (sev === "NONE") return;
    const age = shortAge(ageMs);
    const det = detailAge(ageMs);
    const hours_ago = ageMs / 3_600_000;
    signals.push({
      id: `${type}_${sev.toLowerCase()}`,
      label_en: `${labelPrefix} · ${age}`,
      label_fr: `${labelPrefix} · ${age}`,
      detail_en: `${detailPrefix.en} ${det.en}`,
      detail_fr: `${detailPrefix.fr} ${det.fr}`,
      hours_ago,
      severity: sev as Exclude<FreshnessSeverity, "NONE">,
    });
  }

  // ── Solana ──────────────────────────────────────────────────────────────
  if (input.chain === "solana") {
    if (input.mint) {
      const t = await getSolanaFirstTxTime(input.mint, _fetchFn);
      maybeAdd("token_age", "TOKEN", { en: "Token created", fr: "Token créé" }, t);
    }

    const deployerAddr = input.deployer
      ?? (input.mint ? await getSolanaMintAuthority(input.mint, _fetchFn) : null);

    if (deployerAddr) {
      const t = await getSolanaFirstTxTime(deployerAddr, _fetchFn);
      maybeAdd(
        "deployer_age",
        "DEPLOYER",
        { en: "Deployer wallet created", fr: "Wallet deployer créé" },
        t,
      );

      if (input.poolCreatedAt) {
        maybeAdd(
          "pool_age",
          "POOL",
          { en: "Liquidity pool added", fr: "Liquidité ajoutée" },
          input.poolCreatedAt,
        );
      }

      const { count: launches, unreadable: launchesIllisibles } =
        await countRecentLaunches(deployerAddr, 48 * 3_600_000, _fetchFn);
      // ─── P0 AGAVE TX V1 ────────────────────────────────────────────────
      // Un décompte obtenu sur des transactions REFUSÉES n'est pas un
      // décompte : il ne dit pas « ce deployer n'a rien lancé », il dit
      // « nous n'avons pas pu regarder ». Le signal ne se fabrique donc pas
      // sur un dénombrement qui n'a pas pu être fait — et l'inverse, taire
      // un vrai décompte parce qu'une transaction sans rapport a échoué,
      // serait la sur-correction symétrique : seul le cas où RIEN n'a été
      // lu est écarté.
      if (launchesIllisibles.length > 0) {
        console.warn(
          `[freshness] ${deployerAddr} : ${launchesIllisibles.length} signature(s) illisible(s) — décompte partiel`,
          launchesIllisibles.map((u) => `${u.signature.slice(0, 12)}… ${u.state}/${u.code}`),
        );
      }
      if (launches >= 2) {
        const sev: Exclude<FreshnessSeverity, "NONE"> =
          launches >= 5 ? "CRITICAL" : launches >= 3 ? "HIGH" : "MEDIUM";
        signals.push({
          id: `deployer_recent_launches_${sev.toLowerCase()}`,
          label_en: `${launches} LAUNCHES · 48H`,
          label_fr: `${launches} LANCEMENTS · 48H`,
          detail_en: `Deployer launched ${launches} tokens in 48h`,
          detail_fr: `Deployer a lancé ${launches} tokens en 48h`,
          hours_ago: 48,
          severity: sev,
        });
      }
    }

    if (input.poolCreatedAt && !input.deployer && !input.mint) {
      maybeAdd(
        "pool_age",
        "POOL",
        { en: "Liquidity pool added", fr: "Liquidité ajoutée" },
        input.poolCreatedAt,
      );
    }
  }

  // ── EVM ─────────────────────────────────────────────────────────────────
  if (["ethereum", "base", "arbitrum"].includes(input.chain)) {
    const addr = input.mint ?? input.wallet;
    if (addr) {
      const deployBlock = await getEvmContractDeployBlock(addr, input.chain, _fetchFn);
      if (deployBlock !== null) {
        const t = await getEvmBlockTimestamp(deployBlock, input.chain, _fetchFn);
        maybeAdd(
          "contract_age",
          "CONTRACT",
          { en: "Contract deployed", fr: "Contrat déployé" },
          t,
        );
      }
    }
    if (input.deployer) {
      const deployBlock = await getEvmContractDeployBlock(input.deployer, input.chain, _fetchFn);
      if (deployBlock !== null) {
        const t = await getEvmBlockTimestamp(deployBlock, input.chain, _fetchFn);
        maybeAdd(
          "deployer_age",
          "DEPLOYER",
          { en: "Deployer wallet first seen", fr: "Wallet deployer vu pour la 1ère fois" },
          t,
        );
      }
    }
    if (input.poolCreatedAt) {
      maybeAdd(
        "pool_age",
        "POOL",
        { en: "Liquidity pool added", fr: "Liquidité ajoutée" },
        input.poolCreatedAt,
      );
    }
  }

  // ── Domain ───────────────────────────────────────────────────────────────
  if (input.domain) {
    const t = await getDomainAge(input.domain, _fetchFn);
    maybeAdd(
      "domain_age",
      "DOMAIN",
      { en: "Domain registered", fr: "Domaine enregistré" },
      t,
    );
  }

  // ── Aggregate ────────────────────────────────────────────────────────────
  signals.sort((a, b) => severityScore(b.severity) - severityScore(a.severity));

  const topSev: FreshnessSeverity = signals[0]?.severity ?? "NONE";
  const score_contribution = Math.min(
    15,
    signals.reduce((s, sig) => s + severityScore(sig.severity), 0),
  );

  return {
    severity: topSev,
    score_contribution,
    signals,
    computed_at: new Date(now),
  };
}
