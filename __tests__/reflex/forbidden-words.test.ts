import { describe, it, expect } from "vitest";
import {
  assertClean,
  findForbidden,
  isClean,
  ForbiddenWordError,
} from "@/lib/reflex/forbidden-words";
import {
  VERDICT_WORDING,
  ACTION_WORDING,
  DISCLAIMER_NO_SIGNAL,
  MICRO_COPY,
} from "@/lib/reflex/constants";

describe("forbidden-words: banned EN tokens", () => {
  it.each([
    ["this token is safe", "safe"],
    ["asset approved by team", "approved"],
    ["project certified by audit", "certified"],
    ["guaranteed returns of 100x", "guaranteed"],
    ["clean wallet history", "clean"],
    ["trusted source confirms it", "trusted"],
    ["verified safe by us", "verified safe"],
    ["green light to ape in", "green light"],
    ["all clear, no risk", "all clear"],
    ["this is a scam", "scam"],
    ["the scammer disappeared", "scam"],
    ["he is a fraudster", "fraudster"],
    ["criminal activity detected", "criminal"],
    ["it will rug imminently", "will rug"],
    ["going to rug this week", "going to rug"],
    ["about to rug any moment", "about to rug"],
  ])("flags %j contains %s", (text, token) => {
    const matches = findForbidden(text);
    expect(matches.map((m) => m.token)).toContain(token);
  });
});

describe("forbidden-words: banned FR tokens", () => {
  it.each([
    "ce projet est sûr",
    "asset approuvé par l'équipe",
    "projet certifié par audit",
    "rendement garanti à 100%",
    "ce projet est sécurisé",
    "asset validé par l'équipe",
    "investissement sans risque",
    "placements sans risques",
    "feu vert pour ape",
    "c'est une arnaque",
    "l'arnaqueur a disparu",
    "l'escroc s'est enfui",
    "une escroquerie de plus",
    "activité criminelle confirmée",
    "le fraudeur est connu",
    "il va rug bientôt",
  ])("flags FR text: %s", (text) => {
    expect(findForbidden(text).length).toBeGreaterThan(0);
  });
});

describe("forbidden-words: allowed phrases pass clean", () => {
  it.each([
    // EN allowlist
    "documented risk signals",
    "no critical risk signals detected with current sources",
    "this is not a safety guarantee",
    "matches a known risk pattern",
    "we did not verify this project as safe",
    "evidence-based risk check",
    "absence of signal is not a guarantee",
    "we do not approve assets",
    "We do not approve assets. We document risk.",
    // FR allowlist
    "signaux de risque documentés",
    "aucun signal de risque critique détecté avec les sources actuelles",
    "ce n'est pas une garantie de sécurité",
    "correspond à un schéma de risque connu",
    "nous n'avons pas vérifié ce projet comme étant sûr",
    "vérification de risque basée sur des preuves",
    "l'absence de signal n'est pas une garantie",
    "nous n'approuvons pas d'actifs",
  ])("passes clean: %s", (text) => {
    expect(() => assertClean(text)).not.toThrow();
  });
});

describe("forbidden-words: word boundaries prevent false positives", () => {
  it.each([
    "this is a safety mechanism", //  'safety' != 'safe'
    "we have safer alternatives", //  'safer' != 'safe'
    "approval is pending", //          'approval' != 'approved'
    "the certification process", //   'certification' != 'certified'
    "there is no guarantee", //        'guarantee' (noun) != 'guaranteed'
    "data cleaning step", //           'cleaning' != 'clean'
    "post-mortem cleanup", //          'cleanup' != 'clean'
    "we trust the data", //            'trust' != 'trusted'
    "scamper across the floor", //    'scamper' != 'scam'
    "approving the change", //         'approving' != 'approved'
    "nous approuvons cette procédure", // 'approuvons' (verb) != 'approuvé'
    "le projet est sur Solana", //    'sur' (preposition, no accent) != 'sûr'
    "la surface du wallet", //         'surface' != 'sûr'
    "vérifiable preuve", //            'vérifiable' != 'certifié'
    "la sécurité est importante", //   'sécurité' (noun) != 'sécurisé'
    "valider la transaction", //       'valider' (verb) != 'validé'
    "validation en cours", //          'validation' (noun) != 'validé'
  ])("does not flag: %s", (text) => {
    expect(isClean(text)).toBe(true);
  });
});

describe("forbidden-words: factual past tense allowed, predictive banned", () => {
  it("'rug pulled' (past tense, factual) passes", () => {
    expect(isClean("BOTIFY rug pulled in 2024")).toBe(true);
  });
  it("'rugged' (past tense) passes", () => {
    expect(isClean("the asset rugged last week")).toBe(true);
  });
  it("'will rug' (predictive) is banned", () => {
    expect(isClean("it will rug imminently")).toBe(false);
  });
  it("'about to rug' (predictive) is banned", () => {
    expect(isClean("about to rug — exit now")).toBe(false);
  });
});

