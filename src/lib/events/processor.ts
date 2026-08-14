// src/lib/events/processor.ts
// Handles each DomainEvent type. Called inline (fire-and-forget) by the
// producer and in bulk by the /api/cron/process-events cron.

import { prisma } from "@/lib/prisma";
import { computeProceedsForHandle } from "@/lib/kol/proceeds";
import { buildKolCanonicalSnapshot } from "@/lib/kol/canonical";
import { resolveWalletToKol } from "@/lib/kol/identity";
import { alertDeadLetter } from "@/lib/ops/alerting";
import { findCrossLinks, persistCrossLinks, type CrossLink } from "@/lib/intelligence/crossCaseLinker";
import { detectAndPersistContradictions } from "@/lib/intelligence/contradictionDetector";
import { emitKolUpdated } from "@/lib/events/producer";

/**
 * Types d'événements dont le traitement est HUMAIN. Le processeur ne doit ni
 * les traiter ni les acquitter : ils restent `pending` jusqu'à ce qu'un opérateur
 * tranche via /api/admin/identity/resolve.
 *
 * Pourquoi cette liste existe : `identity.review_required` tombait dans un
 * `case` vide, puis l'update de fin de switch le passait `processed` — sans
 * qu'aucune décision n'ait été prise. Or la file admin
 * (/api/admin/identity/queue) ne liste que les `pending`. Le cron quotidien
 * vidait donc la file de revue avant qu'un humain puisse la voir : au
 * 2026-08-14, 160 événements `identity.review_required`, tous `processed`,
 * aucun arbitré. Le compteur `alertIdentityBacklog` (seuil 20) surveillait un
 * chiffre structurellement bloqué à zéro.
 *
 * Le garde-fou est ici, dans le processeur, et pas seulement dans la requête du
 * cron : le producteur appelle aussi processEvent en direct
 * (producer.ts, `void processEvent(event)`), et toute nouvelle voie d'appel
 * hériterait du même acquittement silencieux.
 */
export const HUMAN_REVIEW_TYPES = new Set(["identity.review_required"]);

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

  // Sortie AVANT toute écriture de statut : un événement en attente d'arbitrage
  // humain n'est pas « traité », et le marquer ainsi le rendrait invisible.
  if (HUMAN_REVIEW_TYPES.has(event.type)) return;

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

      // `identity.review_required` n'apparaît plus ici : il sort en tête de
      // fonction via HUMAN_REVIEW_TYPES. Un `case` vide au milieu du switch
      // tombait dans l'update `processed` de fin de bloc — c'est exactement le
      // défaut corrigé. Le laisser ici, même documenté, réintroduirait le
      // piège au premier refactor.

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
        // Contradiction detection: non-fatal, fire after snapshot rebuild
        void detectAndPersistContradictions(handle);
        break;
      }

      case "casefile.ingested": {
        const handle = String(payload.handle ?? "");
        if (handle) {
          await computeProceedsForHandle(handle);
          await buildKolCanonicalSnapshot(handle);

          // Cross-case linking: detect shared wallets / tokens with other KOLs
          try {
            const links = await findCrossLinks(handle);
            if (links.length > 0) {
              await persistCrossLinks(links);
              console.log(`[processor] cross-case link detected: ${links.length} link(s) for @${handle}`);
              const affectedHandles = new Set<string>(links.map((l: CrossLink) => l.targetHandle));
              for (const target of affectedHandles) {
                emitKolUpdated(target);
              }
            }
          } catch (err) {
            // Non-fatal: cross-linking failure must not block the main casefile flow
            console.error("[processor] cross-case linking failed", err);
          }
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
      void alertDeadLetter(event.id, event.type, msg.slice(0, 300));
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
