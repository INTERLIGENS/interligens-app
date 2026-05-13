import { describe, it, expect } from "vitest";
import { runKnownBad } from "@/lib/reflex/adapters/knownBad";
import { findForbidden } from "@/lib/reflex/forbidden-words";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const KNOWN_BAD_EVM = "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41"; // GordonGekko, high confidence
const KNOWN_BAD_SOL = "7ZhB5PZrNFCvSSKA9VJotGGKiRgSncQAFgTnBNzmCgcz"; // SOL Drainer v1, medium
const BENIGN_EVM = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC

function makeInput(over: Partial<ReflexResolvedInput>): ReflexResolvedInput {
  return { type: "UNKNOWN", raw: "", ...over };
}

describe("knownBad adapter", () => {
  it("emits CRITICAL stopTrigger=true signal for high-confidence EVM hit", () => {
    const r = runKnownBad(
      makeInput({
        type: "EVM_TOKEN",
        chain: "evm",
        address: KNOWN_BAD_EVM,
        raw: KNOWN_BAD_EVM,
      }),
    );
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].severity).toBe("CRITICAL");
    expect(r.signals[0].stopTrigger).toBe(true);
    expect(r.signals[0].confidence).toBe(1.0);
    expect(r.signals[0].source).toBe("knownBad");
  });

  it("emits no signal for a benign EVM address", () => {
    const r = runKnownBad(
      makeInput({
        type: "EVM_TOKEN",
        chain: "evm",
        address: BENIGN_EVM,
        raw: BENIGN_EVM,
      }),
    );
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(0);
  });

  it("emits signal for a known-bad Solana address (medium confidence)", () => {
    const r = runKnownBad(
      makeInput({
        type: "SOLANA_TOKEN",
        chain: "sol",
        address: KNOWN_BAD_SOL,
        raw: KNOWN_BAD_SOL,
      }),
    );
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].code).toMatch(/^knownBad\..+\.sol$/);
    expect(r.signals[0].severity).toBe("STRONG"); // medium → STRONG
    expect(r.signals[0].stopTrigger).toBe(false); // only high → stopTrigger
  });

  it("does not run when address is missing", () => {
    const r = runKnownBad(
      makeInput({ type: "X_HANDLE", handle: "foo", raw: "@foo" }),
    );
    expect(r.ran).toBe(false);
    expect(r.signals).toHaveLength(0);
  });

  it("specific 'eth' chain resolves to upstream 'ETH' lookup", () => {
    const r = runKnownBad(
      makeInput({
        type: "EVM_TOKEN",
        chain: "eth",
        address: KNOWN_BAD_EVM,
        raw: KNOWN_BAD_EVM,
      }),
    );
    expect(r.signals).toHaveLength(1);
  });

  it("generic 'evm' chain matches across all registered EVM chains", () => {
    // GordonGekko is registered on ETH, BASE, ARBITRUM rows
    const r = runKnownBad(
      makeInput({
        type: "EVM_TOKEN",
        chain: "evm",
        address: KNOWN_BAD_EVM,
        raw: KNOWN_BAD_EVM,
      }),
    );
    expect(r.signals[0].payload).toMatchObject({ confidence: "high" });
  });

  it("reasonEn + reasonFr are lint-clean (uses spec allowed phrase)", () => {
    const r = runKnownBad(
      makeInput({
        type: "EVM_TOKEN",
        chain: "evm",
        address: KNOWN_BAD_EVM,
        raw: KNOWN_BAD_EVM,
      }),
    );
    const s = r.signals[0];
    expect(findForbidden([s.reasonEn ?? "", s.reasonFr ?? ""])).toHaveLength(0);
  });

  it("payload exposes hit metadata for the manifest", () => {
    const r = runKnownBad(
      makeInput({
        type: "EVM_TOKEN",
        chain: "evm",
        address: KNOWN_BAD_EVM,
        raw: KNOWN_BAD_EVM,
      }),
    );
    expect(r.signals[0].payload).toEqual(
      expect.objectContaining({
        label: expect.any(String),
        category: expect.any(String),
        chain: expect.any(String),
        confidence: "high",
      }),
    );
  });
});
