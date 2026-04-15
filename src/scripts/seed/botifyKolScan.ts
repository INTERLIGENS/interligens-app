/**
 * BOTIFY KOL Scan — Phase 2D.
 *
 * For each wallet in BOTIFY_KOL_WALLETS:
 *   1. Pull enhanced transactions via Helius (/v0/addresses/.../transactions).
 *   2. Filter tokenTransfers where mint === BOTIFY_MINT and fromUserAccount
 *      is this wallet (= sell side).
 *   3. Aggregate SOL received in the same tx → estimate USD via a flat
 *      SOL price of $200 (Jan-Feb 2025 window baseline).
 *   4. Identify CEX destinations by regex-matching known CEX names against
 *      the enhanced tx description + destination addresses.
 *   5. Upsert KolProfile + KolWallet, insert KolProceedsEvent rows.
 *
 * Also seeds three Arkham-confirmed entries (EduRio, ElonTrades, MoneyLord)
 * directly from static totals — no Helius call needed.
 *
 * IDEMPOTENT. Dry-run by default. To actually write:
 *     RUN_BOTIFY_SCAN=1 npx tsx src/scripts/seed/botifyKolScan.ts
 *
 * Output: writes BOTIFY_KOL_SCAN_REPORT.json at the repo root.
 */

import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const HELIUS_KEY = process.env.HELIUS_API_KEY;
const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const SOL_PRICE_ESTIMATE = 200; // USD, Jan-Feb 2025 window
const DRY_RUN = process.env.RUN_BOTIFY_SCAN !== "1";

type KolEntry = {
  handle: string;
  wallet: string;
  pct: number;
  usdDeal: number | null;
};

