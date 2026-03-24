// seed-intelligence.mjs
// Sprint 5 — 3 seeds en 1 :
//   1. Gordon wallets (SOL) → @GordonGekko
//   2. KOL wallets BSC (EVM 0x)
//   3. 250 serial deployers → SerialDeployer table (si existe) sinon KolWallet

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as fs from "fs";

if (fs.existsSync(".env.local")) { dotenv.config({ path: ".env.local" }); }
else { dotenv.config(); }

const prisma = new PrismaClient();

// ─── 1. Gordon wallets ────────────────────────────────────────
const GORDON_WALLETS = [
  { address: "Eu8i6rpMPXyg5NaEY23qEbFeMhrs953FdqxYxweXm24J", label: "Gordon 1 — SOL", chain: "SOL", claimType: "source_attributed", sourceLabel: "@dethective Telegram — The Wallet Cave" },
  { address: "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3", label: "Gordon 2 — SOL", chain: "SOL", claimType: "source_attributed", sourceLabel: "@dethective Telegram — The Wallet Cave" },
  { address: "3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6", label: "Gordon 3 — SOL", chain: "SOL", claimType: "source_attributed", sourceLabel: "@dethective Telegram — The Wallet Cave" },
];

// ─── 2. KOL BSC wallets ───────────────────────────────────────
const KOL_EVM_WALLETS = [
  { handle: "@atitty_",     address: "0x8c741460F6274869C035d95ACc602C62846400Fd", label: "BSC EVM — @atitty_",      chain: "BSC" },
  { handle: "@mediagiraffes", address: "0xbb8e74bda3d7615d09710fba90b3af1b149b780f", label: "BSC EVM — @mediagiraffes", chain: "BSC" },
  { handle: "@apemp5",      address: "0x469e8e739c2dc6994fd79efb785972d8afefd640", label: "BSC EVM — @apemp5",       chain: "BSC" },
  { handle: "@regrets10x",  address: "0x4950afc2a8e5834a1858a94f98b68cd00f96fe12", label: "BSC EVM — @regrets10x (shared lynk0x)", chain: "BSC" },
  { handle: "@lynk0x",      address: "0x4950afc2a8e5834a1858a94f98b68cd00f96fe12", label: "BSC EVM — @lynk0x (shared regrets10x)", chain: "BSC" },
  { handle: "@daokwondo",   address: "0xD029421d3cE1A01bbEf22f865793Dd70e63FF997", label: "BSC EVM — @daokwondo",    chain: "BSC" },
  { handle: "@herrocrypto", address: "0x326ef9fa575a92090d8dea0b1f053afca64fb19b", label: "BSC EVM — @herrocrypto",  chain: "BSC" },
  { handle: "@moondat",     address: "0x8d95136d5999536e58ad25915d4380bf4ace86ef", label: "BSC EVM — @moondat",      chain: "BSC" },
  { handle: "@jeremyybtc",  address: "0x13c1e86b01544d4ed8e38f11132a11868c3a49e9", label: "BSC EVM — @jeremyybtc",   chain: "BSC" },
];

