// Cloudflare Turnstile server-side verification.
// Pattern mirrors src/app/api/community/submit/route.ts (REST only, no SDK).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "missing_secret" | "rejected" | "network" };

export async function verifyTurnstile(token: string | null | undefined, remoteIp?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail-closed in production. In dev with no secret configured, callers
    // typically bypass — but the billing flow opts to refuse silently rather
    // than masquerade as a successful CAPTCHA pass.
    return { ok: false, reason: "missing_secret" };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return data.success ? { ok: true } : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
