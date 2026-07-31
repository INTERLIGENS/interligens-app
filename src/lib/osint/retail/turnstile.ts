/**
 * src/lib/osint/retail/turnstile.ts
 *
 * SPRINT C1 — Vérification Cloudflare Turnstile (anti-bot).
 *
 * Appelle l'endpoint siteverify de Cloudflare. GÈRE PROPREMENT l'absence de clé :
 * si aucun secret n'est configuré, on NE PLANTE PAS — on renvoie un verdict
 * `configured:false`. La décision d'accepter ou non un envoi non vérifié
 * appartient à l'appelant (la route submit l'enregistre via turnstileVerified).
 * Comme la porte globale est FERMÉE par défaut, aucun envoi réel ne transite tant
 * que l'admin n'a pas explicitement ouvert ET configuré Turnstile.
 *
 * NOMMAGE DU SECRET : on accepte les DEUX noms, `TURNSTILE_SECRET` en premier.
 * C'est le nom réellement provisionné dans l'environnement (déjà lu par
 * src/app/api/community/submit et src/lib/billing/turnstile) ; ce module avait
 * été écrit sur `TURNSTILE_SECRET_KEY`, jamais posé. Sans ce fallback,
 * isTurnstileConfigured() renvoyait false et l'anti-bot serait resté inerte le
 * jour où la porte retail s'ouvre. Aucun nouveau secret à créer. Voir
 * turnstileSecret() pour le détail de la résolution (chaîne vide = absent).
 *
 * Aucune dépendance npm : fetch natif vers l'API Cloudflare.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  /** true si Turnstile est configuré ET le token a passé la validation. */
  ok: boolean;
  /** false si aucun secret n'est posé (validation impossible, non bloquante ici). */
  configured: boolean;
  /** codes d'erreur Cloudflare éventuels, pour audit. */
  errorCodes: string[];
  /** raison lisible (audit/log). */
  reason: string;
}

/**
 * Secret Turnstile, sous l'un ou l'autre nom. null si aucun n'est exploitable.
 *
 * `||` et NON `??` : une variable posée à la chaîne vide doit être traitée comme
 * absente, pas comme une valeur. Avec `??`, `TURNSTILE_SECRET=""` masquerait un
 * `TURNSTILE_SECRET_KEY` valide et l'anti-bot repasserait silencieusement en
 * `configured:false`. Précédent maison : BIRDEYE_API_KEY est resté 101 jours en
 * Production avec un placeholder de 2 caractères sans que rien ne le signale.
 *
 * Ordre TURNSTILE_SECRET d'abord, aligné sur src/lib/billing/turnstile.ts, pour
 * que les deux modules transmettent le MÊME secret si les deux noms sont posés.
 */
function turnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET_KEY || null;
}

export function isTurnstileConfigured(): boolean {
  return !!turnstileSecret();
}

/**
 * Vérifie un token Turnstile. Ne lève jamais : toute erreur réseau/parse devient
 * un verdict ok:false (fail-closed quand Turnstile EST configuré).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = turnstileSecret();
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
