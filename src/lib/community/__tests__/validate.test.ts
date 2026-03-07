
import { describe, it, expect } from "vitest";
import { validateSubmission, detectChain, deriveSeverity } from "../validate";

describe("detectChain", () => {
  it("detects EVM", () => expect(detectChain("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe("EVM"));
  it("detects SOL", () => expect(detectChain("BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb")).toBe("SOL"));
  it("detects TRON", () => expect(detectChain("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9")).toBe("TRON"));
  it("returns null for garbage", () => expect(detectChain("notanaddress")).toBeNull());
});

describe("validateSubmission", () => {
  it("rejects missing address", () => expect(validateSubmission({})).toBe("address required"));
  it("rejects invalid labelType", () => expect(validateSubmission({ address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", labelType: "badtype" })).toMatch(/invalid/));
  it("rejects danger without evidence", () => expect(validateSubmission({
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", labelType: "scam"
  })).toMatch(/evidence/));
  it("accepts danger with txHash", () => expect(validateSubmission({
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", labelType: "scam", txHash: "0xabc"
  })).toBeNull());
  it("accepts info without evidence", () => expect(validateSubmission({
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", labelType: "other"
  })).toBeNull());
  it("rejects message too long", () => expect(validateSubmission({
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", labelType: "other", message: "x".repeat(501)
  })).toMatch(/too long/));
});

describe("deriveSeverity", () => {
  it("scam -> danger", () => expect(deriveSeverity("scam")).toBe("danger"));
  it("mixer -> warn", () => expect(deriveSeverity("mixer")).toBe("warn"));
  it("other -> info", () => expect(deriveSeverity("other")).toBe("info"));
});
