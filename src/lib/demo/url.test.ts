import { describe, it, expect } from "vitest";
import { buildDemoUrl, parseDemoParams } from "./url";

describe("buildDemoUrl", () => {
  it("encode addr + auto=1 sans double encodage", () => {
    const url = buildDemoUrl({ base: "/en/demo", addr: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", deep: false, auto: true });
    expect(url).toContain("/en/demo?");
    expect(url).toContain("addr=BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb");
    expect(url).toContain("auto=1");
    expect(url).toContain("deep=0");
    // pas de double encodage
    expect(url).not.toContain("%25");
  });

  it("deep=true → deep=1", () => {
    const url = buildDemoUrl({ base: "/fr/demo", addr: "TEST", deep: true, auto: false });
    expect(url).toContain("deep=1");
    expect(url).not.toContain("auto=");
  });

  it("addr vide → pas de param addr", () => {
    const url = buildDemoUrl({ base: "/en/demo", addr: "", auto: false });
    expect(url).not.toContain("addr=");
  });
});

describe("parseDemoParams", () => {
  it("parse addr + auto + deep", () => {
    const p = parseDemoParams("?addr=BYZ9&auto=1&deep=1");
    expect(p.addr).toBe("BYZ9");
    expect(p.auto).toBe(true);
    expect(p.deep).toBe(true);
    expect(p.mock).toBeNull();
  });

  it("mock présent → mock extrait", () => {
    const p = parseDemoParams("?mock=red&addr=TEST");
    expect(p.mock).toBe("red");
    expect(p.addr).toBe("TEST");
  });

  it("auto absent → false", () => {
    const p = parseDemoParams("?addr=TEST");
    expect(p.auto).toBe(false);
  });
});

describe("detectChain-like — BSC prefix", () => {
  it("bsc:0x... → reconnu comme BSC (pattern)", () => {
    const addr = "bsc:0x10ED43C718714eb63d5aA57b78b54704E256024E";
    expect(/^bsc:0x[a-fA-F0-9]{40}$/i.test(addr)).toBe(true);
  });

  it("0x... sans prefix → pas BSC", () => {
    const addr = "0x10ED43C718714eb63d5aA57b78b54704E256024E";
    expect(/^bsc:0x[a-fA-F0-9]{40}$/i.test(addr)).toBe(false);
  });
});
