/**
 * KOL handle → token mint resolution.
 *
 * The retail KOL dossier surfaces two different PDFs:
 *   - Wallet-forensic report  → /api/pdf/kol?handle=...
 *   - Case narrative (CaseFile) → /api/casefile?handle=...  or /api/report/v2?mint=...
 *
 * The second path needs a token mint. KolProfile / KolCase don't hold one
 * directly (KolCase.caseId is a free-form string), so this module is the
 * single source of truth for KOL → mint resolution. Known-BOTIFY KOLs
 * resolve to the BOTIFY Solana mint; unknown handles return null and the
 * caller is expected to fall back to the wallet-forensic path.
 *
 * Keep this list narrow. Any new case with its own mint should land here
 * with a named constant so consumers can grep.
 */

export const BOTIFY_MINT =
  "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";

const BOTIFY_KOLS = new Set<string>([
  // Gordon / bkokoski / Kokoski cluster — the BOTIFY-deal KOL.
  "kokoski",
  "bkokoski",
  "gordongekko",
  "GordonGekko",
  "gordon",
  // Other seed KOLs documented on the BOTIFY leak.
  "sxyz500",
  "lynk0x",
  "planted",
  "DonWedge",
  "donwedge",
]);

/**
 * Returns the primary token mint for the given KOL handle, or null if the
 * handle is not mapped to a known case. Callers MUST handle null.
 */
export function kolHandleToMint(handle: string | null | undefined): string | null {
  if (!handle) return null;
  // Match both the exact handle and its lower-cased form so seed data that
  // writes "GordonGekko" still resolves when a URL passes "gordongekko".
  if (BOTIFY_KOLS.has(handle)) return BOTIFY_MINT;
  if (BOTIFY_KOLS.has(handle.toLowerCase())) return BOTIFY_MINT;
  return null;
}
