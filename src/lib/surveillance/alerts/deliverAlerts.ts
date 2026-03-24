import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

async function sendEmail(to: string, signal: any) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "alerts@interligens.com",
      to,
      subject: `⚠️ INTERLIGENS Alert — ${signal.influencer.handle} [${signal.windowBucket}]`,
      html: `
        <h2>INTERLIGENS — Sell-While-Shilling Alert</h2>
        <p><strong>Handle:</strong> ${signal.influencer.handle}</p>
        <p><strong>Bucket:</strong> ${signal.windowBucket}</p>
        <p><strong>Window:</strong> ${signal.windowMinutes} minutes after post</p>
        <p><strong>Token:</strong> ${signal.tokenAddress ?? "N/A"}</p>
        <p><strong>TX Hash:</strong> ${signal.t1TxHash ?? "N/A"}</p>
        <p><strong>Post URL:</strong> <a href="${signal.t0PostUrl}">${signal.t0PostUrl}</a></p>
        <p><strong>Observed:</strong> ${signal.notes ?? "N/A"}</p>
        <hr/>
        <p style="color:gray;font-size:12px;">Facts only — not an accusation. INTERLIGENS Intelligence Platform.</p>
      `,
    }),
  });
  if (!res.ok) throw new Error(`Resend error: ${res.status}`);
}

async function deliverWebhook(url: string, signal: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "SELL_WHILE_SHILLING",
      handle: signal.influencer.handle,
      windowBucket: signal.windowBucket,
      severity: signal.severity,
      windowMinutes: signal.windowMinutes,
      tokenAddress: signal.tokenAddress,
      txHash: signal.t1TxHash,
      postUrl: signal.t0PostUrl,
      detectedAt: signal.createdAt,
      notes: signal.notes,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Webhook failed: HTTP ${res.status}`);
}

export async function deliverPendingAlerts(): Promise<{ delivered: number; failed: number }> {
  const recentSignals = await prisma.signal.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      type: "SELL_WHILE_SHILLING",
    },
    include: { influencer: { select: { handle: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (recentSignals.length === 0) return { delivered: 0, failed: 0 };

  const subscriptions = await prisma.alertSubscription.findMany({
    where: { status: "active" },
  });

  let delivered = 0;
  let failed = 0;
  const thresholdOrder = ["POSSIBLE", "PROBABLE", "BLATANT"];

  for (const sub of subscriptions) {
    const handles: string[] = JSON.parse(sub.handles ?? "[]");
    const thresholdIdx = thresholdOrder.indexOf(sub.severityThreshold ?? "PROBABLE");

    for (const signal of recentSignals) {
      if (handles.length > 0 && !handles.includes(signal.influencer.handle)) continue;
      const sigIdx = thresholdOrder.indexOf(signal.windowBucket ?? "");
      if (sigIdx < thresholdIdx) continue;

      const alreadyDelivered = await prisma.$queryRaw<any[]>`
        SELECT id FROM alert_deliveries
        WHERE "subscriptionId" = ${sub.id} AND "signalId" = ${signal.id}
        LIMIT 1
      `;
      if (alreadyDelivered.length > 0) continue;

      const deliveryId = randomUUID();
      const channel = sub.webhookUrl ? "webhook" : "email";

      try {
        if (sub.webhookUrl) {
          await deliverWebhook(sub.webhookUrl, signal);
        } else if (sub.email) {
          await sendEmail(sub.email, signal);
        }

        await prisma.$executeRaw`
          INSERT INTO alert_deliveries (id, "subscriptionId", "signalId", status, channel, "deliveredAt", "createdAt")
          VALUES (${deliveryId}, ${sub.id}, ${signal.id}, 'delivered', ${channel}, NOW(), NOW())
        `;
        delivered++;
      } catch (err: any) {
        await prisma.$executeRaw`
          INSERT INTO alert_deliveries (id, "subscriptionId", "signalId", status, channel, error, "createdAt")
          VALUES (${deliveryId}, ${sub.id}, ${signal.id}, 'failed', ${channel}, ${err.message}, NOW())
        `;
        failed++;
      }
    }
  }

  return { delivered, failed };
}
