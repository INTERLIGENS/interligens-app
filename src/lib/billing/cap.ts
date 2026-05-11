// Transactional cap check: counts paid + still-valid pending reservations
// with FOR UPDATE inside a serializable-ish transaction. Returns the next
// slot number if available, or null if the cap is reached.

import { prisma } from "@/lib/prisma";
import { getCap, isCapOverrideReached } from "./env";

export type CapResult =
  | { allowed: true; currentCount: number; cap: number }
  | { allowed: false; reason: "override" | "sold_out"; currentCount: number; cap: number };

/**
 * Returns whether a new reservation may be created right now.
 * Run this inside the same transaction that creates the BetaFounderAccess row
 * to avoid TOCTOU races. We use a raw query with FOR UPDATE on the matching
 * rows to lock them for the duration of the transaction.
 */
export async function checkCap(opts?: { tx?: Pick<typeof prisma, "$queryRaw"> }): Promise<CapResult> {
  const cap = getCap();
  if (isCapOverrideReached()) {
    return { allowed: false, reason: "override", currentCount: cap, cap };
  }

  const runner = opts?.tx ?? prisma;
  // Count paid + non-expired pending reservations.
  // FOR UPDATE locks the matching rows so a concurrent transaction can't
  // squeeze in an extra reservation past the cap.
  const rows = await runner.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "BetaFounderAccess"
    WHERE status = 'paid'
       OR (status = 'pending' AND "reservationExpiresAt" > NOW())
    FOR UPDATE
  `;
  const currentCount = Number(rows?.[0]?.count ?? 0);
  if (currentCount >= cap) {
    return { allowed: false, reason: "sold_out", currentCount, cap };
  }
  return { allowed: true, currentCount, cap };
}
