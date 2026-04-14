/**
 * Vault auth helpers — adapted to the existing InvestigatorAccess /
 * InvestigatorSession model. The "beta code" in the original spec is
 * InvestigatorAccess here; the cookie is `investigator_session`.
 *
 * SECURITY: logAudit must always have at least one relational anchor.
 *           If none is supplied we drop the entry with console.error.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  InvestigatorAccess,
  VaultProfile,
  VaultWorkspace,
  VaultCaseFile,
} from "@prisma/client";
import {
  hashSHA256,
  hashIP,
  getSessionTokenFromReq,
} from "@/lib/security/investigatorAuth";

export type VaultAccessContext = {
  access: InvestigatorAccess;
  profile: VaultProfile | null;
};

export type VaultWorkspaceContext = {
  access: InvestigatorAccess;
  profile: VaultProfile;
  workspace: VaultWorkspace;
};

async function resolveAccessFromCookie(
  request: NextRequest
): Promise<InvestigatorAccess | null> {
  const token = getSessionTokenFromReq(request);
  if (!token) return null;
  const session = await prisma.investigatorSession.findFirst({
    where: {
      sessionTokenHash: hashSHA256(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { access: true },
  });
  if (!session || !session.access?.isActive) return null;
  return session.access;
}

/** Used by onboarding routes — workspace not yet required. */
export async function getVaultAccess(
  request: NextRequest
): Promise<VaultAccessContext | null> {
  const access = await resolveAccessFromCookie(request);
  if (!access) return null;
  const profile = await prisma.vaultProfile.findUnique({
    where: { investigatorAccessId: access.id },
  });
  return { access, profile };
}

/** Used by every /box/* route — workspace required. */
export async function getVaultWorkspace(
  request: NextRequest
): Promise<VaultWorkspaceContext | null> {
  const access = await resolveAccessFromCookie(request);
  if (!access) return null;
  const profile = await prisma.vaultProfile.findUnique({
    where: { investigatorAccessId: access.id },
    include: { workspace: true },
  });
  if (!profile || !profile.workspace) return null;
  return { access, profile, workspace: profile.workspace };
}

export async function assertCaseOwnership(
  workspaceId: string,
  caseId: string
): Promise<{ caseId: string } | NextResponse> {
  const c = await prisma.vaultCase.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return { caseId: c.id };
}

export async function assertFileOwnership(
  workspaceId: string,
  caseId: string,
  fileId: string
): Promise<VaultCaseFile | NextResponse> {
  const owner = await assertCaseOwnership(workspaceId, caseId);
  if (owner instanceof NextResponse) return owner;
  const f = await prisma.vaultCaseFile.findFirst({
    where: { id: fileId, caseId },
  });
  if (!f) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return f;
}

// Invariant: at least one of the three anchors must be set.
// If all three are null we drop the entry — must never happen in practice.
export async function logAudit(params: {
  investigatorAccessId?: string | null;
  profileId?: string | null;
  workspaceId?: string | null;
  caseId?: string;
  action: string;
  actor: string;
  request: NextRequest;
  metadata?: Record<string, unknown>;
  /** Optional opaque session fingerprint — merged into metadata.fingerprint. */
  fingerprint?: string;
}): Promise<void> {
  if (
    !params.investigatorAccessId &&
    !params.profileId &&
    !params.workspaceId
  ) {
    console.error("[vault-audit] no relational anchor — entry dropped", {
      action: params.action,
      actor: params.actor,
    });
    return;
  }
  const xff = params.request.headers.get("x-forwarded-for");
  const rawIp = xff ? xff.split(",")[0]?.trim() : null;
  const ipAddress = rawIp ? hashIP(rawIp) : null;
  const userAgent =
    params.request.headers.get("user-agent")?.slice(0, 256) ?? null;
  const mergedMetadata =
    params.fingerprint !== undefined
      ? { ...(params.metadata ?? {}), fingerprint: params.fingerprint }
      : (params.metadata ?? undefined);
  try {
    await prisma.vaultAuditLog.create({
      data: {
        investigatorAccessId: params.investigatorAccessId ?? null,
        profileId: params.profileId ?? null,
        workspaceId: params.workspaceId ?? null,
        caseId: params.caseId ?? null,
        action: params.action,
        actor: params.actor,
        ipAddress,
        userAgent,
        metadata: (mergedMetadata as object) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[vault-audit-error]", err);
  }
}
