import { describe, it, expect } from "vitest";
import {
  buildSignalsManifest,
  canonicalize,
  computeSignalsHash,
} from "@/lib/reflex/manifestHash";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
} from "@/lib/reflex/types";

const SAMPLE_INPUT: ReflexResolvedInput = {
  type: "EVM_TOKEN",
  chain: "evm",
  address: "0xabc",
  raw: "0xabc",
};

function sig(over: Partial<ReflexSignal> & { source: ReflexSignal["source"]; code: string }): ReflexSignal {
  return { severity: "MODERATE", confidence: 0.6, payload: {}, ...over };
}

function eng(
  engine: ReflexEngineOutput["engine"],
  signals: ReflexSignal[],
): ReflexEngineOutput {
  return { engine, ran: true, ms: 12, signals };
}

describe("canonicalize — primitives", () => {
  it.each([
    [null, "null"],
    [undefined, "null"],
    [true, "true"],
    [false, "false"],
    [42, "42"],
    [3.14, "3.14"],
    ["hello", '"hello"'],
  ])("canonicalizes %j → %s", (input, expected) => {
    expect(canonicalize(input)).toBe(expected);
  });

  it("canonicalizes Date as ISO string", () => {
    const d = new Date("2026-05-13T10:00:00.000Z");
    expect(canonicalize(d)).toBe('"2026-05-13T10:00:00.000Z"');
  });
});

describe("canonicalize — structural", () => {
  it("sorts object keys lexicographically", () => {
    const a = canonicalize({ b: 1, a: 2, c: 3 });
    const b = canonicalize({ a: 2, c: 3, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":3}');
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("skips undefined values in objects", () => {
    expect(canonicalize({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  it("recurses through nested structures", () => {
    const v = { outer: { inner: [{ k: "v" }] } };
    expect(canonicalize(v)).toBe('{"outer":{"inner":[{"k":"v"}]}}');
  });
});

describe("computeSignalsHash", () => {
  it("returns 64-char hex SHA-256", () => {
    const h = computeSignalsHash({ a: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same content → same hash", () => {
    const h1 = computeSignalsHash({ a: 1, b: 2 });
    const h2 = computeSignalsHash({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it("different content → different hash", () => {
    expect(computeSignalsHash({ a: 1 })).not.toBe(computeSignalsHash({ a: 2 }));
  });
});

describe("buildSignalsManifest", () => {
  it("contains enginesVersion + input + engines keys", () => {
    const m = buildSignalsManifest(SAMPLE_INPUT, [], "reflex-test");
    expect(Object.keys(m).sort()).toEqual(["engines", "enginesVersion", "input"]);
    expect(m.enginesVersion).toBe("reflex-test");
  });

  it("projects input to deterministic shape", () => {
    const m = buildSignalsManifest(SAMPLE_INPUT, [], "v");
    expect(m.input).toEqual({
      type: "EVM_TOKEN",
      chain: "evm",
      address: "0xabc",
      handle: null,
      url: null,
      ticker: null,
    });
  });

  it("sorts engines by name", () => {
    const engines = [
      eng("tigerscore", []),
      eng("knownBad", []),
      eng("narrative", []),
    ];
    const m = buildSignalsManifest(SAMPLE_INPUT, engines, "v") as {
      engines: Array<{ engine: string }>;
    };
    expect(m.engines.map((e) => e.engine)).toEqual([
      "knownBad",
      "narrative",
      "tigerscore",
    ]);
  });

  it("sorts signals by code within an engine", () => {
    const engines = [
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "tigerscore.zzz", severity: "STRONG", confidence: 0.7 }),
        sig({ source: "tigerscore", code: "tigerscore.aaa", severity: "STRONG", confidence: 0.7 }),
      ]),
    ];
    const m = buildSignalsManifest(SAMPLE_INPUT, engines, "v") as {
      engines: Array<{ signals: Array<{ code: string }> }>;
    };
    expect(m.engines[0].signals.map((s) => s.code)).toEqual([
      "tigerscore.aaa",
      "tigerscore.zzz",
    ]);
  });

  it("drops payload + ms + error from the projection", () => {
    const engines = [
      eng("knownBad", [
        sig({
          source: "knownBad",
          code: "knownBad.x",
          severity: "CRITICAL",
          confidence: 1.0,
          payload: { transient: Date.now() },
        }),
      ]),
    ];
    const m = buildSignalsManifest(SAMPLE_INPUT, engines, "v") as {
      engines: Array<{ signals: Array<Record<string, unknown>> }>;
    };
    expect(m.engines[0].signals[0]).toEqual({
      source: "knownBad",
      code: "knownBad.x",
      severity: "CRITICAL",
      confidence: 1.0,
      stopTrigger: false,
    });
    expect(m.engines[0].signals[0]).not.toHaveProperty("payload");
    expect(m.engines[0]).not.toHaveProperty("ms");
    expect(m.engines[0]).not.toHaveProperty("error");
  });

  it("rounds confidence to 3 decimals", () => {
    const engines = [
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "x", severity: "STRONG", confidence: 0.7000000001 }),
      ]),
    ];
    const m = buildSignalsManifest(SAMPLE_INPUT, engines, "v") as {
      engines: Array<{ signals: Array<{ confidence: number }> }>;
    };
    expect(m.engines[0].signals[0].confidence).toBe(0.7);
  });
});

describe("manifest hash — dedup invariant", () => {
  it("permuted engine order → same hash", () => {
    const a = [eng("tigerscore", []), eng("knownBad", []), eng("narrative", [])];
    const b = [eng("narrative", []), eng("tigerscore", []), eng("knownBad", [])];
    expect(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, a, "v")),
    ).toBe(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, b, "v")),
    );
  });

  it("permuted signal order within engine → same hash", () => {
    const a = [
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "a", severity: "STRONG", confidence: 0.7 }),
        sig({ source: "tigerscore", code: "b", severity: "STRONG", confidence: 0.7 }),
      ]),
    ];
    const b = [
      eng("tigerscore", [
        sig({ source: "tigerscore", code: "b", severity: "STRONG", confidence: 0.7 }),
        sig({ source: "tigerscore", code: "a", severity: "STRONG", confidence: 0.7 }),
      ]),
    ];
    expect(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, a, "v")),
    ).toBe(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, b, "v")),
    );
  });

  it("different enginesVersion → different hash", () => {
    const engines = [eng("knownBad", [])];
    const h1 = computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, engines, "v1"));
    const h2 = computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, engines, "v2"));
    expect(h1).not.toBe(h2);
  });

  it("different transient payload → SAME hash (payload excluded)", () => {
    const a = [
      eng("knownBad", [
        sig({
          source: "knownBad", code: "knownBad.x",
          severity: "CRITICAL", confidence: 1.0,
          payload: { ts: 1 },
        }),
      ]),
    ];
    const b = [
      eng("knownBad", [
        sig({
          source: "knownBad", code: "knownBad.x",
          severity: "CRITICAL", confidence: 1.0,
          payload: { ts: 2 },
        }),
      ]),
    ];
    expect(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, a, "v")),
    ).toBe(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, b, "v")),
    );
  });

  it("different signal severity → different hash", () => {
    const a = [eng("tigerscore", [sig({ source: "tigerscore", code: "x", severity: "MODERATE", confidence: 0.5 })])];
    const b = [eng("tigerscore", [sig({ source: "tigerscore", code: "x", severity: "STRONG", confidence: 0.5 })])];
    expect(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, a, "v")),
    ).not.toBe(
      computeSignalsHash(buildSignalsManifest(SAMPLE_INPUT, b, "v")),
    );
  });
});
