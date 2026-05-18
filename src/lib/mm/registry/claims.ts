import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MmClaimType, MmPubStatus } from "../types";
import { writeReviewLog } from "./reviewLog";

export interface CreateClaimInput {
  mmEntityId: string;
  claimType: MmClaimType;
  text: string;
  sourceId: string;
  textFr?: string | null;
  jurisdiction?: string | null;
  orderIndex?: number;
}

export async function createClaim(
  input: CreateClaimInput,
  actor: { userId: string; role: string },
) {
  if (!input.text.trim()) throw new Error("createClaim: text required");

  return prisma.$transaction(async (tx) => {
    const source = await tx.mmSource.findUnique({ where: { id: input.sourceId } });
    if (!source) throw new Error(`createClaim: sourceId ${input.sourceId} not found`);
    if (source.archivalStatus === "R2_FAIL") {
      throw new Error(
        `createClaim: source ${input.sourceId} has R2_FAIL archival — publication blocked`,
      );
    }
    const entity = await tx.mmEntity.findUnique({ where: { id: input.mmEntityId } });
    if (!entity) throw new Error(`createClaim: entity ${input.mmEntityId} not found`);

    const claim = await tx.mmClaim.create({
      data: {
        mmEntityId: input.mmEntityId,
        claimType: input.claimType,
        text: input.text,
        textFr: input.textFr ?? null,
        sourceId: input.sourceId,
        jurisdiction: input.jurisdiction ?? null,
        orderIndex: input.orderIndex ?? 0,
        publishStatus: "DRAFT",
      },
    });
    await writeReviewLog({
      tx,
      targetType: "CLAIM",
      targetId: claim.id,
      action: "CREATED",
      actorUserId: actor.userId,
      actorRole: actor.role,
      snapshotAfter: claim as unknown as Prisma.InputJsonValue,
    });
    return claim;
  });
}

export async function setClaimPublishStatus(
  claimId: string,
  next: MmPubStatus,
  actor: { userId: string; role: string },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.mmClaim.findUnique({ where: { id: claimId } });
    if (!before) throw new Error(`setClaimPublishStatus: claim ${claimId} not found`);

    if (next === "PUBLISHED") {
      const source = await tx.mmSource.findUnique({ where: { id: before.sourceId } });
      if (!source) throw new Error("setClaimPublishStatus: source missing");
      if (source.archivalStatus === "R2_FAIL" || source.archivalStatus === "PENDING") {
        throw new Error(
          `setClaimPublishStatus: cannot publish — source archival is ${source.archivalStatus}`,
        );
      }
    }

    const after = await tx.mmClaim.update({
      where: { id: claimId },
      data: {
        publishStatus: next,
        publishedAt: next === "PUBLISHED" ? new Date() : before.publishedAt,
      },
    });
    await writeReviewLog({
      tx,
      targetType: "CLAIM",
      targetId: claimId,
      action:
        next === "PUBLISHED"
          ? "PUBLISHED"
          : next === "RETRACTED"
            ? "RETRACTED"
            : next === "REVIEWED"
              ? "REVIEWED"
              : "EDITED",
      actorUserId: actor.userId,
      actorRole: actor.role,
      snapshotBefore: before as unknown as Prisma.InputJsonValue,
      snapshotAfter: after as unknown as Prisma.InputJsonValue,
    });
    return after;
  });
}

export async function listClaimsForEntity(mmEntityId: string, publishStatus?: MmPubStatus) {
  return prisma.mmClaim.findMany({
    where: {
      mmEntityId,
      ...(publishStatus ? { publishStatus } : {}),
    },
    include: { source: true },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });
}
