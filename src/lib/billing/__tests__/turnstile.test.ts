import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyTurnstile } from "../turnstile";

describe("verifyTurnstile", () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.TURNSTILE_SECRET;

  beforeEach(() => {
    process.env.TURNSTILE_SECRET = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.TURNSTILE_SECRET = originalSecret;
  });

  it("rejects when secret is not configured", async () => {
    delete process.env.TURNSTILE_SECRET;
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await verifyTurnstile("abc");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_secret");
  });

  it("rejects when token is missing", async () => {
    const res = await verifyTurnstile(null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_token");
  });

  it("accepts when Cloudflare reports success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    }) as unknown as typeof fetch;
    const res = await verifyTurnstile("good", "1.2.3.4");
    expect(res.ok).toBe(true);
  });

  it("rejects when Cloudflare reports failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, "error-codes": ["invalid"] }),
    }) as unknown as typeof fetch;
    const res = await verifyTurnstile("bad");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("rejected");
  });

  it("rejects on network errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("net")) as unknown as typeof fetch;
    const res = await verifyTurnstile("token");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("network");
  });
});

/**
 * Non-régression : résolution du secret sous ses deux noms.
 *
 * Le module lisait `TURNSTILE_SECRET ?? TURNSTILE_SECRET_KEY`. Avec `??`, une
 * var posée à la chaîne vide est une valeur : `TURNSTILE_SECRET=""` masquait un
 * `TURNSTILE_SECRET_KEY` valide et le flow billing refusait tout checkout en
 * `missing_secret`. Même angle mort que celui corrigé côté osint-retail (38f10f2) ;
 * ces tests sont l'équivalent de src/lib/osint/retail/turnstile.test.ts.
 */
describe("verifyTurnstile — résolution du secret", () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET;
  const ORIGINAL_KEY = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    delete process.env.TURNSTILE_SECRET;
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (ORIGINAL_SECRET === undefined) delete process.env.TURNSTILE_SECRET;
    else process.env.TURNSTILE_SECRET = ORIGINAL_SECRET;
    if (ORIGINAL_KEY === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = ORIGINAL_KEY;
  });

  /** Capture le champ `secret` réellement transmis à siteverify. */
  async function secretSentToSiteverify(): Promise<string | null> {
    let sent: string | null = null;
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      sent = new URLSearchParams(String(init?.body)).get("secret");
      return { ok: true, json: () => Promise.resolve({ success: true }) };
    }) as unknown as typeof fetch;
    await verifyTurnstile("tok");
    return sent;
  }

  it("missing_secret quand aucun des deux noms n'est posé", async () => {
    const res = await verifyTurnstile("tok");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_secret");
  });

  it("TURNSTILE_SECRET_KEY seul suffit (nom historique)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    expect(await secretSentToSiteverify()).toBe("sk-legacy");
  });

  it("TURNSTILE_SECRET seul suffit (nom provisionné)", async () => {
    process.env.TURNSTILE_SECRET = "sk-provisionned";
    expect(await secretSentToSiteverify()).toBe("sk-provisionned");
  });

  it("les deux posés → TURNSTILE_SECRET gagne (même ordre qu'osint-retail)", async () => {
    process.env.TURNSTILE_SECRET = "sk-provisionned";
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    expect(await secretSentToSiteverify()).toBe("sk-provisionned");
  });

  // Le cœur du fix : avec `??` ces deux cas renvoyaient secret = "" (truthy pour
  // `??`, falsy pour `!secret`) → missing_secret, CAPTCHA valide ignoré.
  it("TURNSTILE_SECRET vide ne masque pas un TURNSTILE_SECRET_KEY valide", async () => {
    process.env.TURNSTILE_SECRET = "";
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    expect(await secretSentToSiteverify()).toBe("sk-legacy");
  });

  it("TURNSTILE_SECRET_KEY vide ne masque pas un TURNSTILE_SECRET valide", async () => {
    process.env.TURNSTILE_SECRET_KEY = "";
    process.env.TURNSTILE_SECRET = "sk-provisionned";
    expect(await secretSentToSiteverify()).toBe("sk-provisionned");
  });

  it("les deux posés à vide → missing_secret, aucun appel réseau", async () => {
    process.env.TURNSTILE_SECRET = "";
    process.env.TURNSTILE_SECRET_KEY = "";
    let called = false;
    globalThis.fetch = vi.fn(async () => {
      called = true;
      throw new Error("siteverify ne doit pas être appelé sans secret");
    }) as unknown as typeof fetch;
    const res = await verifyTurnstile("tok");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_secret");
    expect(called).toBe(false);
  });

  it("chaîne vide seule posée → missing_secret", async () => {
    process.env.TURNSTILE_SECRET = "";
    const res = await verifyTurnstile("tok");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_secret");
  });
});
