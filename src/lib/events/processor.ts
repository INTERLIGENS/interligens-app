// src/lib/events/processor.ts
// Handles each DomainEvent type. Called inline (fire-and-forget) by the
// producer and in bulk by the /api/cron/process-events cron.

import { prisma } from "@/lib/prisma";
import { computeProceedsForHandle } from "@/lib/kol/proceeds";
import { buildKolCanonicalSnapshot } from "@/lib/kol/canonical";

type DomainEventRow = {
  id: string;
  type: string;
  payload: unknown;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
  error: string | null;
};

export async function processEvent(event: DomainEventRow): Promise<void> {
  const payload = event.payload as Record<string, unknown>;

  try {
    switch (event.type) {
      case "scan.completed": {
        const address = String(payload.address ?? "");
        if (!address) break;
        // Find if this address belongs to a tracked KOL
        const wallet = await prisma.kolWallet.findFirst({
          where: { address: { equals: address, mode: "insensitive" } },
          select: { kolHandle: true },
        });
        if (wallet?.kolHandle) {
          await computeProceedsForHandle(wallet.kolHandle);
          await buildKolCanonicalSnapshot(wallet.kolHandle);
        }
        break;
      }

      case "wallet.linked": {
        const handle = String(payload.handle ?? "");
        if (!handle) break;
        await computeProceedsForHandle(handle);
        await buildKolCanonicalSnapshot(handle);
        break;
      }

      case "proceeds.recomputed": {
        const handle = String(payload.handle ?? "");
        if (handle) await buildKolCanonicalSnapshot(handle);
        break;
      }

      case "kol.updated": {
        const handle = String(payload.handle ?? "");
        if (handle) await buildKolCanonicalSnapshot(handle);
        break;
      }

      case "casefile.ingested": {
        const handle = String(payload.handle ?? "");
        if (handle) {
          await computeProceedsForHandle(handle);
          await buildKolCanonicalSnapshot(handle);
        }
        break;
      }

      default:
        break;
    }

    await prisma.domainEvent.update({
      where: { id: event.id },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.domainEvent.update({
      where: { id: event.id },
      data: {
        status: "failed",
        processedAt: new Date(),
        error: msg.slice(0, 500),
      },
    }).catch(() => {});
  }
}
