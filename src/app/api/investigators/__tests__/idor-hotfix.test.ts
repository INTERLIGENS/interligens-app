/**
 * IDOR hotfix regression tests.
 *
 * Covers /api/investigators/activity, /terms/accept, and /nda/accept.
 * Each endpoint must:
 *   (1) 401 when no valid investigator session is presented
 *   (2) 403 when a mismatching profileId is supplied in the body
 *   (3) 200 when the session resolves to a profile and the body either
 *       omits profileId or supplies a matching one
 *
 * The session helper is mocked at the module boundary so we can inject
 * "valid session → profile X", "valid session → no profile", and
 * "no session" without touching Prisma or the cookie cache.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/investigators/session", () => ({
  getInvestigatorSessionContext: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    investigatorActivityLog: { create: vi.fn().mockResolvedValue({}) },
    investigatorProfile: { update: vi.fn().mockResolvedValue({}) },
    investigatorBetaTermsAcceptance: {
      create: vi.fn().mockResolvedValue({ acceptedAt: new Date("2026-04-19T22:00:00Z") }),
    },
    investigatorNdaAcceptance: {
      create: vi.fn().mockResolvedValue({ signedAt: new Date("2026-04-20T00:00:00Z") }),
    },
    investigatorProgramAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/investigators/legalDocs", () => ({
  getLegalDoc: vi.fn().mockResolvedValue({ hash: "doc-hash-ok" }),
}));

// All three endpoints use fetch-like JSON parsing; no other external deps
// need to be mocked for this test pass. Each test seeds the session via
// mockedSession and asserts status + (where it matters) the DB payload.

import { POST as activityPOST } from "../activity/route";
import { POST as termsPOST } from "../terms/accept/route";
import { POST as ndaPOST } from "../nda/accept/route";
import { getInvestigatorSessionContext } from "@/lib/investigators/session";

const mockedSession = vi.mocked(getInvestigatorSessionContext);

// ── Helpers ──────────────────────────────────────────────────────────

function makeReq(body: unknown, opts: { origin?: string } = {}): NextRequest {
  const url = "https://example.test/api/investigators/route";
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.origin) headers["origin"] = opts.origin;
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedSession.mockReset();
});

// ── /api/investigators/activity ──────────────────────────────────────

describe("POST /api/investigators/activity — IDOR hotfix", () => {
  it("401 when no session", async () => {
    mockedSession.mockResolvedValueOnce(null);
    const res = await activityPOST(
      makeReq({ profileId: "prof_owner", event: "WORKSPACE_OPENED" }),
    );
    expect(res.status).toBe(401);
  });

  it("401 when session has no profile (legacy tester)", async () => {
    mockedSession.mockResolvedValueOnce({ accessId: "acc_1", profileId: null });
    const res = await activityPOST(
      makeReq({ profileId: "prof_owner", event: "WORKSPACE_OPENED" }),
    );
    expect(res.status).toBe(401);
  });

  it("403 when body profileId mismatches session profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_1",
      profileId: "prof_session",
    });
    const res = await activityPOST(
      makeReq({ profileId: "prof_attacker_target", event: "WORKSPACE_OPENED" }),
    );
    expect(res.status).toBe(403);
  });

  it("200 when body profileId matches session profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_1",
      profileId: "prof_session",
    });
    const res = await activityPOST(
      makeReq({ profileId: "prof_session", event: "WORKSPACE_OPENED" }),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
  });

  it("200 and uses session profileId even when body omits it", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_1",
      profileId: "prof_session",
    });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.investigatorActivityLog.create).mockClear();

    const res = await activityPOST(
      makeReq({ event: "WORKSPACE_OPENED" }),
    );
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.investigatorActivityLog.create).mock.calls[0][0];
    expect(call.data.profileId).toBe("prof_session");
  });
});

// ── /api/investigators/terms/accept ──────────────────────────────────

describe("POST /api/investigators/terms/accept — IDOR hotfix", () => {
  const okBody = {
    accepted: true,
    signerName: "Jane Doe",
    termsVersion: "1.0",
    termsLanguage: "en",
    termsDocHash: "doc-hash-ok",
  };

  it("401 when no session", async () => {
    mockedSession.mockResolvedValueOnce(null);
    const res = await termsPOST(
      makeReq({ ...okBody, profileId: "prof_victim" }),
    );
    expect(res.status).toBe(401);
  });

  it("403 when body profileId mismatches session profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_1",
      profileId: "prof_session",
    });
    const res = await termsPOST(
      makeReq({ ...okBody, profileId: "prof_victim" }),
    );
    expect(res.status).toBe(403);
  });

  it("200 when body profileId matches session profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_1",
      profileId: "prof_session",
    });
    const res = await termsPOST(
      makeReq({ ...okBody, profileId: "prof_session" }),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
  });

  it("200 uses session accessId as betaCodeId, ignoring body.betaCodeId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_session",
      profileId: "prof_session",
    });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.investigatorBetaTermsAcceptance.create).mockClear();

    const res = await termsPOST(
      makeReq({
        ...okBody,
        profileId: "prof_session",
        betaCodeId: "acc_attacker_injected",
      }),
    );
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.investigatorBetaTermsAcceptance.create).mock.calls[0][0];
    expect(call.data.betaCodeId).toBe("acc_session");
    expect(call.data.profileId).toBe("prof_session");
  });

  it("200 during legacy onboarding — session with no profile, body omits profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_legacy",
      profileId: null,
    });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.investigatorBetaTermsAcceptance.create).mockClear();

    const res = await termsPOST(makeReq(okBody));
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.investigatorBetaTermsAcceptance.create).mock.calls[0][0];
    expect(call.data.profileId).toBeNull();
    expect(call.data.betaCodeId).toBe("acc_legacy");
  });

  it("403 during legacy onboarding if body injects a profileId", async () => {
    // Session has null profile; any supplied profileId is unverifiable,
    // so it must be rejected.
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_legacy",
      profileId: null,
    });
    const res = await termsPOST(
      makeReq({ ...okBody, profileId: "prof_victim" }),
    );
    expect(res.status).toBe(403);
  });
});

// ── /api/investigators/nda/accept ────────────────────────────────────

describe("POST /api/investigators/nda/accept — IDOR hotfix", () => {
  const okBody = {
    accepted: true,
    signerName: "Jane Doe",
    ndaVersion: "1.0",
    ndaLanguage: "en",
    ndaDocHash: "doc-hash-ok",
  };

  it("401 when no session", async () => {
    mockedSession.mockResolvedValueOnce(null);
    const res = await ndaPOST(
      makeReq({ ...okBody, profileId: "prof_victim" }),
    );
    expect(res.status).toBe(401);
  });

  it("403 when body profileId mismatches session profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_1",
      profileId: "prof_session",
    });
    const res = await ndaPOST(
      makeReq({ ...okBody, profileId: "prof_victim" }),
    );
    expect(res.status).toBe(403);
  });

  it("200 uses session accessId as betaCodeId, ignoring any client value", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_session",
      profileId: "prof_session",
    });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.investigatorNdaAcceptance.create).mockClear();

    const res = await ndaPOST(
      makeReq({
        ...okBody,
        profileId: "prof_session",
        betaCodeId: "acc_attacker_injected",
      }),
    );
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.investigatorNdaAcceptance.create).mock.calls[0][0];
    expect(call.data.betaCodeId).toBe("acc_session");
    expect(call.data.profileId).toBe("prof_session");
  });

  it("200 during legacy onboarding — session with no profile, body omits profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_legacy",
      profileId: null,
    });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.investigatorNdaAcceptance.create).mockClear();

    const res = await ndaPOST(makeReq(okBody));
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.investigatorNdaAcceptance.create).mock.calls[0][0];
    expect(call.data.profileId).toBeNull();
    expect(call.data.betaCodeId).toBe("acc_legacy");
  });

  it("403 during legacy onboarding if body injects a profileId", async () => {
    mockedSession.mockResolvedValueOnce({
      accessId: "acc_legacy",
      profileId: null,
    });
    const res = await ndaPOST(
      makeReq({ ...okBody, profileId: "prof_victim" }),
    );
    expect(res.status).toBe(403);
  });
});
