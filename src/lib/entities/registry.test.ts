import { describe, it, expect } from "vitest";
import { resolveEntity, resolveEntities } from "./registry";

describe("Entity Registry", () => {
  it("resolves Uniswap V2 on ETH", () => {
    const e = resolveEntity("ETH", "0x7a250d5630b4cf539739df2c5dacb4c659f2488d");
    expect(e.name).toBe("Uniswap V2 Router");
    expect(e.isOfficial).toBe(true);
    expect(e.category).toBe("dex");
  });

  it("resolves case-insensitive", () => {
    const e = resolveEntity("ETH", "0x7A250D5630B4CF539739DF2C5DACB4C659F2488D");
    expect(e.isOfficial).toBe(true);
  });

  it("returns unknown for random address", () => {
    const e = resolveEntity("ETH", "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    expect(e.name).toBe("Unknown");
    expect(e.isOfficial).toBe(false);
  });

  it("resolves PancakeSwap on BSC", () => {
    const e = resolveEntity("BSC", "0x10ed43c718714eb63d5aa57b78b54704e256024e");
    expect(e.name).toBe("PancakeSwap V2 Router");
  });

  it("resolves Jupiter on SOL", () => {
    const e = resolveEntity("SOL", "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
    expect(e.name).toBe("Jupiter Aggregator V6");
    expect(e.isOfficial).toBe(true);
  });

  it("resolveEntities maps multiple addresses", () => {
    const results = resolveEntities("ETH", [
      "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    ]);
    expect(results[0].isOfficial).toBe(true);
    expect(results[1].isOfficial).toBe(false);
  });
});
