// @vitest-environment jsdom
// src/components/vault/__tests__/IntelVaultBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntelVaultBadge } from "../IntelVaultBadge";

describe("IntelVaultBadge", () => {
  it("ne rend rien si match=false", () => {
    const { container } = render(
      <IntelVaultBadge intelVault={{ match: false, categories: [] }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien si intelVault est null", () => {
    const { container } = render(<IntelVaultBadge intelVault={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("rend Intel Vault + chip + confidence si match=true", () => {
    render(
      <IntelVaultBadge
        intelVault={{
          match: true,
          categories: ["airdrop_target"],
          confidence: "low",
          severity: "info",
        }}
      />
    );
    expect(screen.getByText("Intel Vault")).toBeDefined();
    expect(screen.getByText("Airdrop target")).toBeDefined();
    expect(screen.getByText("Confidence: Low")).toBeDefined();
  });

  it("affiche max 3 chips + overflow +N", () => {
    render(
      <IntelVaultBadge
        intelVault={{
          match: true,
          categories: ["scam", "phishing", "drainer", "exploiter"],
          severity: "danger",
        }}
      />
    );
    expect(screen.getByText("+1")).toBeDefined();
  });

  it("ne rend jamais entityName ou sourceUrl", () => {
    const { container } = render(
      <IntelVaultBadge
        intelVault={{
          match: true,
          categories: ["whale"],
          severity: "info",
          // These should never appear
          ...({ entityName: "SECRET", sourceUrl: "https://secret.com" } as any),
        }}
      />
    );
    expect(container.innerHTML).not.toContain("SECRET");
    expect(container.innerHTML).not.toContain("secret.com");
  });

  it("rendu FR correct", () => {
    render(
      <IntelVaultBadge
        intelVault={{ match: true, categories: ["scam"], severity: "danger", confidence: "high" }}
        locale="fr"
      />
    );
    expect(screen.getByText("Liste à risque")).toBeDefined();
    expect(screen.getByText("Arnaque")).toBeDefined();
  });
});
