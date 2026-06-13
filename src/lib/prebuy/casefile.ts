/**
 * PRE-BUY GUARD — published-casefile presence layer.
 *
 * REFLEX's casefileMatch source only keys an address against
 * KolTokenLink.contractAddress + KolCase-by-handle. That misses two real
 * sources of a published case file about a token:
 *
 *   1. TokenCaseFile rows (publishStatus="published") whose contractAddresses
 *      JSON maps a chain → this mint. Typed `String` in Prisma but jsonb in
 *      Postgres → queried with raw SQL (jsonb_each_text over the values).
 *   2. The hardcoded preset cases (BOTIFY / VINE) which have NO DB row and
 *      live only in MINT_TO_CASEFILE_PRESET / kolHandleToCasefilePreset.
 *
 * This helper unions both so the fusion layer's "published casefile" escalator
 * fires for the flagship cases. Read-only, fail-soft.
 */
import { prisma } from "@/lib/prisma";
import {
  mintToCasefilePreset,
  kolHandleToCasefilePreset,
} from "@/lib/casefile/presets";

export interface CasefilePresenceSource {
  kind: "preset" | "token_casefile";
  ref: string;
  url?: string;
}

export interface CasefilePresence {
  present: boolean;
  sources: CasefilePresenceSource[];
  reason: string;
}

async function findPublishedTokenCasefiles(
  mint: string,
): Promise<{ ref: string; ticker: string }[]> {
  try {
    return await prisma.$queryRawUnsafe<{ ref: string; ticker: string }[]>(
      `SELECT ref, ticker FROM token_casefiles
       WHERE "publishStatus" = 'published'
         AND EXISTS (
           SELECT 1 FROM jsonb_each_text(("contractAddresses")::jsonb) AS e(k, v)
           WHERE lower(v) = lower($1)
         )
       LIMIT 10`,
      mint,
    );
  } catch {
    return [];
  }
}

export async function getCasefilePresence(
  tokenMint: string,
  _chain: string,
  handle?: string | null,
): Promise<CasefilePresence> {
  const mint = (tokenMint || "").trim();
  const sources: CasefilePresenceSource[] = [];

  // 1. Preset cases (BOTIFY/VINE) — by mint, then by referring handle.
  const presetByMint = mintToCasefilePreset(mint);
  const presetByHandle = handle ? kolHandleToCasefilePreset(handle) : null;
  const preset = presetByMint ?? presetByHandle;
  if (preset) {
    sources.push({
      kind: "preset",
      ref: `preset:${preset}`,
      url: presetByMint
        ? `/api/casefile/public?mint=${encodeURIComponent(mint)}`
        : `/api/casefile/public?handle=${encodeURIComponent(handle ?? "")}`,
    });
  }

  // 2. Published TokenCaseFile rows referencing this mint.
  if (mint) {
    for (const row of await findPublishedTokenCasefiles(mint)) {
      sources.push({
        kind: "token_casefile",
        ref: row.ref,
        url: `/en/cases`,
      });
    }
  }

  return {
    present: sources.length > 0,
    sources,
    reason:
      sources.length > 0
        ? `${sources.length} published case file source(s): ${sources
            .map((s) => s.ref)
            .join(", ")}`
        : "no published case file references this mint or referring handle",
  };
}
