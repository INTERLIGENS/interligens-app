/**
 * REFLEX V1 — calibration runner (Commit 8/15).
 *
 * Loads the 4 fixture files (200 cases total, 50 per verdict bucket),
 * runs `decide(engines)` on each, and produces a full calibration
 * report. Hard CI gates:
 *
 *   - Global STOP rate ≤ 30%      ("REFLEX trop agressif, calibration
 *                                   overfiring" if breached)
 *   - False-positive rate ≤ 5%    (no-critical bucket → STOP)
 *   - False-negative rate ≤ 5%    (stop bucket → NO_CRITICAL_SIGNAL)
 *
 * Individual fixture mismatches are LOGGED in the report (printed to
 * console + written to __tests__/reflex/calibration/last-report.json)
 * but do not fail the suite. That lets calibration tune thresholds
 * iteratively without the CI churning red on every minor drift.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decide } from "@/lib/reflex/verdict";
import type {
  ReflexEngineOutput,
  ReflexVerdict,
} from "@/lib/reflex/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Fixture {
  id: string;
  expectedVerdict: ReflexVerdict;
  bucket: "stop" | "wait" | "verify" | "no-critical";
  category: string;
  notes: string;
  engines: ReflexEngineOutput[];
}

interface Mismatch {
  id: string;
  bucket: string;
  category: string;
  expected: ReflexVerdict;
  actual: ReflexVerdict;
  confidence: string;
  confidenceScore: number;
  notes: string;
}

interface BucketReport {
  total: number;
  passed: number;
  failed: number;
  /** Bucket=no-critical AND actual verdict = STOP */
  falsePositiveStop: number;
  /** Bucket=stop AND actual verdict = NO_CRITICAL_SIGNAL */
  falseNegativeNoSignal: number;
}

interface CalibrationReport {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  globalStopRate: number;
  byVerdict: Record<ReflexVerdict, number>;
  byBucket: Record<string, BucketReport>;
  mismatches: Mismatch[];
  generatedAt: string;
}

function loadFixtures(): Fixture[] {
  const dir = join(__dirname, "cases");
  const files = ["stop.json", "wait.json", "verify.json", "no-critical.json"];
  const all: Fixture[] = [];
  for (const f of files) {
    const raw = readFileSync(join(dir, f), "utf-8");
    const parsed = JSON.parse(raw) as { cases: Fixture[] };
    all.push(...parsed.cases);
  }
  return all;
}

