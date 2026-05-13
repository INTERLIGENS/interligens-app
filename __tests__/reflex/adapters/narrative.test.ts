import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/reflex/narrativeMatcher", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/reflex/narrativeMatcher")
  >("@/lib/reflex/narrativeMatcher");
  return {
    ...actual,
    loadActiveScripts: vi.fn(),
  };
});

import { loadActiveScripts } from "@/lib/reflex/narrativeMatcher";
import { runNarrative } from "@/lib/reflex/adapters/narrative";
import { NARRATIVE_MATCH_WAIT_THRESHOLD } from "@/lib/reflex/constants";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const mockLoad = vi.mocked(loadActiveScripts);

const HANDLE_INPUT: ReflexResolvedInput = {
  type: "X_HANDLE",
  handle: "x",
  raw: "@x",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("narrative adapter", () => {
  it("does not run when text is empty", async () => {
    const r = await runNarrative({ resolvedInput: HANDLE_INPUT, text: "" });
    expect(r.ran).toBe(false);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("does not run when text is whitespace only", async () => {
    const r = await runNarrative({
      resolvedInput: HANDLE_INPUT,
      text: "   \n\t  ",
    });
    expect(r.ran).toBe(false);
  });

  it("emits no signal when no script matches", async () => {
    mockLoad.mockResolvedValue([
      {
        code: "FOO",
        label: "Foo",
        category: "FOMO",
        keywords: ["xyzzy"],
        regexes: [],
        defaultConfidence: 0.5,
      },
    ]);
    const r = await runNarrative({
      resolvedInput: HANDLE_INPUT,
      text: "this text has nothing in common with xyz",
    });
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(0);
  });

  it("emits STRONG severity when match confidence >= WAIT threshold", async () => {
    mockLoad.mockResolvedValue([
      {
        code: "FAKE_AUDIT",
        label: "Unverifiable audit claim",
        category: "TRUST_HIJACK",
        keywords: ["audited by certik"],
        regexes: [],
        defaultConfidence: 0.75,
      },
    ]);
    const r = await runNarrative({
      resolvedInput: HANDLE_INPUT,
      text: "Fully audited by Certik — trust us.",
    });
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].confidence).toBeGreaterThanOrEqual(
      NARRATIVE_MATCH_WAIT_THRESHOLD,
    );
    expect(r.signals[0].severity).toBe("STRONG");
    expect(r.signals[0].code).toBe("narrative.FAKE_AUDIT");
    expect(r.signals[0].stopTrigger).toBe(false);
  });

  it("emits MODERATE severity when match confidence < WAIT threshold", async () => {
    mockLoad.mockResolvedValue([
      {
        code: "WEAK_SCRIPT",
        label: "x",
        category: "FOMO",
        keywords: ["matched-marker"],
        regexes: [],
        defaultConfidence: 0.4,
      },
    ]);
    const r = await runNarrative({
      resolvedInput: HANDLE_INPUT,
      text: "the text contains matched-marker in passing",
    });
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].confidence).toBeLessThan(NARRATIVE_MATCH_WAIT_THRESHOLD);
    expect(r.signals[0].severity).toBe("MODERATE");
  });

  it("payload exposes matched markers and excerpt for the manifest", async () => {
    mockLoad.mockResolvedValue([
      {
        code: "LISTING_IMMINENT",
        label: "Listing imminent claim",
        category: "FOMO",
        keywords: ["binance listing"],
        regexes: [],
        defaultConfidence: 0.7,
      },
    ]);
    const r = await runNarrative({
      resolvedInput: HANDLE_INPUT,
      text: "Big news: Binance listing imminent next week!",
    });
    expect(r.signals[0].payload).toEqual(
      expect.objectContaining({
        scriptCode: "LISTING_IMMINENT",
        scriptLabel: "Listing imminent claim",
        category: "FOMO",
        matchedKeywords: ["binance listing"],
        excerpt: expect.stringContaining("Binance listing"),
      }),
    );
  });

  it("returns ran:false + error when loadActiveScripts throws", async () => {
    mockLoad.mockRejectedValue(new Error("DB down"));
    const r = await runNarrative({
      resolvedInput: HANDLE_INPUT,
      text: "anything",
    });
    expect(r.ran).toBe(false);
    expect(r.error).toBe("DB down");
  });
});
