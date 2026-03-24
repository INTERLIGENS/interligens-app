// scan-gordon-deep.mjs
// Sprint 5 — Deep scan Gordon wallets
// 1. Gordon_1 : tracer destination des 1441 SOL
// 2. Gordon 2/3 : scan ALL types pour BOTIFY/GHOST

import * as dotenv from "dotenv";
import * as fs from "fs";

if (fs.existsSync(".env.local")) { dotenv.config({ path: ".env.local" }); }
else { dotenv.config(); }

const KEY = process.env.HELIUS_API_KEY;
if (!KEY) { console.error("❌ HELIUS_API_KEY manquant"); process.exit(1); }

const WALLETS = {
  Gordon_1: "Eu8i6rpMPXyg5NaEY23qEbFeMhrs953FdqxYxweXm24J",
  Gordon_2: "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3",
  Gordon_3: "3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6",
};

const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";
const BK_CLUSTER = [
  "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj",
  "HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz",
  "FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc",
  "CFEBsnVtB3qz9ano2nL9mVjmUu26EGDpoY9nGEAqRTqR",
  "HeaiDUtMQjt163afwV7zeAJhzDi16SsEGK1T4AyhqS4R",
  "1234CoNGEgHsyaQtWZbAeYRF9iw7WsiSrxvNZvL5RsHa",
  "HRuLzZ",
];

// Known CEX deposit patterns
const KNOWN_CEX = {
  "D5YqVMoSxnqeZAKAUUE1Dm3bmjtdxQ5DCF356ozqN9cM": "TITAN EXCHANGE",
  "ET3F3q42vUpfDHW8rgrhA1S2WPwb6Fhx97fsLR3EkxSn": "UNKNOWN CEX (ET3F)",
};

async function fetchTxs(address, limit = 100, before = null) {
  let url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${KEY}&limit=${limit}`;
  if (before) url += `&before=${before}`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`HTTP ${res.status}`); return []; }
  return res.json();
}

async function fetchAllTxs(address, maxPages = 3) {
  let all = [];
  let before = null;
  for (let i = 0; i < maxPages; i++) {
    const batch = await fetchTxs(address, 100, before);
    if (!batch.length) break;
    all = all.concat(batch);
    before = batch[batch.length - 1].signature;
    await new Promise(r => setTimeout(r, 400));
  }
  return all;
}

// ─── GORDON 1 : trace des 1441 SOL ───────────────────────────
async function traceGordon1() {
  console.log("\n════════════════════════════════════════");
  console.log(" GORDON_1 — TRACE 1441 SOL");
  console.log(" Eu8i6rpMPXyg...Xm24J");
  console.log("════════════════════════════════════════");

  const txs = await fetchAllTxs(WALLETS.Gordon_1, 3);
  console.log(`→ ${txs.length} TXs chargées\n`);

  const destinations = {};
  const largeTransfers = [];
  let totalSolOut = 0;

  for (const tx of txs) {
    // Native transfers (SOL)
    if (tx.nativeTransfers) {
      for (const t of tx.nativeTransfers) {
        if (t.fromUserAccount === WALLETS.Gordon_1 && t.amount > 100000000) { // > 0.1 SOL
          const solAmt = t.amount / 1e9;
          totalSolOut += solAmt;
          const dest = t.toUserAccount;
          destinations[dest] = (destinations[dest] || 0) + solAmt;

          if (solAmt > 10) {
            largeTransfers.push({
              dest: dest,
              sol: solAmt.toFixed(2),
              date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
              sig: tx.signature?.slice(0,20) + "...",
              cex: KNOWN_CEX[dest] || null,
              bkLink: BK_CLUSTER.some(bk => dest.startsWith(bk.slice(0,8))) ? "BK CLUSTER" : null,
            });
          }
        }
      }
    }

    // Token transfers
    if (tx.tokenTransfers) {
      for (const t of tx.tokenTransfers) {
        if (t.fromUserAccount === WALLETS.Gordon_1) {
          const desc = JSON.stringify(t);
          if (desc.includes(BOTIFY_MINT) || desc.toLowerCase().includes("botify")) {
            console.log(`  🔴 BOTIFY TX: ${new Date(tx.timestamp * 1000).toISOString().slice(0,10)} → ${t.toUserAccount?.slice(0,12)}...`);
          }
        }
      }
    }
  }

  // Top destinations
  const sortedDests = Object.entries(destinations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log(`Total SOL sortant: ${totalSolOut.toFixed(2)} SOL\n`);
  console.log("Top destinations:");
  for (const [addr, sol] of sortedDests) {
    const cex = KNOWN_CEX[addr];
    const bk = BK_CLUSTER.some(b => addr.startsWith(b.slice(0,6)));
    const tag = cex ? `🏦 ${cex}` : bk ? "🔴 BK CLUSTER" : "";
    console.log(`  ${addr.slice(0,16)}...  ${sol.toFixed(2)} SOL  ${tag}`);
  }

  console.log("\nLarge transfers (>10 SOL):");
  for (const t of largeTransfers.sort((a,b) => parseFloat(b.sol) - parseFloat(a.sol))) {
    const tag = t.cex ? `🏦 ${t.cex}` : t.bkLink ? `🔴 ${t.bkLink}` : "";
    console.log(`  ${t.date}  ${t.sol} SOL → ${t.dest.slice(0,16)}...  ${tag}  [${t.sig}]`);
  }

  // Solscan links for top 5
  console.log("\nSolscan — top destinations:");
  for (const [addr] of sortedDests.slice(0,5)) {
    console.log(`  https://solscan.io/account/${addr}`);
  }

  return { totalSolOut, largeTransfers, sortedDests };
}

