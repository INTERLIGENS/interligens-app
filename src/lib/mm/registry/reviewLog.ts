import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MmReviewAction, MmTargetType } from "../types";

export interface ReviewLogInput {
  targetType: MmTargetType;
  targetId: string;
  action: MmReviewAction;
  actorUserId: string;
  actorRole: string;
  notes?: string | null;
  snapshotBefore?: Prisma.InputJsonValue | null;
  snapshotAfter?: Prisma.InputJsonValue | null;
  tx?: Prisma.TransactionClient;
}

export async function writeReviewLog(input: ReviewLogInput) {
  const client = input.tx ?? prisma;
  return client.mmReviewLog.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      action: input.action,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      notes: input.notes ?? null,
      snapshotBefore: input.snapshotBefore ?? Prisma.JsonNull,
      snapshotAfter: input.snapshotAfter ?? Prisma.JsonNull,
    },
  });
}

export async function listReviewLog(
  targetType: MmTargetType,
  targetId: string,
  limit = 50,
) {
  return prisma.mmReviewLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export { Prisma };
