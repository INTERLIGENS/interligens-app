// Provision a brand-new InvestigatorAccess for a Beta Founder payer, then
// email them their access code via the existing Resend pipeline. Returns the
// new access id (so the webhook can back-fill BetaFounderAccess.userId).
//
// Decision 3 reminder: proxy.ts is unchanged in Phase 1, so granting an
// InvestigatorAccess is what actually unlocks the legacy beta gate for the
// payer. The Entitlement created in parallel is for Phase 2.

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendAccessCodeEmail } from "@/lib/email/accessCodeDelivery";

function hashSHA256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface GrantAccessInput {
  email: string;
  labelHint?: string | null; // optional descriptive label for admin UI
  stripeCheckoutSessionId: string;
  sendEmail?: boolean; // default true; set false in tests
}

export interface GrantAccessResult {
  investigatorAccessId: string;
  emailDelivered: boolean | "skipped";
  emailError?: string;
}

export async function provisionBetaFounderAccess(input: GrantAccessInput): Promise<GrantAccessResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const shortSession = input.stripeCheckoutSessionId.slice(-8);
  const label = (input.labelHint?.trim() || `BF-${shortSession}`).slice(0, 64);

  const code = randomBytes(16).toString("hex"); // 32-char hex
  const codeHash = hashSHA256(code);

  const access = await prisma.investigatorAccess.create({
    data: {
      label,
      accessCodeHash: codeHash,
      notes: `beta_founder_1eur · ${normalizedEmail} · session=${input.stripeCheckoutSessionId}`,
    },
  });

  if (input.sendEmail === false) {
    return { investigatorAccessId: access.id, emailDelivered: "skipped" };
  }

  const send = await sendAccessCodeEmail({
    email: normalizedEmail,
    accessCode: code,
    label,
  });
  if (send.delivered) {
    return { investigatorAccessId: access.id, emailDelivered: true };
  }
  return {
    investigatorAccessId: access.id,
    emailDelivered: false,
    emailError: send.skipped ?? send.error,
  };
}
