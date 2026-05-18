import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ALLOWED_WORKFLOW_TRANSITIONS, type MmWorkflow } from "../types";
import { writeReviewLog } from "./reviewLog";

const TERMINAL_LIKE: readonly MmWorkflow[] = ["UNPUBLISHED"];

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_TRANSITION"
      | "PUBLISH_BLOCKED"
      | "VALIDATION",
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function assertTransition(from: MmWorkflow, to: MmWorkflow): void {
  if (from === to) {
    throw new WorkflowError(`no-op transition ${from} → ${to}`, "INVALID_TRANSITION");
  }
  const allowed = ALLOWED_WORKFLOW_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new WorkflowError(
      `illegal transition ${from} → ${to}. allowed: ${allowed.join(", ") || "(none)"}`,
      "INVALID_TRANSITION",
    );
  }
}

export function isTerminal(state: MmWorkflow): boolean {
  return TERMINAL_LIKE.includes(state);
}

async function assertPublishable(
  tx: Prisma.TransactionClient,
  entityId: string,
): Promise<void> {
  const factClaims = await tx.mmClaim.count({
    where: { mmEntityId: entityId, claimType: "FACT" },
  });
  if (factClaims === 0) {
    throw new WorkflowError(
      "cannot publish: entity must have at least one FACT claim",
      "PUBLISH_BLOCKED",
    );
  }

  const missingArchival = await tx.mmClaim.count({
    where: {
      mmEntityId: entityId,
      source: {
        archivalStatus: { in: ["R2_FAIL", "PENDING"] },
      },
    },
  });
  if (missingArchival > 0) {
    throw new WorkflowError(
      `cannot publish: ${missingArchival} claim(s) have source archival pending or failed`,
      "PUBLISH_BLOCKED",
    );
  }
}

export interface TransitionInput {
  entityId: string;
  to: MmWorkflow;
  actor: { userId: string; role: string };
  notes?: string;
}

export async function transitionEntity(input: TransitionInput) {
  const { entityId, to, actor } = input;
  return prisma.$transaction(async (tx) => {
    const before = await tx.mmEntity.findUnique({ where: { id: entityId } });
    if (!before) {
      throw new WorkflowError(`entity ${entityId} not found`, "NOT_FOUND");
    }
    assertTransition(before.workflow, to);

    if (to === "PUBLISHED") {
      await assertPublishable(tx, entityId);
    }

    const after = await tx.mmEntity.update({
      where: { id: entityId },
      data: {
        workflow: to,
        publishedAt:
          to === "PUBLISHED" ? new Date() : to === "UNPUBLISHED" ? null : before.publishedAt,
      },
    });

    const action =
      to === "REVIEWED"
        ? "REVIEWED"
        : to === "PUBLISHED"
          ? "PUBLISHED"
          : to === "UNPUBLISHED"
            ? "UNPUBLISHED"
            : to === "CHALLENGED"
              ? "CHALLENGED"
              : "EDITED";

    await writeReviewLog({
      tx,
      targetType: "ENTITY",
      targetId: entityId,
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      notes: input.notes ?? null,
      snapshotBefore: before as unknown as Prisma.InputJsonValue,
      snapshotAfter: after as unknown as Prisma.InputJsonValue,
    });

    if (to === "PUBLISHED") {
      await tx.mmClaim.updateMany({
        where: { mmEntityId: entityId, publishStatus: "REVIEWED" },
        data: { publishStatus: "PUBLISHED", publishedAt: new Date() },
      });
    }

    return after;
  });
}
