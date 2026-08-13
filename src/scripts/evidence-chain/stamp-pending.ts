/**
 * stamp-pending.ts — Rattrapage TSA des pièces en attente (CC-OFFLINE-56).
 *
 * Les flux serverless (retail submit, commit opérateur) créent les EvidenceItem
 * avec tsaToken NULL (openssl non garanti sur le runtime Vercel + latence TSA
 * inacceptable en requête publique). Ce script, lancé QUOTIDIENNEMENT par
 * launchd sur Host-001 (com.interligens.evidence-stamp.plist, 08:30 — avant le
 * watchdog de 09:00 qui rapporte « TSA pending: N » sur Telegram), horodate
 * tout ce qui attend.
 *
 * ⚠️ openssl : nécessite un openssl avec la sous-commande `ts` (Homebrew
 * OpenSSL 3.x). Le LibreSSL d'Apple (/usr/bin/openssl) ne l'a PAS — le plist
 * met /opt/homebrew/bin en tête de PATH.
 *
 * Usage :
 *   pnpm tsx src/scripts/evidence-chain/stamp-pending.ts               # live
 *   pnpm tsx src/scripts/evidence-chain/stamp-pending.ts --dry-run
 *   pnpm tsx src/scripts/evidence-chain/stamp-pending.ts --limit 100 --throttle-ms 1000
 *
 * Idempotent et reprenable : ne touche que tsaToken IS NULL ; un échec laisse
 * la pièce pending pour le run suivant. Aucune autre colonne modifiée.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaEvidenceStore } from "../../lib/evidence-chain/store/prisma";
import { timestampWithRouting } from "../../lib/evidence-chain/tsa";

const flagN = (name: string, def: number) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : def;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = flagN("limit", 500);
  const throttle = flagN("throttle-ms", 1000);

  const prisma = new PrismaClient();
  const store = new PrismaEvidenceStore(prisma);
  try {
    const pending = (await prisma.$queryRawUnsafe(
      `SELECT "id","sha256","provenanceType","ingestedAt" FROM "EvidenceItem"
        WHERE "tsaToken" IS NULL ORDER BY "ingestedAt" ASC LIMIT $1`,
      limit,
    )) as Array<{ id: string; sha256: string; provenanceType: string | null; ingestedAt: Date }>;

    console.log(`[stamp-pending] ${pending.length} pièce(s) en attente de TSA (limit ${limit})${dryRun ? " — DRY-RUN" : ""}`);
    let done = 0, fail = 0;
    for (const p of pending) {
      if (dryRun) {
        console.log(`  DRY ${p.id} sha=${p.sha256.slice(0, 12)}… ingested=${new Date(p.ingestedAt).toISOString()}`);
        continue;
      }
      try {
        const routed = await timestampWithRouting(p.sha256, { criticality: "OTHER" });
        if (!routed) { fail++; console.error(`  PENDING ${p.id} — aucune TSA joignable`); continue; }
        const { result: ts, tsaUsed } = routed;
        await store.setTsa(p.id, ts.token, ts.provider, ts.genTime, ts.certChainPem);
        await store.insertAccessLog(p.id, "VERIFY", "stamp-pending",
          `tsa rattrapée via ${tsaUsed} (${ts.provider}); cert chain archived; ingestedAt=${new Date(p.ingestedAt).toISOString()}`);
        done++;
        console.log(`  OK  ${p.id} via ${tsaUsed} (${ts.provider})`);
      } catch (e) {
        fail++;
        console.error(`  FAIL ${p.id}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(throttle);
    }

    const rest = (await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "EvidenceItem" WHERE "tsaToken" IS NULL`,
    )) as Array<{ n: number }>;
    console.log(`[stamp-pending] horodatées=${done}, échecs=${fail} — TSA pending restant: ${rest[0]?.n ?? "?"}`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("[stamp-pending] FATAL", e); process.exit(1); });
