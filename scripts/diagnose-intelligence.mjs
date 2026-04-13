import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function safe(label, fn) {
  try {
    const result = await fn();
    console.log(`=== ${label} ===`);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(`=== ${label} ===`);
    console.log(`ERROR: ${e.message}`);
  }
  console.log("");
}

async function diagnose() {
  await safe("1. KOL-related tables", () => prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name ILIKE '%kol%' OR table_name ILIKE '%watch%'
    OR table_name ILIKE '%proceed%' OR table_name ILIKE '%wallet%')
    ORDER BY table_name
  `);

  await safe("2. WatchScan columns", () => prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'WatchScan'
    ORDER BY ordinal_position
  `);

  await safe("3. KolWallet columns", () => prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'KolWallet'
    ORDER BY ordinal_position
  `);

  await safe("4. KolProfile columns", () => prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'KolProfile'
    ORDER BY ordinal_position
  `);

  await safe("5. Proceeds-related tables", () => prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name ILIKE '%proceed%' OR table_name ILIKE '%event%'
    OR table_name ILIKE '%cashout%' OR table_name ILIKE '%transaction%')
    ORDER BY table_name
  `);

  await safe("6. Timeline/event tables", () => prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name ILIKE '%timeline%' OR table_name ILIKE '%mention%'
    OR table_name ILIKE '%laundry%' OR table_name ILIKE '%attribution%')
    ORDER BY table_name
  `);

  await safe("7. GordonGekko KolProfile (handle search)", () =>
    prisma.kolProfile.findFirst({
      where: {
        handle: { contains: "gordongekko", mode: "insensitive" },
      },
    })
  );

  await safe("7b. Any handle containing 'gordon' or 'gekko'", () =>
    prisma.$queryRaw`
      SELECT handle, "displayName", "rugCount", "totalDocumented"
      FROM "KolProfile"
      WHERE handle ILIKE '%gordon%' OR handle ILIKE '%gekko%'
      LIMIT 5
    `
  );

  await safe("8. KolProfile top 10 sample", () =>
    prisma.kolProfile.findMany({
      select: {
        handle: true,
        displayName: true,
        rugCount: true,
        totalDocumented: true,
        totalScammed: true,
      },
      take: 10,
    })
  );

  await safe("9. KolWallet sample (5 rows)", () =>
    prisma.kolWallet.findMany({ take: 5 })
  );

  await safe("10. KolWallet kolHandle distinct count", () =>
    prisma.$queryRaw`
      SELECT COUNT(DISTINCT "kolHandle") as distinct_kols,
             COUNT(*) as total_wallets
      FROM "KolWallet"
    `
  );

  await safe("11. Wallets sharing addresses across KOLs", () =>
    prisma.$queryRaw`
      SELECT address, COUNT(DISTINCT "kolHandle") as kol_count
      FROM "KolWallet"
      GROUP BY address
      HAVING COUNT(DISTINCT "kolHandle") > 1
      LIMIT 10
    `
  );

  await safe("12. KolProceedsEvent (Prisma)", () =>
    // @ts-ignore
    prisma.kolProceedsEvent.findMany({ take: 3 })
  );

  await safe("13. KolProceedsSummary (Prisma)", () =>
    // @ts-ignore
    prisma.kolProceedsSummary.findMany({ take: 3 })
  );

  await safe("14. Proceeds table raw check", () => prisma.$queryRaw`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_name ILIKE '%proceed%'
    ORDER BY table_name, ordinal_position
  `);

  await safe("15. WatchScan sample", () =>
    prisma.watchScan.findMany({ take: 3 })
  );

  await safe("16. KolPromotionMention sample", () =>
    // @ts-ignore
    prisma.kolPromotionMention.findMany({ take: 3 })
  );

  await safe("17. KolTokenInvolvement sample", () =>
    // @ts-ignore
    prisma.kolTokenInvolvement.findMany({ take: 3 })
  );

  await safe("18. Investigated KOLs (bkokoski, sxyz500, lynk0x, planted, DonWedge)", () =>
    prisma.$queryRaw`
      SELECT handle, "displayName", "rugCount", "totalDocumented"
      FROM "KolProfile"
      WHERE handle ILIKE ANY (ARRAY['%bkokoski%', '%sxyz500%', '%lynk0x%', '%planted%', '%donwedge%', '%gordongekko%'])
    `
  );

  await safe("19. KolWallet for investigated KOLs", () =>
    prisma.$queryRaw`
      SELECT "kolHandle", address, chain, label
      FROM "KolWallet"
      WHERE "kolHandle" ILIKE ANY (ARRAY['%bkokoski%', '%sxyz500%', '%lynk0x%', '%planted%', '%donwedge%', '%gordongekko%'])
      LIMIT 50
    `
  );
}

diagnose()
  .catch((e) => {
    console.error("Diagnose failed:", e.message);
  })
  .finally(() => prisma.$disconnect());
