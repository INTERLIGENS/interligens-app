/**
 * src/lib/security/adminAuth.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getAdminTokenFromReq,
  isAdminApi,
  requireAdminApi,
  assertProdEnv,
} from "./adminAuth";

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/test", { headers });
}

// ── getAdminTokenFromReq ─────────────────────────────────────────────────────

describe("getAdminTokenFromReq", () => {
  it("returns null when no header present", () => {
    expect(getAdminTokenFromReq(makeReq())).toBeNull();
  });

  it("returns x-admin-token when present", () => {
    expect(getAdminTokenFromReq(makeReq({ "x-admin-token": "abc123" }))).toBe("abc123");
  });

  it("falls back to x-interligens-api-token (compat)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = getAdminTokenFromReq(makeReq({ "x-interligens-api-token": "legacytoken" }));
    expect(result).toBe("legacytoken");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("DEPRECATION"));
    warnSpy.mockRestore();
  });

  it("prefers x-admin-token over legacy header", () => {
    const result = getAdminTokenFromReq(
      makeReq({ "x-admin-token": "primary", "x-interligens-api-token": "legacy" }),
    );
    expect(result).toBe("primary");
  });
});

// ── isAdminApi ───────────────────────────────────────────────────────────────

describe("isAdminApi", () => {
  const originalEnv = process.env.ADMIN_TOKEN;
  beforeEach(() => { process.env.ADMIN_TOKEN = "supersecret"; });
  afterEach(() => { process.env.ADMIN_TOKEN = originalEnv; });

  it("returns false when no token header", () => {
    expect(isAdminApi(makeReq())).toBe(false);
  });

  it("returns false when wrong token", () => {
    expect(isAdminApi(makeReq({ "x-admin-token": "wrong" }))).toBe(false);
  });

  it("returns true when correct token", () => {
    expect(isAdminApi(makeReq({ "x-admin-token": "supersecret" }))).toBe(true);
  });

  it("returns false when ADMIN_TOKEN not set", () => {
    delete process.env.ADMIN_TOKEN;
    expect(isAdminApi(makeReq({ "x-admin-token": "anything" }))).toBe(false);
  });
});

// ── requireAdminApi ──────────────────────────────────────────────────────────

describe("requireAdminApi", () => {
  const originalEnv = process.env.ADMIN_TOKEN;
  beforeEach(() => { process.env.ADMIN_TOKEN = "mysecrettoken"; });
  afterEach(() => { process.env.ADMIN_TOKEN = originalEnv; });

  it("returns 401 when no token provided", async () => {
    const res = requireAdminApi(makeReq());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when wrong token", async () => {
    const res = requireAdminApi(makeReq({ "x-admin-token": "badtoken" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns null (auth OK) when correct token", () => {
    const res = requireAdminApi(makeReq({ "x-admin-token": "mysecrettoken" }));
    expect(res).toBeNull();
  });

  it("returns 500 with clear message when ADMIN_TOKEN missing", async () => {
    delete process.env.ADMIN_TOKEN;
    const res = requireAdminApi(makeReq({ "x-admin-token": "anything" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    const body = await res!.json();
    expect(body.error).toBe("Server misconfiguration");
    expect(body.detail).toContain("ADMIN_TOKEN");
  });

  it("accepts legacy x-interligens-api-token (compat)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = requireAdminApi(makeReq({ "x-interligens-api-token": "mysecrettoken" }));
    expect(res).toBeNull();
    warnSpy.mockRestore();
  });
});

// ── assertProdEnv ────────────────────────────────────────────────────────────

describe("assertProdEnv", () => {
  const originalToken = process.env.ADMIN_TOKEN;
  afterEach(() => {
    if (originalToken) process.env.ADMIN_TOKEN = originalToken;
    else delete process.env.ADMIN_TOKEN;
  });

  it("does not throw in development even if ADMIN_TOKEN missing", () => {
    // NODE_ENV is "test" in vitest — assertProdEnv only throws in "production"
    delete process.env.ADMIN_TOKEN;
    expect(() => assertProdEnv()).not.toThrow();
  });

  it("does not throw when ADMIN_TOKEN is set", () => {
    process.env.ADMIN_TOKEN = "present";
    expect(() => assertProdEnv()).not.toThrow();
  });

  it("does not throw in test env even if ADMIN_TOKEN missing", () => {
    delete process.env.ADMIN_TOKEN;
    // NODE_ENV=test → no throw expected
    expect(() => assertProdEnv()).not.toThrow();
  });
});
