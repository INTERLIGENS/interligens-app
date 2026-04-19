/**
 * Resolve the current investigator's display handle from the session
 * cookie. Falls back to "investigator" if anything is missing so call
 * sites never have to branch on null.
 *
 * Used by server-rendered pages that need the handle for watermarks or
 * personalisation. Keep it side-effect free.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/security/investigatorAuth";

export async function getCurrentInvestigatorHandle(): Promise<string> {
  try {
    const store = await cookies();
    const token = store.get("investigator_session")?.value ?? null;
    if (!token) return "investigator";
    const session = await validateSession(token);
    if (!session) return "investigator";
    const vp = await prisma.vaultProfile.findUnique({
      where: { investigatorAccessId: session.accessId },
      select: { handle: true },
    });
    if (vp?.handle) return vp.handle;
    const ip = await prisma.investigatorProfile.findUnique({
      where: { accessId: session.accessId },
      select: { handle: true },
    });
    return ip?.handle ?? "investigator";
  } catch {
    return "investigator";
  }
}
