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

/**
 * BETA MODE — soft gate.
 *
 * History: the gate previously assumed every session MUST have a fully
 * onboarded InvestigatorProfile and redirected otherwise. This broke every
 * pre-existing beta tester, who has a valid session cookie but no profile
 * row in DB, putting them in a loop to /onboarding/legal.
 *
 * New rule (beta):
 *   - no cookie / invalid session  → /access
 *   - session valid, NO profile    → LET THROUGH (legacy beta testers)
 *   - profile + SUSPENDED          → block
 *   - profile + REVOKED            → block
 *   - anything else                → LET THROUGH (even partial onboarding)
 *
 * Return type is now nullable: `{ profileId: string | null }`. Callers today
 * discard it (see src/app/investigators/box/layout.tsx:42), so this is a
 * compatible widening.
 */
export async function enforceInvestigatorAccess(): Promise<{
  profileId: string | null;
}> {
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
    select: { id: true, accessState: true },
  });

  // Legacy beta tester: valid session, no profile row yet → let through.
  // Future onboarding flows will create the profile on the client side the
  // first time a workspace mutation happens.
  if (!profile) {
    return { profileId: null };
  }

  if (profile.accessState === "SUSPENDED") {
    redirect("/investigators/suspended");
  }
  if (profile.accessState === "REVOKED") {
    redirect("/investigators/revoked");
  }

  return { profileId: profile.id };
}
