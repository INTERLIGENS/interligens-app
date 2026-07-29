/**
 * Unit tests for the POSTS-based authoritative budget guard (hotfix
 * xapi-usage-authoritative). Pure helpers + the retry/fail-safe wrapper.
 *
 * Covers the 3 decision scenarios required by the fix:
 *   1. usage under cap        → run proceeds (capReached=false)
 *   2. usage at/over cap       → block (capReached=true)
 *   3. X usage API unreachable → getProjectUsageWithRetry returns null after
 *                                all attempts → caller FAILS CLOSED (blocks).
 */
import { describe, it, expect } from "vitest";
import type { XUsage } from "@/lib/xapi/client";
import {
  X_API_HARD_CAP_POSTS,
  estimateRunPosts,
  evaluateBudgetCapPosts,
  getProjectUsageWithRetry,
} from "../route";

describe("X_API_HARD_CAP_POSTS default", () => {
  it("defaults to 24000 posts (≈$139 at $0.0058/post, margin under X's real $150 cap)", () => {
    // X_API_HARD_CAP_POSTS is unset in the test env → default applies.
    expect(X_API_HARD_CAP_POSTS).toBe(24000);
  });
});

describe("estimateRunPosts", () => {
  it("sums per-handle caps (GordonGekko=100, others=maxPostsPerHandle), padded, ceil'd", () => {
    const handles = [{ handle: "a" }, { handle: "GordonGekko" }, { handle: "b" }];
    // 15 + 100 + 15 = 130 posts × 1.25 = 162.5 → ceil → 163
    expect(estimateRunPosts(handles, 15, 1.25)).toBe(163);
  });

  it("applies no padding with safetyFactor=1", () => {
    const handles = [{ handle: "a" }, { handle: "b" }];
    expect(estimateRunPosts(handles, 15, 1)).toBe(30);
  });

  it("gives 0 for an empty watchlist", () => {
    expect(estimateRunPosts([], 15, 1.25)).toBe(0);
  });
});

describe("evaluateBudgetCapPosts", () => {
  it("SCENARIO 1 — under cap: does not block, no warning (run proceeds)", () => {
    // Real numbers: 2607 used this cycle + ~1500 est. next run vs 24000 cap.
    const r = evaluateBudgetCapPosts({ usagePosts: 2607, estimatePosts: 1500, capPosts: 24000 });
    expect(r.capReached).toBe(false);
    expect(r.warning).toBe(false);
  });

  it("SCENARIO 2 — over cap: blocks", () => {
    const r = evaluateBudgetCapPosts({ usagePosts: 23000, estimatePosts: 1500, capPosts: 24000 });
    expect(r.capReached).toBe(true);
  });

  it("blocks exactly at the boundary (usage + estimate === cap, >=)", () => {
    const r = evaluateBudgetCapPosts({ usagePosts: 22500, estimatePosts: 1500, capPosts: 24000 });
    expect(r.capReached).toBe(true); // 24000 >= 24000
  });

  it("raises the warning at >=80% of cap without blocking", () => {
    const r = evaluateBudgetCapPosts({ usagePosts: 19200, estimatePosts: 100, capPosts: 24000 });
    expect(r.warning).toBe(true); // 19200 >= 0.8 * 24000
    expect(r.capReached).toBe(false); // 19300 < 24000
  });

  it("honours a custom warnRatio", () => {
    const r = evaluateBudgetCapPosts({
      usagePosts: 12000,
      estimatePosts: 100,
      capPosts: 24000,
      warnRatio: 0.5,
    });
    expect(r.warning).toBe(true); // 12000 >= 0.5 * 24000
  });
});

describe("getProjectUsageWithRetry (fail-safe)", () => {
  const usage: XUsage = { projectUsage: 2607, projectCap: 2_000_000, capResetDay: 21 };

  it("returns usage on first success (no retry needed)", async () => {
    let calls = 0;
    const r = await getProjectUsageWithRetry(async () => {
      calls++;
      return usage;
    }, [0, 0]);
    expect(r).toEqual(usage);
    expect(calls).toBe(1);
  });

  it("absorbs a transient hiccup: retries then succeeds", async () => {
    let calls = 0;
    const r = await getProjectUsageWithRetry(async () => {
      calls++;
      return calls < 3 ? null : usage;
    }, [0, 0]);
    expect(r).toEqual(usage);
    expect(calls).toBe(3);
  });

  it("SCENARIO 3 — returns null after ALL attempts fail → caller fails CLOSED", async () => {
    let calls = 0;
    const r = await getProjectUsageWithRetry(async () => {
      calls++;
      return null;
    }, [0, 0]);
    expect(r).toBeNull(); // null ⇒ pre-check blocks the run (fail-closed)
    expect(calls).toBe(3); // initial + 2 retries
  });
});