describe("forbidden-words: case insensitivity", () => {
  it.each(["SAFE", "Safe", "sAFe", "APPROVED", "Approved", "SÛR", "Approuvé"])(
    "flags variant: %s",
    (text) => {
      expect(isClean(text)).toBe(false);
    },
  );
});

describe("forbidden-words: smart-quote normalization", () => {
  it("curly apostrophe in FR allowed phrase passes", () => {
    // U+2019 right single quotation mark
    expect(isClean("ce n’est pas une garantie de sécurité")).toBe(true);
  });
  it("curly apostrophe in micro-copy passes", () => {
    expect(isClean("nous n’approuvons pas d’actifs")).toBe(true);
  });
});

describe("forbidden-words: array input", () => {
  it("flags when any element contains a banned token", () => {
    expect(() => assertClean(["all good", "scam alert"])).toThrow(
      ForbiddenWordError,
    );
  });
  it("empty array passes", () => {
    expect(() => assertClean([])).not.toThrow();
  });
  it("empty string passes", () => {
    expect(() => assertClean("")).not.toThrow();
  });
  it("multiple banned tokens are all collected", () => {
    const matches = findForbidden(["approved", "certified", "guaranteed"]);
    expect(matches.map((m) => m.token).sort()).toEqual([
      "approved",
      "certified",
      "guaranteed",
    ]);
  });
});

describe("forbidden-words: error shape", () => {
  it("ForbiddenWordError carries the match list", () => {
    try {
      assertClean("approved and certified");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenWordError);
      const err = e as ForbiddenWordError;
      expect(err.matches.length).toBe(2);
      expect(err.matches.map((m) => m.token).sort()).toEqual([
        "approved",
        "certified",
      ]);
    }
  });
  it("error message includes the source label", () => {
    expect(() => assertClean("scam", "ACTION_WORDING.STOP.en")).toThrow(
      /ACTION_WORDING\.STOP\.en/,
    );
  });
  it("each match carries snippet + index", () => {
    const matches = findForbidden("the project is approved by all");
    expect(matches.length).toBe(1);
    expect(matches[0].token).toBe("approved");
    expect(matches[0].snippet).toContain("approved");
    expect(matches[0].index).toBeGreaterThan(0);
  });
});

describe("forbidden-words: mixed input — allowed phrase + extra banned", () => {
  it("allowed substring is stripped, surrounding banned still flagged", () => {
    const text =
      "we did not verify this project as safe but the token is approved";
    const matches = findForbidden(text);
    expect(matches.some((m) => m.token === "approved")).toBe(true);
    // The 'safe' inside the allowed phrase must NOT be flagged.
    expect(matches.some((m) => m.token === "safe")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Meta-test: every template in constants.ts must pass the lint.
// This is the CI gate the spec mandates: lint anti-mots-interdits sur
// TOUS les templates (verdicts, raisons, actions, micro-copy, disclaimers).
// ─────────────────────────────────────────────────────────────────────────

describe("forbidden-words: constants.ts is lint-clean (CI gate)", () => {
  it("VERDICT_WORDING (EN) passes", () => {
    const all = Object.values(VERDICT_WORDING).map((v) => v.en);
    expect(() => assertClean(all, "VERDICT_WORDING.en")).not.toThrow();
  });
  it("VERDICT_WORDING (FR) passes", () => {
    const all = Object.values(VERDICT_WORDING).map((v) => v.fr);
    expect(() => assertClean(all, "VERDICT_WORDING.fr")).not.toThrow();
  });
  it("ACTION_WORDING (EN) passes", () => {
    const all = Object.values(ACTION_WORDING).map((v) => v.en);
    expect(() => assertClean(all, "ACTION_WORDING.en")).not.toThrow();
  });
  it("ACTION_WORDING (FR) passes", () => {
    const all = Object.values(ACTION_WORDING).map((v) => v.fr);
    expect(() => assertClean(all, "ACTION_WORDING.fr")).not.toThrow();
  });
  it("DISCLAIMER_NO_SIGNAL (EN + FR) passes", () => {
    expect(() =>
      assertClean(
        [DISCLAIMER_NO_SIGNAL.en, DISCLAIMER_NO_SIGNAL.fr],
        "DISCLAIMER_NO_SIGNAL",
      ),
    ).not.toThrow();
  });
  it("MICRO_COPY (every field) passes", () => {
    const all = Object.values(MICRO_COPY);
    expect(() => assertClean(all, "MICRO_COPY")).not.toThrow();
  });
});
