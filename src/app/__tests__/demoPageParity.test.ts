// src/app/__tests__/demoPageParity.test.ts
// Vérifie que EN et FR demo pages ont les mêmes patterns critiques

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const en = readFileSync("src/app/en/demo/page.tsx", "utf-8");
const fr = readFileSync("src/app/fr/demo/page.tsx", "utf-8");

describe("Demo page parity EN/FR", () => {
  it("les deux pages ont setGraphData(gData)", () => {
    expect(en).toContain("setGraphData(gData)");
    expect(fr).toContain("setGraphData(gData)");
  });

  it("les deux pages ont Promise.all pour scan + graph", () => {
    expect(en).toContain("Promise.all");
    expect(fr).toContain("Promise.all");
  });

  it("les deux pages ont normalizeScanData avec tiger_score", () => {
    expect(en).toContain("tiger_score");
    expect(fr).toContain("tiger_score");
  });

  it("les deux pages ont RecidivismAlertBanner", () => {
    expect(en).toContain("RecidivismAlertBanner");
    expect(fr).toContain("RecidivismAlertBanner");
  });

  it("les deux pages ont setAnalysisStatus(done)", () => {
    expect(en).toContain('setAnalysisStatus("done")');
    expect(fr).toContain('setAnalysisStatus("done")');
  });
});