function runCalibration(): CalibrationReport {
  const fixtures = loadFixtures();

  const byVerdict: Record<ReflexVerdict, number> = {
    STOP: 0, WAIT: 0, VERIFY: 0, NO_CRITICAL_SIGNAL: 0,
  };
  const byBucket: Record<string, BucketReport> = {
    stop: { total: 0, passed: 0, failed: 0, falsePositiveStop: 0, falseNegativeNoSignal: 0 },
    wait: { total: 0, passed: 0, failed: 0, falsePositiveStop: 0, falseNegativeNoSignal: 0 },
    verify: { total: 0, passed: 0, failed: 0, falsePositiveStop: 0, falseNegativeNoSignal: 0 },
    "no-critical": { total: 0, passed: 0, failed: 0, falsePositiveStop: 0, falseNegativeNoSignal: 0 },
  };
  const mismatches: Mismatch[] = [];

  for (const f of fixtures) {
    const result = decide(f.engines);
    byVerdict[result.verdict]++;
    const b = byBucket[f.bucket];
    b.total++;
    if (result.verdict === f.expectedVerdict) {
      b.passed++;
    } else {
      b.failed++;
      mismatches.push({
        id: f.id,
        bucket: f.bucket,
        category: f.category,
        expected: f.expectedVerdict,
        actual: result.verdict,
        confidence: result.confidence,
        confidenceScore: result.confidenceScore,
        notes: f.notes,
      });
    }
    // False-positive: no-critical bucket produced STOP
    if (f.bucket === "no-critical" && result.verdict === "STOP") {
      b.falsePositiveStop++;
    }
    // False-negative: stop bucket produced NO_CRITICAL_SIGNAL
    if (f.bucket === "stop" && result.verdict === "NO_CRITICAL_SIGNAL") {
      b.falseNegativeNoSignal++;
    }
  }

  const total = fixtures.length;
  const passed = total - mismatches.length;
  const report: CalibrationReport = {
    total,
    passed,
    failed: mismatches.length,
    passRate: total > 0 ? passed / total : 0,
    globalStopRate: total > 0 ? byVerdict.STOP / total : 0,
    byVerdict,
    byBucket,
    mismatches,
    generatedAt: new Date().toISOString(),
  };

  // Persist the report next to the runner so the operator can grep it
  // after a CI run that fails on a rate gate.
  writeFileSync(
    join(__dirname, "last-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8",
  );

  return report;
}

const report = runCalibration();

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function printReport(r: CalibrationReport): void {
  /* eslint-disable no-console */
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║   REFLEX V1 — Calibration Report (Commit 8/15)             ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`  Total fixtures   : ${r.total}`);
  console.log(`  Passed           : ${r.passed} (${pct(r.passRate)})`);
  console.log(`  Failed           : ${r.failed}\n`);

  console.log("  Verdict distribution");
  console.log(`    STOP                  : ${r.byVerdict.STOP}  (${pct(r.byVerdict.STOP / r.total)})`);
  console.log(`    WAIT                  : ${r.byVerdict.WAIT}  (${pct(r.byVerdict.WAIT / r.total)})`);
  console.log(`    VERIFY                : ${r.byVerdict.VERIFY}  (${pct(r.byVerdict.VERIFY / r.total)})`);
  console.log(`    NO_CRITICAL_SIGNAL    : ${r.byVerdict.NO_CRITICAL_SIGNAL}  (${pct(r.byVerdict.NO_CRITICAL_SIGNAL / r.total)})\n`);

  console.log("  Per-bucket results");
  for (const [bucket, b] of Object.entries(r.byBucket)) {
    const fpPct = b.total > 0 ? b.falsePositiveStop / b.total : 0;
    const fnPct = b.total > 0 ? b.falseNegativeNoSignal / b.total : 0;
    console.log(
      `    ${bucket.padEnd(12)} : ${b.passed}/${b.total} passed (${pct(b.passed / b.total)})` +
      (b.falsePositiveStop > 0 ? `, FP→STOP=${b.falsePositiveStop} (${pct(fpPct)})` : "") +
      (b.falseNegativeNoSignal > 0 ? `, FN→NO_SIGNAL=${b.falseNegativeNoSignal} (${pct(fnPct)})` : "")
    );
  }
  console.log();

  console.log("  Hard gates");
  console.log(`    Global STOP rate ≤ 30%      : ${pct(r.globalStopRate)} ${r.globalStopRate <= 0.30 ? "✓" : "✗ OVERFIRING"}`);
  const noCritFP = r.byBucket["no-critical"].falsePositiveStop / r.byBucket["no-critical"].total;
  const stopFN = r.byBucket.stop.falseNegativeNoSignal / r.byBucket.stop.total;
  console.log(`    False-positive ≤ 5%         : ${pct(noCritFP)} ${noCritFP <= 0.05 ? "✓" : "✗"}`);
  console.log(`    False-negative ≤ 5%         : ${pct(stopFN)} ${stopFN <= 0.05 ? "✓" : "✗"}\n`);

  if (r.mismatches.length > 0) {
    console.log(`  Mismatches (${r.mismatches.length}) — fixtures where actual ≠ expected:`);
    for (const m of r.mismatches) {
      console.log(
        `    [${m.bucket.padEnd(12)}] ${m.id}  ${m.expected} → ${m.actual}  ` +
        `conf=${m.confidence}/${m.confidenceScore.toFixed(3)}  (${m.category})`
      );
      console.log(`      ${m.notes}`);
    }
    console.log();
  }
  /* eslint-enable no-console */
}

printReport(report);

describe("REFLEX calibration — 200-case harness", () => {
  it("loads exactly 200 fixtures, 50 per bucket", () => {
    expect(report.total).toBe(200);
    expect(report.byBucket.stop.total).toBe(50);
    expect(report.byBucket.wait.total).toBe(50);
    expect(report.byBucket.verify.total).toBe(50);
    expect(report.byBucket["no-critical"].total).toBe(50);
  });

  it("global STOP rate ≤ 30% (overfiring guard)", () => {
    expect(report.globalStopRate, `STOP rate ${pct(report.globalStopRate)} > 30% — REFLEX is overfiring`)
      .toBeLessThanOrEqual(0.30);
  });

  it("false-positive rate (no-critical → STOP) ≤ 5%", () => {
    const fp = report.byBucket["no-critical"];
    const rate = fp.falsePositiveStop / fp.total;
    expect(rate, `FP→STOP rate ${pct(rate)} > 5%`).toBeLessThanOrEqual(0.05);
  });

  it("false-negative rate (stop → NO_CRITICAL_SIGNAL) ≤ 5%", () => {
    const fn = report.byBucket.stop;
    const rate = fn.falseNegativeNoSignal / fn.total;
    expect(rate, `FN→NO_SIGNAL rate ${pct(rate)} > 5%`).toBeLessThanOrEqual(0.05);
  });

  // Per-bucket informational tests — surface in CI output but don't gate.
  for (const bucket of ["stop", "wait", "verify", "no-critical"] as const) {
    it(`bucket "${bucket}" pass-rate is reported`, () => {
      const b = report.byBucket[bucket];
      expect(b.total).toBe(50);
      // No hard threshold here — pass rate logged via printReport().
    });
  }
});
