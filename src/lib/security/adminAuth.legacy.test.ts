/**
 * src/lib/security/adminAuth.legacy.test.ts
 * Tests P1.1 — legacy token AuditLog + no-secrets guarantee
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getAdminTokenFromReq, requireAdminApi, prodEnvErrorResponse } from "./adminAuth";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { prisma } from "@/lib/prisma";

function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/test", { headers });
}

// ── Legacy token creates AuditLog ─────────────────────────────────────────────

describe("legacy token AuditLog", () => {
  const originalEnv = process.env.ADMIN_TOKEN;
  beforeEach(() => { process.env.ADMIN_TOKEN = "mysecret"; });
  afterEach(() => { process.env.ADMIN_TOKEN = originalEnv; vi.clearAllMocks(); });

  it("creates LEGACY_TOKEN_USED AuditLog when legacy header used", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getAdminTokenFromReq(makeReq({ "x-interligens-api-token": "mysecret" }));
    // allow microtask to flush
    await new Promise(r => setTimeout(r, 0));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "LEGACY_TOKEN_USED",
        actorId: "system",
        meta: expect.stringContaining("x-interligens-api-token"),
      },
    });
    warnSpy.mockRestore();
  });

  it("does NOT create AuditLog when primary header used", async () => {
    getAdminTokenFromReq(makeReq({ "x-admin-token": "mysecret" }));
    await new Promise(r => setTimeout(r, 0));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

// ── No secrets in responses ───────────────────────────────────────────────────

describe("no secrets in error responses", () => {
  const originalEnv = process.env.ADMIN_TOKEN;
  beforeEach(() => { process.env.ADMIN_TOKEN = "supersecretvalue123"; });
  afterEach(() => { process.env.ADMIN_TOKEN = originalEnv; });

  it("401 response does not contain token value", async () => {
    const res = requireAdminApi(makeReq());
    const body = JSON.stringify(await res!.json());
    expect(body).not.toContain("supersecretvalue123");
  });

  it("403 response does not contain token value", async () => {
    const res = requireAdminApi(makeReq({ "x-admin-token": "wrongtoken" }));
    const body = JSON.stringify(await res!.json());
    expect(body).not.toContain("supersecretvalue123");
  });
});

// ── prodEnvErrorResponse ──────────────────────────────────────────────────────

describe("prodEnvErrorResponse", () => {
  it("returns 500 with safe message", async () => {
    const res = prodEnvErrorResponse();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Admin token missing in production env");
    expect(body.detail).toContain("ADMIN_TOKEN");
  });

  it("does not contain any secret value", async () => {
    process.env.ADMIN_TOKEN = "topsecret999";
    const res = prodEnvErrorResponse();
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("topsecret999");
    delete process.env.ADMIN_TOKEN;
  });
});
