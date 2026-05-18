import { describe, it, expect } from "vitest";
import {
  buildSerialPatterns,
  type DeployerRow,
  type KolTokenRow,
  type KolCaseRow,
} from "../serialPatternDetector";

const DEPLOYER = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const DEPLOYER2 = "0xcafebabeCAFEBABEcafebabecafebabecafebabe";
const MINT1 = "So11111111111111111111111111111111111111112";
const MINT2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT3 = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

function mkDeployer(
  address: string,
  mints: string[],
  chain = "solana",
): DeployerRow {
  const now = new Date();
  return {
    deployerAddress: address,
    chain,
    tokenCount: mints.length,
    tokenMints: mints,
    firstSeenAt: new Date(now.getTime() - 30 * 24 * 3600_000),
    lastSeenAt: now,
  };
}

function mkKolToken(mint: string, handle: string, rugCount = 0): KolTokenRow {
  return { tokenMint: mint, kolHandle: handle, rugCount };
}

function mkCase(handle: string, caseId: string): KolCaseRow {
  return { kolHandle: handle, caseId };
}

describe("buildSerialPatterns — basic detection", () => {
  it("deployer with 2+ tokens → SerialPattern", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1, MINT2])];
    const kolTokens = [
      mkKolToken(MINT1, "kol1"),
      mkKolToken(MINT2, "kol2"),
    ];
    const patterns = buildSerialPatterns(deployers, kolTokens, []);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].deployerAddress).toBe(DEPLOYER);
    expect(patterns[0].tokenCount).toBe(2);
  });

  it("deployer with 1 token → no pattern", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1])];
    const kolTokens = [mkKolToken(MINT1, "kol1")];
    const patterns = buildSerialPatterns(deployers, kolTokens, []);
    expect(patterns).toHaveLength(0);
  });
});

describe("buildSerialPatterns — pattern type classification", () => {
  it("rugCount > 0 → pump_dump", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1, MINT2])];
    const kolTokens = [
      mkKolToken(MINT1, "kol1", 2),
      mkKolToken(MINT2, "kol2", 0),
    ];
    const [p] = buildSerialPatterns(deployers, kolTokens, []);
    expect(p.patternType).toBe("pump_dump");
    expect(p.rugCount).toBeGreaterThan(0);
  });

  it("3+ linked KOLs, no rugs → coordinated_shill", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1, MINT2])];
    const kolTokens = [
      mkKolToken(MINT1, "kol1"),
      mkKolToken(MINT1, "kol2"),
      mkKolToken(MINT2, "kol3"),
    ];
    const [p] = buildSerialPatterns(deployers, kolTokens, []);
    expect(p.patternType).toBe("coordinated_shill");
    expect(p.linkedKolHandles).toHaveLength(3);
  });

  it("3+ tokens, no rugs, <3 KOLs → exit_liquidity", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1, MINT2, MINT3])];
    const kolTokens = [
      mkKolToken(MINT1, "kol1"),
      mkKolToken(MINT2, "kol1"),
      mkKolToken(MINT3, "kol2"),
    ];
    const [p] = buildSerialPatterns(deployers, kolTokens, []);
    expect(p.patternType).toBe("exit_liquidity");
  });
});

describe("buildSerialPatterns — confidence scoring", () => {
  it("2 tokens, no rugs, no multi-KOL → confidence 60", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1, MINT2])];
    const kolTokens = [mkKolToken(MINT1, "kol1"), mkKolToken(MINT2, "kol1")];
    const [p] = buildSerialPatterns(deployers, kolTokens, []);
    expect(p.confidence).toBe(60);
  });

  it("4 tokens → confidence += 2*10 = 80", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1, MINT2, MINT3, "MINT4"])];
    const kolTokens = ["MINT4", MINT1, MINT2, MINT3].map((m) => mkKolToken(m, "kol1"));
    const [p] = buildSerialPatterns(deployers, kolTokens, []);
    expect(p.confidence).toBe(80); // 60 + 2*10
  });

  it("capped at 100", () => {
    const mints = Array.from({ length: 10 }, (_, i) => `MINT${i}`);
    const deployers = [mkDeployer(DEPLOYER, mints)];
    const kolTokens = mints.flatMap((m) =>
      ["kol1", "kol2", "kol3"].map((h) => mkKolToken(m, h, 1)),
    );
    const [p] = buildSerialPatterns(deployers, kolTokens, []);
    expect(p.confidence).toBeLessThanOrEqual(100);
  });
});

describe("buildSerialPatterns — linked cases", () => {
  it("links case IDs from KolCase", () => {
    const deployers = [mkDeployer(DEPLOYER, [MINT1, MINT2])];
    const kolTokens = [mkKolToken(MINT1, "kol1"), mkKolToken(MINT2, "kol2")];
    const kolCases = [
      mkCase("kol1", "case-001"),
      mkCase("kol2", "case-002"),
    ];
    const [p] = buildSerialPatterns(deployers, kolTokens, kolCases);
    expect(p.linkedCaseIds).toContain("case-001");
    expect(p.linkedCaseIds).toContain("case-002");
  });

  it("multiple deployers produce separate patterns", () => {
    const deployers = [
      mkDeployer(DEPLOYER, [MINT1, MINT2]),
      mkDeployer(DEPLOYER2, [MINT2, MINT3]),
    ];
    const kolTokens = [
      mkKolToken(MINT1, "kol1"),
      mkKolToken(MINT2, "kol2"),
      mkKolToken(MINT3, "kol3"),
    ];
    const patterns = buildSerialPatterns(deployers, kolTokens, []);
    expect(patterns).toHaveLength(2);
    const addrs = patterns.map((p) => p.deployerAddress);
    expect(addrs).toContain(DEPLOYER);
    expect(addrs).toContain(DEPLOYER2);
  });
});
