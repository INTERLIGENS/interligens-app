/**
 * Server-side access gate for /investigators/box (workspace) pages.
 *
 * Call as the first line of a server component or layout body. Uses
 * next/navigation redirect() which throws internally — the caller never
 * needs to inspect a return value. If the caller is reached with a valid
 * session + profile, returns `{ profileId }` for optional use downstream.
 *
 * CC-DECISION: Next.js edge middleware can't use Prisma directly, so the
 * gate runs as an async server-side helper called from page/layout server
 * components. The existing edge middleware keeps handling simple cookie
 * presence; this gate handles Prisma state checks.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/security/investigatorAuth";

const COOKIE_NAME = "investigator_session";

export async function enforceInvestigatorAccess(): Promise<{ profileId: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    redirect("/access");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/access");
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
    redirect("/investigators/onboarding/legal");
  }

  if (profile.accessState === "SUSPENDED") {
    redirect("/investigators/suspended");
  }
  if (profile.accessState === "REVOKED") {
    redirect("/investigators/revoked");
  }
  if (!profile.ndaAcceptance) {
    redirect("/investigators/onboarding/legal");
  }
  if (!profile.betaTermsAcceptance) {
    redirect("/investigators/onboarding/legal");
  }
  if (!profile.legalFirstName || !profile.legalLastName) {
    redirect("/investigators/onboarding/identity");
  }
  if (profile.accessLevel === "APPLICANT") {
    redirect("/investigators/onboarding/legal");
  }

  return { profileId: profile.id };
}
