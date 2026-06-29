import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VisionOutput, VisionToken, TokenConsensusDiagnostic } from "@/lib/osint/vision/visionPrompt";
import type { MintVerification } from "@/lib/osint/vision/verifyMintOnChain";

const TOES_REAL = "6ehEcTMCc85aNF4x9CWx8HuvWGhxQtvKdhKVf2HDpump";

// admin gate -> allow
vi.mock("@/lib/security/adminAuth", () => ({ requireAdminApi: () => null }));

// vision (lock 1 already merged) -> controllable fixture
const visionMock = vi.fn();
vi.mock("@/lib/osint/vision/callVision", () => ({
  callVision: (...args: unknown[]) => visionMock(...args),
}));

// Helius (locks 2+3) -> controllable
const verifyMock = vi.fn();
vi.mock("@/lib/osint/vision/verifyMintOnChain", () => ({
  verifyMintOnChain: (...args: unknown[]) => verifyMock(...args),
}));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const PNG_B64 = PNG.toString("base64");

async function post(body: unknown) {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/admin/osint/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "t" },
    body: JSON.stringify(body),
  });
  const res = await POST(req as never);
  return { status: res.status, json: await res.json() };
}

// build a consensus-merged VisionOutput (what callVision now returns)
function merged(tok: Partial<VisionToken>, diag: Partial<TokenConsensusDiagnostic>): VisionOutput {
  const ca = tok.contractAddress ?? null;
  return {
    kolHandle: "gordongekko", kolHandleConfidence: "high", snapshotType: "osint_x_search",
    tokens: [{
      tokenSymbol: "TOES", tokenSymbolConfidence: "high",
      contractAddress: ca, contractAddressConfidence: "high", contractAddressCertain: false,
      chain: "solana", chainConfidence: "high", perf: null, ...tok,
    }],
    readWithCertainty: [], uncertain: [], notes: null,
    diagnostics: {
      passes: 2, secondPassError: null, handleReads: ["gordongekko", "gordongekko"], tokenCountReads: [1, 1],
      tokens: [{ tokenSymbol: tok.tokenSymbol ?? "TOES", tickerReads: ["TOES", "TOES"], tickerAgree: true,
                 caReads: [ca, ca], caAgree: true, caCertainHint: true, ...diag }],
    },
  };
}

describe("POST /api/admin/osint/ingest — dry-run extract (3-lock)", () => {
  beforeEach(() => {
    vi.resetModules(); visionMock.mockReset(); verifyMock.mockReset();
    verifyMock.mockResolvedValue({ status: "exists", symbol: "TOES", name: null });
  });

  it("rejects a missing image", async () => {
    const { status, json } = await post({});
    expect(status).toBe(400);
    expect(json.error).toBe("missing_image");
  });

  it("rejects an unsupported media type (text bytes)", async () => {
    const { status, json } = await post({ imageBase64: Buffer.from("hello world plain").toString("base64") });
    expect(status).toBe(415);
  });

  it("CA clears all three locks => RESOLVED in the dry-run plan, NOTHING written", async () => {
    visionMock.mockResolvedValue(merged({ contractAddress: TOES_REAL }, { caAgree: true }));
    const { status, json } = await post({ imageBase64: PNG_B64 });
    expect(status).toBe(200);
    expect(json.mode).toBe("dry_run");
    expect(json.plan.kolTokenLinksToCreate[0].contractAddress).toBe(TOES_REAL);
    expect(json.plan.kolTokenLinksToCreate[0].resolutionPath).toBe("double_vision:ok|onchain:ok|ticker:ok");
    expect(json.plan.kolProfileToCreate.publishable).toBe(false);
    expect(json.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("vision-pass disagreement => PENDING (verifyMint never consulted)", async () => {
    visionMock.mockResolvedValue(merged({ tokenSymbol: "TROLL", contractAddress: null }, { tokenSymbol: "TROLL", caAgree: false, caReads: [TOES_REAL, "6eHEcTMCc85aNF4x9CWx8HuvWQhxQtvKdhKVf2HDpump"] }));
    const { json } = await post({ imageBase64: PNG_B64, kolHandle: "fuelkek" });
    expect(json.plan.kolTokenLinksToCreate[0].contractAddress).toBe("PENDING:TROLL");
    expect(json.plan.kolTokenLinksToCreate[0].resolutionPath).toBe("double_vision:disagree");
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("on-chain mismatch => PENDING even though passes agreed", async () => {
    verifyMock.mockResolvedValue({ status: "exists", symbol: "FARTCOIN", name: null });
    visionMock.mockResolvedValue(merged({ contractAddress: TOES_REAL }, { caAgree: true }));
    const { json } = await post({ imageBase64: PNG_B64 });
    expect(json.plan.kolTokenLinksToCreate[0].contractAddress).toBe("PENDING:TOES");
    expect(json.plan.kolTokenLinksToCreate[0].resolutionPath).toContain("ticker:mismatch");
  });

  it("accepts a data: URL form", async () => {
    visionMock.mockResolvedValue(merged({ contractAddress: TOES_REAL }, { caAgree: true }));
    const { status } = await post({ imageBase64: `data:image/png;base64,${PNG_B64}` });
    expect(status).toBe(200);
  });

  it("maps an unparseable vision response to 422", async () => {
    visionMock.mockRejectedValue(Object.assign(new Error("x"), { code: "VISION_NOT_JSON" }));
    const { status, json } = await post({ imageBase64: PNG_B64 });
    expect(status).toBe(422);
    expect(json.error).toBe("vision_unparseable");
  });
});