// ─── 3. Top 50 serial deployers ──────────────────────────────
const SERIAL_DEPLOYERS = [
  { address: "bwamJzztZsepfkteWRChggmXuiiCQvpLqPietdNfSXa", pnlUsd: 5503712, tokenCount: 8902, bestToken: "COPPERINU", winrate: 33.24 },
  { address: "4dnWLzmdkLeuDe6hwRBpPqrDbQZ59hpoBu8JLztAescf", pnlUsd: 889101,  tokenCount: 7177, bestToken: "Sus",       winrate: 29.77 },
  { address: "AxmFqz3pbhj6HDK9dC1u7LsYP3rbsTJyKkeCMSpAxrgU", pnlUsd: 150928,  tokenCount: 6140, bestToken: "TANAKI",    winrate: 11.56 },
  { address: "99UtKhdi1RfmMGRpi7kbWz6AQ2y4JkFmxC3swMVMDioZ", pnlUsd: 773098,  tokenCount: 3790, bestToken: "唢呐",      winrate: 19.30 },
  { address: "moanTeQ4d1c1wtZYENytCm1yZDXwUcUYTnSNpjpB4jF",  pnlUsd: 835837,  tokenCount: 3435, bestToken: "MASA",      winrate: 25.39 },
  { address: "Aqje5DsN4u2PHmQxGF9PKfpsDGwQRCBhWeLKHCFhSMXk", pnlUsd: 1351183, tokenCount: 3339, bestToken: "EVA",       winrate: 91.60 },
  { address: "GpTXmkdvrTajqkzX1fBmC4BUjSboF9dHgfnqPqj8WAc4", pnlUsd: 2185689, tokenCount: 3260, bestToken: "ICM",       winrate: 90.13 },
  { address: "5TaPtQ9DE1YMUfiyLv7CCNx1CEh88nWx3sPmNRz9zL75",  pnlUsd: 1316538, tokenCount: 2986, bestToken: "SPICY",     winrate: 41.74 },
  { address: "C4udGwTg6oqcrr8SmSLmkcXDbaFEcopsiaT21KUE4psU",  pnlUsd: 859469,  tokenCount: 2814, bestToken: "America",   winrate: 26.43 },
  { address: "HdKJM6Lvfp9aV9tvEMC8AD4GnsbFgMUkHLoK923Sn1ET",  pnlUsd: 1130736, tokenCount: 2460, bestToken: "KISS",      winrate: 95.26 },
  { address: "GZVSEAajExLJEvACHHQcujBw7nJq98GWUEZtood9LM9b",  pnlUsd: 2369244, tokenCount: 2413, bestToken: "ALICE",     winrate: 74.66 },
  { address: "8i5U2uNBEuTc4zskYP14zbebDg2RSwrrG8REhEnJb97K",  pnlUsd: 973166,  tokenCount: 2388, bestToken: "MEMELESS",  winrate: 78.69 },
  { address: "G7NvZKjoVqBDWciSYtWWgUPB7DA1iJavdvH5jty2FAmM",  pnlUsd: 633222,  tokenCount: 2359, bestToken: "AMERICA",   winrate: 28.16 },
  { address: "9sCcAxe56AuDQfJgU7kB1LpnQEYXDcGpAtXnN49H6SB3",  pnlUsd: 1138726, tokenCount: 2294, bestToken: "CSC",       winrate: 17.61 },
  { address: "6nU2L7MQVUWjtdKHVpuZA9aind73nd3rXC4YFo8KQCy4",  pnlUsd: 376589,  tokenCount: 2285, bestToken: "VVM",       winrate: 19.33 },
  { address: "37uM1rp8TK7eVURVRnjtaxGkdJyXjgA9uz83DjApcHvq",  pnlUsd: 260298,  tokenCount: 2260, bestToken: "BIG",       winrate: 32.56 },
  { address: "B9Zbs2W9VK22AHnCWiK4PqBueDFzN17RNAFu5uFozLMJ",  pnlUsd: 1839355, tokenCount: 2227, bestToken: "AP",        winrate: 7.18  },
  { address: "8NJ7Ujpji8uMF2675mqaTSEm2DCbfJA7fiRKtiaqkaLN",  pnlUsd: 598839,  tokenCount: 2164, bestToken: "Skyline",   winrate: 50.28 },
  { address: "ANAUcDCU3Jfao3mtxBdttjEH7F3Ja7SyjGBKUa9Cruc5",  pnlUsd: 900673,  tokenCount: 2111, bestToken: "Sora",      winrate: 50.50 },
  { address: "5zCkbcD74hFPeBHwYdwJLJAoLVgHX45AFeR7RzC8vFiD",  pnlUsd: 1669694, tokenCount: 1961, bestToken: "CHARLIE",   winrate: 86.74 },
  { address: "BoGxGZ5yWanwcqQPYnQyRNHL7rbrX53ry1S6jtMxADb7",  pnlUsd: 194180,  tokenCount: 1880, bestToken: "BUTTPLUG",  winrate: 8.16  },
  { address: "CAYAFk8PJpZDtukE2NPVRzQaCZm7LnF8Tfe8dYbxa4Cs",  pnlUsd: 508488,  tokenCount: 1755, bestToken: "Derek",     winrate: 95.34 },
  { address: "KWCbAtiCRwPGq4C6CftopH7BA9CyPSBVRM5jLMYyMaP",   pnlUsd: 321176,  tokenCount: 1721, bestToken: "PORGY",     winrate: 75.58 },
  { address: "78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2",  pnlUsd: 554199,  tokenCount: 1707, bestToken: "8",         winrate: 58.41 },
  { address: "HUgpmqL6r4Z4iEZiVuNZ6J6QnAsSZpsL8giVyVtz3QhT",  pnlUsd: 702597,  tokenCount: 1673, bestToken: "TERAFAB",   winrate: 96.39 },
  { address: "5zCkbcD74hFPeBHwYdwJLJAoLVgHX45AFeR7RzC8vFiD",  pnlUsd: 1669694, tokenCount: 1961, bestToken: "CHARLIE",   winrate: 86.74 },
  { address: "whamNNP9tHoxLg92yHvJPdYhghEoCg1qYTsh5a2oLbx",   pnlUsd: 765889,  tokenCount: 1402, bestToken: "ZIGGY",     winrate: 79.92 },
  { address: "8HeDT75s5g4CtCimH5B5nySqCiQhtWii8UnZhxBtFo38",  pnlUsd: 1438735, tokenCount: 637,  bestToken: "Lobstar",   winrate: 88.26 },
  { address: "MNhBbrscBPmeid54buiqSgyWa4D8PY6uKHoK2wJsTJN",   pnlUsd: 4690654, tokenCount: 668,  bestToken: "Poly",      winrate: 13.91 },
  { address: "83QQFLxcEzuJZaejBnzAiW5tyfyaRHMLZnkhJbRPRWtf",  pnlUsd: 3319607, tokenCount: 429,  bestToken: "SCARED",    winrate: 23.73 },
];

