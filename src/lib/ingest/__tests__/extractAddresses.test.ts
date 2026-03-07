
import { describe, it, expect } from "vitest";
import { extractAddresses } from "../extractAddresses";

const SAMPLE_TEXT = `
  Report on suspicious wallets:
  EVM address: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  Also found: 0xAbCdEf1234567890AbCdEf1234567890AbCdEf12
  Solana wallet: BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb
  Tron: TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9
  Some random text that is not an address.
`;

describe("extractAddresses", () => {
  it("extracts 2 EVM addresses", () => {
    const r = extractAddresses(SAMPLE_TEXT);
    expect(r.filter(c => c.chain === "EVM")).toHaveLength(2);
  });
  it("extracts 1 SOL address", () => {
    const r = extractAddresses(SAMPLE_TEXT);
    expect(r.filter(c => c.chain === "SOL").length).toBeGreaterThanOrEqual(1);
  });
  it("deduplicates identical addresses", () => {
    const text = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const r = extractAddresses(text);
    expect(r.filter(c => c.chain === "EVM")).toHaveLength(1);
  });
  it("returns empty for no addresses", () => {
    expect(extractAddresses("no addresses here")).toHaveLength(0);
  });
});
