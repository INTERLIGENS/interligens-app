import { describe, it, expect } from "vitest";
import { getActionCopy } from "./actions";

describe("getActionCopy", () => {
  it("token RED → 3 bullets token, jamais move funds", () => {
    const c = getActionCopy({ scan_type: "token", tier: "RED", chain: "SOL" });
    const all = [...c.en, ...c.fr].join(" ").toLowerCase();
    expect(all).not.toMatch(/move funds|new wallet|burner wallet|revoke everything/);
    expect(c.en).toHaveLength(3);
    expect(c.fr).toHaveLength(3);
    expect(c.en[0]).toContain("DO NOT INTERACT");
    expect(c.fr[0]).toContain("N'INTERAGIS PAS");
  });

  it("wallet RED + unlimitedApprovals → revoke + move funds", () => {
    const c = getActionCopy({ scan_type: "wallet", tier: "RED", chain: "ETH", hasUnlimitedApprovals: true });
    const enAll = c.en.join(" ").toLowerCase();
    const frAll = c.fr.join(" ").toLowerCase();
    expect(enAll).toMatch(/revoke/);
    expect(enAll).toMatch(/move funds/);
    expect(frAll).toMatch(/révoque/);
    expect(frAll).toMatch(/transfère/);
  });

  it("token RED → aucune mention de move funds/burner/revoke everything", () => {
    const FORBIDDEN = ["move funds", "new wallet", "burner wallet", "revoke everything", "bouger des fonds"];
    const c = getActionCopy({ scan_type: "token", tier: "RED", chain: "ETH" });
    const all = [...c.en, ...c.fr].join(" ").toLowerCase();
    for (const f of FORBIDDEN) {
      expect(all).not.toContain(f);
    }
  });
});
