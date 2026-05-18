// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MmClaimBlock } from "@/components/mm/MmClaimBlock";

const base = {
  id: "c1",
  jurisdiction: "US",
  source: {
    publisher: "DOJ",
    title: "Press release",
    url: "https://example.com/press",
  },
};

describe("MmClaimBlock", () => {
  it("prefers the French text when locale=fr", () => {
    const { container } = render(
      <MmClaimBlock
        claim={{
          ...base,
          claimType: "FACT",
          text: "EN text",
          textFr: "Texte français",
        }}
        locale="fr"
      />,
    );
    expect(container.textContent).toContain("Texte français");
    expect(container.textContent).not.toContain("EN text");
  });

  it("falls back to textFr=null with the English text", () => {
    const { container } = render(
      <MmClaimBlock
        claim={{
          ...base,
          claimType: "ALLEGATION",
          text: "English only",
          textFr: null,
        }}
        locale="fr"
      />,
    );
    expect(container.textContent).toContain("English only");
  });

  it("renders the type label for each claim type", () => {
    const types = ["FACT", "ALLEGATION", "INFERENCE", "RESPONSE"] as const;
    for (const t of types) {
      const { container } = render(
        <MmClaimBlock
          claim={{ ...base, claimType: t, text: `${t} text`, textFr: null }}
        />,
      );
      expect(container.querySelector(`[data-claim-type="${t}"]`)).not.toBeNull();
      expect(container.textContent).toContain(t);
    }
  });

  it("links to the source URL with rel=noopener", () => {
    const { container } = render(
      <MmClaimBlock
        claim={{
          ...base,
          claimType: "FACT",
          text: "text",
          textFr: null,
        }}
      />,
    );
    const a = container.querySelector("a[href='https://example.com/press']");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });
});
