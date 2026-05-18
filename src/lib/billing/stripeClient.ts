import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  // Pin to the version we tested against. Stripe sends payloads of this
  // shape regardless of what the dashboard default is set to. The options
  // type literal changes on each SDK major; we cast through unknown to keep
  // the version pin without coupling to whichever literal type the SDK ships.
  const opts = {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
    maxNetworkRetries: 2,
  } as unknown as ConstructorParameters<typeof Stripe>[1];
  cached = new Stripe(key, opts);
  return cached;
}

// Test-only: reset the cached client so vi.mock() works between test cases.
export function __resetStripeForTests(): void {
  cached = null;
}
