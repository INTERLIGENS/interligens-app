import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  requireAdmin,
  requireAdminApi,
  isAdminApi,
} from "@/middleware/adminAuth";

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/admin/governance", { headers });
}

describe("middleware/adminAuth", () => {
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it("isAdminApi returns false when ADMIN_TOKEN is unset", () => {
    const r = makeReq({ "x-admin-token": "anything" });
    expect(isAdminApi(r)).toBe(false);
  });

  it("isAdminApi returns false for wrong token", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    const r = makeReq({ "x-admin-token": "wrong" });
    expect(isAdminApi(r)).toBe(false);
  });

  it("isAdminApi returns true for matching token (constant-time)", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    const r = makeReq({ "x-admin-token": "supersecret" });
    expect(isAdminApi(r)).toBe(true);
  });

  it("requireAdmin throws on missing header", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    expect(() => requireAdmin(makeReq())).toThrow(/Unauthorized/);
  });

  it("requireAdmin throws on wrong token", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    expect(() => requireAdmin(makeReq({ "x-admin-token": "nope" }))).toThrow(
      /Unauthorized/,
    );
  });

  it("requireAdmin returns silently on correct token", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    expect(() =>
      requireAdmin(makeReq({ "x-admin-token": "supersecret" })),
    ).not.toThrow();
  });

  it("requireAdminApi returns 500 when ADMIN_TOKEN env is missing", () => {
    const res = requireAdminApi(makeReq({ "x-admin-token": "x" }));
    expect(res?.status).toBe(500);
  });

  it("requireAdminApi returns 401 without header", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    const res = requireAdminApi(makeReq());
    expect(res?.status).toBe(401);
  });

  it("requireAdminApi returns 403 on wrong token", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    const res = requireAdminApi(makeReq({ "x-admin-token": "wrong" }));
    expect(res?.status).toBe(403);
  });

  it("requireAdminApi returns null on valid token", () => {
    process.env.ADMIN_TOKEN = "supersecret";
    const res = requireAdminApi(makeReq({ "x-admin-token": "supersecret" }));
    expect(res).toBeNull();
  });
});
