import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("proxy Basic Auth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("laisse passer en dev sans Basic Auth", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { proxy } = await import("../../proxy");
    const req = new NextRequest("http://localhost/api/admin/sources");
    const res = proxy(req);
    expect(res.status).not.toBe(401);
  });

  it("bloque en prod sans Basic Auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { proxy } = await import("../../proxy");
    const req = new NextRequest("http://localhost/api/admin/sources");
    const res = proxy(req);
    expect(res.status).toBe(401);
  });

  it("laisse passer en prod avec Basic Auth correct", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { proxy } = await import("../../proxy");
    const creds = Buffer.from("admin:pass").toString("base64");
    const req = new NextRequest("http://localhost/api/admin/sources", {
      headers: { authorization: `Basic ${creds}` },
    });
    const res = proxy(req);
    expect(res.status).not.toBe(401);
  });
});
