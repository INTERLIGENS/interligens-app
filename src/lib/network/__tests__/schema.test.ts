import { describe, it, expect } from "vitest";
import {
  parseNetworkGraph,
  NetworkGraphParseError,
  TIER_VALUES,
  GROUP_VALUES,
} from "@/lib/network/schema";
import shippedData from "@/data/scamUniverse.json";

describe("parseNetworkGraph (shipped data)", () => {
  it("parses src/data/scamUniverse.json without throwing", () => {
    expect(() => parseNetworkGraph(shippedData)).not.toThrow();
  });

  it("exposes ≥41 nodes and all edges reference valid node ids", () => {
    const parsed = parseNetworkGraph(shippedData);
    expect(parsed.nodes.length).toBeGreaterThanOrEqual(41);
    const ids = new Set(parsed.nodes.map((n) => n.id));
    for (const e of parsed.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it("only uses tiers and groups from the enums", () => {
    const parsed = parseNetworkGraph(shippedData);
    for (const n of parsed.nodes) {
      expect(TIER_VALUES).toContain(n.tier);
      expect(GROUP_VALUES).toContain(n.group);
    }
    for (const e of parsed.edges) expect(TIER_VALUES).toContain(e.tier);
  });
});

describe("parseNetworkGraph (invalid inputs)", () => {
  const valid = () => ({
    generatedAt: "2026-04-17",
    sourceOfTruth: "test",
    evidenceTiers: { confirmed: "c", strong: "s", suspected: "u", alleged: "a" },
    nodes: [{ id: "x", group: "person", label: "X", tier: "confirmed" }],
    edges: [],
  });

  it("throws when root is not an object", () => {
    expect(() => parseNetworkGraph("nope")).toThrow(NetworkGraphParseError);
  });

  it("throws when nodes is empty", () => {
    expect(() => parseNetworkGraph({ ...valid(), nodes: [] })).toThrow(/nodes/);
  });

  it("throws on unknown tier in a node", () => {
    const bad = valid();
    bad.nodes[0] = { ...bad.nodes[0], tier: "speculative" as never };
    expect(() => parseNetworkGraph(bad)).toThrow(/tier/);
  });

  it("throws on unknown group", () => {
    const bad = valid();
    bad.nodes[0] = { ...bad.nodes[0], group: "alien" as never };
    expect(() => parseNetworkGraph(bad)).toThrow(/group/);
  });

  it("throws on empty label", () => {
    const bad = valid();
    bad.nodes[0] = { ...bad.nodes[0], label: "" };
    expect(() => parseNetworkGraph(bad)).toThrow(/label/);
  });

  it("throws on edge with missing tier", () => {
    const bad = valid();
    bad.edges = [
      { source: "x", target: "x", type: "self" } as never,
    ];
    expect(() => parseNetworkGraph(bad)).toThrow(/tier/);
  });

  it("ignores unrelated extra fields", () => {
    const withExtras = { ...valid(), randomKey: 42 };
    expect(() => parseNetworkGraph(withExtras)).not.toThrow();
  });
});