// ─── GORDON 2/3 : scan BOTIFY/GHOST ──────────────────────────
async function scanGordon23() {
  console.log("\n════════════════════════════════════════");
  console.log(" GORDON 2/3 — BOTIFY/GHOST SCAN");
  console.log("════════════════════════════════════════");

  for (const [label, address] of [["Gordon_2", WALLETS.Gordon_2], ["Gordon_3", WALLETS.Gordon_3]]) {
    console.log(`\n── ${label} (${address.slice(0,12)}...) ──`);
    const txs = await fetchAllTxs(address, 3);
    console.log(`→ ${txs.length} TXs chargées`);

    const botifyTxs = [];
    const ghostTxs = [];
    const bkLinks = [];
    const tokenActivity = {};

    for (const tx of txs) {
      const raw = JSON.stringify(tx).toLowerCase();

      // BOTIFY
      if (raw.includes("byz9cc") || raw.includes("botify")) {
        botifyTxs.push({
          date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
          type: tx.type,
          sig: tx.signature?.slice(0,24) + "...",
          description: tx.description?.slice(0,80),
        });
      }

      // GHOST (various mints)
      if (raw.includes("ghost")) {
        ghostTxs.push({
          date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
          type: tx.type,
          sig: tx.signature?.slice(0,24) + "...",
        });
      }

      // BK cluster links
      for (const bk of BK_CLUSTER) {
        if (raw.includes(bk.toLowerCase().slice(0,10))) {
          bkLinks.push({
            bkWallet: bk.slice(0,12) + "...",
            date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
            sig: tx.signature?.slice(0,24) + "...",
          });
        }
      }

      // Token activity
      if (tx.tokenTransfers) {
        for (const t of tx.tokenTransfers) {
          const mint = t.mint?.slice(0,8) || "unknown";
          tokenActivity[mint] = (tokenActivity[mint] || 0) + 1;
        }
      }
    }

    console.log(`  BOTIFY TXs : ${botifyTxs.length}`);
    if (botifyTxs.length > 0) {
      botifyTxs.slice(0,5).forEach(t => console.log(`    🔴 ${t.date} [${t.type}] ${t.sig}`));
      if (botifyTxs[0]?.description) console.log(`    desc: ${botifyTxs[0].description}`);
    }

    console.log(`  GHOST TXs  : ${ghostTxs.length}`);
    if (ghostTxs.length > 0) {
      ghostTxs.slice(0,5).forEach(t => console.log(`    🔴 ${t.date} [${t.type}] ${t.sig}`));
    }

    console.log(`  BK links   : ${bkLinks.length}`);
    if (bkLinks.length > 0) {
      bkLinks.slice(0,3).forEach(t => console.log(`    🔴 ${t.date} → ${t.bkWallet} | ${t.sig}`));
    }

    const topTokens = Object.entries(tokenActivity).sort((a,b) => b[1]-a[1]).slice(0,5);
    if (topTokens.length > 0) {
      console.log(`  Top tokens:`);
      topTokens.forEach(([mint, count]) => console.log(`    ${mint}... × ${count}`));
    }

    // Period
    if (txs.length > 0) {
      const first = new Date(txs[txs.length-1].timestamp * 1000).toISOString().slice(0,10);
      const last = new Date(txs[0].timestamp * 1000).toISOString().slice(0,10);
      console.log(`  Period: ${first} → ${last}`);
    }
  }
}

async function main() {
  const g1 = await traceGordon1();
  await scanGordon23();

  // Save full results
  fs.writeFileSync("gordon-deep-scan.json", JSON.stringify({
    gordon1: g1,
    scannedAt: new Date().toISOString(),
  }, null, 2));

  console.log("\n✅ Résultats sauvegardés → gordon-deep-scan.json");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
