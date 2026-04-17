import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { prisma } from "@/lib/prisma";
import { createEntity } from "@/lib/mm/registry/entities";
import { createSource } from "@/lib/mm/registry/sources";
import { createClaim } from "@/lib/mm/registry/claims";
import { SEED_ENTITIES, SEED_SOURCES } from "@/lib/mm/registry/seedData";

const SEED_ACTOR = { userId: "seed-system", role: "system" } as const;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.includes("ep-square-band")) {
    throw new Error("refusing to seed: target is not ep-square-band");
  }

  console.log("[mm seed] starting");

  const existingEntities = await prisma.mmEntity.count();
  if (existingEntities > 0) {
    const slugs = SEED_ENTITIES.map((e) => e.slug);
    const present = await prisma.mmEntity.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, workflow: true },
    });
    if (present.length === slugs.length) {
      console.log(`[mm seed] all ${slugs.length} entities already seeded — no-op`);
      return;
    }
    console.log(`[mm seed] ${present.length}/${slugs.length} already present, filling gaps`);
  }

  const sourceIdByKey = new Map<string, string>();
  for (const src of SEED_SOURCES) {
    const existing = await prisma.mmSource.findFirst({ where: { url: src.url } });
    if (existing) {
      sourceIdByKey.set(src.key, existing.id);
      continue;
    }
    const created = await createSource(
      {
        publisher: src.publisher,
        sourceType: src.sourceType,
        url: src.url,
        title: src.title,
        credibilityTier: src.credibilityTier,
        author: src.author ?? null,
        publishedAt: new Date(src.publishedAt),
        language: src.language,
        localSnapshot: `pending-r2://${src.key}`,
      },
      SEED_ACTOR,
    );
    sourceIdByKey.set(src.key, created.id);
    console.log(`[mm seed] source ${src.key} (${created.id})`);
  }

  for (const seed of SEED_ENTITIES) {
    const already = await prisma.mmEntity.findUnique({ where: { slug: seed.slug } });
    if (already) {
      console.log(`[mm seed] entity ${seed.slug} exists (workflow=${already.workflow})`);
      continue;
    }
    const entity = await createEntity(
      {
        slug: seed.slug,
        name: seed.name,
        legalName: seed.legalName ?? null,
        jurisdiction: seed.jurisdiction ?? null,
        foundedYear: seed.foundedYear ?? null,
        founders: seed.founders ?? [],
        status: seed.status,
        publicSummary: seed.publicSummary,
        publicSummaryFr: seed.publicSummaryFr,
        knownAliases: seed.knownAliases ?? [],
        officialDomains: seed.officialDomains ?? [],
      },
      SEED_ACTOR,
    );
    console.log(`[mm seed] entity ${entity.slug} created (workflow=${entity.workflow})`);

    for (const claim of seed.claims) {
      const sourceId = sourceIdByKey.get(claim.sourceKey);
      if (!sourceId) {
        throw new Error(`seed: source key ${claim.sourceKey} missing for ${seed.slug}`);
      }
      await createClaim(
        {
          mmEntityId: entity.id,
          claimType: claim.claimType,
          text: claim.text,
          textFr: claim.textFr ?? null,
          sourceId,
          jurisdiction: claim.jurisdiction ?? null,
          orderIndex: claim.orderIndex,
        },
        SEED_ACTOR,
      );
    }
    console.log(`[mm seed]   + ${seed.claims.length} FACT claims`);
  }

  const totals = await prisma.mmEntity.groupBy({
    by: ["workflow"],
    _count: true,
  });
  console.log("[mm seed] done. workflow breakdown:", totals);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
