// Stable Idempotency-Key derivation for Stripe create-session calls.
// Bucketing per minute means rapid double-clicks share a key and Stripe
// returns the same session; legitimate retries 60s later get a fresh key.

import { createHash } from "crypto";

export function checkoutIdempotencyKey(input: { userIdOrEmail: string; nowMs?: number }): string {
  const minute = Math.floor((input.nowMs ?? Date.now()) / 60_000);
  const raw = `${input.userIdOrEmail.trim().toLowerCase()}|${minute}`;
  return `bf1-${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}
