import { describe, it, expect, vi } from "vitest";
import { mergeConsensus } from "./callVision";
import { resolveVisionTokens } from "./resolveTokens";
import type { VisionOutput, VisionToken } from "./visionPrompt";
import type { MintVerification } from "./verifyMintOnChain";

// Real TOES CA vs the off-by-2 wrong read that the model emitted as certain=true
const TOES_REAL  = "6ehEcTMCc85aNF4x9CWx8HuvWGhxQtvKdhKVf2HDpump";
const TOES_WRONG = "6eHEcTMCc85aNF4x9CWx8HuvWQhxQtvKdhKVf2HDpump";

function tok(p: Partial<VisionToken>): VisionToken {
  return {
    tokenSymbol: "TOES", tokenSymbolConfidence: "high",
    contractAddress: null, contractAddressConfidence: "high",
    contractAddressCertain: true, // deliberately "certain" — must NOT be trusted
    chain: "solana", chainConfidence: "high", perf: null, ...p,
  };
}
function pass(tokens: VisionToken[], kolHandle = "gordongekko"): VisionOutput {
  return {
    kolHandle, kolHandleConfidence: "high", snapshotType: "osint_x_search",
    tokens, readWithCertainty: [], uncertain: [], notes: null,
  };
}
const verifyExists = (symbol: string | null): () => Promise<MintVerification> =>
  () => Promise.resolve({ status: "exists", symbol, name: null });

describe("LOCK 1 — mergeConsensus (double-read)", () => {
  it("identical CA reads => caAgree true, CA kept", () => {
    const m = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    expect(m.diagnostics!.tokens[0].caAgree).toBe(true);
    expect(m.tokens[0].contractAddress).toBe(TOES_REAL);
  });

  it("the EXACT proven bug: WGhx vs WQhx => caAgree false, CA nulled", () => {
    const m = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_WRONG })]), null);
    expect(m.diagnostics!.tokens[0].caAgree).toBe(false);
    expect(m.tokens[0].contractAddress).toBeNull();
    expect(m.diagnostics!.tokens[0].caReads).toEqual([TOES_REAL, TOES_WRONG]);
  });

  it("contractAddressCertain is always downgraded to false (hint only)", () => {
    const m = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    expect(m.tokens[0].contractAddressCertain).toBe(false);
    expect(m.diagnostics!.tokens[0].caCertainHint).toBe(true); // logged, not authoritative
  });

  it("divergent ticker => tokenSymbol nulled", () => {
    const m = mergeConsensus(pass([tok({ tokenSymbol: "TOES" })]), pass([tok({ tokenSymbol: "TOEZ" })]), null);
    expect(m.tokens[0].tokenSymbol).toBeNull();
    expect(m.diagnostics!.tokens[0].tickerAgree).toBe(false);
  });

  it("second pass failed => CA nulled, ticker kept for PENDING label", () => {
    const m = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), null, "timeout");
    expect(m.diagnostics!.secondPassError).toBe("timeout");
    expect(m.tokens[0].contractAddress).toBeNull();
    expect(m.tokens[0].tokenSymbol).toBe("TOES");
  });
});

describe("THREE-LOCK resolveVisionTokens", () => {
  it("case 1 — vision passes disagree (WGhx vs WQhx) => PENDING, CA_VISION_DISAGREE", async () => {
    const vision = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_WRONG })]), null);
    const verifyMint = vi.fn(verifyExists("TOES"));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(false);
    expect(r.contractAddress).toBe("PENDING:TOES");
    expect(r.resolutionPath).toBe("double_vision:disagree");
    expect(r.warnings.some((w) => w.startsWith("CA_VISION_DISAGREE"))).toBe(true);
    expect(verifyMint).not.toHaveBeenCalled(); // lock 2 never reached
  });

  it("case 2 — passes agree but mint not on-chain => PENDING, CA_NOT_ONCHAIN", async () => {
    const vision = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    const verifyMint = vi.fn(() => Promise.resolve<MintVerification>({ status: "not_found", symbol: null, name: null }));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(false);
    expect(r.contractAddress).toBe("PENDING:TOES");
    expect(r.resolutionPath).toBe("onchain:not_found");
    expect(r.warnings.some((w) => w.startsWith("CA_NOT_ONCHAIN"))).toBe(true);
  });

  it("case 3 — mint exists but on-chain symbol != ticker => PENDING, CA_TICKER_MISMATCH", async () => {
    const vision = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    const verifyMint = vi.fn(verifyExists("FARTCOIN"));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(false);
    expect(r.resolutionPath).toBe("double_vision:ok|onchain:ok|ticker:mismatch");
    expect(r.warnings.some((w) => w.startsWith("CA_TICKER_MISMATCH"))).toBe(true);
    expect(r.audit.onChainSymbol).toBe("FARTCOIN");
  });

  it("case 4 — all three locks clear => RESOLVED", async () => {
    const vision = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    const verifyMint = vi.fn(verifyExists("TOES"));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(true);
    expect(r.contractAddress).toBe(TOES_REAL);
    expect(r.chain).toBe("solana");
    expect(r.resolutionPath).toBe("double_vision:ok|onchain:ok|ticker:ok");
  });

  it("case 4b — case/$-insensitive symbol match still resolves", async () => {
    const vision = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    const verifyMint = vi.fn(verifyExists("$toes"));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(true);
  });

  it("case 5 — Helius unavailable (timeout) => PENDING, CA_VERIFY_UNAVAILABLE (never resolves on a failed check)", async () => {
    const vision = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    const verifyMint = vi.fn(() => Promise.resolve<MintVerification>({ status: "unavailable", symbol: null, name: null }));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(false);
    expect(r.resolutionPath).toBe("onchain:unavailable");
    expect(r.warnings.some((w) => w.startsWith("CA_VERIFY_UNAVAILABLE"))).toBe(true);
  });

  it("case 6 — malformed CA agreed by both passes => PENDING upstream (validate:format_mismatch), verifyMint never called", async () => {
    const bad = "FWgBz_not_valid!!";
    const vision = mergeConsensus(pass([tok({ tokenSymbol: "FAKE", contractAddress: bad })]), pass([tok({ tokenSymbol: "FAKE", contractAddress: bad })]), null);
    const verifyMint = vi.fn(verifyExists("FAKE"));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(false);
    expect(r.contractAddress).toBe("PENDING:FAKE");
    expect(r.resolutionPath).toBe("validate:format_mismatch");
    expect(r.warnings.some((w) => w.startsWith("CA_REJECTED"))).toBe(true);
    expect(verifyMint).not.toHaveBeenCalled();
  });

  it("bonus — mint exists but no on-chain symbol => PENDING, CA_NO_METADATA", async () => {
    const vision = mergeConsensus(pass([tok({ contractAddress: TOES_REAL })]), pass([tok({ contractAddress: TOES_REAL })]), null);
    const verifyMint = vi.fn(verifyExists(null));
    const [r] = await resolveVisionTokens(vision, { verifyMint });
    expect(r.resolved).toBe(false);
    expect(r.resolutionPath).toBe("double_vision:ok|onchain:ok|ticker:no_metadata");
    expect(r.warnings.some((w) => w.startsWith("CA_NO_METADATA"))).toBe(true);
  });
});
