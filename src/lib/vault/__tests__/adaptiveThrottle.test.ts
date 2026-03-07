import { describe, it, expect, beforeEach } from "vitest";
import { checkAdaptiveThrottle, _resetThrottleStore } from "../adaptiveThrottle";

describe("adaptive throttle", () => {
  beforeEach(() => _resetThrottleStore());

  it("allows requests under match limit", () => {
    const r = checkAdaptiveThrottle("1.2.3.4", "ua", false);
    expect(r.allowed).toBe(true);
    expect(r.throttled).toBe(false);
  });

  it("throttles after too many matches", () => {
    for (let i = 0; i < 20; i++) {
      checkAdaptiveThrottle("1.2.3.4", "ua", true);
    }
    const r = checkAdaptiveThrottle("1.2.3.4", "ua", true);
    expect(r.allowed).toBe(false);
    expect(r.throttled).toBe(true);
  });

  it("different fingerprints are independent", () => {
    for (let i = 0; i < 20; i++) checkAdaptiveThrottle("1.2.3.4", "ua", true);
    const r = checkAdaptiveThrottle("5.6.7.8", "ua", true);
    expect(r.allowed).toBe(true);
  });
});
