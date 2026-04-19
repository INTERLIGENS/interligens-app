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
import { isAdminSessionFromCookies } from "@/lib/security/adminAuth";

const COOKIE_NAME = "investigator_session";

/**
 * BETA MODE — soft gate.
 *
 * History: the gate previously assumed every session MUST have a fully
 * onboarded InvestigatorProfile and redirected otherwise. This broke every
 * pre-existing beta tester, who has a valid session cookie but no profile
 * row in DB, putting them in a loop to /onboarding/legal.
 *
 * Rules:
 *   - no cookie / invalid session                 → /access
 *   - session valid, NO profile                   → LET THROUGH (legacy)
 *   - profile + SUSPENDED                         → /investigators/suspended
 *   - profile + REVOKED                           → /investigators/revoked
 *   - profile + workspaceActivatedAt == null      → /onboarding/pending
 *   - profile + workspaceActivatedAt != null      → LET THROUGH
 *
 * Return type is nullable: `{ profileId: string | null }`. Legacy testers
 * without a profile row get `null` and flow through unchanged.
 */
export async function enforceInvestigatorAccess(): Promise<{
  profileId: string | null;
}> {
  // Admin founder bypass — the admin_session cookie (HMAC-signed) short-
  // circuits every investigator onboarding / NDA gate. The founder isn't
  // an investigator and must never be funnelled into that flow.
  if (await isAdminSessionFromCookies()) {
    return { profileId: null };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    redirect("/access");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/access");
  }

  const profile = await prisma.investigatorProfile.findUnique({
    where: { accessId: session.accessId },
    select: { id: true, accessState: true, workspaceActivatedAt: true },
  });

  // Legacy beta tester: valid session, no profile row yet → let through.
  // Future onboarding flows will create the profile when identity is
  // submitted; from that point the workspaceActivatedAt gate applies.
  if (!profile) {
    return { profileId: null };
  }

  if (profile.accessState === "SUSPENDED") {
    redirect("/investigators/suspended");
  }
  if (profile.accessState === "REVOKED") {
    redirect("/investigators/revoked");
  }

  // Hard gate: a profile exists but admin has not activated the workspace.
  // Send the user to the pending-review screen until admin flips the flag.
  if (!profile.workspaceActivatedAt) {
    redirect("/investigators/onboarding/pending");
  }

  return { profileId: profile.id };
}

/**
 * Gate for the pending-review screen itself.
 *
 * Prevents the main gate's redirect loop (pending would otherwise bounce to
 * itself) AND kicks activated users forward into the workspace instead of
 * letting them sit on the holding page.
 *
 *   - no cookie / invalid session                 → /access
 *   - no profile                                  → LET THROUGH (legacy)
 *   - profile + SUSPENDED / REVOKED               → appropriate terminal
 *   - profile + workspaceActivatedAt != null      → /investigators/dashboard
 *   - profile + workspaceActivatedAt == null      → LET THROUGH (render)
 */
export async function enforcePendingScreen(): Promise<void> {
  // Admin founder bypass — same rationale as enforceInvestigatorAccess.
  if (await isAdminSessionFromCookies()) {
    redirect("/investigators/dashboard");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    redirect("/access");
  }

  const session = await validateSession(token);
  if (!session) {
    redirect("/access");
  }

  const profile = await prisma.investigatorProfile.findUnique({
    where: { accessId: session.accessId },
    select: { accessState: true, workspaceActivatedAt: true },
  });

  if (!profile) return;

  if (profile.accessState === "SUSPENDED") {
    redirect("/investigators/suspended");
  }
  if (profile.accessState === "REVOKED") {
    redirect("/investigators/revoked");
  }

  if (profile.workspaceActivatedAt) {
    redirect("/investigators/dashboard");
  }
}

/**
 * Soft gate for onboarding surfaces (legal / identity / welcome / legal doc API).
 *
 * Onboarding steps must be reachable BEFORE the workspace is activated, so we
 * can't use enforceInvestigatorAccess() (which kicks non-activated users to the
 * pending page). We still need to block unauthenticated users and terminal states.
 *
 *   - no cookie / invalid session       → /access (or 401 for API)
 *   - SUSPENDED                         → /investigators/suspended
 *   - REVOKED                           → /investigators/revoked
 *   - otherwise (with or without profile) → LET THROUGH
 *
 * Returns the resolved access/profile IDs so API routes can attribute writes.
 */
export async function enforceOnboardingAccess(): Promise<{
  accessId: string;
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

  const profile = await prisma.investigatorProfile.findUnique({
    where: { accessId: session.accessId },
    select: { id: true, accessState: true },
  });

  if (profile?.accessState === "SUSPENDED") {
    redirect("/investigators/suspended");
  }
  if (profile?.accessState === "REVOKED") {
    redirect("/investigators/revoked");
  }

  return { accessId: session.accessId, profileId: profile?.id ?? null };
}

/**
 * Same as enforceOnboardingAccess but for API routes: returns null on failure
 * instead of redirecting. The route handler decides how to respond (usually 401).
 */
export async function validateOnboardingSessionForApi(): Promise<{
  accessId: string;
  profileId: string | null;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  if (!token) return null;

  const session = await validateSession(token);
  if (!session) return null;

  const profile = await prisma.investigatorProfile.findUnique({
    where: { accessId: session.accessId },
    select: { id: true, accessState: true },
  });

  if (profile?.accessState === "SUSPENDED" || profile?.accessState === "REVOKED") {
    return null;
  }

  return { accessId: session.accessId, profileId: profile?.id ?? null };
}
