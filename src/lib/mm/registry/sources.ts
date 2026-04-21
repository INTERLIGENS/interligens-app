import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MmCredTier, MmSourceType } from "../types";
import { writeReviewLog } from "./reviewLog";

export interface CreateSourceInput {
  publisher: string;
  sourceType: MmSourceType;
  url: string;
  title: string;
  credibilityTier: MmCredTier;
  author?: string | null;
  publishedAt?: Date | null;
  language?: string;
  notes?: string | null;
  localSnapshot?: string | null;
  archivedUrl?: string | null;
}

export async function createSource(
  input: CreateSourceInput,
  actor: { userId: string; role: string },
) {
  if (!input.url.startsWith("http")) {
    throw new Error("createSource: url must start with http");
  }
  if (!input.publisher.trim() || !input.title.trim()) {
    throw new Error("createSource: publisher and title required");
  }
  return prisma.$transaction(async (tx) => {
    const source = await tx.mmSource.create({
      data: {
        publisher: input.publisher,
        sourceType: input.sourceType,
        url: input.url,
        title: input.title,
        credibilityTier: input.credibilityTier,
        author: input.author ?? null,
        publishedAt: input.publishedAt ?? null,
        language: input.language ?? "en",
        notes: input.notes ?? null,
        localSnapshot: input.localSnapshot ?? null,
        archivedUrl: input.archivedUrl ?? null,
        archivalStatus: input.localSnapshot ? "SUCCESS" : "PENDING",
      },
    });
    await writeReviewLog({
      tx,
      targetType: "SOURCE",
      targetId: source.id,
      action: "CREATED",
      actorUserId: actor.userId,
      actorRole: actor.role,
      snapshotAfter: source as unknown as Prisma.InputJsonValue,
    });
    return source;
  });
}

export async function findSourceById(id: string) {
  return prisma.mmSource.findUnique({ where: { id } });
}

export async function listSources(opts?: { sourceType?: MmSourceType; limit?: number }) {
  return prisma.mmSource.findMany({
    where: opts?.sourceType ? { sourceType: opts.sourceType } : {},
    orderBy: { fetchedAt: "desc" },
    take: opts?.limit ?? 100,
  });
}
