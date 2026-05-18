/**
 * REFLEX V1 — orchestrator.
 *
 * Pure async function — no Next.js, no req/res. Reusable from CLI and
 * calibration scripts. Composes inputRouter → adapters (fanned out in
 * parallel) → verdict layer → persistence with dedup.
 *
 * Engines that need data the router cannot synthesize (TigerInput for
 * tigerscore, OffChainInput for off-chain credibility, text corpus for
 * narrative) take an explicit `enrichment` bundle from the caller. The
 * API route (Commit 7b) builds the bundle by fanning out to the existing
 * /api/scan/* endpoints; tests inject mocks directly.
 *
 * Mode handling: the requested mode is passed through effectiveMode()
 * inside persistence.ts. Even if a caller passes mode="PUBLIC" here, the
 * row lands as SHADOW unless REFLEX_PUBLIC_ENABLED is explicitly "true".
 * That belt-and-suspenders gate is the test invariant in
 * orchestrator.test.ts / persistence.test.ts.
 */
import type { TigerInput } from "@/lib/tigerscore/engine";
import type { TigerResult } from "@/lib/tigerscore/engine";
import type { OffChainInput } from "@/lib/off-chain-credibility/engine";
import {
  runCoordination,
  runIntelligenceOverlay,
  runKnownBad,
  runNarrative,
  runOffChain,
  runTigerScore,
} from "./adapters";
import { runCasefileMatch } from "./casefileMatch";
import { REFLEX_ENGINES_VERSION } from "./constants";
import { classify } from "./inputRouter";
import { buildSignalsManifest, computeSignalsHash } from "./manifestHash";
import {
  findRecentByHash,
  persistAnalysis,
} from "./persistence";
import { runRecidivism } from "./recidivism";
import type {
  ReflexAnalysisResult,
  ReflexEngineOutput,
  ReflexLocale,
  ReflexMode,
  ReflexResolvedInput,
} from "./types";
import { decide } from "./verdict";

export interface ReflexEnrichmentBundle {
  /** Populated by /api/scan/evm or /api/scan/solana before calling runReflex. */
  tigerInput?: TigerInput;
  /** Built from URL fetch + token metadata. */
  offChainInput?: OffChainInput;
  /** Free-text corpus for the narrative matcher (URL page, X bio, etc.). */
  narrativeText?: string;
}

export interface RunReflexOptions {
  locale?: ReflexLocale;
  enrichment?: ReflexEnrichmentBundle;
  investigatorId?: string;
  /** Override the dedup window for tests / replay scripts. */
  dedupWindowSeconds?: number;
}

const NOOP_ENGINE = (engine: ReflexEngineOutput["engine"]): ReflexEngineOutput => ({
  engine,
  ran: false,
  ms: 0,
  signals: [],
});

function extractTigerScore(out: ReflexEngineOutput): number | null {
  if (!out.ran || !out.raw) return null;
  const raw = out.raw as Partial<TigerResult>;
  return typeof raw.score === "number" ? raw.score : null;
}

/**
 * Run a full REFLEX analysis end-to-end.
 *
 * Pure-ish: aside from the Prisma read/write inside persistence, no
 * side effects. Returns the persisted (or deduped) ReflexAnalysisResult.
 */
export async function runReflex(
  rawInput: string,
  mode: ReflexMode = "SHADOW",
  opts: RunReflexOptions = {},
): Promise<ReflexAnalysisResult> {
  const startedAt = Date.now();

  // 1. Classify input (pure)
  const resolvedInput: ReflexResolvedInput = classify(rawInput);

  // 2. Fan out adapters in parallel. Sync adapters are wrapped in
  //    Promise.resolve so Promise.all keeps its uniform shape.
  const enrichment = opts.enrichment ?? {};
  const [
    knownBad,
    intelligenceOverlay,
    recidivism,
    casefileMatch,
    coordination,
    tigerscore,
    offchain,
    narrative,
  ] = await Promise.all([
    Promise.resolve(runKnownBad(resolvedInput)),
    runIntelligenceOverlay(resolvedInput),
    runRecidivism(resolvedInput),
    runCasefileMatch(resolvedInput),
    runCoordination(resolvedInput),
    enrichment.tigerInput
      ? runTigerScore({
          resolvedInput,
          tigerInput: enrichment.tigerInput,
          withIntel: true,
        })
      : Promise.resolve(NOOP_ENGINE("tigerscore")),
    enrichment.offChainInput
      ? runOffChain({
          resolvedInput,
          offChainInput: enrichment.offChainInput,
        })
      : Promise.resolve(NOOP_ENGINE("offchain")),
    enrichment.narrativeText
      ? runNarrative({
          resolvedInput,
          text: enrichment.narrativeText,
        })
      : Promise.resolve(NOOP_ENGINE("narrative")),
  ]);

  const engines: ReflexEngineOutput[] = [
    knownBad,
    intelligenceOverlay,
    recidivism,
    casefileMatch,
    coordination,
    tigerscore,
    offchain,
    narrative,
  ];

  // 3. Build deterministic manifest + hash
  const signalsManifest = buildSignalsManifest(
    resolvedInput,
    engines,
    REFLEX_ENGINES_VERSION,
  );
  const signalsHash = computeSignalsHash(signalsManifest);

  // 4. Dedup: identical hash within the dedup window → return existing
  //    row, no new write. Makes runReflex idempotent on retry.
  const existing = await findRecentByHash(
    signalsHash,
    opts.dedupWindowSeconds,
  );
  if (existing) return existing;

  // 5. Apply the V1 decision matrix
  const verdictResult = decide(engines);

  // 6. Persist (mode is forced to SHADOW unless REFLEX_PUBLIC_ENABLED;
  //    see effectiveMode in persistence.ts).
  const persisted = await persistAnalysis({
    resolvedInput,
    inputRaw: rawInput,
    engines,
    verdictResult,
    signalsManifest,
    signalsHash,
    tigerScoreSnapshot: extractTigerScore(tigerscore),
    mode,
    investigatorId: opts.investigatorId,
    latencyMs: Date.now() - startedAt,
    enginesVersion: REFLEX_ENGINES_VERSION,
  });

  return persisted;
}
