import { describe, it, expect } from "vitest";
import { matchNarrative } from "@/lib/reflex/narrativeMatcher";
import {
  NARRATIVE_SCRIPTS,
  type NarrativeScriptSeed,
} from "@/lib/reflex/narrativeScripts";
import { findForbidden } from "@/lib/reflex/forbidden-words";

/** Convert a seed entry to the matcher's input shape. */
function toMatcher(s: NarrativeScriptSeed) {
  return {
    code: s.code,
    label: s.label,
    category: s.category,
    keywords: s.keywords as string[],
    regexes: s.regexes as string[],
    defaultConfidence: s.defaultConfidence,
  };
}

const ALL = NARRATIVE_SCRIPTS.map(toMatcher);

function findByCode(code: string) {
  const s = NARRATIVE_SCRIPTS.find((x) => x.code === code);
  if (!s) throw new Error(`unknown script: ${code}`);
  return toMatcher(s);
}

/**
 * Per-script test triple: { strong text → matches; weak text → may or
 * may not match; benign text → must not match this script }.
 */
const PER_SCRIPT_CASES: ReadonlyArray<{
  code: string;
  strong: string;
  benign: string;
}> = [
  { code: "LISTING_IMMINENT",
    strong: "Big news team: Binance listing imminent next week!",
    benign: "We are reviewing exchange partnerships in due course." },
  { code: "LAST_CHANCE",
    strong: "LAST CHANCE — don't miss this 100x potential moonshot!",
    benign: "We released a quarterly update with new product features." },
  { code: "PRESALE_EXCLUSIVE",
    strong: "Exclusive presale — whitelist only, limited spots.",
    benign: "The token is freely tradable on a major DEX." },
  { code: "KOL_INSIDER_CALL",
    strong: "Alpha leak: insider call from a private group, before everyone.",
    benign: "Our research team published a public report this morning." },
  { code: "FAKE_AUDIT",
    strong: "Smart contract fully audited by Certik — audit report attached.",
    benign: "Our roadmap mentions a future security review by an independent firm." },
  { code: "FAKE_PARTNERSHIP",
    strong: "Official partnership with a major brand confirmed!",
    benign: "We have ongoing conversations with several ecosystem teams." },
  { code: "MIGRATION_EMERGENCY",
    strong: "URGENT: migrate your tokens to the new v2 contract address immediately.",
    benign: "A future protocol upgrade is on the public roadmap." },
  { code: "COMMUNITY_TAKEOVER",
    strong: "Team abandoned — community takeover confirmed, CTO confirmed.",
    benign: "The founding team continues active development." },
  { code: "AIRDROP_CLAIM_TRAP",
    strong: "Claim your airdrop now — you are eligible for airdrop tokens!",
    benign: "Our token distribution follows the standard public emission schedule." },
  { code: "WALLET_VERIFICATION",
    strong: "Connect wallet to claim — verify your wallet to continue.",
    benign: "You can find the contract address on the project's documentation." },
  { code: "SEND_TO_RECEIVE",
    strong: "Send 0.1 ETH receive 1 ETH — double your tokens guaranteed.",
    benign: "Transfer fees apply when bridging between supported chains." },
  { code: "SYNCHRONIZED_PUSH",
    strong: "Everyone is talking about this — trending #1, going viral now.",
    benign: "Discussion is happening organically across various crypto forums." },
  { code: "AI_RWA_NARRATIVE_HIJACK",
    strong: "AI agent token meets real-world asset tokenization — RWA tokenization for everyone.",
    benign: "The protocol settles in stablecoins and supports standard ERC-20 tokens." },
  { code: "CHARITY_CLAIM",
    strong: "10% to charity — for the children, supporting a humanitarian cause.",
    benign: "The treasury follows a transparent on-chain allocation policy." },
  { code: "BURN_SUPPLY_SHOCK",
    strong: "We burned 80% of supply — deflationary mechanism active, supply shock incoming.",
    benign: "Token emissions follow the published vesting schedule." },
];

