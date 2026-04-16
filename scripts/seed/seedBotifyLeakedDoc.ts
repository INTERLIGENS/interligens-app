/**
 * scripts/seed/seedBotifyLeakedDoc.ts
 *
 * Comprehensive seed from BOTIFY leaked document (15 pages).
 * Tasks: Myrrha profile, 13 KOLs, 12 employees, 9 KolEvidence, OOP treasury.
 *
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/seed/seedBotifyLeakedDoc.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertProfile(handle: string, data: Record<string, unknown>) {
  const existing = await prisma.kolProfile.findUnique({ where: { handle } });
  if (!existing) {
    await prisma.kolProfile.create({ data: { handle, ...data } as never });
    return "CREATED";
  }
  await prisma.kolProfile.update({ where: { handle }, data: data as never });
  return "updated";
}

async function upsertWallet(kolHandle: string, address: string, data: Record<string, unknown>) {
  const existing = await prisma.kolWallet.findFirst({ where: { kolHandle, address } });
  if (existing) return "exists";
  await prisma.kolWallet.create({ data: { kolHandle, address, ...data } as never });
  return "CREATED";
}

async function createEvidence(kolHandle: string, data: Record<string, unknown>) {
  await prisma.kolEvidence.create({ data: { kolHandle, ...data } as never });
  return "CREATED";
}

async function main() {
  let profilesCreated = 0, walletsCreated = 0, evidenceCreated = 0;

  // ═══ TASK 1: Myrrha Market Maker ═══
  console.log("\n=== TASK 1: Myrrha Market Maker ===");
  const myrrhaStatus = await upsertProfile("Myrrha", {
    displayName: "Myrrha / Market Maker BOTIFY",
    platform: "x",
    status: "active",
    riskFlag: "confirmed",
    label: "market_maker_fraud",
    publishStatus: "draft",
    notes: "Market maker professionnel payé $17,250 (3 mois) + $5,000 (Artis) par BOTIFY pour créer du volume artificiel via bloXroute MEV Raydium. ~90 wallets coordonnés. 1,000 SOL de dotation initiale confirmée on-chain. TX contrat : eUoN9HRBYZ8Ai3ZRF5QAgRW8RfCKNUgYDceP6DjeJGRzTQrnUgqpNNdiPC7sdxoT34BFz1jqCWj64LhJjWnfjdX",
  });
  console.log(`  Myrrha profile: ${myrrhaStatus}`);
  if (myrrhaStatus === "CREATED") profilesCreated++;

  const mainMW = await upsertWallet("Myrrha", "5aMV3SpwUN29JujLD1nTBgcgL5DULmDA9L1xGsE6zUoX", {
    chain: "SOL",
    label: "Myrrha MM principal — wash trading BOTIFY",
    attributionSource: "botify_leaked_doc",
    attributionStatus: "confirmed",
    isPubliclyUsable: true,
    confidence: "high",
  });
  console.log(`  Myrrha main wallet: ${mainMW}`);
  if (mainMW === "CREATED") walletsCreated++;

  // ═══ TASK 2: KOLs manquants ═══
  console.log("\n=== TASK 2: 13 KOLs manquants ===");
  const kols: Array<{ handle: string; displayName?: string; pct: number; dealCash?: string; wallet: string; txHash?: string }> = [
    { handle: "ktrades", displayName: "ktrades / NCScalls", pct: 0, dealCash: "35 SOL", wallet: "5BdLZq1Cw3FpSrrRXof7oCW4yL2juueb7vtgZSQFsgX9" },
    { handle: "Visionary", pct: 0.1, wallet: "HMsLgBn7B2Rhw3MXWdtT2YiPj46qAgVqdhXn6nYi7KGL" },
    { handle: "TigerZ", pct: 0.0217, dealCash: "$5,000 one time", wallet: "BCmNsVBD1vqhcUmx6K3Tk9jvKrB3Vp57jupvxqqyqeD1" },
    { handle: "CryptoWithLeo", pct: 0.0776, dealCash: "$10,000 one time", wallet: "ELspHtLvG4UprrMuqczoVds5dbgZbfNgdXrXEdKbuBwV" },
    { handle: "JonMelillo", displayName: "Jon Melillo", pct: 0.01875, dealCash: "$3,500 one time", wallet: "D3asJi3hnaXxS8Yj6c9un6rHMKqHmzT3ZeevvnxYL6YA" },
    { handle: "BitcoinBaby", pct: 0.0075, dealCash: "$2,000", wallet: "5SsvDHqPBJEUti6X2BRdoNYrL6MQSuTFW5QtuqdLa2Ln" },
    { handle: "NickRose", displayName: "Nick Rose", pct: 0.0181, dealCash: "$5,000 one time", wallet: "6wkrhV46fbELzh7cuGNdi8zByM2ySDK7FViamt91b5qS" },
    { handle: "sneaky", pct: 0.0517, dealCash: "25 SOL", wallet: "GUQZD145qsxSD1S4zPZLH5gCjQqYyvN6jZfZrj6DPAPv" },
    { handle: "CryptoChaos", pct: 0.0172, dealCash: "$1,500", wallet: "CpyUYYe2x2hB96V97gHJRUYsP2Xjgz6E68fbxNwKYR6L" },
    { handle: "SolFace", pct: 0.0151, dealCash: "$2,500", wallet: "7g848YH3i9XpsEWp4S3f6mvQ1je3pgtZsNrRSvhfVmxi" },
    { handle: "Assetdash", pct: 0.016, wallet: "FuqZn1ttMkiBx2GV6noNaADvGD3spK84U2rZJfANk2xr" },
    { handle: "BlockchainCrusader", pct: 0.0069, dealCash: "$4,000 one time", wallet: "E6AeYFA6n7ZdamxtuJtKoZUuMVfqs9DveQsTraRXnCqM" },
    { handle: "Cryptopizzagirl", pct: 0.0163, dealCash: "$3,500 one time", wallet: "D5dnpjGBB5HvBfRoVMUoP79hKx3Y47ihd5c8K2mduYL1" },
  ];

  for (const k of kols) {
    const ps = await upsertProfile(k.handle, {
      displayName: k.displayName || k.handle,
      platform: "x",
      label: "botify_kol",
      riskFlag: "flagged",
      publishStatus: "draft",
      notes: `BOTIFY KOL — ${k.pct}% allocation${k.dealCash ? ` + ${k.dealCash} cash` : ""}. Source: leaked doc.`,
    });
    if (ps === "CREATED") profilesCreated++;

    const ws = await upsertWallet(k.handle, k.wallet, {
      chain: "SOL",
      label: `[LEAKED DOC] BOTIFY KOL — ${k.pct}%${k.dealCash ? ` + ${k.dealCash}` : ""}`,
      attributionSource: "botify_leaked_doc",
      attributionStatus: "confirmed",
      isPubliclyUsable: true,
      confidence: "high",
    });
    if (ws === "CREATED") walletsCreated++;
    console.log(`  ${k.handle}: profile=${ps}, wallet=${ws}`);
  }

  // Zebec OTC partner
  const zebecPs = await upsertProfile("Zebec", {
    displayName: "Zebec (OTC partner)",
    platform: "x",
    label: "botify_otc",
    riskFlag: "flagged",
    publishStatus: "draft",
    notes: "BOTIFY OTC partner — 0.24% allocation — $20,000 invested. Source: leaked doc.",
  });
  if (zebecPs === "CREATED") profilesCreated++;
  const zebecWs = await upsertWallet("Zebec", "FJ9FkByHs3AobVPQxmy5NxJT4Ez2yoa8eXFP62uF3nx6", {
    chain: "SOL",
    label: "[LEAKED DOC] BOTIFY OTC — 0.24% — $20,000 invested",
    attributionSource: "botify_leaked_doc",
    attributionStatus: "confirmed",
    confidence: "high",
  });
  if (zebecWs === "CREATED") walletsCreated++;
  console.log(`  Zebec: profile=${zebecPs}, wallet=${zebecWs}`);

  // ═══ TASK 3: Employés BOTIFY ═══
  console.log("\n=== TASK 3: 12 employés ===");
  const employees: Array<{ name: string; role: string; wallet: string; salary: string }> = [
    { name: "Salman", role: "AI Engineer", wallet: "4rNC3BDSkx2C8rvKbC3XQSbgo62E7M7NRFpzCNPkjTSz", salary: "$450/week" },
    { name: "Aun", role: "AI Engineer", wallet: "29Dhno6QtP5WGKc9nDpw9YArNckRqBxHoY7iART1eiNX", salary: "$500/week" },
    { name: "Shah", role: "Blockchain Dev", wallet: "8PFwyevY7JasqQ1BGRmg2GEwzsNAZiucCBut1AmeTRfJ", salary: "$500/week" },
    { name: "Samad", role: "PM", wallet: "DF7vhibpXBwESfhrUDbF3XdCAaGvQpn6sJ2SJNHhkjH1", salary: "$375/week" },
    { name: "Naveed", role: "Blockchain Dev", wallet: "GjdATkqyJYugYNsZTqibW9jpDVsXDt5ABVp3vyGuRQrg", salary: "$500/week" },
    { name: "Qayoom", role: "QA Engineer", wallet: "AU32HUXdRLso7mzdtXkh2tYhifrzTc13dXjuAxDdevmF", salary: "$450/week" },
    { name: "Dania", role: "Frontend Dev", wallet: "9cC8DDr3rEDRU7SLxbW1NucwYyFDqZdfaQQXiAVtbZXS", salary: "$350/week" },
    { name: "Moazzam", role: "Frontend Dev", wallet: "5PG46CR5mt7zmZJF4FhLxnFUYHLEVXu46kojYWrhVhSf", salary: "$350/week" },
    { name: "Mohamed", role: "Data Scientist", wallet: "64mYcePmuPvoaztgXR2A3cYDftBnCfhHPtHqyz8qXzPw", salary: "$500/week" },
    { name: "Atif", role: "DevOps", wallet: "Fz1ueabAUJN83T8iStXPB59CB93c92E4Rz3wD73QDo2Y", salary: "$500/week" },
    { name: "Paul", role: "Sr AI Engineer", wallet: "A6eCkm8emZyFzGgsTYDRoFrR2bPZ5v1279MykE6T8M6C", salary: "$2,800/week" },
    { name: "Armel", role: "Sr AI Engineer", wallet: "zy82a6KmP3LLXpJF33KCDnzYfGtXi6viMwF9UfDGig5", salary: "$3,200/week" },
  ];

  for (const e of employees) {
    const ws = await upsertWallet("bkokoski", e.wallet, {
      chain: "SOL",
      label: `[LEAKED DOC] BOTIFY payroll — ${e.name} — ${e.role} — ${e.salary}`,
      attributionSource: "botify_leaked_doc",
      attributionStatus: "confirmed",
      isPubliclyUsable: true,
      confidence: "high",
    });
    if (ws === "CREATED") walletsCreated++;
    console.log(`  ${e.name} (${e.role}): wallet=${ws}`);
  }

  // ═══ TASK 4: 9 KolEvidence critiques ═══
  console.log("\n=== TASK 4: 9 KolEvidence ===");
  const evidences: Array<{ kolHandle: string; type: string; label: string; description: string; sourceUrl?: string; amountUsd?: number; rawJson?: string }> = [
    { kolHandle: "bkokoski", type: "fund_movement", label: "Bridge ETH $190,600", description: "BK bridge $190,600 USDT Solana→Ethereum via Gate — blanchiment cross-chain prouvé", sourceUrl: "https://solscan.io/tx/2dN1JBuV3nezLYC76qE6vTReRC7TiqTZDiYqr2KQdHNb4d7hmUNARZHjPi8FzkvVwDfzxzYYHkCHzGbGQYd8rBHe", amountUsd: 190600, rawJson: JSON.stringify({ txBridge: "2dN1JBuV3nezLYC76qE6vTReRC7TiqTZDiYqr2KQdHNb4d7hmUNARZHjPi8FzkvVwDfzxzYYHkCHzGbGQYd8rBHe", txReceiveEth: "0x53bcbd41200ad506e88ef208078d5c967d927d1c250c6b213d5960006b74f777", txGatePaid: "0xdbdaee0733835f984dddbe866929a8ee3813976e673c00ebbf2d6b827a7a83a8", amount: 190600, currency: "USDT", route: "Solana→Gate→Ethereum" }) },
    { kolHandle: "bkokoski", type: "market_manipulation", label: "Dotation MM 1000 SOL", description: "1,000 SOL trésorerie BOTIFY envoyés au market maker Myrrha pour financer le wash trading — manipulation de marché prouvée on-chain", sourceUrl: "https://solscan.io/tx/5wopug7c3boMB2eEYzCbXRnSVS9Ah1WGtmt8zNJ4u6zxWP8pbL7zupfxawWDzJzSswGtDcMWzCvvdEG4cbr1w4z" },
    { kolHandle: "bkokoski", type: "insider_trading", label: "Lien BOTIFY↔$TRUMP $20,000", description: "$20,000 USDT envoyés depuis trésorerie BOTIFY vers 'FF to ML (trump whale wallet)' — lien documenté BOTIFY↔$TRUMP opération coordonnée", sourceUrl: "https://solscan.io/tx/4N9UAUqhXC78YbJTG3eBRunuwuTjsfhjEByqRfDpHcSi9xEaSo7xefneTD4eQjah72LDvT9BZdHWhHrsd3sjCzz5", amountUsd: 20000 },
    { kolHandle: "bkokoski", type: "market_manipulation", label: "Faux followers Twitter", description: "Achat de faux followers Twitter prouvé on-chain (300 USDT) — manipulation artificielle crédibilité sociale", sourceUrl: "https://solscan.io/tx/2EELTs63ScHVx9R9VPFbuVPiwEMBgUeK74rGRENVVUnb6wMFguk9awNFhmw4cSEvkrY1BdNuVVE6sEt8PfKYBkb", amountUsd: 300 },
    { kolHandle: "bkokoski", type: "paid_promotion", label: "Listing MEXC $90,000", description: "$90,000 USDT payés pour le listing MEXC — preuve directe du budget fraude alloué à la crédibilité artificielle du token", sourceUrl: "https://solscan.io/tx/596C8bd9xvW5dTaiZsPQR8FHsMtcy1o9sTodaVauqHMmbmxCCihbEGeRFyTgkH9goD3LnZE3pG7aqv6XRy1pf6x5", amountUsd: 90000 },
    { kolHandle: "bkokoski", type: "paid_promotion", label: "TikTok push $150,500", description: "$150,500 USDT payés pour campagne TikTok — manipulation de masse documentée on-chain", sourceUrl: "https://solscan.io/tx/xfa1qrYvP8tY9irWBz2xEKz3VscfynHGR5473nQkmwiihgxZeUpXRmsvvSWY258Ta6FWhiSnY72rNZd9a6xTDis", amountUsd: 150500 },
    { kolHandle: "bkokoski", type: "paid_promotion", label: "UEFA campaign $80,000", description: "$80,000 USDT payés pour campagne UEFA — fonds frauduleux utilisés pour association avec institution sportive légitime", sourceUrl: "https://solscan.io/tx/2FUydYXpZAbFzJX67TyJiSXxrHmwEaqMxCYy7tcgW3joviXD6cgFUxKuf3pRcnrhNnnu2LAmych58AeSnMErMqeF", amountUsd: 80000 },
    { kolHandle: "sxyz500", type: "insider_proof", label: "Vol ADL→HK Sam O'Leary", description: "19.642 SOL (billet avion ADL→HK) payé par trésorerie BOTIFY pour Sam O'Leary — preuve physique de son implication directe dans l'organisation", sourceUrl: "https://solscan.io/tx/34sRPzjan7hEm55rE49zSLzkxpKSkDH2ayCeAreit6qVP6hrVjQNMEa7cubke3E5soJFZfKNpPdAN1DUBSUK34Jo" },
    { kolHandle: "bkokoski", type: "market_manipulation", label: "Volume bot $34.4 SOL", description: "34.4132 SOL payés pour bot de volume artificiel (2M volume) — manipulation on-chain prouvée", sourceUrl: "https://solscan.io/tx/51cqdmuTFw7sMhoj92cZw8x4bQvESTXzJgCbZxZM18BkwDM73TzUD6bfkhJd3ptzPhQizW9z4asxXSybNDWV8QL9" },
  ];

  for (const ev of evidences) {
    try {
      await createEvidence(ev.kolHandle, {
        type: ev.type,
        label: ev.label,
        description: ev.description,
        sourceUrl: ev.sourceUrl,
        amountUsd: ev.amountUsd,
        rawJson: ev.rawJson,
      });
      evidenceCreated++;
      console.log(`  ✓ ${ev.kolHandle}: ${ev.label}`);
    } catch (err) {
      console.log(`  ✗ ${ev.kolHandle}: ${ev.label} — ${(err as Error).message}`);
    }
  }

  // ═══ TASK 5: OOP trésorerie multi-chaîne ═══
  console.log("\n=== TASK 5: OOP trésorerie ===");
  try {
    await createEvidence("bkokoski", {
      type: "fund_movement",
      label: "Trésorerie BOTIFY multi-chaîne",
      description: "Trésorerie multi-chaîne documentée : 30,000 WLD (63K USDT) liquidité initiale + 42,937 FTM achetés (22,300 USDT) + fonds perdus vers acteur 'Majin' (30,295 USDT). Wallet de remboursement centralisé OrbitApe confirmé : 4F5J5KfqhzjaXL5fbeAqrWJX7dnWhwzSSrMmVUfSZQ91. Total trésorerie running documenté : $73,045 USDT.",
      rawJson: JSON.stringify({
        wldInitialLiq: { amount: 30000, usdtValue: 63000 },
        ftmPurchase: { ftmAmount: 42937, usdtSpent: 22300, remainingFtm: 11480, remainingUsdValue: 7995 },
        majinLoss: { usdtLost: 30295, note: "Dude funding lost to Majin — acteur non identifié" },
        orbitReimburseWallet: "4F5J5KfqhzjaXL5fbeAqrWJX7dnWhwzSSrMmVUfSZQ91",
        runningTotal: 73045,
        chains: ["SOL", "ETH", "FTM"],
      }),
      amountUsd: 73045,
    });
    evidenceCreated++;
    console.log("  ✓ OOP trésorerie multi-chaîne");
  } catch (err) {
    console.log(`  ✗ OOP: ${(err as Error).message}`);
  }

  // OrbitApe wallet
  const orbitWs = await upsertWallet("bkokoski", "4F5J5KfqhzjaXL5fbeAqrWJX7dnWhwzSSrMmVUfSZQ91", {
    chain: "SOL",
    label: "[LEAKED DOC] OrbitApe — wallet remboursement centralisé",
    attributionSource: "botify_leaked_doc",
    attributionStatus: "confirmed",
    confidence: "high",
  });
  if (orbitWs === "CREATED") walletsCreated++;
  console.log(`  OrbitApe wallet: ${orbitWs}`);

  console.log(`\n=== DONE ===`);
  console.log(`Profiles created: ${profilesCreated}`);
  console.log(`Wallets created: ${walletsCreated}`);
  console.log(`Evidence created: ${evidenceCreated}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
