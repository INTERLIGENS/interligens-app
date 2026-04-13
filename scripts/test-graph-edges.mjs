import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const results = [];

function log(label, pass, detail) {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  results.push({ label, pass, detail });
}

function normalizeHandle(v) {
  return v.replace(/^@+/, "").trim().toLowerCase();
}

// Simulate the cross-intel edge construction that CaseGraph performs
// when it receives enrichment data. An edge is created between any two
// entities whose enrichment resolves to the same kolName.

// 5.1 Get all cases with entities
const casesWithEntities = await prisma.vaultCase.findMany({
  where: { entities: { some: {} } },
  select: {
    id: true,
    caseTemplate: true,
    entities: { select: { id: true, type: true, value: true } },
  },
});
console.log(`Found ${casesWithEntities.length} cases with entities`);

if (casesWithEntities.length === 0) {
  log("5.0 cases with entities exist", false, "none");
  console.log("\n__JSON__\n" + JSON.stringify(results));
  await prisma.$disconnect();
  process.exit(0);
}

for (const c of casesWithEntities) {
  console.log(`\n--- Case ${c.id} (${c.caseTemplate}) · ${c.entities.length} entities ---`);

  // 5.2 Resolve each entity to a kolName via enrichment logic
  const enrichment = {};
  for (const e of c.entities) {
    let kolName = null;
    if (e.type === "HANDLE") {
      const h = normalizeHandle(e.value);
      const profile = await prisma.kolProfile.findFirst({
        where: { handle: { equals: h, mode: "insensitive" } },
        select: { handle: true, displayName: true },
      });
      if (profile) kolName = profile.displayName ?? profile.handle;
    } else if (e.type === "WALLET" || e.type === "CONTRACT") {
      const wallet = await prisma.kolWallet.findFirst({
        where: {
          OR: [
            { address: e.value },
            { address: e.value.toLowerCase() },
          ],
        },
        select: { kolHandle: true },
      });
      if (wallet) {
        const profile = await prisma.kolProfile.findFirst({
          where: { handle: { equals: wallet.kolHandle, mode: "insensitive" } },
          select: { displayName: true, handle: true },
        });
        kolName = profile?.displayName ?? wallet.kolHandle;
      }
    }
    if (kolName) {
      enrichment[e.id] = { inKolRegistry: true, kolName };
      console.log(`  ${e.type} ${e.value.slice(0, 24)}… → KOL: ${kolName}`);
    } else {
      console.log(`  ${e.type} ${e.value.slice(0, 24)}… → no KOL match`);
    }
  }

  // 5.3 Group by kolName (lowercased)
  const kolGroups = {};
  for (const entity of c.entities) {
    const enr = enrichment[entity.id];
    if (enr?.inKolRegistry && enr.kolName) {
      const key = enr.kolName.toLowerCase();
      (kolGroups[key] ??= []).push(entity);
    }
  }

  let edgesInThisCase = 0;
  for (const [kolName, entities] of Object.entries(kolGroups)) {
    if (entities.length < 2) continue;
    for (let i = 0; i < entities.length - 1; i++) {
      const a = entities[i];
      const b = entities[i + 1];
      edgesInThisCase++;
      console.log(
        `  EDGE: ${a.type}:${a.value.slice(0, 16)} ↔ ${b.type}:${b.value.slice(0, 16)} (Same KOL: ${kolName})`
      );
    }
  }

  log(
    `5.${c.id.slice(0, 8)} cross-intel edges`,
    edgesInThisCase > 0 || c.entities.length < 2,
    edgesInThisCase > 0
      ? `${edgesInThisCase} edge(s)`
      : `no edges (${c.entities.length} entities, ${Object.keys(kolGroups).length} KOL groups, all singletons)`
  );
}

console.log("\n__JSON__\n" + JSON.stringify(results));
await prisma.$disconnect();
