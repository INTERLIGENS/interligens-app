import { describe, it, expect, beforeEach, vi } from "vitest";

async function call(params = "") {
  vi.resetModules();
  const { GET } = await import("./route");
  return GET(new Request("http://localhost/api/osint/signals?" + params));
}

describe("GET /api/osint/signals", () => {
  beforeEach(() => { vi.resetModules(); });

  it("botify: returns 2 items capped at 2", async () => {
    const res = await call("q=botify&lang=en&mock=1");
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.items.length).toBeLessThanOrEqual(2);
    expect(json.items[0].tags).toContain("pump.fun");
  });

  it("no q: returns 1 generic item", async () => {
    const res = await call("lang=en&mock=1");
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.items.length).toBeGreaterThanOrEqual(1);
    expect(json.items[0].id).toBe("generic-no-signal");
  });

  it("fr lang: returns fr microcopy", async () => {
    const res = await call("q=botify&lang=fr&mock=1");
    const json = await res.json();
    expect(json.items[0].why_fr).toContain("pump.fun");
  });
});
