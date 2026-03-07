import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("middleware Basic Auth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("laisse passer en dev sans Basic Auth", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { middleware } = await import("../../middleware");
    const req = new NextRequest("http://localhost/api/admin/sources");
    const res = middleware(req);
    expect(res.status).not.toBe(401);
  });

  it("bloque en prod sans Basic Auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { middleware } = await import("../../middleware");
    const req = new NextRequest("http://localhost/api/admin/sources");
    const res = middleware(req);
    expect(res.status).toBe(401);
  });

  it("laisse passer en prod avec Basic Auth correct", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { middleware } = await import("../../middleware");
    const creds = Buffer.from("admin:pass").toString("base64");
    const req = new NextRequest("http://localhost/api/admin/sources", {
      headers: { authorization: `Basic ${creds}` },
    });
    const res = middleware(req);
    expect(res.status).not.toBe(401);
  });
});
