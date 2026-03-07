import { describe, it, expect } from "vitest";
import { detectRecidivism } from "../RecidivismAlertBanner";

const base = { clusters: [], related_projects: [], overall_status: "NONE" };
const proof = (s: string, h = "shared_funder") => ({ type: h, tx_signature: s, timestamp: 1700000000, detail: "test" });

describe("detectRecidivism — logique", () => {
  it("false si pas de données", () => expect(detectRecidivism(base).detected).toBe(false));

  it("true si related CORROBORATED + link_score>=80", () => {
    const g = { ...base, related_projects: [{ mint:"A", symbol:"BONK", status:"CORROBORATED", link_score:85, shared_wallets:3, signals:[] }] };
    expect(detectRecidivism(g).detected).toBe(true);
    expect(detectRecidivism(g).corroboratedRelated).toBe(1);
  });

  it("false si related CORROBORATED mais link_score<80", () => {
    const g = { ...base, related_projects: [{ mint:"A", symbol:"BONK", status:"CORROBORATED", link_score:70, shared_wallets:2, signals:[] }] };
    expect(detectRecidivism(g).detected).toBe(false);
  });

  it("true si cluster shared_funder CORROBORATED avec proofs", () => {
    const g = { ...base, clusters: [{ strength:"HIGH", heuristic:"shared_funder", status:"CORROBORATED", proofs:[proof("abc")] }] };
    expect(detectRecidivism(g).detected).toBe(true);
    expect(detectRecidivism(g).totalProofs).toBe(1);
  });

  it("true si cluster lp_overlap CORROBORATED avec proofs", () => {
    const g = { ...base, clusters: [{ strength:"MED", heuristic:"lp_overlap", status:"CORROBORATED", proofs:[proof("xyz","lp_overlap")] }] };
    expect(detectRecidivism(g).detected).toBe(true);
  });

  it("false si co_trading seulement (pas shared_funder/lp_overlap)", () => {
    const g = { ...base, clusters: [{ strength:"MED", heuristic:"co_trading", status:"CORROBORATED", proofs:[proof("xyz","co_trading")] }] };
    expect(detectRecidivism(g).detected).toBe(false);
  });

  it("false si proofs vides", () => {
    const g = { ...base, clusters: [{ strength:"HIGH", heuristic:"shared_funder", status:"CORROBORATED", proofs:[] }] };
    expect(detectRecidivism(g).detected).toBe(false);
  });
});

describe("detectRecidivism — filtre stablecoins", () => {
  it("USDC exclu de topRelated", () => {
    const g = { ...base, related_projects: [
      { mint:"A", symbol:"USDC", status:"CORROBORATED", link_score:90, shared_wallets:5, signals:[] },
      { mint:"B", symbol:"BONK", status:"CORROBORATED", link_score:85, shared_wallets:3, signals:[] },
    ]};
    const v = detectRecidivism(g);
    expect(v.topRelated.every(p => p.symbol !== "USDC")).toBe(true);
    expect(v.topRelated.some(p => p.symbol === "BONK")).toBe(true);
  });

  it("USDT, mSOL, SOL exclus", () => {
    const g = { ...base, related_projects: [
      { mint:"A", symbol:"USDT",   status:"CORROBORATED", link_score:95, shared_wallets:5, signals:[] },
      { mint:"B", symbol:"MSOL",   status:"CORROBORATED", link_score:90, shared_wallets:4, signals:[] },
      { mint:"C", symbol:"SOL",    status:"CORROBORATED", link_score:88, shared_wallets:3, signals:[] },
      { mint:"D", symbol:"SCAMX",  status:"CORROBORATED", link_score:85, shared_wallets:2, signals:[] },
    ]};
    const v = detectRecidivism(g);
    const symbols = v.topRelated.map(p => p.symbol);
    expect(symbols).not.toContain("USDT");
    expect(symbols).not.toContain("MSOL");
    expect(symbols).not.toContain("SOL");
    expect(symbols).toContain("SCAMX");
  });

  it("totalRelated ne compte pas les stablecoins", () => {
    const g = { ...base, related_projects: [
      { mint:"A", symbol:"USDC",  status:"CORROBORATED", link_score:95, shared_wallets:5, signals:[] },
      { mint:"B", symbol:"SCAM1", status:"CORROBORATED", link_score:85, shared_wallets:3, signals:[] },
      { mint:"C", symbol:"SCAM2", status:"REFERENCED",   link_score:60, shared_wallets:2, signals:[] },
    ]};
    const v = detectRecidivism(g);
    expect(v.totalRelated).toBe(2); // USDC exclu
  });
});

describe("detectRecidivism — confidence", () => {
  it("HIGH si >=4 proofs + >=2 types d'heuristique", () => {
    const g = { ...base, clusters: [
      { strength:"HIGH", heuristic:"shared_funder", status:"CORROBORATED", proofs:[proof("a"),proof("b"),proof("c")] },
      { strength:"MED",  heuristic:"lp_overlap",    status:"CORROBORATED", proofs:[proof("d","lp_overlap")] },
    ]};
    expect(detectRecidivism(g).confidence).toBe("HIGH");
  });

  it("MED si 2 preuves, 1 type", () => {
    const g = { ...base, clusters: [
      { strength:"HIGH", heuristic:"shared_funder", status:"CORROBORATED", proofs:[proof("a"),proof("b")] },
    ]};
    expect(detectRecidivism(g).confidence).toBe("MED");
  });

  it("LOW si 0 preuves", () => {
    expect(detectRecidivism(base).confidence).toBe("LOW");
  });
});