const BOTIFY_KOL_WALLETS: KolEntry[] = [
  { handle: "OD",            wallet: "RTwVCWB3DjQ2vapBZtPTwizTcERGkNg2246AqAq1b7o",  pct: 1.0,    usdDeal: 10000 },
  { handle: "Brazil",        wallet: "46o9ufNhLACTkGPAng37Xw4Z6GR2ubUWanGBoPfEoHDb",  pct: 0.91,   usdDeal: null },
  { handle: "Dale",          wallet: "EbEfNLYD6QtRJmyBtZ9E5Wepms8XHCWBLBwwgP6y4iLo",  pct: 0.6,    usdDeal: null },
  { handle: "Xeus",          wallet: "9turTgeLPDk77u4aZDvgtYZaXzjZ1jzxV239j6WDmv2X",  pct: 0.52,   usdDeal: null },
  { handle: "Spider",        wallet: "3aHb2NzpvuafrRtNkeHcDrh56JeTGX4VAAyRUUmSdMBN",  pct: 0.5,    usdDeal: null },
  { handle: "Mason",         wallet: "7ZdDRV7dVksCWgUuAbviFzafVbt5mb1vcZ58p9Ah7zCi",  pct: 0.5,    usdDeal: null },
  { handle: "MaisonGhost",   wallet: "2ucbjTj5RWJfs2jFat37qoiKpBQ9xHzaDGd1UNaaZ6nP",  pct: 0.5,    usdDeal: null },
  { handle: "Shah",          wallet: "DDzW6w3wPyh58XNSpnC3VAHSGMifPdic7ZEe5Du5RcwN",  pct: 0.5,    usdDeal: null },
  { handle: "Henok",         wallet: "2bxdtvSBnKDRFkgCDnJMF79PbRBV5UwXxCRiBH9Cq5h4",  pct: 0.5,    usdDeal: null },
  { handle: "YourPop",       wallet: "7sRQ7RJSCDSynJr3aFXqVffAaPJKvmZZGRHTWzHHVTbm",  pct: 0.5,    usdDeal: null },
  { handle: "Iced",          wallet: "GZqgPnKiDGrBt7oQLzVQ9J17oT4dFuLdwXcQ35sHpmxp",  pct: 0.5,    usdDeal: null },
  { handle: "Nekoz",         wallet: "5KtrjaTBSpsmg42PGRHYohoXd4pHPRZ21yzskfsU9WNa",  pct: 0.4,    usdDeal: null },
  { handle: "Shmoo",         wallet: "EjhN9HgBwhzcpKEJtgiUL41PWKF7u56NpbFjuL7hvn2P",  pct: 0.325,  usdDeal: 10000 },
  { handle: "Sibel",         wallet: "9ZYq8SL5XPECWqnfYB1F6i7oT4Fakfck8QhzZqo18fHX",  pct: 0.256,  usdDeal: null },
  { handle: "Brommy",        wallet: "J9Lwoh2bimo4UwLHPJU7TvMhxqgpRimtsBqPS25y8kN2",  pct: 0.25,   usdDeal: null },
  { handle: "Exy",           wallet: "F3jZKYLYh7wR2cfatZV1w6jXiwrgQh9PyPXEL7segYtW",  pct: 0.2,    usdDeal: null },
  { handle: "Acid",          wallet: "6gn9y7iG72MxMmD9wAbGWA5ZQSTtUZtZ2AAk7wvQEMbM",  pct: 0.2,    usdDeal: null },
  { handle: "CryptoZin",     wallet: "Ao47TMguxAXCG7CmcQJTnh5fu9tqkeZFo1YsS4hCyryr",  pct: 0.1745, usdDeal: 10000 },
  { handle: "CryptoCowboy",  wallet: "6Q7MLhVJtrZT2Joix5sYzLxh1eRcoj1CxiUTge9QWp8m",  pct: 0.1745, usdDeal: null },
  { handle: "Bossman",       wallet: "9P2np34H1umoKVGeXMFd5UUpA5m6DHuv5uPDoucGyF9",   pct: 0.166,  usdDeal: 10000 },
  { handle: "Solid",         wallet: "4HdddUJRMJKwJCAYST1AxuBdmYpu5C3BP2pedsuDQ7Qz",  pct: 0.16,   usdDeal: null },
  { handle: "Ronnie",        wallet: "2C1HCNgXLryQ4W5ExrehTy793K9nzWcZcfpq2NsVPVHx",  pct: 0.1265, usdDeal: 25000 },
  { handle: "ConorKenny",    wallet: "5iM9sR7yzh6x93GLPAbh6wuEkmNNgzpyc5Lq2bgJQQjU",  pct: 0.11,   usdDeal: null },
  { handle: "Vic",           wallet: "3jJuCoWBdAu5pULXPuzXn8gYsGk5jifqVApRLDvjUKWB",  pct: 0.1048, usdDeal: 10000 },
  { handle: "Barbie",        wallet: "D68istiZpeSrCzMsJSWb46hRimqFTCP8xqHRtbfSm3Z4",  pct: 0.1,    usdDeal: 10000 },
  { handle: "Venom",         wallet: "G1hgGFq1FqcxrS36SUL67JJ8GivKWG5dx2e8u7eKFm6F",  pct: 0.075,  usdDeal: null },
  { handle: "CoachTY",       wallet: "5Rx84j9TqiFH2CgeQKP2pHKGPsK45PcXXiKdqPdQPRkR",  pct: 0.069,  usdDeal: 25000 },
  { handle: "Geppetto",      wallet: "EnrRj77ffuRc9MfY2GKygTSbpu8QyFT7VZdK1DHk3hhc",  pct: 0.059,  usdDeal: 10000 },
  { handle: "LogicJohn",     wallet: "Ga1r1RdUHyk1E4yJPVGHKF5QZ6FE2csWKJGNcBtS63Ff",  pct: 0.0551, usdDeal: 5000 },
  { handle: "Wulf",          wallet: "GzLUEPZHGUrfqPnPErtSiTjxrWUkZdw8tcQoJTQKN2zx",  pct: 0.05,   usdDeal: null },
  { handle: "Blackbeard",    wallet: "6pADY44tK88735dyK6AzAUu2dpracC7h4RPTHbM727CL",  pct: 0.05,   usdDeal: null },
  { handle: "Altstein",      wallet: "Faq1T2prNfydMMauFrZsKyztLa9wEzgVwy9kFjhW4igK",  pct: 0.035,  usdDeal: null },
  { handle: "Rivercrypto",   wallet: "ChnMUy4pjXw29mxPTEpGctRwa7Qd3udRFfPnNNwmV86E",  pct: 0.0326, usdDeal: 7500 },
  { handle: "Rocco",         wallet: "2huX5X9iSeksX2vS6C5jdA5doLm2B6PykeMqqbMZq2Xu",  pct: 0.0275, usdDeal: 5000 },
  { handle: "Fiend",         wallet: "3hJcP4wbPo6NjPcM8bMoTJTX8NavuqfNPP4mNsWznZpW",  pct: 0.0275, usdDeal: 3000 },
  { handle: "Hardy",         wallet: "CwtBn2B5Ky8XJiyxFfvjRitsnc97M6BXmHzWpnXaU6J8",  pct: 0.025,  usdDeal: null },
  { handle: "Meraki",        wallet: "FvYFDc1JYiG9574dyQtr9H8jv95YFP7tKPmbWCReJSEP",  pct: 0.0125, usdDeal: 20000 },
  { handle: "SolanaRockets", wallet: "3XAcxTSiw5twRudMFhG7Mmg6h5hGxyB7jjwKVW4Nh4BT",  pct: 0,      usdDeal: null },
];

