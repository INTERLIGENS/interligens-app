/**
 * REFLEX V1 — narrative scripts seed.
 *
 * Idempotent upsert of the 15 NarrativeScript rows backing the matcher.
 * Run with: pnpm seed:narrative-scripts
 *
 * Requires the NarrativeScript table to exist — see docs/reflex-v1.sql
 * (apply via Neon SQL Editor on ep-square-band before running this).
 *
 * Flags:
 *   --dry-run   simulate without writing
 *   --verbose   print every script's keyword/regex counts
 */

import { prisma } from "../../src/lib/prisma";
import { NARRATIVE_SCRIPTS } from "../../src/lib/reflex/narrativeScripts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose");

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};
const fmt = (color: string, t: string) => `${color}${t}${c.reset}`;

interface Report {
  total: number;
  upserted: number;
  unchanged: number;
  failed: number;
  failures: { code: string; error: string }[];
}

async function main(): Promise<Report> {
  const startedAt = Date.now();
  console.log(
    fmt(c.bold + c.cyan, "\n╔══════════════════════════════════════════════╗"),
  );
  console.log(
    fmt(c.bold + c.cyan, "║   REFLEX V1 — Seed NarrativeScript           ║"),
  );
  console.log(
    fmt(c.bold + c.cyan, "╚══════════════════════════════════════════════╝\n"),
  );
  console.log(fmt(c.gray, `  Target  : prisma.narrativeScript`));
  console.log(fmt(c.gray, `  Scripts : ${NARRATIVE_SCRIPTS.length}`));
  if (dryRun) console.log(fmt(c.yellow, `  Mode    : DRY-RUN (no writes)`));
  console.log();

  const report: Report = {
    total: NARRATIVE_SCRIPTS.length,
    upserted: 0,
    unchanged: 0,
    failed: 0,
    failures: [],
  };

  for (const s of NARRATIVE_SCRIPTS) {
    try {
      if (verbose) {
        console.log(
          fmt(
            c.gray,
            `  · ${s.code.padEnd(28)} kw=${s.keywords.length.toString().padStart(2)} re=${s.regexes.length.toString().padStart(2)} conf=${s.defaultConfidence}`,
          ),
        );
      }
      if (dryRun) {
        report.upserted++;
        continue;
      }
      await prisma.narrativeScript.upsert({
        where: { code: s.code },
        update: {
          label: s.label,
          category: s.category,
          keywords: s.keywords,
          regexes: s.regexes,
          derivedFrom: s.derivedFrom,
          defaultConfidence: s.defaultConfidence,
          severity: s.severity,
          active: true,
        },
        create: {
          code: s.code,
          label: s.label,
          category: s.category,
          keywords: s.keywords,
          regexes: s.regexes,
          derivedFrom: s.derivedFrom,
          defaultConfidence: s.defaultConfidence,
          severity: s.severity,
          active: true,
        },
      });
      report.upserted++;
    } catch (e) {
      report.failed++;
      report.failures.push({
        code: s.code,
        error: e instanceof Error ? e.message : String(e),
      });
      console.log(
        fmt(
          c.red,
          `  ✗ ${s.code}: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  const elapsed = Date.now() - startedAt;
  console.log();
  console.log(
    fmt(
      c.bold,
      `  Result  : ${report.upserted}/${report.total} upserted` +
        (report.failed > 0 ? `, ${report.failed} FAILED` : ""),
    ),
  );
  console.log(fmt(c.gray, `  Elapsed : ${elapsed}ms`));
  console.log();
  return report;
}

main()
  .then(async (report) => {
    await prisma.$disconnect();
    if (report.failed === 0) {
      console.log(fmt(c.green + c.bold, "  ✅ Seed completed cleanly.\n"));
      process.exit(0);
    }
    if (report.failed < report.total) {
      console.log(
        fmt(c.yellow + c.bold, `  ⚠️  Partial: ${report.failed} failure(s).\n`),
      );
      process.exit(1);
    }
    console.log(fmt(c.red + c.bold, "  ❌ Total failure.\n"));
    process.exit(2);
  })
  .catch(async (err) => {
    console.error(fmt(c.red + c.bold, "\n  ❌ Unhandled error:"), err);
    await prisma.$disconnect();
    process.exit(2);
  });
