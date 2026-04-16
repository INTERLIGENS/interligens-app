import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace, logAudit } from "@/lib/vault/auth.server";

async function sendEmail(handle: string, message: string, caseId: string | null) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL ?? "feedback@interligens.com";
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "investigators@interligens.com",
        to,
        subject: `Investigator Feedback — ${handle}`,
        text: [
          `Handle: ${handle}`,
          `Case: ${caseId ?? "—"}`,
          `Sent: ${new Date().toISOString()}`,
          "",
          message,
        ].join("\n"),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[feedback] resend failed", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const message =
    typeof body.message === "string" ? body.message.slice(0, 5000).trim() : "";
  const caseId =
    typeof body.caseId === "string" && body.caseId.length > 0
      ? body.caseId
      : null;

  if (!message) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }

  const handle = ctx.profile.handle ?? ctx.access.label;

  // Best-effort: try email first, then DB
  const emailed = await sendEmail(handle, message, caseId);

  if (!emailed) {
    try {
      await prisma.vaultFeedback.create({
        data: {
          workspaceId: ctx.workspace.id,
          caseId,
          handle,
          message,
        },
      });
    } catch (err) {
      console.error("[feedback] db store failed", err);
      return NextResponse.json({ error: "store_failed" }, { status: 500 });
    }
  }

  // Also store in FeedbackEntry for admin inbox
  try {
    await prisma.feedbackEntry.create({
      data: {
        accessId: ctx.access.id,
        investigatorName: handle,
        investigatorEmail: (ctx.profile as Record<string, unknown>).contactEmail as string ?? undefined,
        workspaceId: ctx.workspace.id,
        type: typeof body.type === "string" ? body.type : "feedback",
        body: message,
      },
    });
  } catch {
    // Non-blocking — FeedbackEntry table may not exist yet
  }

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId: caseId ?? undefined,
    action: "FEEDBACK_SENT",
    actor: ctx.access.label,
    request,
    metadata: { delivery: emailed ? "email" : "db" },
  });

  return NextResponse.json({ success: true });
}
