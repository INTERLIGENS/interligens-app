import { describe, it, expect } from "vitest";
import {
  checkMmOverride,
  listMmOverrides,
} from "@/lib/mm/integration/override";

describe("checkMmOverride", () => {
  it("returns false when MM_OVERRIDE_TOKENS is unset", () => {
    expect(checkMmOverride("mint-1", "SOLANA", {})).toBe(false);
  });

  it("returns true when the token is in the list (case-insensitive chain)", () => {
    expect(
      checkMmOverride("mint-1", "SOLANA", {
        MM_OVERRIDE_TOKENS: "mint-1:solana, mint-2:ETHEREUM",
      }),
    ).toBe(true);
  });

  it("returns false when the token is absent from the list", () => {
    expect(
      checkMmOverride("mint-3", "SOLANA", {
        MM_OVERRIDE_TOKENS: "mint-1:SOLANA,mint-2:ETHEREUM",
      }),
    ).toBe(false);
  });

  it("tolerates whitespace and trailing commas", () => {
    expect(
      checkMmOverride("mint-1", "SOLANA", {
        MM_OVERRIDE_TOKENS: " mint-1 : solana ,, ",
      }),
    ).toBe(true);
  });

  it("listMmOverrides returns every parsed entry in canonical form", () => {
    const list = listMmOverrides({
      MM_OVERRIDE_TOKENS: "a:solana, b:ethereum",
    });
    expect(list.sort()).toEqual(["a:SOLANA", "b:ETHEREUM"].sort());
  });

  it("returns false when only one half of the pair is provided", () => {
    expect(
      checkMmOverride("mint-1", "SOLANA", {
        MM_OVERRIDE_TOKENS: "mint-1,mint-2:ETHEREUM",
      }),
    ).toBe(false);
  });
});
