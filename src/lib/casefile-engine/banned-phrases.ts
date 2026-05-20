/**
 * Casefile Engine V1 — banned phrases linter (regex-based).
 *
 * Detects accusatory wording that has no place in an admissibility-grade
 * casefile draft. "stolen" in isolation is NOT banned — it is a legitimate
 * term inside case-law citations such as CLM v CLN [2022] SGHC 46.
 *
 * Exception: the phrase "stolen cryptocurrency" is tolerated when it appears
 * in proximity (±120 chars) of a recognised citation tag.
 */

export interface BannedPattern {
  pattern: RegExp;
  description: string;
}

export const BANNED_PATTERNS: BannedPattern[] = [
  // Generic accusatory identity terms
  { pattern: /\bscammer\b/i, description: "scammer" },
  { pattern: /\bfraudster\b/i, description: "fraudster" },
  { pattern: /\bcriminal\b/i, description: "criminal" },
  { pattern: /\bthief\b/i, description: "thief" },

  // Accusatory verbs with subject capture
  { pattern: /\b[\w@.-]+\s+stole\b/i, description: "X stole" },
  { pattern: /\bstolen\s+by\s+[\w@.-]+/i, description: "stolen by X" },
  { pattern: /\bfunds\s+were\s+stolen\s+by\b/i, description: "funds were stolen by" },
  { pattern: /\bconfirmed\s+stolen\s+by\b/i, description: "confirmed stolen by" },
  { pattern: /\blaundered\s+by\s+[\w@.-]+/i, description: "laundered by X" },
  { pattern: /\b[\w@.-]+\s+laundered\b/i, description: "X laundered" },
  { pattern: /\b[\w@.-]+\s+is\s+responsible\b/i, description: "X is responsible" },
  { pattern: /\b[\w@.-]+\s+is\s+guilty\b/i, description: "X is guilty" },

  // Unjustified conclusions
  { pattern: /\bconfirmed\s+fraud\b/i, description: "confirmed fraud" },
  { pattern: /\bproven\s+scam\b/i, description: "proven scam" },

  // Promises
  { pattern: /\brecovery\s+guaranteed\b/i, description: "recovery guaranteed" },
  { pattern: /\bwe\s+will\s+recover\b/i, description: "we will recover" },

  // Legal advice
  { pattern: /\byou\s+should\s+file\b/i, description: "you should file" },
  { pattern: /\byou\s+should\s+sue\b/i, description: "you should sue" },
  { pattern: /\blegal\s+route\s+recommended\b/i, description: "legal route recommended" },
  { pattern: /\bcivil\s+recovery\s+viable\b/i, description: "civil recovery viable" },

  // Lead-gen
  { pattern: /\bfind\s+a\s+lawyer\b/i, description: "find a lawyer" },
  { pattern: /\bmatch\s+with\s+lawyer\b/i, description: "match with lawyer" },
];

// Recognised case-law citation tag (proximity allowance).
const CITATION_CONTEXT = /\[\d{4}\]\s*(EWHC|SGHC|HKCFI|HKCFA|SCC|UKSC|UKHL|EWCA)/i;

export interface BannedPhraseViolation {
  description: string;
  match: string;
  position: number;
  inCitationContext: boolean;
}

export function checkBannedPhrases(text: string): BannedPhraseViolation[] {
  const violations: BannedPhraseViolation[] = [];

  for (const { pattern, description } of BANNED_PATTERNS) {
    // Force a globalised copy so .exec walks every occurrence.
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const around = text.slice(
        Math.max(0, m.index - 120),
        Math.min(text.length, m.index + 120),
      );
      const inCitation = CITATION_CONTEXT.test(around);
      violations.push({
        description,
        match: m[0],
        position: m.index,
        inCitationContext: inCitation,
      });
    }
  }

  // Tolerate "stolen cryptocurrency" inside a citation neighbourhood only.
  // Every other violation in citation context is still reported.
  return violations.filter(
    (v) => !v.inCitationContext || !/\bstolen\s+cryptocurrency\b/i.test(v.match),
  );
}
