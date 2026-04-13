// Run intelligence pack against the case with the MOST entities
// (best chance to exercise network discovery).
import { PrismaClient } from "@prisma/client";
import { buildCaseIntelligencePack } from "../src/lib/vault/buildCaseIntelligencePack.ts";

const prisma = new PrismaClient();

const biggest = await prisma.vaultCaseEntity.groupBy({
  by: ["caseId"],
  _count: { _all: true },
  orderBy: { _count: { caseId: "desc" } },
  take: 3,
});

console.log("Top 3 cases by entity count:");
for (const b of biggest) console.log(`  ${b.caseId}: ${b._count._all} entities`);

for (const b of biggest) {
  const c = await prisma.vaultCase.findUnique({
    where: { id: b.caseId },
    select: { id: true, workspaceId: true, caseTemplate: true },
  });
  if (!c) continue;
  console.log(`\n--- Testing case ${c.id} (${c.caseTemplate}) ---`);
  const pack = await buildCaseIntelligencePack(c.id, c.workspaceId);
  console.log(`  entities=${pack.entityCount}`);
  console.log(
    `  KOL matches=${pack.entities.filter((e) => e.crossIntelligence?.inKolRegistry).length}`
  );
  console.log(
    `  relatedActors=${pack.networkIntelligence.relatedActors.length} [${pack.networkIntelligence.relatedActors.slice(0, 5).join(", ")}]`
  );
  console.log(
    `  proceedsSummed=$${Math.round(pack.entities.reduce((s, e) => s + (e.crossIntelligence?.proceedsSummary?.totalUSD ?? 0), 0))}`
  );
  console.log(
    `  laundryTrails=${pack.entities.filter((e) => e.crossIntelligence?.laundryTrail?.detected).length}`
  );
  console.log(`  confidenceClaims=${pack.confidenceAssessment.length}`);
  console.log(`  correlationSignals=${pack.timelineCorrelation.correlationSignals.length}`);
}

await prisma.$disconnect();
