import { describe, it, expect } from "vitest";
import { validateCA, pendingFor, isPending } from "./validateCA";

describe("validateCA", () => {
  it("accepts a well-formed Solana base58 CA and infers solana", () => {
    const r = validateCA("FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump");
    expect(r.valid).toBe(true);
    expect(r.inferredChain).toBe("solana");
  });

  it("accepts a well-formed EVM CA and infers ethereum", () => {
    const r = validateCA("0x" + "a".repeat(40));
    expect(r.valid).toBe(true);
    expect(r.inferredChain).toBe("ethereum");
  });

  it("rejects a truncated/garbage CA", () => {
    expect(validateCA("FWgBz...").valid).toBe(false);
    expect(validateCA("0x123").valid).toBe(false);
    expect(validateCA("not an address").valid).toBe(false);
  });

  it("rejects Solana strings containing forbidden base58 chars (0,O,I,l)", () => {
    // 44 chars but contains '0' and 'O' which are not in base58
    expect(validateCA("0OIl" + "1".repeat(40)).valid).toBe(false);
  });

  it("rejects non-strings, empty, and PENDING sentinels", () => {
    expect(validateCA(null).valid).toBe(false);
    expect(validateCA(undefined).valid).toBe(false);
    expect(validateCA("").valid).toBe(false);
    expect(validateCA("PENDING:TROLL").valid).toBe(false);
    expect(validateCA("PENDING:TROLL").reason).toBe("pending_sentinel");
  });

  it("pendingFor sanitizes and uppercases the ticker", () => {
    expect(pendingFor("troll")).toBe("PENDING:TROLL");
    expect(pendingFor("$Mo th.er")).toBe("PENDING:MOTHER");
    expect(pendingFor(null)).toBe("PENDING:UNKNOWN");
  });

  it("isPending detects sentinels case-insensitively", () => {
    expect(isPending("PENDING:X")).toBe(true);
    expect(isPending("pending:x")).toBe(true);
    expect(isPending("0x" + "a".repeat(40))).toBe(false);
  });
});
