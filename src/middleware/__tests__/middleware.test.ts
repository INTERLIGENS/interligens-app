import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("proxy Basic Auth", () => {
  afterEach(() => vi.unstubAllEnvs());

  // Le gate admin est ALWAYS-ON depuis 798723d ("admin gate always-on in
  // proxy.ts"). src/proxy.ts ne lit pas NODE_ENV et n'expose aucune branche dev :
  // checkBasicAuth() renvoie false dès qu'il n'y a pas d'en-tête Authorization,
  // quel que soit l'environnement. NODE_ENV reste stubbé ici précisément pour
  // verrouiller cette indépendance — si quelqu'un réintroduit un bypass dev dans
  // le proxy, ce test tombe.
  it("bloque aussi en dev sans Basic Auth", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { proxy } = await import("../../proxy");
    const req = new NextRequest("http://localhost/api/admin/sources");
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("bloque en prod sans Basic Auth", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_BASIC_USER", "admin");
    vi.stubEnv("ADMIN_BASIC_PASS", "pass");
    vi.resetModules();
    const { proxy } = await import("../../proxy");
    const req = new NextRequest("http://localhost/api/admin/sources");
    const res = await proxy(req);
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
    const res = await proxy(req);
    expect(res.status).not.toBe(401);
  });
});
