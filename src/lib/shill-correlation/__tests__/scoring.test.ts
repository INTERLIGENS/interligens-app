import { describe, it, expect } from "vitest";
import { computeCandidateScores, type CandidateScoringInput } from "../scoring";

const base: CandidateScoringInput = {
  observedShillCount: 1,
  analyzableShillCount: 1,
  preTweetCount: 0,
  nearTweetCount: 0,
  postTweetCount: 1,
  exitCount: 0,
  distinctKolCount: 1,
};

describe("computeCandidateScores — components", () => {
  it("ratioObserved = observed / analyzable", () => {
    const s = computeCandidateScores({ ...base, observedShillCount: 3, analyzableShillCount: 4 });
    expect(s.ratioObserved).toBe(0.75);
  });

  it("timingScore weights pre > near > post", () => {
    const allPre = computeCandidateScores({ ...base, preTweetCount: 4, postTweetCount: 0 });
    const allNear = computeCandidateScores({ ...base, nearTweetCount: 4, postTweetCount: 0 });
    const allPost = computeCandidateScores({ ...base, postTweetCount: 4 });
    expect(allPre.timingScore).toBe(100);
    expect(allNear.timingScore).toBe(50);
    expect(allPost.timingScore).toBeCloseTo(15, 5);
    expect(allPre.timingScore).toBeGreaterThan(allNear.timingScore);
    expect(allNear.timingScore).toBeGreaterThan(allPost.timingScore);
  });

  it("specificityScore is inverse of distinct KOL count", () => {
    expect(computeCandidateScores({ ...base, distinctKolCount: 1 }).specificityScore).toBe(100);
    expect(computeCandidateScores({ ...base, distinctKolCount: 2 }).specificityScore).toBe(50);
    expect(computeCandidateScores({ ...base, distinctKolCount: 4 }).specificityScore).toBe(25);
  });

  it("exitScore = fraction of observations with a recorded exit", () => {
    const s = computeCandidateScores({ ...base, preTweetCount: 1, postTweetCount: 1, exitCount: 1 });
    expect(s.exitScore).toBe(50);
    expect(computeCandidateScores(base).exitScore).toBe(0); // none captured
  });
});

describe("genericSniperPenalty — destructive", () => {
  it("is 0 for a single-KOL wallet, ramps convexly with spread", () => {
    expect(computeCandidateScores({ ...base, distinctKolCount: 1 }).genericSniperPenalty).toBe(0);
    expect(computeCandidateScores({ ...base, distinctKolCount: 2 }).genericSniperPenalty).toBe(8);
    expect(computeCandidateScores({ ...base, distinctKolCount: 3 }).genericSniperPenalty).toBe(32);
    expect(computeCandidateScores({ ...base, distinctKolCount: 4 }).genericSniperPenalty).toBe(72);
    expect(computeCandidateScores({ ...base, distinctKolCount: 5 }).genericSniperPenalty).toBe(100);
  });

  it("collapses correlationScore for a broad sniper despite strong per-KOL stats", () => {
    const strong = {
      observedShillCount: 5,
      analyzableShillCount: 5,
      preTweetCount: 5,
      nearTweetCount: 0,
      postTweetCount: 0,
      exitCount: 0,
    };
    const specific = computeCandidateScores({ ...strong, distinctKolCount: 1 });
    const sniper = computeCandidateScores({ ...strong, distinctKolCount: 6 });
    expect(specific.correlationScore).toBeGreaterThan(80);
    expect(sniper.correlationScore).toBe(0); // penalty 100 wipes it out
    expect(sniper.classification).toBe("watch");
  });
});

describe("thresholds, confidence & classification", () => {
  it("high_interest + high confidence for a strong specific recurring front-runner", () => {
    const s = computeCandidateScores({
      observedShillCount: 5,
      analyzableShillCount: 5,
      preTweetCount: 5,
      nearTweetCount: 0,
      postTweetCount: 0,
      exitCount: 0,
      distinctKolCount: 1,
    });
    expect(s.shortlistEligible).toBe(true);
    expect(s.seriousCandidate).toBe(true);
    expect(s.classification).toBe("high_interest");
    expect(s.confidence).toBe("high");
  });

  it("candidate/medium when shortlist-eligible but not serious", () => {
    const s = computeCandidateScores({
      observedShillCount: 3,
      analyzableShillCount: 3,
      preTweetCount: 3,
      nearTweetCount: 0,
      postTweetCount: 0,
      exitCount: 0,
      distinctKolCount: 1,
    });
    expect(s.shortlistEligible).toBe(true); // 3 shills, 3 pre, ratio 1.0
    expect(s.seriousCandidate).toBe(false); // <5 shills
    expect(s.classification).toBe("candidate");
    expect(s.confidence).toBe("medium");
  });

  it("watch when below shortlist thresholds", () => {
    const s = computeCandidateScores({
      observedShillCount: 2,
      analyzableShillCount: 5,
      preTweetCount: 1,
      nearTweetCount: 0,
      postTweetCount: 1,
      exitCount: 0,
      distinctKolCount: 1,
    });
    expect(s.shortlistEligible).toBe(false); // only 2 shills, 1 pre, ratio 0.4
    expect(s.classification).toBe("watch");
    expect(s.confidence).toBe("low");
  });

  it("shortlist needs >=3 shills AND >=2 pre AND ratio>=25%", () => {
    // 3 shills, ratio 1.0, but only 1 pre -> not eligible
    const onePre = computeCandidateScores({
      ...base, observedShillCount: 3, analyzableShillCount: 3, preTweetCount: 1, postTweetCount: 2,
    });
    expect(onePre.shortlistEligible).toBe(false);
    // 3 shills, 2 pre, but ratio 0.2 (<25%) -> not eligible
    const lowRatio = computeCandidateScores({
      ...base, observedShillCount: 3, analyzableShillCount: 15, preTweetCount: 2, postTweetCount: 1,
    });
    expect(lowRatio.shortlistEligible).toBe(false);
  });
});
