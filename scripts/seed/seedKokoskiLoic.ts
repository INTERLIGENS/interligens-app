/**
 * scripts/seed/seedKokoskiLoic.ts
 *
 * Adds a single KolEvidence row for bkokoski documenting the LOIC ERC-20
 * deployment from wallet 0x32B6006e5b942F47Ab4DB68eE70f683370853ecF on
 * 2023-07-09. Idempotent — re-running is a no-op.
 *
 * Evidence source: direct Etherscan reading of contract
 * 0xBF4F891C5f3d4e9b84dab25cb4dbd61025f13bbe (verified source, creator field
 * matches BK personal EVM wallet).
 *
 * Run: npx tsx scripts/seed/seedKokoskiLoic.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KOL_HANDLE = "bkokoski";
const DEDUP_KEY = "bkokoski:token_deployment:loic:0xBF4F891C5f3d4e9b84dab25cb4dbd61025f13bbe";

const LOIC_TOKEN = "0xBF4F891C5f3d4e9b84dab25cb4dbd61025f13bbe";
const BK_DEPLOYER = "0x32B6006e5b942F47Ab4DB68eE70f683370853ecF";
const DEPLOYMENT_TX =
  "0xb674dae7147d1b60b250e838544c8a8d238e1663532e207650626756fd7ecee1";

async function main() {
  const kol = await prisma.kolProfile.findUnique({
    where: { handle: KOL_HANDLE },
    select: { handle: true },
  });

  if (!kol) {
    console.error(
      `✗ KolProfile '${KOL_HANDLE}' not found. Run seed-kokoski.mjs first.`,
    );
    process.exit(1);
  }

  const existing = await prisma.kolEvidence.findFirst({
    where: { kolHandle: KOL_HANDLE, dedupKey: DEDUP_KEY },
    select: { id: true },
  });

  if (existing) {
    console.log(`= LOIC evidence already present (id=${existing.id}) — no-op`);
    return;
  }

  const created = await prisma.kolEvidence.create({
    data: {
      kolHandle: KOL_HANDLE,
      type: "token_deployment",
      label: "LOIC meme-token deployment — classic pump pattern",
      description:
        "BK deployed LOIC (Low Orbit Ion Cannon) token July 2023 using standard meme-token playbook: Set Buy Fee, Set Sell Fee, Set Max Buy/Sell/Wallet Amount, Open Trading, then Renounce Ownership to create artificial 'safety'. Confirms pattern of serial token deployments beyond BOTIFY/Dione. Deployed from BK personal EVM wallet 0x32B6…3ecF (Arkham entity 'kokoskib').",
      wallets: JSON.stringify([BK_DEPLOYER, LOIC_TOKEN]),
      amountUsd: null,
      txCount: 1,
      dateFirst: new Date("2023-07-09T00:00:00Z"),
      dateLast: new Date("2023-07-09T00:00:00Z"),
      token: "LOIC",
      sampleTx: DEPLOYMENT_TX,
      sourceUrl: `https://etherscan.io/address/${LOIC_TOKEN}`,
      dedupKey: DEDUP_KEY,
    },
    select: { id: true, label: true },
  });

  console.log(`✓ Inserted KolEvidence id=${created.id}`);
  console.log(`  label: ${created.label}`);

  const total = await prisma.kolEvidence.count({
    where: { kolHandle: KOL_HANDLE },
  });
  console.log(`\n✅ ${total} evidences total en DB pour ${KOL_HANDLE}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
