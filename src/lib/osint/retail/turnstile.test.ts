/**
 * Tests du nommage du secret Turnstile.
 *
 * Le module a été écrit sur TURNSTILE_SECRET_KEY, alors que le nom réellement
 * provisionné dans l'environnement est TURNSTILE_SECRET (déjà lu par
 * api/community/submit et lib/billing/turnstile). Ces tests verrouillent le
 * fallback : les DEUX noms doivent configurer l'anti-bot, sinon la porte retail
 * s'ouvrirait avec un Turnstile inerte.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isTurnstileConfigured, verifyTurnstile } from "./turnstile";

const ORIGINAL_KEY = process.env.TURNSTILE_SECRET_KEY;
const ORIGINAL_SECRET = process.env.TURNSTILE_SECRET;

function clear(): void {
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET;
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(clear);

afterEach(() => {
  restore("TURNSTILE_SECRET_KEY", ORIGINAL_KEY);
  restore("TURNSTILE_SECRET", ORIGINAL_SECRET);
});

describe("isTurnstileConfigured", () => {
  it("false quand aucun des deux noms n'est posé", () => {
    expect(isTurnstileConfigured()).toBe(false);
  });

  it("true avec TURNSTILE_SECRET_KEY seul (nom historique du module)", () => {
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    expect(isTurnstileConfigured()).toBe(true);
  });

  it("true avec TURNSTILE_SECRET seul (nom réellement provisionné)", () => {
    process.env.TURNSTILE_SECRET = "sk-provisionned";
    expect(isTurnstileConfigured()).toBe(true);
  });

  it("true quand les deux sont posés", () => {
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    process.env.TURNSTILE_SECRET = "sk-provisionned";
    expect(isTurnstileConfigured()).toBe(true);
  });

  // Une var posée à vide vaut ABSENTE. Avec `??` au lieu de `||`, ces deux cas
  // renverraient true (secret = "") puis masqueraient le secret valide.
  it("false quand le seul nom posé est une chaîne vide", () => {
    process.env.TURNSTILE_SECRET = "";
    expect(isTurnstileConfigured()).toBe(false);
  });

  it("false quand les deux noms sont posés à vide", () => {
    process.env.TURNSTILE_SECRET = "";
    process.env.TURNSTILE_SECRET_KEY = "";
    expect(isTurnstileConfigured()).toBe(false);
  });

  it("TURNSTILE_SECRET vide ne masque pas un TURNSTILE_SECRET_KEY valide", () => {
    process.env.TURNSTILE_SECRET = "";
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    expect(isTurnstileConfigured()).toBe(true);
  });

  it("TURNSTILE_SECRET_KEY vide ne masque pas un TURNSTILE_SECRET valide", () => {
    process.env.TURNSTILE_SECRET_KEY = "";
    process.env.TURNSTILE_SECRET = "sk-provisionned";
    expect(isTurnstileConfigured()).toBe(true);
  });
});

describe("verifyTurnstile — verdict sans secret", () => {
  it("configured:false et ne touche jamais le réseau", async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error("siteverify ne doit pas être appelé sans secret");
    }) as typeof fetch;
    try {
      const r = await verifyTurnstile("some-token");
      expect(r.configured).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("turnstile_not_configured");
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

/** Capture le champ `secret` réellement transmis à siteverify. */
async function secretSentToSiteverify(): Promise<string | null> {
  const originalFetch = globalThis.fetch;
  let sent: string | null = null;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sent = new URLSearchParams(String(init?.body)).get("secret");
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    await verifyTurnstile("tok");
    return sent;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe("verifyTurnstile — précédence des deux noms", () => {
  // Ordre aligné sur src/lib/billing/turnstile.ts : si les deux vars sont
  // posées, les deux modules doivent transmettre le MÊME secret à Cloudflare.
  it("les deux posés → TURNSTILE_SECRET gagne (ordre billing)", async () => {
    process.env.TURNSTILE_SECRET = "sk-provisionned";
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    expect(await secretSentToSiteverify()).toBe("sk-provisionned");
  });

  it("TURNSTILE_SECRET vide → c'est TURNSTILE_SECRET_KEY qui part", async () => {
    process.env.TURNSTILE_SECRET = "";
    process.env.TURNSTILE_SECRET_KEY = "sk-legacy";
    expect(await secretSentToSiteverify()).toBe("sk-legacy");
  });
});

describe("verifyTurnstile — secret sous l'un ou l'autre nom", () => {
  for (const name of ["TURNSTILE_SECRET_KEY", "TURNSTILE_SECRET"] as const) {
    it(`${name} : token absent → configured:true, missing_token`, async () => {
      process.env[name] = "sk-test";
      const r = await verifyTurnstile(null);
      expect(r.configured).toBe(true);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("missing_token");
      expect(r.errorCodes).toEqual(["missing-input-response"]);
    });

    it(`${name} : le secret posé est bien celui envoyé à siteverify`, async () => {
      process.env[name] = "sk-sent";
      const originalFetch = globalThis.fetch;
      let sentSecret: string | null = null;
      globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        sentSecret = new URLSearchParams(String(init?.body)).get("secret");
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }) as unknown as typeof fetch;
      try {
        const r = await verifyTurnstile("tok");
        expect(r.ok).toBe(true);
        expect(r.configured).toBe(true);
        expect(sentSecret).toBe("sk-sent");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  }
});
