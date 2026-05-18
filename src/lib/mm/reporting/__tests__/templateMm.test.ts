import { describe, it, expect } from "vitest";
import {
  renderMmReportHtml,
  type MmReportInput,
  type MmReportClaim,
  type MmReportAttribution,
  type MmReportScanSummary,
  type MmReportClusterRelation,
  type MmReportSource,
} from "@/lib/mm/reporting/templateMm";

const now = new Date("2026-04-01T12:00:00Z");

function makeSource(id = "src1"): MmReportSource {
  return {
    id,
    publisher: "SEC.gov",
    title: "Enforcement Action",
    url: "https://sec.gov/litigation/1",
    sourceType: "COURT",
    credibilityTier: "TIER_1",
    publishedAt: now,
  };
}

function makeClaim(
  id: string,
  claimType: MmReportClaim["claimType"],
  text: string,
): MmReportClaim {
  return {
    id,
    claimType,
    text,
    textFr: null,
    jurisdiction: "US-SDNY",
    orderIndex: 0,
    source: makeSource("src-" + id),
  };
}

function makeAttribution(id: string, addr: string): MmReportAttribution {
  return {
    id,
    walletAddress: addr,
    chain: "SOLANA",
    attributionMethod: "COURT_FILING",
    confidence: 0.95,
    reviewedAt: now,
    createdAt: now,
  };
}

function makeScan(subjectId: string): MmReportScanSummary {
  return {
    subjectId,
    chain: "SOLANA",
    displayScore: 82,
    band: "RED",
    confidence: "high",
    coverage: "full",
    dominantDriver: "WASH_TRADING",
    computedAt: now,
    signalsCount: 4,
    topSignals: [
      { type: "WASH_TRADING", severity: "HIGH", description: "Round trip pattern" },
    ],
    detectorScores: [{ detectorType: "WASH_TRADING", score: 28 }],
  };
}

function makeCluster(): MmReportClusterRelation {
  return {
    internalClusterId: "CLU-001",
    rootWallet: "ROOT1111111111111111111111111111",
    memberCount: 3,
    members: [
      "ROOT1111111111111111111111111111",
      "MEM22222222222222222222222222222",
      "MEM33333333333333333333333333333",
    ],
    sharedTokens: ["TOKEN_AAA", "TOKEN_BBB"],
  };
}

function baseInput(): MmReportInput {
  return {
    entity: {
      slug: "dione-protocol",
      name: "Dione Protocol",
      legalName: "Dione Labs SARL",
      jurisdiction: "Switzerland",
      foundedYear: 2022,
      founders: ["Alice", "Bob"],
      status: "CONVICTED",
      riskBand: "RED",
      defaultScore: 95,
      publicSummary: "Test entity summary.",
      publicSummaryFr: "Résumé de test.",
      workflow: "PUBLISHED",
      publishedAt: now,
      updatedAt: now,
    },
    claims: [],
    attributions: [],
    scans: [],
    clusters: [],
    generatedAt: now,
  };
}

describe("renderMmReportHtml", () => {
  it("produces a complete HTML doctype with the entity name in the title", () => {
    const html = renderMmReportHtml(baseInput());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>MM Report — Dione Protocol</title>");
  });

  it("escapes HTML in entity name to prevent injection", () => {
    const input = baseInput();
    input.entity.name = `<script>alert("x")</script>`;
    const html = renderMmReportHtml(input);
    expect(html).not.toContain(`<script>alert("x")</script>`);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;");
  });

  it("renders FACT / ALLEGATION / INFERENCE / RESPONSE sections when claims are present", () => {
    const input = baseInput();
    input.claims = [
      makeClaim("1", "FACT", "Procedural fact"),
      makeClaim("2", "ALLEGATION", "Documented allegation"),
      makeClaim("3", "INFERENCE", "Corroborated inference"),
      makeClaim("4", "RESPONSE", "Legal reply"),
    ];
    const html = renderMmReportHtml(input);
    expect(html).toContain("Procedural fact");
    expect(html).toContain("Documented allegation");
    expect(html).toContain("Corroborated inference");
    expect(html).toContain("Legal reply");
    expect(html).toContain("Statut procédural");
    expect(html).toContain("Éléments documentés");
    expect(html).toContain("Position adverse");
  });

  it("renders wallet attributions with explorer links", () => {
    const input = baseInput();
    input.attributions = [
      makeAttribution("a1", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
    ];
    const html = renderMmReportHtml(input);
    expect(html).toContain("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(html).toContain("solscan.io/account/");
  });

  it("renders scan summaries including detector scores", () => {
    const input = baseInput();
    input.scans = [makeScan("WALLET_A")];
    const html = renderMmReportHtml(input);
    expect(html).toContain("WALLET_A");
    expect(html).toContain("82");
    expect(html).toContain("WASH_TRADING");
  });

  it("renders cluster relations when present", () => {
    const input = baseInput();
    input.clusters = [makeCluster()];
    const html = renderMmReportHtml(input);
    expect(html).toContain("CLU-001");
    expect(html).toContain("2 token(s) partagé(s)");
  });

  it("gracefully renders an empty snapshot (no claims / attribs / scans / clusters)", () => {
    const html = renderMmReportHtml(baseInput());
    expect(html).toContain("Dione Protocol");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).not.toContain("undefined");
  });

  it("includes the methodology / disclaimer block", () => {
    const html = renderMmReportHtml(baseInput());
    expect(html.toLowerCase()).toContain("méthodologie");
  });
});
