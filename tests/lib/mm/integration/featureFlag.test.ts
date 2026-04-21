import { describe, it, expect } from "vitest";
import { isMmIntegrationEnabled } from "@/lib/mm/integration/featureFlag";

describe("isMmIntegrationEnabled", () => {
  it("returns false when MM_INTEGRATION_LIVE is unset", () => {
    expect(isMmIntegrationEnabled({})).toBe(false);
  });

  it("returns false for explicit falsey values", () => {
    for (const v of ["false", "0", "off", "no", "FALSE", ""]) {
      expect(
        isMmIntegrationEnabled({ MM_INTEGRATION_LIVE: v }),
        `value=${JSON.stringify(v)}`,
      ).toBe(false);
    }
  });

  it("returns true for each recognised truthy value (case-insensitive)", () => {
    for (const v of ["1", "true", "on", "YES", "True", "  on  "]) {
      expect(
        isMmIntegrationEnabled({ MM_INTEGRATION_LIVE: v }),
        `value=${JSON.stringify(v)}`,
      ).toBe(true);
    }
  });

  it("ignores non-string values without crashing", () => {
    expect(
      // @ts-expect-error — testing defensive handling of a wrongly-typed env
      isMmIntegrationEnabled({ MM_INTEGRATION_LIVE: 1 }),
    ).toBe(false);
  });
});