const ARKHAM_KNOWN = [
  {
    handle: "EduRio",
    wallets: ["GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66", "EBLZB5QA9QPFwUgtDcUHeWqRptc6q5ywLk4Dk1GhWA2M"],
    totalUsd: 347237,
    cex: "MEXC",
    note: "Arkham confirme. $187K wallet 1 + $160K wallet 2. Liquidation jan-fev 2025.",
  },
  {
    handle: "ElonTrades",
    wallets: ["BN5edYKL6tV4ZsTKqJGJBmHjrxW4seK6i5sXSG3fGKwX"],
    totalUsd: 53313,
    cex: "MEXC",
    note: "Arkham @ElonTrades. $27,507 BOTIFY to MEXC (F9XGz) en 1 TX. Lie BQ72 (reseau BK famille).",
  },
  {
    handle: "MoneyLord",
    wallets: ["7QquANyvZgpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJ"],
    totalUsd: 85484,
    cex: "Bybit",
    note: "Arkham @MoneyLord. $48,117 Bybit en 1 journee (27 fev 2025). SOL $28K + USDC $19K.",
  },
];

const CEX_NAME_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /binance/i,     name: "Binance" },
  { re: /\bmexc\b/i,    name: "MEXC" },
  { re: /bybit/i,       name: "Bybit" },
  { re: /\bokx\b/i,     name: "OKX" },
  { re: /blofin/i,      name: "BloFin" },
  { re: /bitget/i,      name: "Bitget" },
  { re: /coinbase/i,    name: "Coinbase" },
  { re: /kraken/i,      name: "Kraken" },
  { re: /gate\.io/i,    name: "Gate.io" },
  { re: /kucoin/i,      name: "KuCoin" },
  { re: /fixedfloat/i,  name: "FixedFloat" },
  { re: /changenow/i,   name: "ChangeNOW" },
];

interface EnhancedTx {
  signature: string;
  timestamp: number;
  description?: string;
  type?: string;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    fromTokenAccount?: string;
    toTokenAccount?: string;
    mint?: string;
    tokenAmount?: number;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    amount?: number; // lamports
  }>;
  accountData?: Array<{ account: string; nativeBalanceChange?: number }>;
}

interface SellEvent {
  txHash: string;
  blockTime: number;
  amountTokens: number;
  solReceived: number;
  destAddrs: string[];
  cex: string | null;
  description: string;
}

async function fetchEnhancedTxs(wallet: string): Promise<EnhancedTx[]> {
  const url =
    "https://api.helius.xyz/v0/addresses/" +
    encodeURIComponent(wallet) +
    "/transactions?api-key=" +
    encodeURIComponent(HELIUS_KEY ?? "") +
    "&limit=100";
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("helius_" + res.status);
  const json = (await res.json()) as EnhancedTx[];
  return Array.isArray(json) ? json : [];
}

function identifyCex(description: string, destAddrs: string[]): string | null {
  const hay = (description + " " + destAddrs.join(" ")).trim();
  if (!hay) return null;
  for (const p of CEX_NAME_PATTERNS) {
    if (p.re.test(hay)) return p.name;
  }
  return null;
}

function extractSellEvents(wallet: string, txs: EnhancedTx[]): SellEvent[] {
  const events: SellEvent[] = [];
  for (const tx of txs) {
    const outs = (tx.tokenTransfers ?? []).filter(
      (t) => t.mint === BOTIFY_MINT && t.fromUserAccount === wallet
    );
    if (outs.length === 0) continue;
    const amountTokens = outs.reduce((s, t) => s + (t.tokenAmount ?? 0), 0);
    if (amountTokens <= 0) continue;

    // SOL received: native inflow to wallet, minus outflow
    const nativeIn = (tx.nativeTransfers ?? [])
      .filter((n) => n.toUserAccount === wallet)
      .reduce((s, n) => s + (n.amount ?? 0), 0);
    const nativeOut = (tx.nativeTransfers ?? [])
      .filter((n) => n.fromUserAccount === wallet)
      .reduce((s, n) => s + (n.amount ?? 0), 0);
    const solReceived = Math.max(0, (nativeIn - nativeOut) / 1e9);

    const destAddrs = Array.from(
      new Set(outs.map((t) => t.toUserAccount).filter(Boolean) as string[])
    );
    const cex = identifyCex(tx.description ?? "", destAddrs);

    events.push({
      txHash: tx.signature,
      blockTime: tx.timestamp,
      amountTokens,
      solReceived,
      destAddrs,
      cex,
      description: (tx.description ?? "").slice(0, 200),
    });
  }
  return events;
}

