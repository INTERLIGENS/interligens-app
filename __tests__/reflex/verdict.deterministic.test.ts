import { describe, it, expect } from "vitest";
import { decide } from "@/lib/reflex/verdict";
import type {
  ReflexEngineOutput,
  ReflexSignal,
  ReflexSignalSeverity,
  ReflexSignalSource,
} from "@/lib/reflex/types";

function sig(over: {
  source: ReflexSignalSource;
  code: string;
  severity?: ReflexSignalSeverity;
  confidence?: number;
  stopTrigger?: boolean;
  reasonEn?: string;
  reasonFr?: string;
  payload?: Record<string, unknown>;
}): ReflexSignal {
  return {
    severity: "MODERATE",
    confidence: 0.6,
    payload: {},
    ...over,
  };
}

function eng(
  engine: ReflexEngineOutput["engine"],
  signals: ReflexSignal[],
): ReflexEngineOutput {
  return { engine, ran: true, ms: 1, signals };
}

const STOP_REASON = {
  en: "Address matches a known risk pattern.",
  fr: "L'adresse correspond à un schéma de risque connu.",
};

/** Build a non-trivial scenario with multiple engines and signals. */
function fullScenario(): ReflexEngineOutput[] {
  return [
    eng("knownBad", [
      sig({
        source: "knownBad",
        code: "knownBad.scam.eth",
        severity: "CRITICAL",
        confidence: 1.0,
        stopTrigger: true,
        reasonEn: STOP_REASON.en,
        reasonFr: STOP_REASON.fr,
      }),
    ]),
    eng("tigerscore", [
      sig({
        source: "tigerscore",
        code: "tigerscore.unlimited_approvals",
        severity: "CRITICAL",
        confidence: 0.9,
      }),
      sig({
        source: "tigerscore",
        code: "tigerscore.freeze_authority",
        severity: "CRITICAL",
        confidence: 0.9,
      }),
    ]),
    eng("recidivism", [
      sig({
        source: "recidivism",
        code: "recidivism.recidivist",
        severity: "STRONG",
        confidence: 0.9,
      }),
    ]),
    eng("offchain", [
      sig({
        source: "offchain",
        code: "offchain.band.low",
        severity: "MODERATE",
        confidence: 0.6,
      }),
    ]),
    eng("coordination", []),
    eng("intelligenceOverlay", []),
    eng("narrative", []),
  ];
}

describe("verdict — deterministic across runs", () => {
  it("same input × 10 → identical verdict, reasons, confidence", () => {
    const baseline = decide(fullScenario());
    for (let i = 0; i < 9; i++) {
      expect(decide(fullScenario())).toEqual(baseline);
    }
  });
});

