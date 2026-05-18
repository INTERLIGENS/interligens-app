import { describe, it, expect } from "vitest";
import { analyzeSignatureIntent } from "@/lib/signature-intent/analyzer";

// ── EVM calldata builders ─────────────────────────────────────────────────────

const DEAD  = "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const ALICE = "0000000000000000000000001234567890abcdef1234567890abcdef12345678";
const BOB   = "000000000000000000000000abcdef1234567890abcdef1234567890abcdef12";
const MAX_U = "f".repeat(64);
const ONE   = "0000000000000000000000000000000000000000000000000de0b6b3a7640000"; // 1e18

// approve(address,uint256)
const RAW_APPROVE_MAX     = `0x095ea7b3${DEAD}${MAX_U}`;
const RAW_APPROVE_LIMITED = `0x095ea7b3${DEAD}${ONE}`;
// permit(owner,spender,value,deadline,v,r,s)
const RAW_PERMIT          = `0xd505accf${ALICE}${DEAD}${ONE}${"0".repeat(64)}${"0".repeat(64)}${"0".repeat(64)}${"0".repeat(64)}`;
// setApprovalForAll(address,bool)
const RAW_SET_APPROVAL    = `0xa22cb465${DEAD}0000000000000000000000000000000000000000000000000000000000000001`;
// transferFrom(from,to,amount)
const RAW_TRANSFER_FROM   = `0x23b872dd${ALICE}${BOB}${ONE}`;
// multicall with hidden approve inside
const RAW_MULTICALL_APPROVE =
  `0xac9650d8` +
  `0000000000000000000000000000000000000000000000000000000000000020` +
  `0000000000000000000000000000000000000000000000000000000000000001` +
  `0000000000000000000000000000000000000000000000000000000000000020` +
  `0000000000000000000000000000000000000000000000000000000000000044` +
  `095ea7b3${DEAD}${MAX_U}00000000`; // approve hidden inside

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("analyzeSignatureIntent", () => {
  it("test 1 — approve MAX_UINT256 → CRITICAL UNLIMITED_APPROVAL", () => {
    const result = analyzeSignatureIntent({ raw_tx: RAW_APPROVE_MAX, chain: "ethereum" });
    expect(result.risk_level).toBe("CRITICAL");
    expect(result.intent_type).toBe("UNLIMITED_APPROVAL");
    expect(result.recommended_action).toBe("REJECT");
    expect(result.decoded_summary.is_unlimited).toBe(true);
    expect(result.decoded_summary.spender).toContain("deadbeef");
  });

  it("test 2 — approve limited amount → MEDIUM APPROVE", () => {
    const result = analyzeSignatureIntent({ raw_tx: RAW_APPROVE_LIMITED, chain: "ethereum" });
    expect(result.risk_level).toBe("MEDIUM");
    expect(result.intent_type).toBe("APPROVE");
    expect(result.recommended_action).toBe("CAUTION");
    expect(result.decoded_summary.is_unlimited).toBe(false);
  });

  it("test 3 — permit EIP-2612 → HIGH PERMIT", () => {
    const result = analyzeSignatureIntent({ raw_tx: RAW_PERMIT, chain: "ethereum" });
    expect(result.risk_level).toBe("HIGH");
    expect(result.intent_type).toBe("PERMIT");
    expect(result.recommended_action).toBe("CAUTION");
  });

  it("test 4 — setApprovalForAll → CRITICAL SET_APPROVAL_FOR_ALL", () => {
    const result = analyzeSignatureIntent({ raw_tx: RAW_SET_APPROVAL, chain: "ethereum" });
    expect(result.risk_level).toBe("CRITICAL");
    expect(result.intent_type).toBe("SET_APPROVAL_FOR_ALL");
    expect(result.recommended_action).toBe("REJECT");
    expect(result.decoded_summary.is_unlimited).toBe(true);
  });

  it("test 5 — transferFrom known address → LOW TRANSFER_FROM", () => {
    const result = analyzeSignatureIntent({
      raw_tx: RAW_TRANSFER_FROM,
      chain: "ethereum",
    });
    expect(result.risk_level).toBe("LOW");
    expect(result.intent_type).toBe("TRANSFER_FROM");
    expect(result.recommended_action).toBe("SAFE_TO_SIGN");
    expect(result.red_flags).toHaveLength(0);
  });

  it("test 6 — multicall with hidden approve → HIGH MULTICALL_WITH_APPROVAL", () => {
    const result = analyzeSignatureIntent({
      raw_tx: RAW_MULTICALL_APPROVE,
      chain: "ethereum",
    });
    expect(result.risk_level).toBe("HIGH");
    expect(result.intent_type).toBe("MULTICALL_WITH_APPROVAL");
    expect(result.recommended_action).toBe("CAUTION");
    expect(result.red_flags.some((f) => f.toLowerCase().includes("approval"))).toBe(true);
  });

  it("test 7 — Solana setAuthority via decoded_data → CRITICAL SET_AUTHORITY", () => {
    const result = analyzeSignatureIntent({
      chain: "solana",
      decoded_data: {
        method: "setAuthority",
        params: { authorityType: "MintTokens", newAuthority: "11111111111111111111111111111111" },
      },
    });
    expect(result.risk_level).toBe("CRITICAL");
    expect(result.intent_type).toBe("SET_AUTHORITY");
    expect(result.recommended_action).toBe("REJECT");
  });

  it("test 8 — unknown selector → MEDIUM UNKNOWN CAUTION", () => {
    const unknownTx = "0xdeadcafe" + "0".repeat(64);
    const result = analyzeSignatureIntent({ raw_tx: unknownTx, chain: "ethereum" });
    expect(result.risk_level).toBe("MEDIUM");
    expect(result.intent_type).toBe("UNKNOWN");
    expect(result.recommended_action).toBe("CAUTION");
  });
});
