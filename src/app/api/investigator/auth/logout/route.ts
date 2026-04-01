import { NextResponse } from "next/server";
import { clearInvestigatorCookie } from "@/lib/security/investigatorAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearInvestigatorCookie(res);
  return res;
}
