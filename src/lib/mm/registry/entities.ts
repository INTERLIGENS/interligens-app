import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MmRiskBand, MmStatus, MmWorkflow } from "../types";
import { MM_STATUS_DEFAULT_SCORE_RANGE, MM_STATUS_TO_RISK_BAND } from "../types";
import { writeReviewLog } from "./reviewLog";

export interface CreateEntityInput {
  slug: string;
  name: string;
  status: MmStatus;
  publicSummary: string;
  legalName?: string | null;
  jurisdiction?: string | null;
  foundedYear?: number | null;
  founders?: string[];
  publicSummaryFr?: string | null;
  knownAliases?: string[];
  officialDomains?: string[];
  defaultScore?: number;
  riskBand?: MmRiskBand;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function assertValidSlug(slug: string) {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`invalid slug: "${slug}" (expected kebab-case a-z0-9)`);
  }
}

export function defaultScoreFor(status: MmStatus): number {
  const range = MM_STATUS_DEFAULT_SCORE_RANGE[status];
  if (range.max === 0) return 0;
  return Math.round((range.min + range.max) / 2);
}

export async function createEntity(
  input: CreateEntityInput,
  actor: { userId: string; role: string },
) {
  assertValidSlug(input.slug);
  if (!input.name.trim()) throw new Error("createEntity: name required");
  if (!input.publicSummary.trim()) throw new Error("createEntity: publicSummary required");

  const defaultScore = input.defaultScore ?? defaultScoreFor(input.status);
  const riskBand = input.riskBand ?? MM_STATUS_TO_RISK_BAND[input.status];

  return prisma.$transaction(async (tx) => {
    const entity = await tx.mmEntity.create({
      data: {
        slug: input.slug,
        name: input.name,
        status: input.status,
        riskBand,
        defaultScore,
        publicSummary: input.publicSummary,
        legalName: input.legalName ?? null,
        jurisdiction: input.jurisdiction ?? null,
        foundedYear: input.foundedYear ?? null,
        founders: input.founders ?? [],
        publicSummaryFr: input.publicSummaryFr ?? null,
        knownAliases: input.knownAliases ?? [],
        officialDomains: input.officialDomains ?? [],
        workflow: "DRAFT",
      },
    });
    await writeReviewLog({
      tx,
      targetType: "ENTITY",
      targetId: entity.id,
      action: "CREATED",
      actorUserId: actor.userId,
      actorRole: actor.role,
      snapshotAfter: entity as unknown as Prisma.InputJsonValue,
    });
    return entity;
  });
}

export async function findEntityBySlug(slug: string) {
  return prisma.mmEntity.findUnique({ where: { slug } });
}

export async function findEntityById(id: string) {
  return prisma.mmEntity.findUnique({ where: { id } });
}

export async function listEntities(opts?: {
  workflow?: MmWorkflow;
  status?: MmStatus;
  limit?: number;
  offset?: number;
}) {
  return prisma.mmEntity.findMany({
    where: {
      ...(opts?.workflow ? { workflow: opts.workflow } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    skip: opts?.offset ?? 0,
    take: opts?.limit ?? 100,
  });
}

export async function countEntities(opts?: { workflow?: MmWorkflow; status?: MmStatus }) {
  return prisma.mmEntity.count({
    where: {
      ...(opts?.workflow ? { workflow: opts.workflow } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
    },
  });
}

export async function getEntityFull(slug: string) {
  return prisma.mmEntity.findUnique({
    where: { slug },
    include: {
      claims: {
        include: { source: true },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      },
      attributions: {
        where: { revokedAt: null },
        orderBy: { confidence: "desc" },
      },
    },
  });
}

export async function updateEntity(
  id: string,
  patch: Partial<
    Pick<
      CreateEntityInput,
      | "name"
      | "legalName"
      | "jurisdiction"
      | "foundedYear"
      | "founders"
      | "publicSummary"
      | "publicSummaryFr"
      | "knownAliases"
      | "officialDomains"
      | "defaultScore"
      | "riskBand"
    >
  >,
  actor: { userId: string; role: string },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.mmEntity.findUnique({ where: { id } });
    if (!before) throw new Error(`updateEntity: entity ${id} not found`);
    const after = await tx.mmEntity.update({ where: { id }, data: patch });
    await writeReviewLog({
      tx,
      targetType: "ENTITY",
      targetId: id,
      action: "EDITED",
      actorUserId: actor.userId,
      actorRole: actor.role,
      snapshotBefore: before as unknown as Prisma.InputJsonValue,
      snapshotAfter: after as unknown as Prisma.InputJsonValue,
    });
    return after;
  });
}
