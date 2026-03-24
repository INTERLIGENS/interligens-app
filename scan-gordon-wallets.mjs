// scan-gordon-wallets.mjs
// Sprint 5 — Scan Helius des 3 wallets Gordon
// Cherche : cashout patterns, BOTIFY/GHOST transactions, liens avec BK cluster

import * as dotenv from "dotenv";
import * as fs from "fs";

if (fs.existsSync(".env.local")) { dotenv.config({ path: ".env.local" }); }
else { dotenv.config(); }

const HELIUS_KEY = process.env.HELIUS_API_KEY || process.env.HELIUS_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY;
if (!HELIUS_KEY) {
  console.error("❌ HELIUS_API_KEY non trouvé dans .env.local");
  process.exit(1);
}

const GORDON_WALLETS = {
  "Gordon_1": "Eu8i6rpMPXyg5NaEY23qEbFeMhrs953FdqxYxweXm24J",
  "Gordon_2": "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3",
  "Gordon_3": "3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6",
};

// Wallets BK cluster pour détection de liens
const BK_CLUSTER = [
  "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj", // Wallet A
  "HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz", // Wallet B
  "FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc", // Wallet C
  "CFEBsnVtB3qz9ano2nL9mVjmUu26EGDpoY9nGEAqRTqR", // Wallet D
  "HeaiDUtMQjt163afwV7zeAJhzDi16SsEGK1T4AyhqS4R", // Hub exit
  "1234CoNGEgHsyaQtWZbAeYRF9iw7WsiSrxvNZvL5RsHa", // Vanity
];

const TOKENS_OF_INTEREST = ["BOTIFY", "GHOST", "DIONE", "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb"];

async function getTransactions(address, label) {
  console.log(`\n── Scanning ${label} (${address.slice(0,8)}...) ──`);

  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_KEY}&limit=100&type=SWAP`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ❌ HTTP ${res.status}`);
      return null;
    }
    const txs = await res.json();
    console.log(`  → ${txs.length} transactions trouvées`);
    return txs;
  } catch(e) {
    console.error(`  ❌ Erreur: ${e.message}`);
    return null;
  }
}

async function getBalance(address) {
  const url = `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${HELIUS_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}

async function analyzeWallet(label, address) {
  const result = {
    label,
    address,
    solBalance: null,
    tokenBalances: [],
    totalTxs: 0,
    swapTxs: 0,
    botifyTxs: [],
    ghostTxs: [],
    bkClusterLinks: [],
    usdcMoved: 0,
    firstTx: null,
    lastTx: null,
    cashoutIndicators: [],
  };

  // Balance
  const balances = await getBalance(address);
  if (balances) {
    result.solBalance = balances.nativeBalance ? (balances.nativeBalance / 1e9).toFixed(4) : 0;
    result.tokenBalances = (balances.tokens || []).slice(0, 10).map(t => ({
      mint: t.mint,
      amount: t.amount,
      decimals: t.decimals,
    }));
  }

  // Transactions — all types
  const allUrl = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_KEY}&limit=100`;
  let allTxs = [];
  try {
    const res = await fetch(allUrl);
    if (res.ok) allTxs = await res.json();
  } catch(e) {}

  result.totalTxs = allTxs.length;
  if (allTxs.length > 0) {
    result.firstTx = new Date(allTxs[allTxs.length-1].timestamp * 1000).toISOString().slice(0,10);
    result.lastTx = new Date(allTxs[0].timestamp * 1000).toISOString().slice(0,10);
  }

  for (const tx of allTxs) {
    const desc = JSON.stringify(tx).toLowerCase();

    // BOTIFY detection
    if (desc.includes("byz9cc") || desc.includes("botify")) {
      result.botifyTxs.push({
        sig: tx.signature?.slice(0,20) + "...",
        date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
        type: tx.type,
      });
    }

    // GHOST detection
    if (desc.includes("ghost")) {
      result.ghostTxs.push({
        sig: tx.signature?.slice(0,20) + "...",
        date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
        type: tx.type,
      });
    }

    // BK cluster links
    for (const bkWallet of BK_CLUSTER) {
      if (desc.includes(bkWallet.toLowerCase().slice(0,12))) {
        result.bkClusterLinks.push({
          bkWallet: bkWallet.slice(0,12) + "...",
          sig: tx.signature?.slice(0,20) + "...",
          date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
        });
      }
    }

    // USDC moved
    if (tx.nativeTransfers) {
      for (const t of tx.nativeTransfers) {
        if (t.amount > 1000000) result.usdcMoved += t.amount / 1e9;
      }
    }
  }

  // Cashout indicators
  if (result.botifyTxs.length > 0) result.cashoutIndicators.push(`${result.botifyTxs.length} BOTIFY TX`);
  if (result.ghostTxs.length > 0) result.cashoutIndicators.push(`${result.ghostTxs.length} GHOST TX`);
  if (result.bkClusterLinks.length > 0) result.cashoutIndicators.push(`${result.bkClusterLinks.length} BK CLUSTER LINKS`);
  if (result.usdcMoved > 1000) result.cashoutIndicators.push(`${result.usdcMoved.toFixed(0)} SOL moved`);

  return result;
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log(" GORDON WALLETS — HELIUS SCAN");
  console.log("═══════════════════════════════════════");

  const results = [];

  for (const [label, address] of Object.entries(GORDON_WALLETS)) {
    const analysis = await analyzeWallet(label, address);
    results.push(analysis);

    console.log(`\n  SOL balance  : ${analysis.solBalance}`);
    console.log(`  Total TXs    : ${analysis.totalTxs}`);
    console.log(`  BOTIFY TXs   : ${analysis.botifyTxs.length}`);
    console.log(`  GHOST TXs    : ${analysis.ghostTxs.length}`);
    console.log(`  BK links     : ${analysis.bkClusterLinks.length}`);
    console.log(`  Indicators   : ${analysis.cashoutIndicators.join(" | ") || "none"}`);
    if (analysis.firstTx) console.log(`  Period       : ${analysis.firstTx} → ${analysis.lastTx}`);

    if (analysis.botifyTxs.length > 0) {
      console.log(`  BOTIFY sample:`);
      analysis.botifyTxs.slice(0,3).forEach(t => console.log(`    ${t.date} ${t.type} ${t.sig}`));
    }
    if (analysis.bkClusterLinks.length > 0) {
      console.log(`  BK links sample:`);
      analysis.bkClusterLinks.slice(0,3).forEach(t => console.log(`    ${t.date} → ${t.bkWallet} | ${t.sig}`));
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  // Save results
  fs.writeFileSync("gordon-scan-results.json", JSON.stringify(results, null, 2));
  console.log("\n✅ Résultats sauvegardés → gordon-scan-results.json");

  // Summary
  console.log("\n═══════════════════════════════════════");
  console.log(" SUMMARY");
  console.log("═══════════════════════════════════════");
  for (const r of results) {
    const flag = r.cashoutIndicators.length > 0 ? "🔴" : "⚪";
    console.log(`${flag} ${r.label}: ${r.cashoutIndicators.join(" | ") || "clean"}`);
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
