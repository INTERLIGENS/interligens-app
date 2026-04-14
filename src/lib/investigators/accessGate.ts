/**
 * Server-side access gate for /investigators/workspace pages.
 *
 * CC-DECISION: Next.js edge middleware can't use Prisma directly, so the gate
 * is implemented as an async server-side helper. Server components and
 * layouts call `enforceInvestigatorAccess(req)` and get either `null`
 * (allowed) or a redirect target path. The existing edge middleware keeps
 * handling simple cookie presence; this gate handles Prisma state checks.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/security/investigatorAuth";

const COOKIE_NAME = "investigator_session";

export type AccessGateResult =
  | { allowed: true; profileId: string }
  | { allowed: false; redirect: string };

export async function enforceInvestigatorAccess(): Promise<AccessGateResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    return { allowed: false, redirect: "/access" };
  }

  const session = await validateSession(token);
  if (!session) {
    return { allowed: false, redirect: "/access" };
  }

  // Look up the InvestigatorProfile linked to this access (1:1 via accessId).
  const profile = await prisma.investigatorProfile.findUnique({
    where: { accessId: session.accessId },
    include: {
      ndaAcceptance: { select: { id: true } },
      betaTermsAcceptance: { select: { id: true } },
    },
  });

  // No profile yet → still in onboarding, must sign legal docs first
  if (!profile) {
    return { allowed: false, redirect: "/investigators/onboarding/legal" };
  }

  if (profile.accessState === "SUSPENDED") {
    return { allowed: false, redirect: "/investigators/suspended" };
  }
  if (profile.accessState === "REVOKED") {
    return { allowed: false, redirect: "/investigators/revoked" };
  }
  if (!profile.ndaAcceptance) {
    return { allowed: false, redirect: "/investigators/onboarding/legal" };
  }
  if (!profile.betaTermsAcceptance) {
    return { allowed: false, redirect: "/investigators/onboarding/legal" };
  }
  if (!profile.legalFirstName || !profile.legalLastName) {
    return { allowed: false, redirect: "/investigators/onboarding/identity" };
  }
  if (profile.accessLevel === "APPLICANT") {
    return { allowed: false, redirect: "/investigators/onboarding/legal" };
  }

  return { allowed: true, profileId: profile.id };
}
