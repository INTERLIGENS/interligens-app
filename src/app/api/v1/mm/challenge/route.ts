import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeReviewLog } from "@/lib/mm/registry/reviewLog";
import { dkimPrecheck } from "@/lib/mm/email/dkim";
import type { MmTargetType, MmVerifMethod } from "@/lib/mm/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_TARGET_TYPES: MmTargetType[] = ["ENTITY", "CLAIM", "ATTRIBUTION"];
const VALID_VERIF_METHODS: MmVerifMethod[] = [
  "EMAIL_DKIM",
  "LEGAL_SIGNATURE",
  "OFFICIAL_CHANNEL",
];

interface ChallengeBody {
  targetType?: string;
  targetId?: string;
  challenger?: {
    name?: string;
    email?: string;
    role?: string;
    entity?: string;
  };
  claimedText?: string;
  responseText?: string;
  verificationMethod?: string;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: ChallengeBody;
  try {
    body = (await req.json()) as ChallengeBody;
  } catch {
    return badRequest("invalid_json");
  }

  const { targetType, targetId, challenger, claimedText, responseText, verificationMethod } =
    body;

  if (!targetType || !VALID_TARGET_TYPES.includes(targetType as MmTargetType)) {
    return badRequest("invalid_target_type");
  }
  if (!targetId || typeof targetId !== "string") return badRequest("invalid_target_id");
  if (!challenger?.email || !challenger.name || !challenger.entity) {
    return badRequest("missing_challenger_fields");
  }
  if (!claimedText || !responseText) return badRequest("missing_claim_or_response");
  if (
    !verificationMethod ||
    !VALID_VERIF_METHODS.includes(verificationMethod as MmVerifMethod)
  ) {
    return badRequest("invalid_verification_method");
  }

  // Resolve the target — we only support ENTITY targets with domain-based DKIM.
  let officialDomains: string[] = [];
  let entityIdForLog: string | null = null;

  if (targetType === "ENTITY") {
    const entity = await prisma.mmEntity.findUnique({ where: { id: targetId } });
    if (!entity) return NextResponse.json({ error: "entity_not_found" }, { status: 404 });
    officialDomains = entity.officialDomains;
    entityIdForLog = entity.id;
  } else if (targetType === "CLAIM") {
    const claim = await prisma.mmClaim.findUnique({
      where: { id: targetId },
      include: { mmEntity: true },
    });
    if (!claim) return NextResponse.json({ error: "claim_not_found" }, { status: 404 });
    officialDomains = claim.mmEntity.officialDomains;
    entityIdForLog = claim.mmEntity.id;
  } else if (targetType === "ATTRIBUTION") {
    const attribution = await prisma.mmAttribution.findUnique({
      where: { id: targetId },
      include: { mmEntity: true },
    });
    if (!attribution) {
      return NextResponse.json({ error: "attribution_not_found" }, { status: 404 });
    }
    officialDomains = attribution.mmEntity.officialDomains;
    entityIdForLog = attribution.mmEntity.id;
  }

  // Phase 1: DKIM precheck (domain ownership + resolvability). Full DKIM
  // signature verification happens via an inbound mail worker in a later phase.
  const precheck =
    verificationMethod === "EMAIL_DKIM"
      ? await dkimPrecheck({
          email: challenger.email,
          officialDomains,
        })
      : { ok: false, reason: "manual_review_required" as const };

  const verificationStatus = precheck.ok ? "EMAIL_VERIFIED" : "PENDING";

  const challenge = await prisma.mmChallenge.create({
    data: {
      targetType: targetType as MmTargetType,
      targetId,
      challengerEmail: challenger.email,
      challengerName: challenger.name,
      challengerRole: challenger.role ?? null,
      challengerEntity: challenger.entity,
      claimedText,
      responseText,
      verificationStatus,
      verificationMethod: verificationMethod as MmVerifMethod,
      verifiedAt: precheck.ok ? new Date() : null,
      publishStatus: "DRAFT",
    },
  });

  await writeReviewLog({
    targetType: "CHALLENGE",
    targetId: challenge.id,
    action: "CHALLENGED",
    actorUserId: challenger.email,
    actorRole: "challenger",
    notes: precheck.ok
      ? `dkim precheck OK (domain=${precheck.emailDomain})`
      : `dkim precheck pending: ${precheck.reason ?? "unknown"}`,
    snapshotAfter: {
      challengeId: challenge.id,
      entityId: entityIdForLog,
      precheck: JSON.parse(JSON.stringify(precheck)),
    } as unknown as Prisma.InputJsonValue,
  });

  return NextResponse.json(
    {
      challengeId: challenge.id,
      verificationStatus,
      nextStep: precheck.ok
        ? "Domain email verified. Challenge is now queued for editorial review."
        : `Email domain could not be auto-verified (${precheck.reason ?? "unknown"}). An admin will review manually.`,
      expectedResolutionHours: 72,
    },
    { status: 202 },
  );
}