async function upsertKol(
  handle: string,
  opts: { pct?: number; usdDeal?: number | null; internalNote: string },
): Promise<void> {
  await prisma.kolProfile.upsert({
    where: { handle },
    update: { internalNote: opts.internalNote },
    create: {
      handle,
      platform: "x",
      tier: "HIGH",
      publishStatus: "draft",
      label: "kol",
      riskFlag: "paid-promo",
      internalNote: opts.internalNote,
    },
  });
}

async function upsertKolWallet(
  handle: string,
  address: string,
  label: string,
): Promise<void> {
  const existing = await prisma.kolWallet.findFirst({
    where: { kolHandle: handle, address, chain: "SOL" },
  });
  if (existing) return;
  await prisma.kolWallet.create({
    data: {
      kolHandle: handle,
      address,
      chain: "SOL",
      label,
      claimType: "verified_onchain",
      sourceLabel: "BOTIFY internal document — mariaqueennft",
      confidence: "high",
      attributionStatus: "approved",
    },
  });
}

async function insertProceedsEvent(params: {
  handle: string;
  walletAddress: string;
  txHash: string;
  eventDate: string;
  amountTokens: number;
  amountUsd: number | null;
  priceUsdAtTime: number | null;
  pricingSource: string;
  eventType: string;
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    'INSERT INTO "KolProceedsEvent" (id, "kolHandle", "walletAddress", chain, "txHash", "eventDate", "tokenSymbol", "tokenAddress", "amountTokens", "amountUsd", "priceUsdAtTime", "pricingSource", "eventType", "ambiguous", "caseId") VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT ("txHash") DO NOTHING',
    params.handle,
    params.walletAddress,
    "SOL",
    params.txHash,
    params.eventDate,
    "BOTIFY",
    BOTIFY_MINT,
    params.amountTokens,
    params.amountUsd,
    params.priceUsdAtTime,
    params.pricingSource,
    params.eventType,
    false,
    null,
  );
}

type ReportRow = {
  handle: string;
  wallet: string;
  txCount: number;
  totalUsdCashout: number;
  cexIdentified: string[];
  status: "active" | "no_activity" | "error" | "arkham_seed";
  error?: string;
  pct?: number;
  usdDeal?: number | null;
};

async function scanLiveKol(kol: KolEntry): Promise<ReportRow> {
  try {
    const txs = await fetchEnhancedTxs(kol.wallet);
    const events = extractSellEvents(kol.wallet, txs);
    const walletUsd = events.reduce(
      (s, e) => s + e.solReceived * SOL_PRICE_ESTIMATE,
      0,
    );
    const cexList = Array.from(
      new Set(events.map((e) => e.cex).filter((x): x is string => x !== null)),
    );

    if (!DRY_RUN && events.length > 0) {
      await upsertKol(kol.handle, {
        internalNote:
          "BOTIFY KOL " +
          (kol.pct * 100).toFixed(2) +
          "% allocation. USD deal: " +
          (kol.usdDeal ?? "unknown") +
          ". Source: BOTIFY internal doc IMG_0647 — mariaqueennft.",
      });
      await upsertKolWallet(
        kol.handle,
        kol.wallet,
        "BOTIFY KOL allocation " + (kol.pct * 100).toFixed(2) + "% — doc interne IMG_0647",
      );

      for (const ev of events) {
        const usd = ev.solReceived * SOL_PRICE_ESTIMATE;
        const price = ev.amountTokens > 0 && usd > 0 ? usd / ev.amountTokens : null;
        const eventDate = new Date((ev.blockTime ?? 0) * 1000).toISOString();
        await insertProceedsEvent({
          handle: kol.handle,
          walletAddress: kol.wallet,
          txHash: ev.txHash,
          eventDate,
          amountTokens: ev.amountTokens,
          amountUsd: usd > 0 ? parseFloat(usd.toFixed(2)) : null,
          priceUsdAtTime: price,
          pricingSource: "helius_sol_estimate_200usd",
          eventType: ev.cex ? "cex_deposit" : "dex_sell",
        });
      }
    }

    return {
      handle: kol.handle,
      wallet: kol.wallet,
      txCount: events.length,
      totalUsdCashout: Math.round(walletUsd),
      cexIdentified: cexList,
      status: events.length > 0 ? "active" : "no_activity",
      pct: kol.pct,
      usdDeal: kol.usdDeal,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      handle: kol.handle,
      wallet: kol.wallet,
      txCount: 0,
      totalUsdCashout: 0,
      cexIdentified: [],
      status: "error",
      error: message.slice(0, 200),
      pct: kol.pct,
      usdDeal: kol.usdDeal,
    };
  }
}

