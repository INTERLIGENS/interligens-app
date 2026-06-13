/**
 * PRE-BUY GUARD — orchestrator (the convergence entry point).
 *
 * getPreBuyVerdict({ tokenMint, chain, handle? }) fuses, in real time:
 *   - REFLEX        (existing 6-source deterministic verdict, run as-is)
 *   - shill layer   (on-chain pre-shill correlation — getShillCorrelationForToken)
 *   - KOL layer     (referring-account risk + token involvement)
 * into a single PreBuyVerdict.
 *
 * Shadow mode, admin-only, additive, read-only against existing tables.
 * ZERO changes to the REFLEX engine — we only consume runReflex().
 *
 * Degradation: the shill and KOL layers are individually fail-soft and the
 * orchestrator runs them in parallel. They never block on live X calls
 * (relevant while the X API is spend-capped until 2026-06-21) — they read
 * already-ingested Postgres data and degrade to "unavailable" on any error.
 * REFLEX itself is core; if it throws (e.g. DB down) the error propagates and
 * the route surfaces a 500.
 */
import { runReflex } from "@/lib/reflex/orchestrator";
import { getShillCorrelationForToken } from "./shill";
import { getReferralRisk, getTokenKolInvolvement } from "./kol";
import { getCasefilePresence } from "./casefile";
import {
  fusePreBuyVerdict,
  type PreBuyEvidenceLink,
  type PreBuyVerdict,
} from "./verdict";

export type { PreBuyVerdict, PreBuyVerdictLabel } from "./verdict";

export interface GetPreBuyVerdictParams {
  tokenMint: string;
  chain: string;
  handle?: string | null;
}

export async function getPreBuyVerdict(
  params: GetPreBuyVerdictParams,
): Promise<PreBuyVerdict> {
  const { tokenMint, chain, handle } = params;

  // REFLEX is run as-is in SHADOW mode. We pass no enrichment bundle in v1,
  // so the DB-backed sources (knownBad, intelligenceOverlay, recidivism,
  // casefileMatch, coordination) run; tigerscore/offchain/narrative stay
  // dormant unless a future phase wires /api/scan enrichment. This keeps v1
  // fully DB-backed and free of live external calls.
  const [reflex, shill, referral, tokenKol, casefile] = await Promise.all([
    runReflex(tokenMint, "SHADOW"),
    getShillCorrelationForToken(tokenMint, chain),
    getReferralRisk(handle),
    getTokenKolInvolvement(chain, tokenMint),
    getCasefilePresence(tokenMint, chain, handle),
  ]);

  // "Published casefile" comes from two complementary sources:
  //   - REFLEX casefileMatch (KolTokenLink / KolCase-by-handle), and
  //   - getCasefilePresence (preset BOTIFY/VINE + published TokenCaseFile rows,
  //     which casefileMatch does NOT cover).
  const reflexCasefile = (reflex.signals ?? []).some(
    (s) => s.source === "casefileMatch",
  );
  const casefilePresent = reflexCasefile || casefile.present;
  const casefileLinks: PreBuyEvidenceLink[] = casefile.sources.map((s) => ({
    type: "casefile",
    ref: s.ref,
    url: s.url,
  }));

  return fusePreBuyVerdict({
    reflex,
    shill,
    referral,
    tokenKol,
    casefilePresent,
    casefileLinks,
  });
}
