/**
 * src/lib/osint/retail/turnstile.ts
 *
 * SPRINT C1 — Vérification Cloudflare Turnstile (anti-bot).
 *
 * Appelle l'endpoint siteverify de Cloudflare. GÈRE PROPREMENT l'absence de clé :
 * si TURNSTILE_SECRET_KEY n'est pas configuré, on NE PLANTE PAS — on renvoie un
 * verdict `configured:false`. La décision d'accepter ou non un envoi non vérifié
 * appartient à l'appelant (la route submit l'enregistre via turnstileVerified).
 * Comme la porte globale est FERMÉE par défaut, aucun envoi réel ne transite tant
 * que l'admin n'a pas explicitement ouvert ET configuré Turnstile.
 *
 * Aucune dépendance npm : fetch natif vers l'API Cloudflare.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  /** true si Turnstile est configuré ET le token a passé la validation. */
  ok: boolean;
  /** false si TURNSTILE_SECRET_KEY est absent (validation impossible, non bloquante ici). */
  configured: boolean;
  /** codes d'erreur Cloudflare éventuels, pour audit. */
  errorCodes: string[];
  /** raison lisible (audit/log). */
  reason: string;
}

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Vérifie un token Turnstile. Ne lève jamais : toute erreur réseau/parse devient
 * un verdict ok:false (fail-closed quand Turnstile EST configuré).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, configured: false, errorCodes: [], reason: "turnstile_not_configured" };
  }
  if (!token) {
    return { ok: false, configured: true, errorCodes: ["missing-input-response"], reason: "missing_token" };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    const resp = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!resp.ok) {
      return { ok: false, configured: true, errorCodes: [`http_${resp.status}`], reason: "siteverify_http_error" };
    }
    const data = (await resp.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) {
      return { ok: true, configured: true, errorCodes: [], reason: "verified" };
    }
    return {
      ok: false,
      configured: true,
      errorCodes: Array.isArray(data["error-codes"]) ? data["error-codes"] : [],
      reason: "verification_failed",
    };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      errorCodes: ["network_error"],
      reason: e instanceof Error ? e.message : "siteverify_unreachable",
    };
  }
}
