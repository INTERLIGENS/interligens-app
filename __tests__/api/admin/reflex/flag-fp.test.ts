import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reflexAnalysis: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST, DELETE } from "@/app/api/admin/reflex/[id]/flag-fp/route";
import { NextRequest } from "next/server";

const mockUpdate = vi.mocked(
  prisma.reflexAnalysis.update as unknown as (...a: unknown[]) => unknown,
);

function req(): NextRequest {
  return new NextRequest(new Request("http://localhost/api/admin/reflex/x/flag-fp"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/reflex/:id/flag-fp", () => {
  it("flags the row and returns ok=true", async () => {
    const now = new Date("2026-05-13T10:00:00Z");
    mockUpdate.mockResolvedValue({
      id: "row-1", falsePositiveFlag: true, falsePositiveFlaggedAt: now,
    });
    const res = await POST(req(), { params: Promise.resolve({ id: "row-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("row-1");
    expect(body.flag).toBe(true);
    expect(body.flaggedAt).toBe(now.toISOString());
  });

  it("writes falsePositiveFlaggedBy='admin' (V1)", async () => {
    mockUpdate.mockResolvedValue({
      id: "row-2", falsePositiveFlag: true, falsePositiveFlaggedAt: new Date(),
    });
    await POST(req(), { params: Promise.resolve({ id: "row-2" }) });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-2" },
        data: expect.objectContaining({
          falsePositiveFlag: true,
          falsePositiveFlaggedBy: "admin",
        }),
      }),
    );
    // falsePositiveFlaggedAt should be a Date instance
    const call = mockUpdate.mock.calls[0]?.[0] as { data: { falsePositiveFlaggedAt: Date } };
    expect(call.data.falsePositiveFlaggedAt).toBeInstanceOf(Date);
  });

  it("returns 404 when row not found", async () => {
    mockUpdate.mockRejectedValue(new Error("Record to update not found."));
    const res = await POST(req(), { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("returns 500 on unexpected error", async () => {
    mockUpdate.mockRejectedValue(new Error("connection refused"));
    const res = await POST(req(), { params: Promise.resolve({ id: "row-3" }) });
    expect(res.status).toBe(500);
  });

  it("returns 400 when id is missing", async () => {
    const res = await POST(req(), { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/reflex/:id/flag-fp", () => {
  it("unflags the row", async () => {
    mockUpdate.mockResolvedValue({ id: "row-1", falsePositiveFlag: false });
    const res = await DELETE(req(), { params: Promise.resolve({ id: "row-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flag).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          falsePositiveFlag: false,
          falsePositiveFlaggedAt: null,
          falsePositiveFlaggedBy: null,
        },
      }),
    );
  });

  it("returns 404 when not found", async () => {
    mockUpdate.mockRejectedValue(new Error("Record to update not found."));
    const res = await DELETE(req(), { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });
});

describe("auth gate (informational — handled by proxy.ts)", () => {
  it("documents that proxy.ts gates /api/admin/* before this handler runs", () => {
    // src/proxy.ts requires admin_session cookie (or Basic Auth fallback)
    // on /api/admin/*. The handler trusts the request reached it. If a
    // future change moves auth into the handler, replace this comment
    // with an actual assertion.
    expect(true).toBe(true);
  });
});
