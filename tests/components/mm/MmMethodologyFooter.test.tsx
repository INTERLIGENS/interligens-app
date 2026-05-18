// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MmMethodologyFooter } from "@/components/mm/MmMethodologyFooter";

describe("MmMethodologyFooter", () => {
  it("surfaces the four canonical methodology links", () => {
    const { container } = render(<MmMethodologyFooter />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/mm/methodology",
        "/mm/methodology#corrections",
        "/mm/methodology#right-of-reply",
        "/mm/legal",
      ]),
    );
  });

  it("renders the legal@interligens.com contact when showContact", () => {
    const { container } = render(<MmMethodologyFooter />);
    expect(container.textContent).toContain("legal@interligens.com");
  });

  it("hides the contact block when showContact=false", () => {
    const { container } = render(<MmMethodologyFooter showContact={false} />);
    expect(container.textContent).not.toContain("legal@interligens.com");
  });

  it("renders the lastUpdated date when provided", () => {
    const d = new Date("2026-04-01T00:00:00Z");
    const { container } = render(<MmMethodologyFooter lastUpdated={d} />);
    expect(container.textContent).toContain("2026-04-01");
  });
});
