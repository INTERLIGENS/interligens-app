import { PrismaClient } from "@prisma/client";
import { analyzeLaundryTrail } from "../src/lib/laundry/engine";
import { validateLaundryOutput } from "../src/lib/laundry/guardrails";
import { readFileSync } from "fs";
import { resolve } from "path";

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const handle = args.handle;
  const dataPath = args.data;
  const narrative = args.narrative;

  if (!handle || !dataPath) {
    console.error("Usage: npx tsx scripts/seedLaundryTrail.ts --handle <kolHandle> --data <hops.json> [--narrative \"text\"]");
    process.exit(1);
  }

  const raw = readFileSync(resolve(dataPath), "utf-8");
  const hops = JSON.parse(raw);

  if (!Array.isArray(hops) || hops.length === 0) {
    console.error("Error: hops file must be a non-empty JSON array");
    process.exit(1);
  }

  const chain = hops[0].chain ?? "ethereum";

  if (narrative) validateLaundryOutput(narrative);

  const output = await analyzeLaundryTrail(hops[0].address, chain, hops);

  const trail = await prisma.laundryTrail.create({
    data: {
      walletAddress: output.walletAddress,
      chain: output.chain,
      trailType: output.trailType,
      laundryRisk: output.laundryRisk,
      recoveryDifficulty: output.recoveryDifficulty,
      trailBreakHop: output.trailBreakHop ?? null,
      fundsUnresolved: output.fundsUnresolved ?? null,
      narrativeText: narrative ?? null,
      evidenceNote: output.evidenceNote,
      kolHandle: handle,
      signals: {
        create: output.signals.map(s => ({
          family: s.family,
          confirmed: s.confirmed,
          severity: s.severity,
          detail: s.detail,
          rawData: (s.rawData ?? {}) as any,
        })),
      },
    },
  });

  const fullTrail = await prisma.laundryTrail.findUnique({ where: { id: trail.id }, include: { signals: true } });
  console.log("Trail created:", trail.id);
  console.log("Signals:", (fullTrail?.signals ?? []).map((s: any) => `${s.family} (${s.severity}${s.confirmed ? "" : ", adjacent"})`).join(", "));
  console.log("Risk:", trail.laundryRisk);
  console.log("Recovery:", trail.recoveryDifficulty);
  if (trail.trailBreakHop) console.log("Trail break hop:", trail.trailBreakHop);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
