import { PrismaClient } from "@prisma/client";
import { buildCaseIntelligencePack } from "../src/lib/vault/buildCaseIntelligencePack.ts";

const prisma = new PrismaClient();
const results = [];

function log(label, pass, detail) {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  results.push({ label, pass, detail });
}

try {
  // Find any case — case templates in prod are slug-style ("kol-promo" etc)
  // so we try several filters.
  const candidates = await prisma.vaultCase.findMany({
    where: {
      OR: [
        { caseTemplate: "kol-promo" },
        { caseTemplate: "KOL_PROMO_SCHEME" },
        { caseTemplate: { contains: "kol", mode: "insensitive" } },
      ],
    },
    select: { id: true, workspaceId: true, caseTemplate: true },
    take: 5,
  });

  let target = candidates[0];
  if (!target) {
    // Fallback: any case with at least 1 entity.
    const anyCase = await prisma.vaultCase.findFirst({
      where: { entities: { some: {} } },
      select: { id: true, workspaceId: true, caseTemplate: true },
      orderBy: { createdAt: "desc" },
    });
    target = anyCase;
  }

  if (!target) {
    log("3.0 case discovery", false, "no case found in DB");
    console.log("\n__JSON__\n" + JSON.stringify(results));
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`Target case: ${target.id} (template=${target.caseTemplate})`);
  log("3.0 case discovery", true, `found case ${target.id}`);

  const pack = await buildCaseIntelligencePack(target.id, target.workspaceId);

  console.log("\nPack keys:");
  for (const k of Object.keys(pack)) {
    const v = pack[k];
    if (Array.isArray(v)) console.log(`  ${k}: array len=${v.length}`);
    else if (v && typeof v === "object")
      console.log(`  ${k}: object keys=${Object.keys(v).join(",")}`);
    else console.log(`  ${k}: ${v}`);
  }

  log("3.1 entities.length > 0", pack.entities.length > 0, `entities=${pack.entities.length}`);

  const kolHits = pack.entities.filter((e) => e.crossIntelligence?.inKolRegistry).length;
  log(
    "3.2 >=1 entity with inKolRegistry=true",
    kolHits >= 1,
    `kolHits=${kolHits}`
  );

  const netActors = pack.networkIntelligence?.relatedActors?.length ?? 0;
  log(
    "3.3 networkIntelligence.relatedActors.length > 0",
    netActors > 0,
    `relatedActors=${netActors}${netActors > 0 ? ` [${pack.networkIntelligence.relatedActors.slice(0, 5).join(", ")}]` : ""}`
  );

  const proceedsHits = pack.entities.filter(
    (e) => (e.crossIntelligence?.proceedsSummary?.totalUSD ?? 0) > 0
  ).length;
  const totalProceedsSum = pack.entities.reduce(
    (s, e) => s + (e.crossIntelligence?.proceedsSummary?.totalUSD ?? 0),
    0
  );
  log(
    "3.4 >=1 entity with proceedsSummary.totalUSD > 0",
    proceedsHits >= 1,
    `proceedsHits=${proceedsHits}, totalSum=$${Math.round(totalProceedsSum)}`
  );

  const laundryHits = pack.entities.filter(
    (e) => e.crossIntelligence?.laundryTrail?.detected
  ).length;
  log(
    "3.5 >=1 entity with laundryTrail.detected",
    laundryHits >= 1,
    `laundryHits=${laundryHits}`
  );

  const confClaims = pack.confidenceAssessment?.length ?? 0;
  log(
    "3.6 confidenceAssessment.length > 0",
    confClaims > 0,
    `claims=${confClaims}${confClaims > 0 ? " · " + pack.confidenceAssessment.map((c) => c.claim).join(" · ") : ""}`
  );

  log(
    "3.7 timelineCorrelation exists",
    pack.timelineCorrelation != null,
    `hasTimeline=${pack.timelineCorrelation?.hasTimeline}, signals=${pack.timelineCorrelation?.correlationSignals?.length ?? 0}`
  );
} catch (err) {
  log("test-intelligence-pack", false, `CRASH: ${String(err).slice(0, 200)}`);
  console.error(err);
}

console.log("\n__JSON__\n" + JSON.stringify(results));
await prisma.$disconnect();
