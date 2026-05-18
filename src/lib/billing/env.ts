// Feature flag + env access for the billing module.
// All env reads happen server-side only. No `NEXT_PUBLIC_BILLING_*` keys.

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

export function isCapOverrideReached(): boolean {
  return process.env.BETA_CAP_REACHED === "true";
}

export function getCap(): number {
  const raw = process.env.BETA_FOUNDER_CAP;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://app.interligens.com";
}

export function isStripeTaxEnabled(): boolean {
  return process.env.STRIPE_TAX_ENABLED === "true";
}
