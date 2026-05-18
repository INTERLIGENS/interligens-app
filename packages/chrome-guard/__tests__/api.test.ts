import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchVerdict } from "../src/api";

describe("fetchVerdict", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns RED for a flagged address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ verdict: "RED", score: 80 }) })));
    expect(await fetchVerdict("0xbad")).toBe("RED");
  });

  it("returns ORANGE for a risky address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ verdict: "ORANGE", score: 50 }) })));
    expect(await fetchVerdict("0xrisky")).toBe("ORANGE");
  });

  it("returns GREEN for a safe address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ verdict: "GREEN", score: 5 }) })));
    expect(await fetchVerdict("0xsafe")).toBe("GREEN");
  });

  it("fail-open when API throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network error"); }));
    expect(await fetchVerdict("any")).toBe("GREEN");
  });

  it("fail-open when API returns non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await fetchVerdict("any")).toBe("GREEN");
  });

  it("fail-open when verdict is unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ verdict: "UNKNOWN" }) })));
    expect(await fetchVerdict("any")).toBe("GREEN");
  });
});
