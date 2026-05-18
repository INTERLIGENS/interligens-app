/**
 * REFLEX V1 — output language lint.
 *
 * Banned: wording that suggests safety/approval, or makes a predictive
 * claim about future criminal behavior. The list is consulted before any
 * REFLEX user-facing string is returned or persisted, and is also run as
 * a CI gate against every template in src/lib/reflex/constants.ts.
 *
 * Allowed phrases are pre-stripped from the input so phrases like
 * "we did not verify this project as safe" (which legitimately contains
 * "safe") do not trigger a false positive.
 *
 * Word boundaries use Unicode-aware lookarounds (\p{L}\p{N}_) rather
 * than the ASCII-only \b, so French accented variants like "approuvé"
 * match correctly without leaking into "approuvons" (different stem).
 */

import type { ForbiddenMatch } from "./types";

/**
 * Build a regex matching `core` only when surrounded by non-letter,
 * non-digit, non-underscore characters (or string edges).
 */
function bw(core: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${core})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
}

const ALLOWED_PHRASES: readonly RegExp[] = [
  // EN — exact spec allowlist
  bw("documented risk signals?"),
  bw("no critical risk signals? detected with current sources?"),
  bw("this is not a safety guarantee"),
  bw("matches? a known risk pattern"),
  bw("we did not verify this project as safe"),
  bw("evidence-based risk check"),
  bw("absence of signal is not a guarantee"),
  bw("we do not approve(?: assets?)?"),
  // FR — spec allowlist + idiomatic negations used in MICRO_COPY
  bw("signaux de risque documentée?s?"),
  bw("aucun signal de risque critique détectée?s? avec les sources actuelles?"),
  bw("ce n'?est pas une garantie de sécurité"),
  bw("correspond à un schéma de risque connu"),
  bw("nous n'?avons pas vérifié ce projet comme étant sûr"),
  bw("vérification de risque basée sur des preuves"),
  bw("l'?absence de signal n'?est pas une garantie"),
  bw("nous n'?approuvons pas(?: d'?actifs?)?"),
];

interface BannedPattern {
  pattern: RegExp;
  token: string;
}

const BANNED_PATTERNS: readonly BannedPattern[] = [
  // EN — absolute spec ban list
  { pattern: bw("safe"), token: "safe" },
  { pattern: bw("approved"), token: "approved" },
  { pattern: bw("certified"), token: "certified" },
  { pattern: bw("guaranteed"), token: "guaranteed" },
  { pattern: bw("clean"), token: "clean" },
  { pattern: bw("trusted"), token: "trusted" },
  { pattern: bw("verified safe"), token: "verified safe" },
  { pattern: bw("green light"), token: "green light" },
  { pattern: bw("all clear"), token: "all clear" },
  { pattern: bw("scam(?:mers?)?"), token: "scam" },
  { pattern: bw("fraudsters?"), token: "fraudster" },
  { pattern: bw("criminals?"), token: "criminal" },
  // Predictive rug-pull constructs only; factual past tense remains allowed.
  { pattern: bw("will rug"), token: "will rug" },
  { pattern: bw("going to rug"), token: "going to rug" },
  { pattern: bw("about to rug"), token: "about to rug" },
  // FR — equivalents
  { pattern: bw("sûre?s?"), token: "sûr" },
  { pattern: bw("approuvée?s?"), token: "approuvé" },
  { pattern: bw("certifiée?s?"), token: "certifié" },
  { pattern: bw("garantis?"), token: "garanti" },
  { pattern: bw("sécurisée?s?"), token: "sécurisé" },
  { pattern: bw("validée?s?"), token: "validé" },
  { pattern: bw("sans risques?"), token: "sans risque" },
  { pattern: bw("feu vert"), token: "feu vert" },
  { pattern: bw("arnaque(?:urs?|s)?"), token: "arnaque" },
  { pattern: bw("escrocs?"), token: "escroc" },
  { pattern: bw("escroqueries?"), token: "escroquerie" },
  { pattern: bw("fraudeurs?"), token: "fraudeur" },
  { pattern: bw("criminel(?:le?)?s?"), token: "criminel" },
  { pattern: bw("va rug"), token: "va rug" },
];

export class ForbiddenWordError extends Error {
  readonly matches: readonly ForbiddenMatch[];
  readonly source: string;
  constructor(matches: readonly ForbiddenMatch[], source: string) {
    const tokens = Array.from(new Set(matches.map((m) => m.token))).join(", ");
    super(`Forbidden words detected in ${source}: ${tokens}`);
    this.name = "ForbiddenWordError";
    this.matches = matches;
    this.source = source;
  }
}

function joinInput(input: string | readonly string[]): string {
  return typeof input === "string" ? input : input.join("\n");
}

function normalize(text: string): string {
  // Fold curly apostrophes to ASCII so spec allowlist patterns match
  // regardless of which quote style the upstream string uses.
  return text.replace(/[‘’]/g, "'");
}

function stripAllowedPhrases(text: string): string {
  let out = text;
  for (const phrase of ALLOWED_PHRASES) {
    out = out.replace(phrase, " ");
  }
  return out;
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length + 20);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Return every banned-token match in `input`. Empty array when clean.
 * Allowed phrases are pre-stripped before scanning.
 */
export function findForbidden(
  input: string | readonly string[],
): ForbiddenMatch[] {
  const joined = normalize(joinInput(input));
  if (!joined) return [];
  const stripped = stripAllowedPhrases(joined);
  const matches: ForbiddenMatch[] = [];
  for (const { pattern, token } of BANNED_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(stripped)) !== null) {
      matches.push({
        token,
        snippet: snippetAround(stripped, m.index, m[0].length),
        index: m.index,
      });
    }
  }
  return matches;
}

/**
 * Throw ForbiddenWordError if any banned token is present.
 * `source` is a diagnostic label, e.g. "VERDICT_WORDING.STOP.en".
 */
export function assertClean(
  input: string | readonly string[],
  source: string = "reflex output",
): void {
  const matches = findForbidden(input);
  if (matches.length > 0) {
    throw new ForbiddenWordError(matches, source);
  }
}

/** Non-throwing convenience: returns true when input is clean. */
export function isClean(input: string | readonly string[]): boolean {
  return findForbidden(input).length === 0;
}
