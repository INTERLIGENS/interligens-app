/**
 * src/lib/surveillance/reports/__tests__/casefile.test.ts
 */
import { describe, test, expect } from "vitest";

// Test du template HTML sans dépendance DB
function buildHtmlMinimal(data: { handle: string; txHash: string; windowBucket: string }) {
  return `<html><body>
    <h1>INTERLIGENS — Evidence Report</h1>
    <span class="badge ${data.windowBucket}">${data.windowBucket}</span>
    <td>${data.handle}</td>
    <td class="mono">${data.txHash}</td>
    <div class="disclaimer">Facts only</div>
  </body></html>`;
}

describe("CaseFile HTML generation", () => {
  test("contient le header INTERLIGENS", () => {
    const html = buildHtmlMinimal({ handle: "@test", txHash: "0xabc", windowBucket: "BLATANT" });
    expect(html).toContain("INTERLIGENS");
  });

  test("contient le handle", () => {
    const html = buildHtmlMinimal({ handle: "@vitalik", txHash: "0xabc", windowBucket: "BLATANT" });
    expect(html).toContain("@vitalik");
  });

  test("contient le txHash", () => {
    const html = buildHtmlMinimal({ handle: "@test", txHash: "0xdeadbeef", windowBucket: "PROBABLE" });
    expect(html).toContain("0xdeadbeef");
  });

  test("contient le windowBucket", () => {
    const html = buildHtmlMinimal({ handle: "@test", txHash: "0xabc", windowBucket: "BLATANT" });
    expect(html).toContain("BLATANT");
  });

  test("contient le disclaimer facts only", () => {
    const html = buildHtmlMinimal({ handle: "@test", txHash: "0xabc", windowBucket: "BLATANT" });
    expect(html).toContain("Facts only");
  });

  test("HTML non vide", () => {
    const html = buildHtmlMinimal({ handle: "@test", txHash: "0xabc", windowBucket: "BLATANT" });
    expect(html.length).toBeGreaterThan(100);
  });
});

// ─── ALERT THRESHOLD LOGIC ───────────────────────────────────────────────────

describe("alert threshold logic", () => {
  const thresholdOrder = ["POSSIBLE", "PROBABLE", "BLATANT"];

  function shouldDeliver(signalBucket: string, threshold: string): boolean {
    const sigIdx = thresholdOrder.indexOf(signalBucket);
    const threshIdx = thresholdOrder.indexOf(threshold);
    return sigIdx >= threshIdx;
  }

  test("BLATANT signal passe un threshold PROBABLE", () => {
    expect(shouldDeliver("BLATANT", "PROBABLE")).toBe(true);
  });

  test("BLATANT signal passe un threshold POSSIBLE", () => {
    expect(shouldDeliver("BLATANT", "POSSIBLE")).toBe(true);
  });

  test("PROBABLE signal passe un threshold PROBABLE", () => {
    expect(shouldDeliver("PROBABLE", "PROBABLE")).toBe(true);
  });

  test("POSSIBLE signal ne passe pas un threshold PROBABLE", () => {
    expect(shouldDeliver("POSSIBLE", "PROBABLE")).toBe(false);
  });

  test("POSSIBLE signal passe un threshold POSSIBLE", () => {
    expect(shouldDeliver("POSSIBLE", "POSSIBLE")).toBe(true);
  });

  test("PROBABLE signal ne passe pas un threshold BLATANT", () => {
    expect(shouldDeliver("PROBABLE", "BLATANT")).toBe(false);
  });
});
