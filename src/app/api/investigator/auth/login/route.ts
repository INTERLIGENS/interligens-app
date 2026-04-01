import { NextRequest, NextResponse } from "next/server";
import { setInvestigatorCookie } from "@/lib/security/investigatorAuth";

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const expected = process.env.INVESTIGATOR_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (token !== expected) {
    await new Promise((r) => setTimeout(r, 200));
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setInvestigatorCookie(res);
  return res;
}
