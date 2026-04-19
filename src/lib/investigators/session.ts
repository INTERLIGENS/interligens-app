/**
 * Server-side session → investigator-profile resolver for API routes.
 *
 * This helper exists so route handlers that accept an investigator
 * `profileId` in their request body never trust that value on its own.
 * They derive the authoritative profileId from the signed session cookie
 * and either (a) overwrite the body value with it or (b) verify they
 * match. Either way, an attacker cannot target a profile they don't own
 * via a forged body — the foundation of the IDOR class of bugs.
 *
 * Returned shape:
 *   - `null`          — no cookie, expired/revoked session, or access
 *                       row missing / deactivated. Route should 401.
 *   - `{ accessId, profileId: null }` — valid session for a legacy beta
 *                       tester who has no `InvestigatorProfile` row yet.
 *                       Routes that don't require a profile (e.g. the
 *                       NDA acceptance during onboarding, which creates
 *                       the linkage after the fact) can still proceed.
 *   - `{ accessId, profileId: <id> }` — fully onboarded investigator.
 *
 * Design note: we deliberately do NOT reuse `getVaultWorkspace` here —
 * that helper resolves `VaultProfile`, a different table from
 * `InvestigatorProfile`. The two coexist and have distinct primary keys,
 * so conflating them would silently compare IDs from unrelated rows.
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  hashSHA256,
} from "@/lib/security/investigatorAuth";

export interface InvestigatorSessionContext {
  /** InvestigatorAccess.id — also the canonical betaCodeId. */
  accessId: string;
  /** InvestigatorProfile.id, or null for legacy testers with no profile row. */
  profileId: string | null;
}

export async function getInvestigatorSessionContext(
  req: NextRequest,
): Promise<InvestigatorSessionContext | null> {
  const token = getSessionTokenFromReq(req);
  if (!token) return null;

  const session = await prisma.investigatorSession.findFirst({
    where: {
      sessionTokenHash: hashSHA256(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { access: { select: { id: true, isActive: true } } },
  });
  if (!session || !session.access || !session.access.isActive) return null;

  const profile = await prisma.investigatorProfile.findUnique({
    where: { accessId: session.access.id },
    select: { id: true },
  });

  return {
    accessId: session.access.id,
    profileId: profile?.id ?? null,
  };
}
