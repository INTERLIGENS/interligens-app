import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Simulate the new network discovery for GordonGekko's wallets.
async function verify() {
  const gordonWallets = [
    "Eu8i6rpMPXyg5NaEY23qEbFeMhrs953FdqxYxweXm24J",
    "4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3",
    "3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6",
    "0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41",
  ];

  // Find the handle owning these wallets
  const wallets = await prisma.kolWallet.findMany({
    where: { address: { in: gordonWallets } },
    select: { kolHandle: true },
  });
  const matchedHandles = Array.from(new Set(wallets.map((w) => w.kolHandle)));
  console.log("Matched handles from wallets:", matchedHandles);

  // Signal B — token involvement overlap
  const tokenMints = await prisma.$queryRaw`
    SELECT DISTINCT "tokenMint"
    FROM "KolTokenInvolvement"
    WHERE "kolHandle" = ANY(${matchedHandles})
  `;
  console.log("Shared tokenMints:", tokenMints);

  const mintArray = tokenMints.map((r) => r.tokenMint).filter(Boolean);
  if (mintArray.length > 0) {
    const counterparts = await prisma.$queryRaw`
      SELECT DISTINCT "kolHandle"
      FROM "KolTokenInvolvement"
      WHERE "tokenMint" = ANY(${mintArray})
      AND "kolHandle" <> ALL(${matchedHandles})
    `;
    console.log("Network actors (via tokens):", counterparts);
  }

  // Proceeds events for GordonGekko
  const proceeds = await prisma.$queryRaw`
    SELECT "eventDate", "amountUsd", "tokenSymbol"
    FROM "KolProceedsEvent"
    WHERE "kolHandle" = ANY(${matchedHandles})
    ORDER BY "eventDate" DESC
    LIMIT 5
  `;
  console.log("Proceeds events sample:", proceeds);

  // Promo mentions
  const promos = await prisma.$queryRaw`
    SELECT "postedAt", "tokenSymbol"
    FROM "KolPromotionMention"
    WHERE "kolHandle" = ANY(${matchedHandles})
    ORDER BY "postedAt" DESC
    LIMIT 5
  `;
  console.log("Promo mentions sample:", promos);

  // Cashout-after-promo check
  if (proceeds.length > 0 && promos.length > 0) {
    let matches = 0;
    for (const promo of promos) {
      for (const pr of proceeds) {
        const delta =
          new Date(pr.eventDate).getTime() - new Date(promo.postedAt).getTime();
        if (delta >= 0 && delta <= 72 * 3600 * 1000) matches++;
      }
    }
    console.log(`CASHOUT_AFTER_PROMO matches: ${matches}`);
  }

  // Proceeds summary
  const summary = await prisma.$queryRaw`
    SELECT "kolHandle", "totalProceedsUsd", "eventCount"
    FROM "KolProceedsSummary"
    WHERE "kolHandle" = ANY(${matchedHandles})
  `;
  console.log("Summary:", summary);
}

verify()
  .catch((e) => console.error("Verify failed:", e.message))
  .finally(() => prisma.$disconnect());
