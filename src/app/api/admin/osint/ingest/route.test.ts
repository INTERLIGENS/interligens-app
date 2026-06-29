import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VisionOutput } from "@/lib/osint/vision/visionPrompt";

// admin gate -> allow
vi.mock("@/lib/security/adminAuth", () => ({ requireAdminApi: () => null }));

// vision call -> controllable fixture
const visionMock = vi.fn();
vi.mock("@/lib/osint/vision/callVision", () => ({
  callVision: (...args: unknown[]) => visionMock(...args),
}));

// minimal valid PNG (magic bytes + filler) so media detection passes
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);
const PNG_B64 = PNG.toString("base64");

async function post(body: unknown) {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/admin/osint/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "t" },
    body: JSON.stringify(body),
  });
  // route types NextRequest but only uses .json()/.headers at runtime
  const res = await POST(req as never);
  return { status: res.status, json: await res.json() };
}

function v(p: Partial<VisionOutput>): VisionOutput {
  return {
    kolHandle: "captain_meme1", kolHandleConfidence: "high",
    snapshotType: "osint_x_search", tokens: [], readWithCertainty: [], uncertain: [], notes: null,
    ...p,
  };
}

describe("POST /api/admin/osint/ingest — dry-run extract", () => {
  beforeEach(() => { vi.resetModules(); visionMock.mockReset(); });

  it("rejects a missing image", async () => {
    const { status, json } = await post({});
    expect(status).toBe(400);
    expect(json.error).toBe("missing_image");
  });

  it("rejects an unsupported media type (text bytes)", async () => {
    const { status, json } = await post({ imageBase64: Buffer.from("hello world plain").toString("base64") });
    expect(status).toBe(415);
    expect(json.error).toBe("unsupported_media_type");
  });

  it("returns a dry-run plan and writes NOTHING; certain CA resolved", async () => {
    visionMock.mockResolvedValue(v({
      tokens: [{
        tokenSymbol: "TOES", tokenSymbolConfidence: "high",
        contractAddress: "FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump",
        contractAddressConfidence: "high", contractAddressCertain: true,
        chain: "solana", chainConfidence: "high", perf: "12x",
      }],
    }));
    const { status, json } = await post({ imageBase64: PNG_B64 });
    expect(status).toBe(200);
    expect(json.mode).toBe("dry_run");
    expect(json.plan.kolTokenLinksToCreate[0].contractAddress).toContain("FWgBz");
    expect(json.plan.kolProfileToCreate.publishable).toBe(false);
    // real sha256 of the actual bytes
    expect(json.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("doubtful CA from vision -> PENDING in the dry-run plan", async () => {
    visionMock.mockResolvedValue(v({
      tokens: [{
        tokenSymbol: "TROLL", tokenSymbolConfidence: "high",
        contractAddress: "FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump",
        contractAddressConfidence: "low", contractAddressCertain: false,
        chain: "solana", chainConfidence: "medium", perf: null,
      }],
    }));
    const { json } = await post({ imageBase64: PNG_B64, kolHandle: "fuelkek" });
    expect(json.plan.kolTokenLinksToCreate[0].contractAddress).toBe("PENDING:TROLL");
  });

  it("accepts a data: URL form", async () => {
    visionMock.mockResolvedValue(v({ tokens: [] }));
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