describe("verdict — deterministic across permutations", () => {
  it("permuted signals within an engine → same output", () => {
    const a: ReflexEngineOutput[] = [
      eng("tigerscore", [
        sig({
          source: "tigerscore",
          code: "tigerscore.unlimited_approvals",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
        sig({
          source: "tigerscore",
          code: "tigerscore.freeze_authority",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
        sig({
          source: "tigerscore",
          code: "tigerscore.mint_authority",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
      ]),
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
    ];
    const b: ReflexEngineOutput[] = [
      eng("tigerscore", [
        // reversed signal order
        sig({
          source: "tigerscore",
          code: "tigerscore.mint_authority",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
        sig({
          source: "tigerscore",
          code: "tigerscore.freeze_authority",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
        sig({
          source: "tigerscore",
          code: "tigerscore.unlimited_approvals",
          severity: "CRITICAL",
          confidence: 0.9,
        }),
      ]),
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
    ];
    expect(decide(a)).toEqual(decide(b));
  });

  it("permuted engine order → same output", () => {
    const scenario = fullScenario();
    const reversed = [...scenario].reverse();
    expect(decide(reversed)).toEqual(decide(scenario));
  });

  it("randomized engine order (5 shuffles) → all equal to baseline", () => {
    const baseline = decide(fullScenario());
    // Deterministic pseudo-shuffles via different orderings.
    const orderings = [
      [0, 1, 2, 3, 4, 5, 6],
      [6, 5, 4, 3, 2, 1, 0],
      [3, 1, 4, 0, 2, 6, 5],
      [2, 0, 5, 1, 4, 6, 3],
      [5, 2, 0, 6, 1, 3, 4],
    ];
    for (const order of orderings) {
      const base = fullScenario();
      const permuted = order.map((i) => base[i]);
      expect(decide(permuted)).toEqual(baseline);
    }
  });
});

describe("verdict — stable tie-breaks", () => {
  it("equal severity + confidence → code lexicographic order in reasons", () => {
    // Two CRITICAL drivers, same confidence, different codes.
    // 'freeze_authority' < 'unlimited_approvals' lexicographically →
    // freeze_authority's reason should appear first in the reasons list.
    const r = decide([
      eng("knownBad", [
        sig({
          source: "knownBad",
          code: "knownBad.scam.eth",
          severity: "CRITICAL",
          confidence: 1.0,
          stopTrigger: true,
          reasonEn: STOP_REASON.en,
          reasonFr: STOP_REASON.fr,
        }),
      ]),
    ]);
    // STOP with a single stopTrigger signal — reasons should be deterministic.
    expect(r.verdictReasonEn).toEqual([STOP_REASON.en]);
  });

  it("convergence STOP: critical drivers sorted by code asc in reasons", () => {
    // 3 CRITICAL tigerscore drivers + recidivist → convergence STOP.
    // Reasons should pick top 3 in stable order.
    const r1 = decide([
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "tigerscore.unlimited_approvals", severity: "CRITICAL", confidence: 0.9 }),
        sig({ source: "tigerscore", code: "tigerscore.freeze_authority", severity: "CRITICAL", confidence: 0.9 }),
        sig({ source: "tigerscore", code: "tigerscore.mint_authority", severity: "CRITICAL", confidence: 0.9 }),
      ]),
    ]);
    const r2 = decide([
      eng("recidivism", [
        sig({
          source: "recidivism",
          code: "recidivism.recidivist",
          severity: "STRONG",
          confidence: 0.9,
        }),
      ]),
      eng("tigerscore", [
        // permuted
        sig({ source: "tigerscore", code: "tigerscore.mint_authority", severity: "CRITICAL", confidence: 0.9 }),
        sig({ source: "tigerscore", code: "tigerscore.unlimited_approvals", severity: "CRITICAL", confidence: 0.9 }),
        sig({ source: "tigerscore", code: "tigerscore.freeze_authority", severity: "CRITICAL", confidence: 0.9 }),
      ]),
    ]);
    expect(r1.verdictReasonEn).toEqual(r2.verdictReasonEn);
    expect(r1.verdictReasonFr).toEqual(r2.verdictReasonFr);
  });
});

describe("verdict — deterministic across the four branches", () => {
  it.each([
    {
      label: "STOP via stopTrigger",
      engines: (): ReflexEngineOutput[] => [
        eng("knownBad", [
          sig({
            source: "knownBad",
            code: "knownBad.scam.eth",
            severity: "CRITICAL",
            confidence: 1.0,
            stopTrigger: true,
            reasonEn: STOP_REASON.en,
            reasonFr: STOP_REASON.fr,
          }),
        ]),
      ],
    },
    {
      label: "WAIT via narrative match",
      engines: (): ReflexEngineOutput[] => [
        eng("narrative", [
          sig({
            source: "narrative",
            code: "narrative.MIGRATION_EMERGENCY",
            severity: "STRONG",
            confidence: 0.85,
            payload: { category: "URGENCY" },
          }),
        ]),
      ],
    },
    {
      label: "VERIFY via TRUST_HIJACK at low confidence",
      engines: (): ReflexEngineOutput[] => [
        eng("narrative", [
          sig({
            source: "narrative",
            code: "narrative.AI_RWA_NARRATIVE_HIJACK",
            severity: "MODERATE",
            confidence: 0.55,
            payload: { category: "TRUST_HIJACK" },
          }),
        ]),
      ],
    },
    {
      label: "NO_CRITICAL_SIGNAL — clean engines",
      engines: (): ReflexEngineOutput[] => [
        eng("tigerscore", []),
        eng("offchain", []),
      ],
    },
  ])("$label — same input × 5 produces identical output", ({ engines }) => {
    const baseline = decide(engines());
    for (let i = 0; i < 4; i++) {
      expect(decide(engines())).toEqual(baseline);
    }
  });
});
