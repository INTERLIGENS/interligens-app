// src/lib/events/processor.ts
// Handles each DomainEvent type. Called inline (fire-and-forget) by the
// producer and in bulk by the /api/cron/process-events cron.

import { prisma } from "@/lib/prisma";
import { computeProceedsForHandle } from "@/lib/kol/proceeds";
import { buildKolCanonicalSnapshot } from "@/lib/kol/canonical";
import { resolveWalletToKol } from "@/lib/kol/identity";

const MAX_RETRIES = 3;
// Exponential backoff: 2min, 10min, 30min
const RETRY_DELAYS_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000];

// Coalesce kol.updated: if ≥3 events for the same handle within 2min,
// process only once and fast-ack the rest.
const _kolUpdatedCoalesce = new Map<string, { firstMs: number; count: number }>();
const COALESCE_WINDOW_MS = 2 * 60_000;
const COALESCE_THRESHOLD = 3;

type DomainEventRow = {
  id: string;
  type: string;
  payload: unknown;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
  error: string | null;
  retryCount: number;
  nextRetryAt: Date | null;
  deadLetteredAt: Date | null;
  correlationId: string | null;
  causationId: string | null;
  idempotencyKey: string | null;
};

export async function processEvent(event: DomainEventRow): Promise<void> {
  const payload = event.payload as Record<string, unknown>;

  try {
    switch (event.type) {
      case "scan.completed": {
        const address = String(payload.address ?? "");
        const chain = String(payload.chain ?? "");
        if (!address) break;

        const match = await resolveWalletToKol(address, chain);

        if (match.confidence === "exact" && match.handle) {
          await computeProceedsForHandle(match.handle);
          await buildKolCanonicalSnapshot(match.handle);
        } else {
          console.log(`[processor] scan.completed: no KOL match for ${address} (${chain})`);
        }

        if (match.requiresHumanReview) {
          await prisma.domainEvent.create({
            data: {
              type: "identity.review_required",
              payload: { address, chain, confidence: match.confidence, evidence: match.evidence },
              status: "pending",
            },
          }).catch(() => {});
        }
        break;
      }

      case "identity.review_required":
        // Consumed by admin tooling — no automated action taken
        break;

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
        if (!handle) break;

        const now = Date.now();
        const entry = _kolUpdatedCoalesce.get(handle);
        if (entry && now - entry.firstMs < COALESCE_WINDOW_MS) {
          entry.count++;
          if (entry.count >= COALESCE_THRESHOLD) {
            // Already processed once in this window — fast-ack without rebuild
            break;
          }
        } else {
          _kolUpdatedCoalesce.set(handle, { firstMs: now, count: 1 });
        }

        await buildKolCanonicalSnapshot(handle);
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
    const nextRetry = event.retryCount + 1;

    if (nextRetry > MAX_RETRIES) {
      await prisma.domainEvent.update({
        where: { id: event.id },
        data: {
          status: "dead_letter",
          processedAt: new Date(),
          deadLetteredAt: new Date(),
          error: msg.slice(0, 500),
          retryCount: nextRetry,
        },
      }).catch(() => {});
    } else {
      const delayMs = RETRY_DELAYS_MS[nextRetry - 1] ?? 30 * 60_000;
      await prisma.domainEvent.update({
        where: { id: event.id },
        data: {
          status: "pending",
          error: msg.slice(0, 500),
          retryCount: nextRetry,
          nextRetryAt: new Date(Date.now() + delayMs),
        },
      }).catch(() => {});
    }
  }
}
