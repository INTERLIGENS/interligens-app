// Cloudflare Turnstile server-side verification.
// Pattern mirrors src/app/api/community/submit/route.ts (REST only, no SDK).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "missing_secret" | "rejected" | "network" };

/**
 * Secret Turnstile, sous l'un ou l'autre nom. null si aucun n'est exploitable.
 *
 * `||` et NON `??` : une variable posée à la chaîne vide vaut ABSENTE, pas
 * valeur. Avec `??`, `TURNSTILE_SECRET=""` masquait un `TURNSTILE_SECRET_KEY`
 * valide, le flow billing repassait en `missing_secret` et refusait tout
 * checkout/waitlist alors que le CAPTCHA était configuré.
 *
 * Ordre TURNSTILE_SECRET d'abord — aligné sur src/lib/osint/retail/turnstile.ts,
 * pour que les deux modules transmettent le MÊME secret à Cloudflare si les
 * deux noms sont posés.
 */
function turnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET_KEY || null;
}

export async function verifyTurnstile(token: string | null | undefined, remoteIp?: string | null): Promise<TurnstileResult> {
  const secret = turnstileSecret();
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
