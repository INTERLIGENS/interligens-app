import { describe, it, expect } from "vitest";
import { checkoutIdempotencyKey } from "../idempotency";

describe("checkoutIdempotencyKey", () => {
  it("collapses two calls in the same minute to the same key", () => {
    const t = Date.parse("2026-05-11T10:00:30Z");
    const a = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t });
    const b = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t + 25_000 });
    expect(a).toBe(b);
    expect(a).toMatch(/^bf1-[a-f0-9]{32}$/);
  });

  it("returns a different key in a different minute bucket", () => {
    const t = Date.parse("2026-05-11T10:00:30Z");
    const a = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t });
    const b = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t + 60_000 });
    expect(a).not.toBe(b);
  });

  it("normalizes case and whitespace", () => {
    const t = Date.parse("2026-05-11T10:00:30Z");
    const a = checkoutIdempotencyKey({ userIdOrEmail: " User@X.COM ", nowMs: t });
    const b = checkoutIdempotencyKey({ userIdOrEmail: "user@x.com", nowMs: t });
    expect(a).toBe(b);
  });
});
