/**
 * src/lib/surveillance/alerts/deliverAlerts.ts
 * Livre les alertes par email (console stub) et webhook
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function deliverPendingAlerts(): Promise<{
  delivered: number;
  failed: number;
}> {
  // Récupérer les signaux récents non encore alertés
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

  for (const sub of subscriptions) {
    const handles: string[] = JSON.parse(sub.handles ?? "[]");
    const thresholdOrder = ["POSSIBLE", "PROBABLE", "BLATANT"];
    const thresholdIdx = thresholdOrder.indexOf(sub.severityThreshold ?? "PROBABLE");

    for (const signal of recentSignals) {
      // Vérifier si le handle est dans la watchlist de l'abonnement
      if (handles.length > 0 && !handles.includes(signal.influencer.handle)) continue;

      // Vérifier le seuil de sévérité
      const sigIdx = thresholdOrder.indexOf(signal.windowBucket ?? "");
      if (sigIdx < thresholdIdx) continue;

      // Vérifier si déjà livré
      const alreadyDelivered = await prisma.$queryRaw<any[]>`
        SELECT id FROM alert_deliveries
        WHERE "subscriptionId" = ${sub.id} AND "signalId" = ${signal.id}
        LIMIT 1
      `;
      if (alreadyDelivered.length > 0) continue;

      const deliveryId = randomUUID();
      try {
        if (sub.webhookUrl) {
          await deliverWebhook(sub.webhookUrl, signal);
        } else {
          // Console stub pour email
          console.log(`[alert] EMAIL to ${sub.email}: ${signal.influencer.handle} — ${signal.windowBucket}`);
        }

        await prisma.$executeRaw`
          INSERT INTO alert_deliveries (id, "subscriptionId", "signalId", status, channel, "deliveredAt", "createdAt")
          VALUES (${deliveryId}, ${sub.id}, ${signal.id}, 'delivered',
            ${sub.webhookUrl ? 'webhook' : 'email'}, NOW(), NOW())
        `;
        delivered++;
      } catch (err: any) {
        await prisma.$executeRaw`
          INSERT INTO alert_deliveries (id, "subscriptionId", "signalId", status, channel, error, "createdAt")
          VALUES (${deliveryId}, ${sub.id}, ${signal.id}, 'failed',
            ${sub.webhookUrl ? 'webhook' : 'email'}, ${err.message}, NOW())
        `;
        failed++;
      }
    }
  }

  return { delivered, failed };
}

async function deliverWebhook(url: string, signal: any) {
  const payload = {
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
    etherscan: signal.t1TxHash ? `https://etherscan.io/tx/${signal.t1TxHash}` : null,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Webhook failed: HTTP ${res.status}`);
}
