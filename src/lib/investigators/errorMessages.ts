/**
 * Client-side error-code → human message map for the investigator workspace.
 *
 * API routes return small machine codes ("not_found", "forbidden", etc.) so
 * they stay stable across languages and log-friendly. Every user-facing
 * component that surfaces a fetch error should route through describeError()
 * rather than printing the raw code.
 *
 * The workspace is English-only (see DECISIONS.md → Phase 2 language strategy),
 * so this map is EN-only on purpose. Public pages have their own local copy.
 */

const MESSAGES: Record<string, string> = {
  unauthorized: "Your session has expired. Please log in again.",
  forbidden: "You don't have permission to do that.",
  not_found: "That item no longer exists.",
  delete_failed: "Delete didn't go through — please retry.",
  update_failed: "Update didn't go through — please retry.",
  missing_ciphertext: "Encrypted payload is missing — please retry.",
  salt_fetch_failed: "Couldn't load your workspace keys. Refresh the page.",
  rate_limited: "Too many requests — slow down and try again in a moment.",
  nda_required: "You need to sign the NDA before creating a workspace.",
  handle_taken: "That handle is already in use — pick another one.",
  bad_handle: "Invalid handle format.",
  bad_salt: "Invalid key salt.",
  profile_exists: "A profile is already set up for this account.",
  network: "Network error — check your connection and retry.",
  graph_unavailable:
    "Graph storage isn't live yet — the Neon migration hasn't run.",
};

const GENERIC = "Something went wrong. Please try again.";

/**
 * Normalise anything (Error, Response, raw string, unknown) into a message
 * suitable for display. Prefers the mapped message for known codes, otherwise
 * falls back to the generic one.
 */
export function describeError(input: unknown): string {
  if (typeof input === "string") return MESSAGES[input] ?? GENERIC;
  if (!input) return GENERIC;
  if (input instanceof Error) return input.message || GENERIC;
  if (typeof input === "object" && "error" in (input as Record<string, unknown>)) {
    const e = (input as { error?: unknown }).error;
    if (typeof e === "string") return MESSAGES[e] ?? e;
  }
  return GENERIC;
}

/**
 * Helper for fetch error flows: given a Response and (optionally) the parsed
 * JSON body, pick the best user-facing message.
 */
export function describeResponse(res: Response, body?: unknown): string {
  if (res.status === 401) return MESSAGES.unauthorized;
  if (res.status === 403) return MESSAGES.forbidden;
  if (res.status === 404) return MESSAGES.not_found;
  if (res.status === 429) return MESSAGES.rate_limited;
  if (body) {
    const m = describeError(body);
    if (m !== GENERIC) return m;
  }
  if (res.status >= 500) return "Server error — please try again in a moment.";
  return GENERIC;
}
