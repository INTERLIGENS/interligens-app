import { describe, it, expect } from "vitest";
import { classifyAsset } from "./verifyMintOnChain";

describe("classifyAsset (Helius getAsset -> MintVerification)", () => {
  it("exists with token_info.symbol", () => {
    const r = classifyAsset(true, { result: { id: "MINT", token_info: { symbol: "TOES" } } });
    expect(r.status).toBe("exists");
    expect(r.symbol).toBe("TOES");
  });

  it("exists with content.metadata.symbol fallback", () => {
    const r = classifyAsset(true, { result: { id: "MINT", content: { metadata: { symbol: "TOES", name: "Toes" } } } });
    expect(r.status).toBe("exists");
    expect(r.symbol).toBe("TOES");
    expect(r.name).toBe("Toes");
  });

  it("exists but no symbol -> symbol null", () => {
    const r = classifyAsset(true, { result: { id: "MINT" } });
    expect(r.status).toBe("exists");
    expect(r.symbol).toBeNull();
  });

  it("clean RPC answer, no result -> not_found", () => {
    expect(classifyAsset(true, { result: null }).status).toBe("not_found");
    expect(classifyAsset(true, {}).status).toBe("not_found");
  });

  it("error 'Asset Not Found' -> not_found", () => {
    expect(classifyAsset(true, { error: { message: "Asset Not Found" } }).status).toBe("not_found");
  });

  it("other RPC error -> unavailable (never resolve)", () => {
    expect(classifyAsset(true, { error: { message: "rate limited" } }).status).toBe("unavailable");
  });

  it("http not ok / null body -> unavailable", () => {
    expect(classifyAsset(false, { result: { id: "x" } }).status).toBe("unavailable");
    expect(classifyAsset(true, null).status).toBe("unavailable");
  });
});
