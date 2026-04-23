import { describe, it, expect, vi } from "vitest";
import {
  computeOffChainCredibility,
  computeTigerModifier,
} from "@/lib/off-chain-credibility/engine";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(body: string | object, contentType = "text/html") {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return Promise.resolve(
    new Response(text, { status: 200, headers: { "Content-Type": contentType } }),
  );
}

function notFound() {
  return Promise.resolve(new Response("", { status: 404 }));
}

// Rich homepage HTML
const RICH_HTML = `
<html><body>
<a href="https://github.com/example/myproject">GitHub</a>
<a href="https://twitter.com/myproject">Twitter</a>
<a href="https://t.me/myproject">Telegram</a>
<a href="/whitepaper.pdf">Whitepaper</a>
<a href="/docs">Documentation</a>
<p>Team, Contact, Privacy Policy, Terms of Service, Audit, Roadmap</p>
<p>Certified by CertiK security audit</p>
</body></html>
`.toLowerCase();

const THIN_HTML = `<html><body><h1>Token</h1></body></html>`.toLowerCase();

// RDAP responses
function rdapOld() {
  const d = new Date(Date.now() - 400 * 86_400_000).toISOString(); // 400 days ago
  return ok({ events: [{ eventAction: "registration", eventDate: d }] }, "application/json");
}

function rdapNew() {
  const d = new Date(Date.now() - 5 * 86_400_000).toISOString(); // 5 days ago
  return ok({ events: [{ eventAction: "registration", eventDate: d }] }, "application/json");
}

// GitHub API response
function ghActive() {
  return ok({
    size: 5000,
    pushed_at: new Date(Date.now() - 10 * 86_400_000).toISOString(), // pushed 10 days ago
    stargazers_count: 42,
    forks_count: 7,
  }, "application/json");
}

// Wayback Machine response
function waybackOld() {
  return ok({
    archived_snapshots: {
      closest: {
        available: true,
        timestamp: "20210601120000", // June 2021
      }
    }
  }, "application/json");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeOffChainCredibility", () => {
  it("test 1 — rich site + active GitHub + CertiK audit → score > 60 GOOD/STRONG", async () => {
    const mockFetch = vi.fn((url: string) => {
      if (url.includes("rdap.iana.org")) return rdapOld();
      if (url.includes("api.github.com")) return ghActive();
      if (url.includes("archive.org/wayback")) return waybackOld();
      if (url.includes("t.me")) return ok("<div>1,234 members</div>");
      if (url.includes("whitepaper.pdf")) return ok("", "application/pdf");
      return ok(RICH_HTML); // homepage
    });

    const result = await computeOffChainCredibility({
      websiteUrl: "https://example.com",
      tokenMint: "test-mint-rich",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.score).toBeGreaterThan(60);
    expect(["GOOD", "STRONG"]).toContain(result.band);
    expect(result.signals).toHaveLength(8);
    expect(result.tiger_modifier).toBeLessThanOrEqual(0);
  });

  it("test 2 — domain < 14 days → domain_age signal RED, 0 pts", async () => {
    const mockFetch = vi.fn((url: string) => {
      if (url.includes("rdap.iana.org")) return rdapNew();
      if (url.includes("api.github.com")) return notFound();
      if (url.includes("archive.org")) return ok({ archived_snapshots: {} }, "application/json");
      return ok(THIN_HTML);
    });

    const result = await computeOffChainCredibility({
      websiteUrl: "https://newproject.io",
      tokenMint: "test-mint-new-domain",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    const domainSig = result.signals.find((s) => s.id === "domain_age");
    expect(domainSig).toBeDefined();
    expect(domainSig!.score).toBe(0);
    expect(domainSig!.status).toBe("RED");
  });

  it("test 3 — GitHub absent (no link, 404) → github signal RED, score ≤ 4", async () => {
    const mockFetch = vi.fn((url: string) => {
      if (url.includes("rdap.iana.org")) return rdapOld();
      if (url.includes("api.github.com")) return notFound();
      if (url.includes("archive.org")) return ok({ archived_snapshots: {} }, "application/json");
      return ok(THIN_HTML); // no github link in HTML
    });

    const result = await computeOffChainCredibility({
      websiteUrl: "https://nogithub.io",
      tokenMint: "test-mint-no-gh",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    const ghSig = result.signals.find((s) => s.id === "github");
    expect(ghSig).toBeDefined();
    expect(ghSig!.score).toBeLessThanOrEqual(4);
    expect(ghSig!.status).toBe("RED");
  });

  it("test 4 — CertiK in homepage HTML → audit signal GREEN 16 pts", async () => {
    const htmlWithAudit = `<html><body><a href="https://certik.com/report">CertiK Audit</a></body></html>`;
    const mockFetch = vi.fn((url: string) => {
      if (url.includes("rdap.iana.org")) return rdapOld();
      if (url.includes("api.github.com")) return notFound();
      if (url.includes("archive.org")) return ok({ archived_snapshots: {} }, "application/json");
      return ok(htmlWithAudit.toLowerCase());
    });

    const result = await computeOffChainCredibility({
      websiteUrl: "https://audited.io",
      tokenMint: "test-mint-audit",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    const auditSig = result.signals.find((s) => s.id === "audit");
    expect(auditSig).toBeDefined();
    expect(auditSig!.score).toBe(16);
    expect(auditSig!.status).toBe("GREEN");
  });

  it("test 5 — whitepaper absent → whitepaper signal RED 0 pts", async () => {
    const mockFetch = vi.fn((url: string) => {
      if (url.includes("rdap.iana.org")) return rdapOld();
      if (url.includes("api.github.com")) return notFound();
      if (url.includes("archive.org")) return ok({ archived_snapshots: {} }, "application/json");
      return ok(THIN_HTML); // no whitepaper links
    });

    const result = await computeOffChainCredibility({
      websiteUrl: "https://nowp.io",
      tokenMint: "test-mint-no-wp",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    const wpSig = result.signals.find((s) => s.id === "whitepaper");
    expect(wpSig).toBeDefined();
    expect(wpSig!.score).toBe(0);
    expect(wpSig!.status).toBe("RED");
  });

  it("test 6 — tiger_modifier for score 18 → +8", () => {
    expect(computeTigerModifier(18)).toBe(8);
    expect(computeTigerModifier(0)).toBe(8);
    expect(computeTigerModifier(20)).toBe(8);
  });

  it("test 7 — tiger_modifier for score 75 → -3", () => {
    expect(computeTigerModifier(75)).toBe(-3);
    expect(computeTigerModifier(61)).toBe(-3);
    expect(computeTigerModifier(80)).toBe(-3);
  });

  it("test 8 — fetch timeout on all signals → graceful degradation, no crash", async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error("AbortError")));

    const result = await computeOffChainCredibility({
      websiteUrl: "https://timeout-project.io",
      tokenMint: "test-mint-timeout",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    // Should not throw, should return a valid result
    expect(result.signals).toHaveLength(8);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.band).toBeDefined();
    // Confidence should be LOW since nothing was reachable
    expect(result.confidence).toBe("LOW");
  });
});
