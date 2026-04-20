// ─── MM Pattern Engine — release surface ──────────────────────────────────
// Registry / discovery / reporting / email / integration hooks are
// intentionally excluded from this release. Only the behavioral sub-modules
// ship:
//   - engine: detectors, scoring, cohorts, scanRun
//   - adapter: displayScore, displayReason, disclaimer, freshness,
//              riskAssessment (engine-only — no registry lookup)
//   - data:    on-chain adapters (etherscan, helius, birdeye) + scanner

export * from "./types";
export * as engine from "./engine";
export * as adapter from "./adapter";
export * as data from "./data";
