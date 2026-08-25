// ─── Auto-test de la sonde C4 — les scénarios de la checklist post-deploy ────
//
//   npx tsx src/scripts/watchdog/c4-selftest.ts
//
// AUCUN ACCÈS BASE, AUCUN RÉSEAU, AUCUNE ÉCRITURE. La sonde est une fonction
// pure : on lui donne un monde, on lit son verdict. C'est ce qui permet de
// vérifier « un CAPPED déclenche bien un WARNING » et « un backfill ne
// rafraîchit rien » sans attendre un vrai plafond ni toucher la production.
//
// Ces deux scénarios sont les points ③ et ④ de la checklist de
// docs/prep/WATCHER_CLOSURE_2026-08-25.md. Ils doublent les tests Vitest — à
// dessein : après un déploiement on veut pouvoir REJOUER le raisonnement à la
// main et LIRE le rapport, pas seulement voir passer un point vert.

import {
  evaluateWatcherHealth,
  formatWatcherHealthReport,
} from "@/lib/watchdog/watcherHealthProbe";
import {
  INGESTION_MODE,
  RUN_STATUS,
  SOURCE_WATCHER_V2,
  TRIGGER,
  type WatcherRunRecord,
} from "@/lib/watchdog/watcherRunTypes";

const NOW = new Date("2026-08-27T09:00:00Z");

function run(over: Partial<WatcherRunRecord> & { id: string }): WatcherRunRecord {
  return {
    source: SOURCE_WATCHER_V2,
    trigger: TRIGGER.CRON,
    ingestionMode: INGESTION_MODE.LIVE,
    status: RUN_STATUS.SUCCESS,
    scheduledAt: null,
    startedAt: null,
    collectionStartedAt: null,
    finishedAt: null,
    handlesAttempted: 50,
    handlesSucceeded: 50,
    tweetsFetched: 300,
    newPostsObserved: 80,
    candidatesProduced: 70,
    xApiErrors: 0,
    durationMs: 200_000,
    ...over,
  };
}

/** Un run cron LIVE sain, le jour J à 06:00 UTC. */
const healthyOn = (id: string, day: string) =>
  run({
    id,
    scheduledAt: new Date(`${day}T06:00:00Z`),
    startedAt: new Date(`${day}T06:00:10Z`),
    collectionStartedAt: new Date(`${day}T06:00:12Z`),
    finishedAt: new Date(`${day}T06:04:00Z`),
  });

/** Un run capé : le cron a démarré, la collecte n'a JAMAIS commencé. */
const cappedOn = (id: string, day: string) =>
  run({
    id,
    status: RUN_STATUS.CAPPED,
    scheduledAt: new Date(`${day}T06:00:00Z`),
    startedAt: new Date(`${day}T06:00:10Z`),
    collectionStartedAt: null, // ← la signature du bail budgétaire
    finishedAt: new Date(`${day}T06:00:12Z`),
    handlesAttempted: 0,
    handlesSucceeded: 0,
    tweetsFetched: 0,
    newPostsObserved: 0,
    candidatesProduced: 0,
    durationMs: 2_000,
  });

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "❌"} ${label} → ${JSON.stringify(actual)}${ok ? "" : ` (attendu ${JSON.stringify(expected)})`}`);
}

// ── ③ Un CAPPED simulé déclenche un WARNING, pas un DOWN ───────────────────
console.log("\n=== ③ Un run capé aujourd'hui, après un run sain hier ===\n");
const scenarioCapped = [healthyOn("hier", "2026-08-26"), cappedOn("aujourdhui", "2026-08-27")];
const rCapped = evaluateWatcherHealth(scenarioCapped, NOW);
console.log(formatWatcherHealthReport(rCapped));
console.log("");
check("Scheduler reste VERT (le cron a bien démarré)", rCapped.scheduler.level, "HEALTHY");
check("Collector passe WARNING (aucune lecture X)", rCapped.collector.level, "WARNING");
check("Budget passe WARNING (1 run capé)", rCapped.budget.level, "WARNING");
check("overall = DEGRADED, et surtout PAS 'DOWN'", rCapped.overall, "DEGRADED");
check(
  "la fraîcheur du dernier succès reste celle d'HIER",
  rCapped.successfulFreshness?.toISOString(),
  "2026-08-26T06:04:00.000Z",
);

// ── ③b Deux capés consécutifs → CRITICAL ───────────────────────────────────
console.log("\n=== ③b Deux runs capés consécutifs ===\n");
const rCapped2 = evaluateWatcherHealth(
  [cappedOn("j-1", "2026-08-26"), cappedOn("j-0", "2026-08-27")],
  NOW,
);
check("consecutiveCappedRuns = 2", rCapped2.consecutiveCappedRuns, 2);
check("Budget passe CRITICAL", rCapped2.budget.level, "CRITICAL");
check("Scheduler reste VERT dans les deux cas", rCapped2.scheduler.level, "HEALTHY");

// ── ④ Un backfill ne rafraîchit PAS la sonde (invariant C4-1) ──────────────
console.log("\n=== ④ Backfill de 261 candidats à l'instant, sur un LIVE vieux de 5 jours ===\n");
const vieuxLive = healthyOn("live-vieux", "2026-08-22");
const backfill = run({
  id: "backfill-maintenant",
  trigger: TRIGGER.BACKFILL,
  ingestionMode: INGESTION_MODE.BACKFILL,
  scheduledAt: null,
  startedAt: new Date("2026-08-27T08:00:00Z"),
  collectionStartedAt: new Date("2026-08-27T08:00:01Z"),
  finishedAt: new Date("2026-08-27T08:02:00Z"),
  handlesAttempted: 0,
  handlesSucceeded: 0,
  tweetsFetched: 0,
  newPostsObserved: 261,
  candidatesProduced: 261,
});

const sansBackfill = evaluateWatcherHealth([vieuxLive], NOW);
const avecBackfill = evaluateWatcherHealth([vieuxLive, backfill], NOW);
console.log(formatWatcherHealthReport(avecBackfill));
console.log("");
check("overall reste CRITICAL malgré les 261 candidats", avecBackfill.overall, "CRITICAL");
check(
  "successfulFreshness INCHANGÉE À LA SECONDE",
  avecBackfill.successfulFreshness?.toISOString(),
  sansBackfill.successfulFreshness?.toISOString(),
);
check("le backfill est COMPTÉ dans l'audit", avecBackfill.ignoredRunCount, 1);
check("…et n'entre pas dans les runs jugés", avecBackfill.liveCronRunCount, 1);
check(
  "le verdict est bit-à-bit identique avec et sans le backfill (hors compteur d'audit)",
  JSON.stringify({ ...avecBackfill, ignoredRunCount: 0 }) === JSON.stringify(sansBackfill),
  true,
);
check(
  "le rendu texte ne contient jamais le mot « down »",
  /down/i.test(formatWatcherHealthReport(avecBackfill)),
  false,
);

console.log(
  failures === 0
    ? "\n✅ AUTO-TEST C4 : tous les scénarios de la checklist passent.\n"
    : `\n❌ AUTO-TEST C4 : ${failures} vérification(s) en échec.\n`,
);
process.exit(failures === 0 ? 0 : 1);