describe.each(PER_SCRIPT_CASES)(
  "narrativeMatcher — $code",
  ({ code, strong, benign }) => {
    const script = findByCode(code);

    it("matches the strong text and surfaces it at top", () => {
      const matches = matchNarrative(strong, ALL);
      expect(matches.length).toBeGreaterThan(0);
      const top = matches[0];
      // The strong text was designed for this code, so it must rank #1.
      expect(top.scriptCode).toBe(code);
      expect(top.confidence).toBeGreaterThanOrEqual(script.defaultConfidence);
      expect(top.matchedKeywords.length + top.matchedRegexes.length).toBeGreaterThan(0);
    });

    it("does NOT match the benign text", () => {
      const matches = matchNarrative(benign, [script]);
      expect(matches).toHaveLength(0);
    });

    it("confidence increases when multiple markers land", () => {
      // Build a text containing several keywords from the script (≥ 2).
      const kws = script.keywords.slice(0, Math.min(3, script.keywords.length));
      if (kws.length < 2) return; // skip scripts with single keyword
      const text = kws.join(" — ");
      const matches = matchNarrative(text, [script]);
      expect(matches).toHaveLength(1);
      // Confidence boost = 0.05 × (totalHits - 1), capped at 0.2.
      expect(matches[0].confidence).toBeGreaterThan(script.defaultConfidence);
    });
  },
);

describe("narrativeMatcher — general behavior", () => {
  it("returns [] for empty text", () => {
    expect(matchNarrative("", ALL)).toHaveLength(0);
  });

  it("returns [] for whitespace-only text", () => {
    expect(matchNarrative("   \n  \t ", ALL)).toHaveLength(0);
  });

  it("returns [] when no scripts are provided", () => {
    expect(matchNarrative("anything at all", [])).toHaveLength(0);
  });

  it("is case-insensitive on keywords", () => {
    const s = findByCode("LISTING_IMMINENT");
    const r = matchNarrative("BINANCE LISTING IMMINENT — go go go", [s]);
    expect(r).toHaveLength(1);
  });

  it("sorts matches by confidence descending", () => {
    const text =
      "LAST CHANCE — don't miss this moonshot 100x — also Binance listing imminent.";
    const matches = matchNarrative(text, ALL);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].confidence).toBeLessThanOrEqual(matches[i - 1].confidence);
    }
  });

  it("skips invalid regex rather than throwing", () => {
    const broken = {
      code: "BROKEN_REGEX",
      label: "x",
      category: "FOMO",
      keywords: ["definitely-matches-keyword"],
      regexes: ["[unclosed-class"], // invalid regex
      defaultConfidence: 0.5,
    };
    const r = matchNarrative("contains definitely-matches-keyword", [broken]);
    expect(r).toHaveLength(1);
    expect(r[0].matchedKeywords).toEqual(["definitely-matches-keyword"]);
    expect(r[0].matchedRegexes).toHaveLength(0);
  });

  it("confidence is capped at 1.0 even with many hits", () => {
    const script = findByCode("LAST_CHANCE");
    const text = script.keywords.slice(0, 6).join(" ");
    const matches = matchNarrative(text, [script]);
    expect(matches[0].confidence).toBeLessThanOrEqual(1.0);
  });

  it("excerpt is bounded around the first hit", () => {
    const text =
      "x".repeat(200) + " Binance listing imminent — " + "y".repeat(200);
    const r = matchNarrative(text, [findByCode("LISTING_IMMINENT")]);
    expect(r).toHaveLength(1);
    expect(r[0].excerpt.length).toBeLessThanOrEqual(120);
    expect(r[0].excerpt.toLowerCase()).toContain("binance listing");
  });
});

describe("narrative library — coverage + integrity", () => {
  it("contains exactly 15 scripts", () => {
    expect(NARRATIVE_SCRIPTS).toHaveLength(15);
  });

  it("every script code is unique", () => {
    const codes = NARRATIVE_SCRIPTS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every label is lint-clean (no banned tokens)", () => {
    const labels = NARRATIVE_SCRIPTS.map((s) => s.label);
    expect(findForbidden(labels)).toHaveLength(0);
  });

  it("every defaultConfidence is in (0, 1]", () => {
    for (const s of NARRATIVE_SCRIPTS) {
      expect(s.defaultConfidence).toBeGreaterThan(0);
      expect(s.defaultConfidence).toBeLessThanOrEqual(1);
    }
  });

  it("every script has at least one keyword and one regex", () => {
    for (const s of NARRATIVE_SCRIPTS) {
      expect(s.keywords.length).toBeGreaterThan(0);
      expect(s.regexes.length).toBeGreaterThan(0);
    }
  });

  it("every regex compiles", () => {
    for (const s of NARRATIVE_SCRIPTS) {
      for (const r of s.regexes) {
        expect(() => new RegExp(r, "i")).not.toThrow();
      }
    }
  });

  it("derivedFrom only references known casefile codes", () => {
    const known = new Set(["BOTIFY", "RAVE", "GHOST", "VINE", "SOLAXY"]);
    for (const s of NARRATIVE_SCRIPTS) {
      for (const c of s.derivedFrom) {
        expect(known.has(c)).toBe(true);
      }
    }
  });
});
