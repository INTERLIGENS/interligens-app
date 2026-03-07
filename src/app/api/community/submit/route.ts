
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSubmission, detectChain, deriveSeverity } from "@/lib/community/validate";
import { hashIp, getClientIp } from "@/lib/community/ipHash";
import { getRateLimitStore } from "@/lib/vault/ratelimit/getStore";

const RATE_LIMIT = parseInt(process.env.COMMUNITY_RATE_LIMIT ?? "5");

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const store = getRateLimitStore();
  const key = `community:${ipHash}`;
  const now = Date.now();
  const entry = await store.get(key);
  const count = (entry && entry.resetAt > now) ? entry.count + 1 : 1;
  await store.set(key, { count, resetAt: now + 3600_000 }, 3600_000);
  if (count > RATE_LIMIT) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Turnstile CAPTCHA (optional if TURNSTILE_SECRET not set)
  const secret = process.env.TURNSTILE_SECRET;
  if (secret) {
    const body = await req.clone().formData().catch(() => null);
    const token = body?.get("cf-turnstile-response") as string | null;
    if (!token) return NextResponse.json({ error: "CAPTCHA required" }, { status: 400 });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = await res.json();
    if (!data.success) return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const err = validateSubmission(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const chain = body.chain || detectChain(body.address)!;
  const severity = deriveSeverity(body.labelType);

  const submission = await prisma.communitySubmission.create({
    data: {
      chain,
      address: body.address.trim(),
      labelType: body.labelType,
      label: body.label ?? null,
      message: body.message ?? null,
      evidenceUrl: body.evidenceUrl ?? null,
      txHash: body.txHash ?? null,
      reporterContact: body.reporterContact ?? null,
      ipHash,
      userAgentHash: req.headers.get("user-agent")?.slice(0, 64) ?? null,
      severityDerived: severity,
    },
  });

  return NextResponse.json({ ok: true, submissionId: submission.id });
}
