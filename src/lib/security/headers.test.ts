import { describe, it, expect } from "vitest";
import { buildCsp, buildSecurityHeaders, buildApiHeaders } from "./headers";

// ── CSP ───────────────────────────────────────────────────────────────────────

describe("buildCsp", () => {
  it("contient default-src 'self'", () => {
    expect(buildCsp()).toContain("default-src 'self'");
  });

  it("bloque les frames (frame-ancestors 'none')", () => {
    expect(buildCsp()).toContain("frame-ancestors 'none'");
  });

  it("bloque les objets (object-src 'none')", () => {
    expect(buildCsp()).toContain("object-src 'none'");
  });

  it("autorise img data: et https: (icons marché)", () => {
    const csp = buildCsp();
    expect(csp).toContain("img-src");
    expect(csp).toContain("data:");
    expect(csp).toContain("https:");
  });

  it("contient upgrade-insecure-requests", () => {
    expect(buildCsp()).toContain("upgrade-insecure-requests");
  });

  it("base-uri limité à self (anti-injection)", () => {
    expect(buildCsp()).toContain("base-uri 'self'");
  });

  it("form-action limité à self", () => {
    expect(buildCsp()).toContain("form-action 'self'");
  });

  it("ne contient pas de wildcard dangereux *", () => {
    // Autorise data: et https: mais pas un wildcard nu
    const csp = buildCsp();
    const directives = csp.split(";").map((d) => d.trim());
    for (const d of directives) {
      // script-src et default-src ne doivent pas avoir * seul
      if (d.startsWith("script-src") || d.startsWith("default-src")) {
        expect(d).not.toMatch(/\s\*(?:\s|$)/);
      }
    }
  });
});

// ── buildSecurityHeaders ──────────────────────────────────────────────────────

describe("buildSecurityHeaders — dev (isProd: false)", () => {
  const headers = buildSecurityHeaders({ isProd: false });
  const get = (key: string) => headers.find((h) => h.key === key)?.value;

  it("inclut Content-Security-Policy", () => {
    expect(get("Content-Security-Policy")).toBeDefined();
  });

  it("inclut X-Content-Type-Options: nosniff", () => {
    expect(get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("inclut Referrer-Policy", () => {
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("inclut Permissions-Policy avec camera et microphone désactivés", () => {
    const pp = get("Permissions-Policy") ?? "";
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  it("inclut X-Frame-Options: DENY", () => {
    expect(get("X-Frame-Options")).toBe("DENY");
  });

  it("N'inclut PAS HSTS en dev", () => {
    expect(get("Strict-Transport-Security")).toBeUndefined();
  });
});

describe("buildSecurityHeaders — prod (isProd: true)", () => {
  const headers = buildSecurityHeaders({ isProd: true });
  const get = (key: string) => headers.find((h) => h.key === key)?.value;

  it("inclut HSTS en prod", () => {
    const hsts = get("Strict-Transport-Security") ?? "";
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("inclut tous les autres headers aussi", () => {
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("Content-Security-Policy")).toBeDefined();
  });
});

// ── buildApiHeaders ───────────────────────────────────────────────────────────

describe("buildApiHeaders (routes PDF)", () => {
  const headers = buildApiHeaders();
  const get = (key: string) => headers.find((h) => h.key === key)?.value;

  it("désactive le cache", () => {
    expect(get("Cache-Control")).toContain("no-store");
  });

  it("ajoute noindex pour les routes PDF", () => {
    expect(get("X-Robots-Tag")).toContain("noindex");
  });

  it("inclut X-Content-Type-Options", () => {
    expect(get("X-Content-Type-Options")).toBe("nosniff");
  });
});

// ── Intégrité du set complet ──────────────────────────────────────────────────

describe("cohérence du set de headers", () => {
  it("pas de clé en double", () => {
    const headers = buildSecurityHeaders({ isProd: true });
    const keys    = headers.map((h) => h.key);
    const unique  = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });

  it("aucun header avec valeur vide", () => {
    const headers = buildSecurityHeaders({ isProd: true });
    for (const h of headers) {
      expect(h.value.trim().length).toBeGreaterThan(0);
    }
  });
});
