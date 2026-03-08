import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sourceRegistry: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/security/auth", () => ({
  checkAuth: async () => ({ authorized: true }),
}));

import { POST, GET } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/security/adminAuth", () => ({
  requireAdminApi: () => null,
  isAdminApi: () => true,
}));


function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/sources", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Source CRUD", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST crée une source", async () => {
    vi.mocked(prisma.sourceRegistry.create).mockResolvedValue({ id: "src_1", sourceName: "WeAreKent" } as never);
    const res = await POST(makeReq("POST", { sourceName: "WeAreKent", handle: "@wearekent_" }));
    expect(res.status).toBe(201);
    expect(prisma.sourceRegistry.create).toHaveBeenCalledOnce();
  });

  it("POST 400 si sourceName manquant", async () => {
    const res = await POST(makeReq("POST", {}));
    expect(res.status).toBe(400);
  });

  it("GET liste les sources", async () => {
    vi.mocked(prisma.sourceRegistry.findMany).mockResolvedValue([{ id: "src_1" }] as never);
    vi.mocked(prisma.sourceRegistry.count).mockResolvedValue(1);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources).toHaveLength(1);
  });
});
