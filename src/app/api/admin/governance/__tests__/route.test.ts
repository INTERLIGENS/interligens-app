import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const adminSetGovernedStatus = vi.fn();
const adminListGovernedStatus = vi.fn();
const adminRevokeGovernedStatus = vi.fn();

vi.mock("@/lib/admin/governance", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/admin/governance")>(
      "@/lib/admin/governance",
    );
  return {
    ...actual,
    adminSetGovernedStatus: (...a: unknown[]) => adminSetGovernedStatus(...a),
    adminListGovernedStatus: (...a: unknown[]) => adminListGovernedStatus(...a),
    adminRevokeGovernedStatus: (...a: unknown[]) =>
      adminRevokeGovernedStatus(...a),
  };
});

import { GET, POST } from "@/app/api/admin/governance/route";
import { POST as REVOKE } from "@/app/api/admin/governance/revoke/route";

function makeReq(
  method: string,
  body: unknown = undefined,
  headers: Record<string, string> = {},
) {
  // NextRequest's init type is narrower than the global RequestInit. We
  // assemble a plain object and cast via unknown because the web-spec
  // AbortSignal | null is not assignable to Next's AbortSignal | undefined.
  const init: Record<string, unknown> = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { ...headers, "content-type": "application/json" };
  }
  return new NextRequest(
    "http://localhost/api/admin/governance",
    init as unknown as ConstructorParameters<typeof NextRequest>[1],
  );
}

describe("GET /api/admin/governance", () => {
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
    adminListGovernedStatus.mockReset();
  });

  it("returns 401 without a token", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 403 on wrong token", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    const res = await GET(makeReq("GET", undefined, { "x-admin-token": "wrong" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 with the list payload on valid token", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    adminListGovernedStatus.mockResolvedValue({
      total: 1,
      items: [{ id: "row-1", status: "watchlisted" }],
    });
    const res = await GET(
      makeReq("GET", undefined, { "x-admin-token": "s3cr3t" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; total: number };
    expect(body.ok).toBe(true);
    expect(body.total).toBe(1);
  });
});

describe("POST /api/admin/governance", () => {
  beforeEach(() => {
    adminSetGovernedStatus.mockReset();
  });
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it("refuses unauthorised requests (401)", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    const res = await POST(
      makeReq("POST", {
        entityType: "wallet",
        entityValue: "0xabc",
        status: "watchlisted",
      }),
    );
    expect(res.status).toBe(401);
    expect(adminSetGovernedStatus).not.toHaveBeenCalled();
  });

  it("refuses wrong token (403)", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    const res = await POST(
      makeReq(
        "POST",
        {
          entityType: "wallet",
          entityValue: "0xabc",
          status: "watchlisted",
        },
        { "x-admin-token": "wrong" },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("persists a valid payload (201)", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    adminSetGovernedStatus.mockResolvedValue({
      id: "row-1",
      status: "watchlisted",
      entityValue: "0xabc",
    });
    const res = await POST(
      makeReq(
        "POST",
        {
          entityType: "wallet",
          entityValue: "0xabc",
          status: "watchlisted",
          reason: "test",
        },
        { "x-admin-token": "s3cr3t" },
      ),
    );
    expect(res.status).toBe(201);
    expect(adminSetGovernedStatus).toHaveBeenCalledTimes(1);
  });

  it("returns 400 on invalid JSON", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    const req = new NextRequest("http://localhost/api/admin/governance", {
      method: "POST",
      body: "not-json",
      headers: {
        "content-type": "application/json",
        "x-admin-token": "s3cr3t",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/governance/revoke", () => {
  beforeEach(() => {
    adminRevokeGovernedStatus.mockReset();
  });
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it("returns 401 without a token", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    const res = await REVOKE(
      makeReq("POST", { entityType: "wallet", entityValue: "0xabc", reason: "x" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing fields", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    const res = await REVOKE(
      makeReq("POST", { entityType: "wallet" }, { "x-admin-token": "s3cr3t" }),
    );
    expect(res.status).toBe(400);
  });

  it("revokes and returns 200 on success", async () => {
    process.env.ADMIN_TOKEN = "s3cr3t";
    adminRevokeGovernedStatus.mockResolvedValue({ id: "row-1", status: "none" });
    const res = await REVOKE(
      makeReq(
        "POST",
        { entityType: "wallet", entityValue: "0xabc", reason: "fix" },
        { "x-admin-token": "s3cr3t" },
      ),
    );
    expect(res.status).toBe(200);
  });
});
