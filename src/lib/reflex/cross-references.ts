/**
 * REFLEX V1 — cross-reference lookups for investigator detail view.
 *
 * Returns links to the existing KOL profile route (/{locale}/kol/{handle})
 * and to the investigator casefile route (/investigators/box/cases/{caseId})
 * when the analysis input matches a KolProfile or a published casefile.
 *
 * Pure Prisma reads, no side effects.
 */
import { prisma } from "@/lib/prisma";
import type { InvestigatorLocale } from "./investigator-copy";

export interface KolProfileRef {
  handle: string;
  displayName: string | null;
  url: string;
}

export interface CasefileRef {
  caseId: string;
  url: string;
}

export interface CrossReferences {
  kolProfile: KolProfileRef | null;
  casefiles: CasefileRef[];
}

export interface CrossReferenceInput {
  handle: string | null;
  address: string | null;
}

export async function lookupCrossReferences(
  input: CrossReferenceInput,
  locale: InvestigatorLocale,
): Promise<CrossReferences> {
  const refs: CrossReferences = { kolProfile: null, casefiles: [] };

  // KOL profile match by handle (case-insensitive).
  if (input.handle) {
    const kol = await prisma.kolProfile.findFirst({
      where: { handle: { equals: input.handle, mode: "insensitive" } },
      select: { handle: true, displayName: true },
    });
    if (kol) {
      refs.kolProfile = {
        handle: kol.handle,
        displayName: kol.displayName ?? null,
        url: `/${locale}/kol/${kol.handle}`,
      };
    }
  }

  // Casefile match: token address linked to a caseId via KolTokenLink.
  if (input.address) {
    const links = await prisma.kolTokenLink.findMany({
      where: {
        contractAddress: { equals: input.address, mode: "insensitive" },
        caseId: { not: null },
      },
      select: { caseId: true },
    });
    const caseIds = Array.from(
      new Set(
        links.map((l) => l.caseId).filter((c): c is string => typeof c === "string"),
      ),
    );
    refs.casefiles = caseIds.map((caseId) => ({
      caseId,
      // /investigators/box/cases/{caseId} is locale-agnostic by design —
      // the existing investigator case detail route does not carry a
      // locale prefix in this repo.
      url: `/investigators/box/cases/${caseId}`,
    }));
  }

  return refs;
}