async function seedArkhamKnown(): Promise<ReportRow[]> {
  const rows: ReportRow[] = [];
  for (const ak of ARKHAM_KNOWN) {
    if (!DRY_RUN) {
      await upsertKol(ak.handle, {
        internalNote:
          "Arkham-confirmed BOTIFY cashout. Total $" +
          ak.totalUsd.toLocaleString("en-US") +
          " via " +
          ak.cex +
          ". " +
          ak.note,
      });
      for (const w of ak.wallets) {
        await upsertKolWallet(
          ak.handle,
          w,
          "BOTIFY KOL — Arkham confirmed (" + ak.cex + ")",
        );
      }
      // Summary proceeds event — deterministic txHash makes it idempotent.
      // First wallet carries the total. Not a real on-chain tx, flagged
      // via pricingSource=arkham_confirmed so downstream aggregators can
      // treat it as a manually-entered ground truth record.
      await insertProceedsEvent({
        handle: ak.handle,
        walletAddress: ak.wallets[0],
        txHash: "arkham-" + ak.handle.toLowerCase() + "-summary",
        eventDate: "2025-02-27T00:00:00.000Z",
        amountTokens: 0,
        amountUsd: ak.totalUsd,
        priceUsdAtTime: null,
        pricingSource: "arkham_confirmed",
        eventType: "cex_deposit",
      });
    }
    rows.push({
      handle: ak.handle,
      wallet: ak.wallets.join(","),
      txCount: 1,
      totalUsdCashout: ak.totalUsd,
      cexIdentified: [ak.cex],
      status: "arkham_seed",
    });
  }
  return rows;
}

async function main() {
  console.log("[botify-scan] mode=" + (DRY_RUN ? "DRY-RUN" : "WRITE"));
  if (!HELIUS_KEY) {
    console.error("[botify-scan] HELIUS_API_KEY not set");
    process.exit(1);
  }

  const report: ReportRow[] = [];
  let totalUsd = 0;
  let i = 0;
  for (const kol of BOTIFY_KOL_WALLETS) {
    i++;
    process.stdout.write(
      "[" + i + "/" + BOTIFY_KOL_WALLETS.length + "] " + kol.handle + " ",
    );
    const row = await scanLiveKol(kol);
    const label =
      row.status === "active"
        ? "ACTIVE " + row.txCount + "tx $" + row.totalUsdCashout +
          (row.cexIdentified.length ? " [" + row.cexIdentified.join(",") + "]" : "")
        : row.status === "no_activity"
          ? "no_activity"
          : "ERROR " + (row.error ?? "");
    console.log(label);
    report.push(row);
    totalUsd += row.totalUsdCashout;
    await new Promise((r) => setTimeout(r, 100)); // gentle Helius pacing
  }

  console.log("[botify-scan] seeding 3 Arkham-known entries");
  const arkhamRows = await seedArkhamKnown();
  report.push(...arkhamRows);
  totalUsd += arkhamRows.reduce((s, r) => s + r.totalUsdCashout, 0);

  const reportObj = {
    scanDate: new Date().toISOString().slice(0, 10),
    mode: DRY_RUN ? "dry-run" : "write",
    totalKolsScanned: BOTIFY_KOL_WALLETS.length + ARKHAM_KNOWN.length,
    totalUsdDocumented: Math.round(totalUsd),
    solPriceEstimate: SOL_PRICE_ESTIMATE,
    kols: report,
  };

  const reportPath = path.resolve(process.cwd(), "BOTIFY_KOL_SCAN_REPORT.json");
  fs.writeFileSync(reportPath, JSON.stringify(reportObj, null, 2));
  console.log("[botify-scan] wrote " + reportPath);
  console.log(
    "[botify-scan] total USD documented: $" + Math.round(totalUsd).toLocaleString("en-US"),
  );
  console.log(
    "[botify-scan] active KOLs: " +
      report.filter((r) => r.status === "active").length +
      " / " +
      BOTIFY_KOL_WALLETS.length,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[botify-scan] fatal", err);
  process.exit(1);
});
