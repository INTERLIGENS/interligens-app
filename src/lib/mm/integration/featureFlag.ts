// ─── MM → TigerScore feature flag (spec §11.3) ────────────────────────────
// The entire integration must be off by default. It only turns on when the
// environment explicitly sets MM_INTEGRATION_LIVE to a truthy value AND the
// calibration has been validated on real data. Any doubt → off.
//
// Truthy values accepted: "1", "true", "on", "yes" (case-insensitive).
// Anything else (empty, "0", "false", undefined) keeps the integration off.

const TRUTHY = new Set(["1", "true", "on", "yes"]);

export type EnvBag = Record<string, string | undefined>;

export function isMmIntegrationEnabled(env: EnvBag = process.env): boolean {
  const raw = env.MM_INTEGRATION_LIVE;
  if (typeof raw !== "string") return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}

export const MM_INTEGRATION_ENV_KEY = "MM_INTEGRATION_LIVE";