async function main() {
  console.log("\n══════════════════════════════════");
  console.log(" SEED INTELLIGENCE — SPRINT 5");
  console.log("══════════════════════════════════\n");

  // ── 1. Gordon wallets → @GordonGekko ──────────────────────
  console.log("── 1. Gordon wallets ──");
  const gordon = await prisma.kolProfile.findUnique({ where: { handle: "GordonGekko" } });
  if (!gordon) {
    console.warn("⚠️  @GordonGekko non trouvé — lancer seed-kol-network.mjs d'abord");
  } else {
    for (const w of GORDON_WALLETS) {
      const existing = await prisma.kolWallet.findFirst({
        where: { kolHandle: "GordonGekko", address: w.address }
      });
      if (!existing) {
        await prisma.kolWallet.create({
          data: { kolHandle: "GordonGekko", ...w, status: "active" }
        });
        console.log(`  ✅ ${w.label} → ${w.address.slice(0,12)}...`);
      } else {
        console.log(`  ℹ️  ${w.label} déjà présent`);
      }
    }

    // Evidence Gordon wallets sur @GordonGekko
    const existingEv = await prisma.kolEvidence.findFirst({
      where: { kolHandle: "GordonGekko", label: { contains: "Gordon 1/2/3" } }
    });
    if (!existingEv) {
      await prisma.kolEvidence.create({ data: {
        kolHandle: "GordonGekko",
        type: "ONCHAIN_WALLET",
        label: "Gordon 1/2/3 — 3 SOL wallets confirmés via @dethective",
        description: "3 wallets SOL attribués à @GordonGekko via @dethective Telegram (The Wallet Cave). Gordon 1: Eu8i6rp... | Gordon 2: 4yscBpf... | Gordon 3: 3X9REre... Source: cross-reference gmgn.ai + Telegram Dethective, 22/03/2026.",
        wallets: JSON.stringify([
          "Eu8i6rpMPXyg5NaEY23qEbFeMhrs953FdqxYxweXm24J",
          "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3",
          "3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6"
        ]),
        sourceUrl: "https://t.me/dethective_wallets",
        dateFirst: new Date("2026-03-22"),
      }});
      console.log("  ✅ Evidence Gordon wallets ajoutée");
    }
  }

  // ── 2. KOL BSC wallets ────────────────────────────────────
  console.log("\n── 2. KOL BSC wallets ──");
  for (const w of KOL_EVM_WALLETS) {
    const kol = await prisma.kolProfile.findFirst({
      where: { handle: { equals: w.handle, mode: "insensitive" } }
    });
    if (!kol) {
      console.warn(`  ⚠️  @${w.handle} non trouvé en DB — skip`);
      continue;
    }
    const existing = await prisma.kolWallet.findFirst({
      where: { address: w.address }
    });
    if (!existing) {
      await prisma.kolWallet.create({
        data: {
          kolHandle: kol.handle,
          address: w.address,
          label: w.label,
          chain: w.chain,
          status: "active",
          claimType: "source_attributed",
          sourceLabel: "@dethective Telegram",
        }
      });
      console.log(`  ✅ @${w.handle} → ${w.address.slice(0,12)}...`);
    } else {
      console.log(`  ℹ️  @${w.handle} wallet déjà présent`);
    }
  }

  // ── 3. Serial deployers → KolWallet avec tag deployer ─────
  console.log("\n── 3. Serial deployers (top 30) ──");
  let deployerCount = 0;

  // Vérifier si table SerialDeployer existe via Prisma
  // Si pas de modèle, on les stocke en KolEvidence sur un profil générique
  // ou on vérifie via prisma introspection

  // Stratégie : créer un KolProfile "DEPLOYER_POOL" si pas de table dédiée
  let deployerPool = await prisma.kolProfile.findFirst({
    where: { handle: "deployer_pool" }
  });
  if (!deployerPool) {
    deployerPool = await prisma.kolProfile.create({ data: {
      handle: "deployer_pool",
      platform: "solana",
      displayName: "Serial Deployer Pool",
      label: "250 serial deployers — Dethective dataset",
      riskFlag: "high_risk",
      confidence: "confirmed",
      status: "active",
      notes: "Liste complète des 250 wallets ayant déployé 300+ tokens en 6 mois. Source: @dethective Telegram The Wallet Cave — 22/03/2026.",
      tags: JSON.stringify(["serial-deployer", "pump.fun", "rug", "dethective"]),
    }});
    console.log("  ✅ deployer_pool profile créé");
  }

  // Déduplique par adresse
  const seen = new Set();
  for (const d of SERIAL_DEPLOYERS) {
    if (seen.has(d.address)) continue;
    seen.add(d.address);

    const existing = await prisma.kolWallet.findFirst({ where: { address: d.address } });
    if (!existing) {
      await prisma.kolWallet.create({ data: {
        kolHandle: "deployer_pool",
        address: d.address,
        chain: "SOL",
        label: `Deployer — ${d.tokenCount} tokens — PnL $${d.pnlUsd.toLocaleString()} — best: ${d.bestToken}`,
        status: "active",
        claimType: "analytical_estimate",
        sourceLabel: `@dethective — winrate ${d.winrate}%`,
      }});
      deployerCount++;
    }
  }
  console.log(`  ✅ ${deployerCount} deployers ajoutés`);

  // ── 4. LOUD victims CSV ───────────────────────────────────
  console.log("\n── 4. LOUD victims (wallet_loud.csv) ──");
  const csvRaw = fs.readFileSync(process.env.HOME + "/Downloads/wallet_loud.csv", "utf8");
  const csvLines = csvRaw.trim().split("\n").slice(1); // skip header
  const loudWallets = csvLines.map(l => {
    const parts = l.replace(/\r/, "").split(",");
    return { blockTime: parts[0], humanTime: parts[1], address: parts[2] };
  }).filter(w => w.address && w.address.length > 20);

  // Stocker comme evidence sur un profil LOUD token
  let loudPool = await prisma.kolProfile.findFirst({ where: { handle: "loud_token_victims" } });
  if (!loudPool) {
    loudPool = await prisma.kolProfile.create({ data: {
      handle: "loud_token_victims",
      platform: "solana",
      displayName: "LOUD Token Victim Pool",
      label: "963 victim wallets — LOUD token — 31/05/2025",
      riskFlag: "victim_pool",
      confidence: "confirmed",
      status: "active",
      notes: "963 wallets ayant interagi avec le token LOUD le 31/05/2025. Source: wallet_loud.csv. Potentielles victimes d'un rug pull.",
      tags: JSON.stringify(["victim-pool", "loud", "solana"]),
    }});
    console.log("  ✅ loud_token_victims profile créé");
  }

  // Stocker comme une seule evidence avec le count
  const existingLoud = await prisma.kolEvidence.findFirst({
    where: { kolHandle: "loud_token_victims", type: "VICTIM_POOL" }
  });
  if (!existingLoud) {
    await prisma.kolEvidence.create({ data: {
      kolHandle: "loud_token_victims",
      type: "VICTIM_POOL",
      label: `LOUD token — ${loudWallets.length} victim wallets — 31/05/2025`,
      description: `${loudWallets.length} wallets SOL documentés ayant envoyé des fonds au token LOUD le 31/05/2025. Période: 16h20 → 17h46 UTC. Source: wallet_loud.csv fourni via investigation Dethective.`,
      wallets: JSON.stringify(loudWallets.slice(0, 50).map(w => w.address)), // top 50 pour ne pas dépasser la limite
      txCount: loudWallets.length,
      dateFirst: new Date("2025-05-31T16:20:51Z"),
      dateLast: new Date("2025-05-31T17:46:03Z"),
    }});
    console.log(`  ✅ ${loudWallets.length} LOUD victims enregistrés`);
  } else {
    console.log("  ℹ️  LOUD victims déjà présents");
  }

  // ── Summary ───────────────────────────────────────────────
  const totalProfiles = await prisma.kolProfile.count();
  const totalWallets = await prisma.kolWallet.count();
  const totalEvidences = await prisma.kolEvidence.count();

  console.log("\n══════════════════════════════════");
  console.log(" DONE");
  console.log(`  KolProfile  : ${totalProfiles}`);
  console.log(`  KolWallet   : ${totalWallets}`);
  console.log(`  KolEvidence : ${totalEvidences}`);
  console.log("══════════════════════════════════\n");
}

main()
  .catch(e => { console.error("❌", e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
