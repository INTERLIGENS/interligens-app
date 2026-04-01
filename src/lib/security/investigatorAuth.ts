/**
 * src/lib/security/investigatorAuth.ts
 *
 * Investigator dashboard auth — individual access codes with DB-backed sessions.
 *
 * Flow:
 *  1. Investigator enters their unique access code
 *  2. Backend hashes it (SHA-256) and looks up InvestigatorAccess
 *  3. If valid + active + not expired → create InvestigatorSession
 *  4. Session token (opaque, random) set as httpOnly cookie
 *  5. Middleware validates session on every request
 *  6. All events logged to InvestigatorAuditLog
 */

import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Constants ───────────────────────────────────────────────────────────────

const COOKIE_NAME = "investigator_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_TTL_SEC = 8 * 60 * 60;

// ── Hashing ─────────────────────────────────────────────────────────────────

export function hashSHA256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash IP for audit (not reversible to full IP). */
export function hashIP(ip: string): string {
  return createHash("sha256").update(`interligens:ip:${ip}`).digest("hex").slice(0, 16);
}

// ── Session Cookie ──────────────────────────────────────────────────────────

export function getSessionTokenFromReq(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

// ── Audit Logging ───────────────────────────────────────────────────────────

export async function auditLog(params: {
  accessId?: string | null;
  eventType: string;
  route?: string;
  ipHash?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.investigatorAuditLog.create({
      data: {
        investigatorAccessId: params.accessId ?? null,
        eventType: params.eventType,
        route: params.route ?? null,
        ipHash: params.ipHash ?? null,
        userAgent: params.userAgent?.slice(0, 256) ?? null,
        metadata: params.metadata ? (params.metadata as Record<string, string>) : undefined,
      },
    });
  } catch (err) {
    console.error("[investigatorAuth] audit log failed:", err);
  }
}

// ── Login ───────────────────────────────────────────────────────────────────

export interface LoginResult {
  success: boolean;
  label?: string;
}

/**
 * Authenticate with an access code.
 * Returns { success, label } and sets session cookie on res if successful.
 */
export async function loginWithAccessCode(
  code: string,
  res: NextResponse,
  meta: { ip: string; userAgent: string },
): Promise<LoginResult> {
  const codeHash = hashSHA256(code);
  const ipHash = hashIP(meta.ip);

  const access = await prisma.investigatorAccess.findFirst({
    where: { accessCodeHash: codeHash },
  });

  // Uniform failure — no info leak
  if (!access || !access.isActive) {
    await auditLog({
      accessId: access?.id ?? null,
      eventType: access ? "login_fail_inactive" : "login_fail_unknown",
      ipHash,
      userAgent: meta.userAgent,
    });
    return { success: false };
  }

  if (access.expiresAt && access.expiresAt < new Date()) {
    await auditLog({
      accessId: access.id,
      eventType: "login_fail_expired",
      ipHash,
      userAgent: meta.userAgent,
    });
    return { success: false };
  }

  // Create session
  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSHA256(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.investigatorSession.create({
    data: {
      investigatorAccessId: access.id,
      sessionTokenHash,
      expiresAt,
      ipHash,
      userAgent: meta.userAgent?.slice(0, 256) ?? null,
    },
  });

  // Update lastUsedAt
  await prisma.investigatorAccess.update({
    where: { id: access.id },
    data: { lastUsedAt: new Date() },
  });

  await auditLog({
    accessId: access.id,
    eventType: "login_success",
    ipHash,
    userAgent: meta.userAgent,
    metadata: { label: access.label },
  });

  setSessionCookie(res, sessionToken);
  return { success: true, label: access.label };
}

// ── Session Validation ──────────────────────────────────────────────────────

export interface SessionInfo {
  accessId: string;
  label: string;
  sessionId: string;
}

/**
 * Validate session token from cookie.
 * Returns SessionInfo if valid, null otherwise.
 * Also updates lastSeenAt for active sessions.
 */
export async function validateSession(
  sessionToken: string,
): Promise<SessionInfo | null> {
  const tokenHash = hashSHA256(sessionToken);

  const session = await prisma.investigatorSession.findFirst({
    where: {
      sessionTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      access: { select: { id: true, label: true, isActive: true } },
    },
  });

  if (!session || !session.access.isActive) return null;

  // Update lastSeenAt (fire-and-forget for performance)
  prisma.investigatorSession
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {});

  return {
    accessId: session.access.id,
    label: session.access.label,
    sessionId: session.id,
  };
}

// ── Logout ──────────────────────────────────────────────────────────────────

export async function revokeSession(
  sessionToken: string,
  meta: { ip: string; userAgent: string },
): Promise<void> {
  const tokenHash = hashSHA256(sessionToken);
  const ipHash = hashIP(meta.ip);

  const session = await prisma.investigatorSession.findFirst({
    where: { sessionTokenHash: tokenHash, revokedAt: null },
  });

  if (session) {
    await prisma.investigatorSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await auditLog({
      accessId: session.investigatorAccessId,
      eventType: "logout",
      ipHash,
      userAgent: meta.userAgent,
    });
  }
}

// ── Revocation utilities (for admin scripts) ────────────────────────────────

/** Deactivate an access and revoke all its sessions. */
export async function revokeAccess(accessId: string): Promise<void> {
  await prisma.investigatorAccess.update({
    where: { id: accessId },
    data: { isActive: false },
  });

  await prisma.investigatorSession.updateMany({
    where: { investigatorAccessId: accessId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditLog({
    accessId,
    eventType: "access_revoked",
  });
}

/** Regenerate access code for an existing access. Returns new plaintext code. */
export async function regenerateAccessCode(accessId: string): Promise<string> {
  const newCode = randomBytes(16).toString("hex");
  const newHash = hashSHA256(newCode);

  await prisma.investigatorAccess.update({
    where: { id: accessId },
    data: { accessCodeHash: newHash },
  });

  // Revoke all existing sessions
  await prisma.investigatorSession.updateMany({
    where: { investigatorAccessId: accessId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditLog({
    accessId,
    eventType: "access_code_regenerated",
  });

  return newCode;
}

// ── API Route Guard ─────────────────────────────────────────────────────────

/**
 * requireInvestigatorSession(req)
 * Use at the top of every /api/investigator/* data route.
 * Returns NextResponse (401) if session invalid, null if OK.
 */
export async function requireInvestigatorSession(
  req: NextRequest,
): Promise<NextResponse | null> {
  const sessionToken = getSessionTokenFromReq(req);
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  return null;
}

// ── Middleware helper ────────────────────────────────────────────────────────

/**
 * Quick session check for middleware (lightweight).
 * Uses a direct query instead of full validateSession to minimize latency.
 */
export async function isValidSessionToken(token: string): Promise<boolean> {
  const tokenHash = hashSHA256(token);
  const session = await prisma.investigatorSession.findFirst({
    where: {
      sessionTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      access: { select: { isActive: true } },
    },
  });
  return !!session?.access?.isActive;
}
