// scan-planted.mjs
// Sprint 5 — Scan Helius @planted (Djordje Stupar)
// Objectif : trouver wallets SOL, BOTIFY/GHOST activity, liens BK/Gordon

import * as dotenv from "dotenv";
import * as fs from "fs";
if (fs.existsSync(".env.local")) { dotenv.config({ path: ".env.local" }); }
else { dotenv.config(); }

const KEY = process.env.HELIUS_API_KEY;
if (!KEY) { console.error("❌ HELIUS_API_KEY manquant"); process.exit(1); }

// Wallets connus du réseau pour cross-ref
const NETWORK_WALLETS = {
  // BK cluster
  "Wallet_A_BK": "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj",
  "Wallet_B_BK": "HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz",
  "Wallet_C_BK": "FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc",
  "Hub_Exit":    "HeaiDUtMQjt163afwV7zeAJhzDi16SsEGK1T4AyhqS4R",
  // Gordon
  "Gordon_1":    "Eu8i6rpMPXyg5NaEY23qEbFeMhrs953FdqxYxweXm24J",
  "Gordon_2":    "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3",
  "Gordon_3":    "3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6",
};

const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";

// Planted EVM = 0x — on cherche via Arkham ou cross-ref
// On cherche les wallets SOL via l'API Helius enhanced transactions

