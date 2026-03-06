// src/lib/intel-vault/auth.ts
import { NextRequest, NextResponse } from "next/server";

export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = req.headers.get("x-admin-token") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.error("ADMIN_TOKEN non configuré");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
