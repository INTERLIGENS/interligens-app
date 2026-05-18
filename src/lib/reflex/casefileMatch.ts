/**
 * REFLEX V1 — exact casefile match.
 *
 * Spec V1 rule (relaxed from the original "similarity > 0.75"): match
 * exact by tokenMint OR wallet address OR handle referenced in a caseId.
 * Fuzzy similarity is V2.
 *
 * A positive match is a STOP trigger on its own (per spec). The query
 * favours direct token→case links via KolTokenLink.caseId, then falls
 * back to wallet→handle→case attribution.
 */
import { prisma } from "@/lib/prisma";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
} from "./types";

export type CasefileMatchResult = {
  matched: boolean;
  matchedVia: "kolCase.kolHandle" | "kolTokenLink" | "kolWallet→kolCase" | null;
  matchedHandle: string | null;
  caseIds: string[];
};

export async function runCasefileMatch(
  input: ReflexResolvedInput,
): Promise<ReflexEngineOutput<CasefileMatchResult>> {
  const start = Date.now();
  const ms = () => Date.now() - start;

  let result: CasefileMatchResult = {
    matched: false,
    matchedVia: null,
    matchedHandle: null,
    caseIds: [],
  };

  try {
    if (input.type === "X_HANDLE" && input.handle) {
      const cases = await prisma.kolCase.findMany({
        where: { kolHandle: { equals: input.handle, mode: "insensitive" } },
        select: { caseId: true },
      });
      const ids = Array.from(new Set(cases.map((c) => c.caseId)));
      if (ids.length > 0) {
        result = {
          matched: true,
          matchedVia: "kolCase.kolHandle",
          matchedHandle: input.handle,
          caseIds: ids,
        };
      }
    } else if (input.address) {
      // Try the token→case shortcut first (KolTokenLink.caseId is the
      // editorial link a curator sets when documenting a case).
      const tokenLinks = await prisma.kolTokenLink.findMany({
        where: {
          contractAddress: { equals: input.address, mode: "insensitive" },
        },
        select: { kolHandle: true, caseId: true },
      });
      const linkCaseIds = tokenLinks
        .map((l) => l.caseId)
        .filter((c): c is string => !!c);
      if (linkCaseIds.length > 0) {
        result = {
          matched: true,
          matchedVia: "kolTokenLink",
          matchedHandle: tokenLinks[0]?.kolHandle ?? null,
          caseIds: Array.from(new Set(linkCaseIds)),
        };
      } else {
        // Fall back to wallet attribution: address → KolWallet → KolCase.
        const wallets = await prisma.kolWallet.findMany({
          where: { address: { equals: input.address, mode: "insensitive" } },
          select: { kolHandle: true },
        });
        for (const w of wallets) {
          const cases = await prisma.kolCase.findMany({
            where: { kolHandle: w.kolHandle },
            select: { caseId: true },
          });
          if (cases.length > 0) {
            result = {
              matched: true,
              matchedVia: "kolWallet→kolCase",
              matchedHandle: w.kolHandle,
              caseIds: Array.from(new Set(cases.map((c) => c.caseId))),
            };
            break;
          }
        }
      }
    }

    const signals: ReflexSignal[] = [];
    if (result.matched) {
      signals.push({
        source: "casefileMatch",
        code: "casefileMatch.exact",
        severity: "CRITICAL",
        confidence: 1.0,
        stopTrigger: true,
        reasonEn: "Address matches a known risk pattern.",
        reasonFr: "L'adresse correspond à un schéma de risque connu.",
        payload: {
          matchedVia: result.matchedVia,
          matchedHandle: result.matchedHandle,
          caseIds: result.caseIds,
        },
      });
    }

    return {
      engine: "casefileMatch",
      ran: true,
      ms: ms(),
      signals,
      raw: result,
    };
  } catch (e) {
    return {
      engine: "casefileMatch",
      ran: false,
      ms: ms(),
      signals: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
