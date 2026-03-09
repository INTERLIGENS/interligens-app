// @pr3:seed-sources-script
/**
 * scripts/seed-sources.ts
 *
 * Script CLI d'ingestion idempotente des sources INTERLIGENS.
 *
 * Usage :
 *   pnpm tsx scripts/seed-sources.ts              # run normal
 *   pnpm tsx scripts/seed-sources.ts --dry-run    # simulation sans écriture
 *   pnpm tsx scripts/seed-sources.ts --force      # force même si sources existent
 *   pnpm tsx scripts/seed-sources.ts --verbose    # détail par source
 *
 * Exit codes :
 *   0 — succès complet (created + skipped, 0 failed)
 *   1 — erreurs partielles (au moins 1 failed)
 *   2 — échec total (tous failed)
 */

import { seedDefaultSources, DEFAULT_SOURCES } from "../src/lib/vault/bootstrap/seedSources";
import { prisma } from "../src/lib/prisma";

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  gray:   "\x1b[90m",
};

function fmt(color: string, text: string) {
  return `${color}${text}${c.reset}`;
}

// ── Args ──────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const dryRun  = args.includes("--dry-run");
const force   = args.includes("--force");
const verbose = args.includes("--verbose");

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();

  console.log(fmt(c.bold + c.cyan, "\n╔══════════════════════════════════════════╗"));
  console.log(fmt(c.bold + c.cyan,   "║   INTERLIGENS — Seed Sources             ║"));
  console.log(fmt(c.bold + c.cyan,   "╚══════════════════════════════════════════╝\n"));

  if (dryRun)  console.log(fmt(c.yellow, "  ⚡ DRY-RUN activé — aucune écriture en DB\n"));
  if (force)   console.log(fmt(c.yellow, "  ⚡ FORCE activé — relance même si sources existent\n"));

  // Guard prod : vérifier les sources existantes sauf si --force
  const existingCount = await prisma.sourceRegistry.count();

  if (existingCount > 0 && !force && !dryRun) {
    console.log(fmt(c.yellow,
      `  ⚠️  ${existingCount} source(s) déjà en base.\n` +
      `     Relancer avec --force pour upsert ou --dry-run pour simuler.\n`
    ));
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(fmt(c.gray, `  Sources à traiter : ${DEFAULT_SOURCES.length}`));
  console.log(fmt(c.gray, `  Sources existantes : ${existingCount}\n`));

  // ── Seed ──────────────────────────────────────────────────────────────────
  const report = await seedDefaultSources(DEFAULT_SOURCES, dryRun);

  // ── Résumé détaillé (verbose) ─────────────────────────────────────────────
  if (verbose) {
    console.log(fmt(c.bold, "\n  Détail par source :"));
    for (const d of report.details) {
      if (d.status === "created") {
        console.log(`    ${fmt(c.green, "✓")} ${d.name}`);
      } else if (d.status === "skipped") {
        console.log(`    ${fmt(c.gray, "–")} ${d.name} ${fmt(c.gray, "(skipped)")}`);
      } else {
        console.log(`    ${fmt(c.red, "✗")} ${d.name} — ${fmt(c.red, d.error ?? "erreur inconnue")}`);
      }
    }
  }

  // ── Résumé final ──────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);

  console.log(fmt(c.bold, "\n  ┌─────────────────────────────────┐"));
  console.log(fmt(c.bold, `  │  Résumé du seed                 │`));
  console.log(fmt(c.bold, `  ├─────────────────────────────────┤`));
  console.log(`  │  Total     : ${String(report.total).padEnd(19)}│`);
  console.log(`  │  ${fmt(c.green, "Créées")}    : ${String(report.created).padEnd(19)}│`);
  console.log(`  │  ${fmt(c.gray, "Skippées")}  : ${String(report.skipped).padEnd(19)}│`);
  console.log(`  │  ${fmt(c.red,  "Erreurs")}   : ${String(report.failed).padEnd(19)}│`);
  console.log(`  │  Durée     : ${(elapsed + "s").padEnd(19)}│`);
  console.log(fmt(c.bold, `  └─────────────────────────────────┘\n`));

  await prisma.$disconnect();

  // ── Exit code ─────────────────────────────────────────────────────────────
  if (report.failed === 0) {
    console.log(fmt(c.green + c.bold, "  ✅  Seed terminé sans erreur.\n"));
    process.exit(0);
  } else if (report.failed < report.total) {
    console.log(fmt(c.yellow + c.bold, `  ⚠️   Seed partiel : ${report.failed} erreur(s).\n`));
    process.exit(1);
  } else {
    console.log(fmt(c.red + c.bold, "  ❌  Seed en échec total.\n"));
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(fmt(c.red + c.bold, "\n  ❌  Erreur fatale non gérée :"), err);
  prisma.$disconnect().finally(() => process.exit(2));
});