async function searchPlantedWallets() {
  console.log("════════════════════════════════════════");
  console.log(" @PLANTED (Djordje Stupar) — WALLET HUNT");
  console.log("════════════════════════════════════════\n");

  // Stratégie 1 : chercher via token BOTIFY — qui a tradé BOTIFY ?
  // Helius token holders
  console.log("── Stratégie 1 : BOTIFY token — top holders ──");
  const holdersUrl = `https://api.helius.xyz/v0/token-metadata?api-key=${KEY}`;

  // Get BOTIFY holders via DAS
  const dasUrl = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;
  try {
    const res = await fetch(dasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenLargestAccounts",
        params: [BOTIFY_MINT],
      }),
    });
    const data = await res.json();
    if (data.result?.value) {
      console.log(`  → ${data.result.value.length} top holders BOTIFY:`);
      data.result.value.slice(0, 10).forEach((h, i) => {
        console.log(`    ${i+1}. ${h.address.slice(0,16)}... — ${h.uiAmount?.toFixed(0) || h.amount} tokens`);
      });
    }
  } catch(e) {
    console.log("  ⚠️  getTokenLargestAccounts:", e.message);
  }

  await new Promise(r => setTimeout(r, 500));

  // Stratégie 2 : chercher via X handle "planted" dans les metadata
  // Scan des wallets qui ont interagi avec Gordon_1 et Hub_Exit
  console.log("\n── Stratégie 2 : wallets ayant interagi avec Hub_Exit ──");
  const hubUrl = `https://api.helius.xyz/v0/addresses/${NETWORK_WALLETS.Hub_Exit}/transactions?api-key=${KEY}&limit=100`;

  try {
    const res = await fetch(hubUrl);
    const txs = await res.json();
    console.log(`  → ${txs.length} TXs sur Hub_Exit`);

    const uniqueSenders = new Set();
    for (const tx of txs) {
      if (tx.nativeTransfers) {
        for (const t of tx.nativeTransfers) {
          if (t.toUserAccount === NETWORK_WALLETS.Hub_Exit) {
            uniqueSenders.add(t.fromUserAccount);
          }
        }
      }
      if (tx.tokenTransfers) {
        for (const t of tx.tokenTransfers) {
          if (t.toUserAccount === NETWORK_WALLETS.Hub_Exit) {
            uniqueSenders.add(t.fromUserAccount);
          }
        }
      }
    }

    console.log(`  → ${uniqueSenders.size} expéditeurs uniques vers Hub_Exit`);
    const senderList = [...uniqueSenders].slice(0, 20);
    senderList.forEach(s => console.log(`    ${s}`));

    // Check si un de ces senders est dans notre réseau
    for (const sender of uniqueSenders) {
      for (const [label, addr] of Object.entries(NETWORK_WALLETS)) {
        if (sender === addr) {
          console.log(`  🔴 MATCH: ${sender.slice(0,16)}... = ${label}`);
        }
      }
    }

  } catch(e) {
    console.log("  ⚠️  Hub_Exit scan:", e.message);
  }

  await new Promise(r => setTimeout(r, 500));

  // Stratégie 3 : scan Gordon_2 — qui lui a envoyé des fonds ?
  console.log("\n── Stratégie 3 : funding sources de Gordon_2 ──");
  const g2Url = `https://api.helius.xyz/v0/addresses/${NETWORK_WALLETS.Gordon_2}/transactions?api-key=${KEY}&limit=100`;

  try {
    const res = await fetch(g2Url);
    const txs = await res.json();

    const incomingFunds = [];
    for (const tx of txs) {
      if (tx.nativeTransfers) {
        for (const t of tx.nativeTransfers) {
          if (t.toUserAccount === NETWORK_WALLETS.Gordon_2 && t.amount > 1000000000) {
            incomingFunds.push({
              from: t.fromUserAccount,
              sol: (t.amount/1e9).toFixed(2),
              date: new Date(tx.timestamp * 1000).toISOString().slice(0,10),
              sig: tx.signature?.slice(0,20) + "...",
            });
          }
        }
      }
    }

    if (incomingFunds.length > 0) {
      console.log(`  → ${incomingFunds.length} transferts entrants >1 SOL:`);
      incomingFunds.slice(0,10).forEach(f => {
        const isKnown = Object.entries(NETWORK_WALLETS).find(([,a]) => a === f.from);
        const tag = isKnown ? ` 🔴 ${isKnown[0]}` : "";
        console.log(`    ${f.date}  ${f.sol} SOL  ← ${f.from.slice(0,16)}...${tag}  [${f.sig}]`);
      });
    } else {
      console.log("  → Aucun transfert entrant >1 SOL trouvé dans les 100 dernières TXs");
    }

  } catch(e) {
    console.log("  ⚠️  Gordon_2 funding:", e.message);
  }

  // Stratégie 4 : search BOTIFY swappers via enhanced tx
  console.log("\n── Stratégie 4 : BOTIFY recent swappers ──");
  const botifyUrl = `https://api.helius.xyz/v0/addresses/${BOTIFY_MINT}/transactions?api-key=${KEY}&limit=50&type=SWAP`;
  try {
    const res = await fetch(botifyUrl);
    const txs = await res.json();
    console.log(`  → ${txs.length} BOTIFY SWAP TXs récentes`);

    const swappers = new Set();
    for (const tx of txs) {
      if (tx.feePayer) swappers.add(tx.feePayer);
    }
    console.log(`  → ${swappers.size} swappers uniques`);
    [...swappers].slice(0,10).forEach(s => {
      const isKnown = Object.entries(NETWORK_WALLETS).find(([,a]) => a === s);
      const tag = isKnown ? ` 🔴 ${isKnown[0]}` : "";
      console.log(`    ${s.slice(0,20)}...${tag}`);
    });
  } catch(e) {
    console.log("  ⚠️  BOTIFY swappers:", e.message);
  }

  console.log("\n✅ Scan @planted terminé");
  console.log("→ Pour identifier le wallet SOL de @planted, vérifier manuellement:");
  console.log("  1. Son profil X pour wallet mentionné dans bio/posts");
  console.log("  2. Ses posts autour de BOTIFY (Avr-Mai 2025) pour adresse");
  console.log("  3. Cross-ref avec liste @dethective TIER 1 KOL wallets");
}

searchPlantedWallets().catch(e => { console.error("❌", e.message); process.exit(1); });
