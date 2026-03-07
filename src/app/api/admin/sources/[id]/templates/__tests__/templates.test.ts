import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sourceTemplate: { findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/security/auth", () => ({
  checkAuth: async () => ({ authorized: true }),
}));

import { GET, POST } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/sources/s1/templates", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Source Templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET retourne les templates", async () => {
    vi.mocked(prisma.sourceTemplate.findMany).mockResolvedValue([{ id: "t1" }] as never);
    const res = await GET(makeReq("GET"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(1);
  });

  it("POST crée un template", async () => {
    vi.mocked(prisma.sourceTemplate.create).mockResolvedValue({ id: "t1" } as never);
    const res = await POST(makeReq("POST", {
      inputType: "sheet",
      columnMapping: { address: "Wallet", chain: "Chain" },
    }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(201);
    expect(prisma.sourceTemplate.create).toHaveBeenCalledOnce();
  });

  it("POST 400 si columnMapping manquant", async () => {
    const res = await POST(makeReq("POST", { inputType: "csv" }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(400);
  });
});
