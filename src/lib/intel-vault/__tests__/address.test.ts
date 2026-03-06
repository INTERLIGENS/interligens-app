import { describe, it, expect } from "vitest";
import { detectChain, isValidAddress, pickAddressColumn } from "../address";

describe("address detection", () => {
  it("détecte ethereum pour 0x addresses", () => {
    expect(detectChain("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe("ethereum");
  });

  it("détecte solana pour base58 long", () => {
    expect(detectChain("BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb")).toBe("solana");
  });

  it("retourne other pour invalide", () => {
    expect(detectChain("not-an-address")).toBe("other");
  });

  it("valide une adresse EVM", () => {
    expect(isValidAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(true);
  });

  it("invalide une adresse trop courte", () => {
    expect(isValidAddress("0xdeadbeef")).toBe(false);
  });

  it("isValidAddress false pour chaîne vide", () => {
    expect(isValidAddress("")).toBe(false);
  });
});

describe("pickAddressColumn", () => {
  it("retourne la colonne avec le plus d'adresses EVM", () => {
    const headers = ["name", "address", "amount"];
    const rows = [
      ["Alice", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "1.5"],
      ["Bob", "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", "2.0"],
      ["Charlie", "not-an-addr", "0.5"],
    ];
    expect(pickAddressColumn(headers, rows)).toBe(1);
  });

  it("retourne -1 si aucune adresse valide", () => {
    const headers = ["a", "b"];
    const rows = [["x", "y"], ["z", "w"]];
    expect(pickAddressColumn(headers, rows)).toBe(-1);
  });
});
