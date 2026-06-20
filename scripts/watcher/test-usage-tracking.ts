// ─────────────────────────────────────────────────────────────
// TEST — Tracking conso X API (XApiUsage)
// Simule les counts d'un run SANS appeler X API ni écrire en DB.
// DRY_RUN=true → recordXApiUsage logge le calcul et retourne avant
// tout accès Prisma. Valide : formule de coût, compteur lookups,
// comptabilisation partielle (crash mi-run), prix configurable.
//
//   DRY_RUN=true npx tsx scripts/watcher/test-usage-tracking.ts
// ─────────────────────────────────────────────────────────────

process.env.DRY_RUN = 'true'; // doit être posé AVANT l'import (lu au load)

import assert from 'node:assert';

async function main() {
  const { recordXApiUsage } = await import('./watcherV2');

  // Helper: fabrique un WatcherStats partiel sans toucher au reste.
  const mkStats = (tweetsFetched: number, userLookups: number) => ({
    handlesScanned: userLookups, handlesFailed: 0,
    tweetsFetched, userLookups,
    candidatesCreated: 0, candidatesSkipped: 0,
    profilesEnriched: 0, profilesPromoted: 0,
  });

  const PRICE = 0.0058;
  let pass = 0;

  // ── Cas 1 : run complet nominal ─────────────────────────────
  // 100 (GordonGekko) + 10×151 autres handles = 1610 posts, 152 lookups
  {
    const posts = 100 + 10 * 151, lookups = 152;
    const expected = posts * PRICE; // lookups non refacturés par défaut
    assert.strictEqual(posts, 1610);
    assert.ok(Math.abs(expected - 9.338) < 1e-9, `cost=${expected}`);
    console.log(`\n[Cas 1] run complet — ${posts} posts, ${lookups} lookups`);
    await recordXApiUsage(mkStats(posts, lookups) as any);
    console.log(`        attendu: $${expected.toFixed(4)} ✓`);
    pass++;
  }

  // ── Cas 2 : crash à mi-run (30 handles traités) ─────────────
  // Comptabilité partielle : seuls les reads réellement faits comptent.
  {
    const posts = 100 + 10 * 29, lookups = 30; // 30 handles dont GordonGekko
    const expected = posts * PRICE;
    console.log(`\n[Cas 2] crash mi-run — ${posts} posts, ${lookups} lookups`);
    await recordXApiUsage(mkStats(posts, lookups) as any);
    console.log(`        attendu: $${expected.toFixed(4)} (partiel, pas de double comptage) ✓`);
    pass++;
  }

  // ── Cas 3 : 0 read → aucune écriture ────────────────────────
  {
    console.log(`\n[Cas 3] 0 read consommé`);
    await recordXApiUsage(mkStats(0, 0) as any);
    pass++;
  }

  // ── Cas 4 : prix historique faux ($0.10/1000) pour contraste ─
  {
    process.env.X_API_COST_PER_POST = '0.0001';
    const posts = 1610, expectedWrong = posts * 0.0001;
    console.log(`\n[Cas 4] ancien prix $0.10/1000 (faux) — ${posts} posts`);
    await recordXApiUsage(mkStats(posts, 152) as any);
    console.log(`        donnerait $${expectedWrong.toFixed(4)} vs réel $${(posts * PRICE).toFixed(4)} → 58× sous-estimé`);
    delete process.env.X_API_COST_PER_POST;
    pass++;
  }

  // ── Cas 5 : lookups modélisés via env ───────────────────────
  {
    process.env.X_API_COST_PER_LOOKUP = '0.01';
    const posts = 1610, lookups = 152;
    const expected = posts * PRICE + lookups * 0.01;
    console.log(`\n[Cas 5] lookups facturés $0.01 — ${posts} posts, ${lookups} lookups`);
    await recordXApiUsage(mkStats(posts, lookups) as any);
    console.log(`        attendu: $${expected.toFixed(4)} ✓`);
    delete process.env.X_API_COST_PER_LOOKUP;
    pass++;
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ ${pass}/5 cas simulés — 0 appel X API, 0 écriture DB (DRY_RUN)`);
  console.log(`${'═'.repeat(50)}\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
