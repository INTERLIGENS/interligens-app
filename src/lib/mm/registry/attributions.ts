import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MmAttribMethod, MmChain } from "../types";
import { writeReviewLog } from "./reviewLog";

export interface CreateAttributionInput {
  walletAddress: string;
  chain: MmChain;
  mmEntityId: string;
  attributionMethod: MmAttribMethod;
  confidence: number;
  evidenceRefs: Array<{ sourceId: string; description: string }>;
  reviewerUserId?: string | null;
}

export const MIN_CONFIDENCE_AUTO = 0.85;
export const MIN_CONFIDENCE_REVIEW = 0.7;
export const INFERRED_CLUSTER_CAP = 0.7;

export async function createAttribution(
  input: CreateAttributionInput,
  actor: { userId: string; role: string },
) {
  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error("createAttribution: confidence must be in [0,1]");
  }
  if (input.confidence < MIN_CONFIDENCE_REVIEW) {
    throw new Error(
      `createAttribution: confidence ${input.confidence} below review threshold ${MIN_CONFIDENCE_REVIEW}`,
    );
  }
  if (
    input.attributionMethod === "INFERRED_CLUSTER" &&
    input.confidence > INFERRED_CLUSTER_CAP
  ) {
    throw new Error(
      `createAttribution: INFERRED_CLUSTER is capped at confidence ${INFERRED_CLUSTER_CAP}`,
    );
  }
  if (!input.evidenceRefs.length) {
    throw new Error("createAttribution: at least one evidence ref required");
  }

  return prisma.$transaction(async (tx) => {
    const entity = await tx.mmEntity.findUnique({ where: { id: input.mmEntityId } });
    if (!entity) throw new Error(`createAttribution: entity ${input.mmEntityId} not found`);

    const existing = await tx.mmAttribution.findFirst({
      where: {
        walletAddress: input.walletAddress,
        chain: input.chain,
        mmEntityId: input.mmEntityId,
        revokedAt: null,
      },
    });
    if (existing) {
      throw new Error(
        `createAttribution: active attribution already exists for wallet ${input.walletAddress} on ${input.chain}`,
      );
    }

    const attribution = await tx.mmAttribution.create({
      data: {
        walletAddress: input.walletAddress,
        chain: input.chain,
        mmEntityId: input.mmEntityId,
        attributionMethod: input.attributionMethod,
        confidence: input.confidence,
        evidenceRefs: input.evidenceRefs as unknown as Prisma.InputJsonValue,
        reviewerUserId: input.reviewerUserId ?? null,
        reviewedAt:
          input.confidence >= MIN_CONFIDENCE_AUTO && input.reviewerUserId
            ? new Date()
            : null,
      },
    });
    await writeReviewLog({
      tx,
      targetType: "ATTRIBUTION",
      targetId: attribution.id,
      action: "CREATED",
      actorUserId: actor.userId,
      actorRole: actor.role,
      snapshotAfter: attribution as unknown as Prisma.InputJsonValue,
    });
    return attribution;
  });
}

export async function revokeAttribution(
  id: string,
  reason: string,
  actor: { userId: string; role: string },
) {
  if (!reason.trim()) throw new Error("revokeAttribution: reason required");
  return prisma.$transaction(async (tx) => {
    const before = await tx.mmAttribution.findUnique({ where: { id } });
    if (!before) throw new Error(`revokeAttribution: ${id} not found`);
    if (before.revokedAt) return before;
    const after = await tx.mmAttribution.update({
      where: { id },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    await writeReviewLog({
      tx,
      targetType: "ATTRIBUTION",
      targetId: id,
      action: "RETRACTED",
      actorUserId: actor.userId,
      actorRole: actor.role,
      notes: reason,
      snapshotBefore: before as unknown as Prisma.InputJsonValue,
      snapshotAfter: after as unknown as Prisma.InputJsonValue,
    });
    return after;
  });
}

export async function lookupAttribution(walletAddress: string, chain: MmChain) {
  return prisma.mmAttribution.findFirst({
    where: {
      walletAddress,
      chain,
      revokedAt: null,
      confidence: { gte: MIN_CONFIDENCE_REVIEW },
    },
    orderBy: { confidence: "desc" },
    include: { mmEntity: true },
  });
}
