import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAmf } from "../sources/amf";

describe("fetchAmf", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 })
    );
    const result = await fetchAmf();
    expect(result).toEqual([]);
  });

  it("returns empty array on timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("abort"));
    const result = await fetchAmf();
    expect(result).toEqual([]);
  });

  it("parses AMF entries with domain + project", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            name: "Fake Broker SA",
            website: "https://www.fakebroker.com/register",
          },
          {
            name: "Scam Exchange",
            url: "scam-exchange.io",
          },
        ])
      )
    );
    const result = await fetchAmf();
    // Each entry with website/url → domain + project = 2 entries each
    expect(result.length).toBeGreaterThanOrEqual(4);

    const domains = result.filter((r) => r.entityType === "DOMAIN");
    expect(domains.length).toBe(2);
    expect(domains[0].value).toBe("fakebroker.com");
    expect(domains[0].sourceSlug).toBe("amf");
    expect(domains[0].riskClass).toBe("SANCTION");
    expect(domains[0].jurisdiction).toBe("FR");

    const projects = result.filter((r) => r.entityType === "PROJECT");
    expect(projects.length).toBe(2);
    expect(projects[0].value).toBe("Fake Broker SA");
  });
});
