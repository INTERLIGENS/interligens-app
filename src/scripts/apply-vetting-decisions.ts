/**
 * src/scripts/apply-vetting-decisions.ts
 * Apply reviewed night-vetting decisions to KolProfile (2026-06-13).
 *   STEP 3 promote 5 confirmed signal callers: status draft -> published
 *   STEP 4 exclude 1 + downgrade 4 (label/isActive)
 * Raw SQL (isActive/deactivatedReason not in Prisma client). Idempotent.
 *
 * Usage: pnpm tsx -r dotenv/config src/scripts/apply-vetting-decisions.ts [--write]
 */

import { prisma } from "@/lib/prisma";

const PROMOTE = ["cryptoWZRD_", "DaanCrypto", "52kskew", "CastilloTrading", "CryptoCred"];
const EXCLUDE = "0xkyle__";
const BOT = ["0xCryptoshi", "0xEthan"];
const PROMO = ["alterfind_", "CryptoThro"];

async function main() {
  const write = process.argv.slice(2).includes("--write");
  console.log(`[vetting-apply] mode: ${write ? "WRITE" : "DRY"}\n`);

  const all = [...PROMOTE, EXCLUDE, ...BOT, ...PROMO];
  const before = await prisma.$queryRawUnsafe<{ handle: string; status: string; label: string; isActive: boolean; deactivatedReason: string | null }[]>(
    `SELECT "handle","status","label","isActive","deactivatedReason" FROM "KolProfile" WHERE lower("handle") = ANY($1::text[]) ORDER BY "handle"`,
    all.map((h) => h.toLowerCase()),
  );
  console.log("BEFORE:");
  for (const r of before) console.log(`  @${r.handle.padEnd(16)} status=${r.status} label=${r.label} active=${r.isActive} reason=${r.deactivatedReason ?? "-"}`);

  if (write) {
    // STEP 3 — promote
    const nPromote = await prisma.$executeRawUnsafe(
      `UPDATE "KolProfile" SET "status"='published' WHERE lower("handle") = ANY($1::text[]) AND "status"<>'published'`,
      PROMOTE.map((h) => h.toLowerCase()),
    );
    // STEP 4a — exclude
    const nExclude = await prisma.$executeRawUnsafe(
      `UPDATE "KolProfile" SET "isActive"=false, "deactivatedAt"=now(), "deactivatedReason"='not_found_2026_06_13' WHERE lower("handle")=lower($1)`,
      EXCLUDE,
    );
    // STEP 4b — bot label (status unchanged)
    const nBot = await prisma.$executeRawUnsafe(
      `UPDATE "KolProfile" SET "label"='bot_suspected' WHERE lower("handle") = ANY($1::text[])`,
      BOT.map((h) => h.toLowerCase()),
    );
    // STEP 4c — paid promo label (status unchanged)
    const nPromo = await prisma.$executeRawUnsafe(
      `UPDATE "KolProfile" SET "label"='paid_promo_confirmed' WHERE lower("handle") = ANY($1::text[])`,
      PROMO.map((h) => h.toLowerCase()),
    );
    console.log(`\n[writes] promoted=${nPromote} excluded=${nExclude} bot_labeled=${nBot} promo_labeled=${nPromo}`);
  } else {
    console.log("\n(DRY — re-run with --write)");
  }

  const after = await prisma.$queryRawUnsafe<{ handle: string; status: string; label: string; isActive: boolean; deactivatedReason: string | null }[]>(
    `SELECT "handle","status","label","isActive","deactivatedReason" FROM "KolProfile" WHERE lower("handle") = ANY($1::text[]) ORDER BY "handle"`,
    all.map((h) => h.toLowerCase()),
  );
  console.log("\nAFTER:");
  for (const r of after) console.log(`  @${r.handle.padEnd(16)} status=${r.status} label=${r.label} active=${r.isActive} reason=${r.deactivatedReason ?? "-"}`);

  // overall counts
  const pub = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int n FROM "KolProfile" WHERE "status"='published'`);
  const activeNew = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int n FROM "KolProfile" WHERE "isActive"=true`);
  console.log(`\n[totals] KolProfile status='published': ${pub[0].n} | isActive=true: ${activeNew[0].n}`);
}

main()
  .catch((e) => { console.error("[vetting-apply] failed", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.exit(process.exitCode ?? 0); });
