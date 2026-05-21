/**
 * Scam Counter widget — public re-export.
 *
 * Importing anything from this file outside of `src/offline/widgets/scam-counter/`
 * (or the dedicated demo page under `src/app/offline/scam-counter-demo/`) is
 * out of scope for the OFFLINE MODE V2 period.
 */

export { default as ScamCounter } from "./ScamCounter";
export type { ScamCounterProps } from "./ScamCounter";
export {
  MOCK_STATS,
  SCAM_CATEGORIES,
  type ScamCategory,
  type ScamStats,
} from "./_data/mock-stats";
