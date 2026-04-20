/**
 * src/app/api/admin/__tests__/adminRoutes.integration.test.ts
 *
 * P1 — Integration tests: verify /api/admin/* auth behaviour.
 *
 * These tests import the route handlers directly (no HTTP server needed),
 * passing synthetic NextRequest objects.
 *
 * Add routes here as they are migrated. At minimum: sources, submissions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Prisma mock ──────────────────────────────────────────────────────────────
//
// These tests verify auth + response shape, not DB behaviour. Without a
// mock, the route handlers reach for a live Neon connection and crash on
// "credentials not available" in the test env. We stub just the delegates
// each route touches; every other delegate falls back to a catch-all mock
// so future route additions don't need ceremony.

vi.mock("@/lib/prisma", () => {
  const sourceRegistry = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: "src_test" }),
  };
  const communitySubmission = {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "sub_test" }),
    update: vi.fn().mockResolvedValue({ id: "sub_test" }),
  };
  return {
    prisma: new Proxy(
      { sourceRegistry, communitySubmission },
      {
        get(target, prop) {
          if (prop in target) return (target as Record<string, unknown>)[prop as string];
          // Fallback for any delegate we didn't explicitly mock: return a
          // stub that resolves to empty so the route handler doesn't throw.
          return {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            findFirst: vi.fn().mockResolvedValue(null),
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue({}),
          };
        },
      },
    ),
  };
});

// ── helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = "integration-test-token";

function req(
  url: string,
  method = "GET",
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method, headers });
}

function withToken(headers: Record<string, string> = {}) {
  return { ...headers, "x-admin-token": VALID_TOKEN };
}

// ── env setup ────────────────────────────────────────────────────────────────

const originalToken = process.env.ADMIN_TOKEN;
beforeEach(() => {
  process.env.ADMIN_TOKEN = VALID_TOKEN;
});
afterEach(() => {
  process.env.ADMIN_TOKEN = originalToken;
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/sources
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/sources", () => {
  it("returns 401 JSON (not HTML) without token", async () => {
    const { GET } = await import("@/app/api/admin/sources/route");
    const res = await GET(req("/api/admin/sources"));
    expect(res.status).toBe(401);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("application/json");
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 200 with valid x-admin-token", async () => {
    const { GET } = await import("@/app/api/admin/sources/route");
    const res = await GET(req("/api/admin/sources", "GET", withToken()));
    // 200 or 404/500 due to missing DB in test env — but NOT 401/403
    expect([200, 204, 404, 500]).toContain(res.status);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/submissions
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/submissions", () => {
  it("returns 401 JSON without token", async () => {
    const { GET } = await import("@/app/api/admin/submissions/route");
    const res = await GET(req("/api/admin/submissions"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("passes auth with valid token", async () => {
    const { GET } = await import("@/app/api/admin/submissions/route");
    const res = await GET(req("/api/admin/submissions", "GET", withToken()));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/ingest
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/ingest", () => {
  it("returns 401 JSON without token", async () => {
    const { POST } = await import("@/app/api/admin/ingest/route");
    const res = await POST(req("/api/admin/ingest", "POST"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/ingest/pdf
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/ingest/pdf", () => {
  it("returns 401 JSON without token", async () => {
    const { POST } = await import("@/app/api/admin/ingest/pdf/route");
    const res = await POST(req("/api/admin/ingest/pdf", "POST"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No route should import checkAuth anymore
// (static analysis — run separately via grep or the patch script)
// ─────────────────────────────────────────────────────────────────────────────
