// src/lib/ingestion/pipeline.ts
// Universal ingestion pipeline — normalise → resolve → compute → publish.

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveWalletToKol } from "@/lib/kol/identity";
import { computeProceedsForHandle } from "@/lib/kol/proceeds";
import {
  emitWalletLinked,
  emitCasefileIngested,
  emitKolUpdated,
} from "@/lib/events/producer";
import type {
  IngestionSource,
  IngestionJob,
  NormalizedEntity,
} from "./types";
import type { WalletMatchResult } from "@/lib/kol/identity";

// ── Helpers ─────────────────────────────────────────────────────────────────

function checksum(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ETH_RE = /^0x[0-9a-fA-F]{40}$/;
const HANDLE_RE = /^@?[A-Za-z0-9_]{1,50}$/;

// ── ÉTAPE A — Normalize ──────────────────────────────────────────────────────

function normalize(input: string, source: IngestionSource): NormalizedEntity {
  const trimmed = input.trim();

  // ETH/EVM wallet
  if (ETH_RE.test(trimmed)) {
    return { type: "wallet", chain: "ETH", address: trimmed.toLowerCase(), handle: null, amountUsd: null, eventDate: null, rawData: { input: trimmed } };
  }

  // SOL wallet
  if (SOL_RE.test(trimmed) && source !== "twitter_handle") {
    return { type: "wallet", chain: "SOL", address: trimmed, handle: null, amountUsd: null, eventDate: null, rawData: { input: trimmed } };
  }

  // JSON casefile
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const handle = typeof parsed.handle === "string" ? parsed.handle.replace(/^@/, "") : null;
      const amountUsd = typeof parsed.amountUsd === "number" ? parsed.amountUsd : null;
      const eventDate = parsed.eventDate ? new Date(parsed.eventDate as string) : null;
      return { type: "casefile", chain: null, address: null, handle, amountUsd, eventDate, rawData: parsed };
    } catch {
      // fall through to handle
    }
  }

  // CSV Arkham line: txHash,walletAddress,chain,date,amountUsd,...
  if (trimmed.includes(",") && source === "csv_arkham") {
    const parts = trimmed.split(",").map(p => p.trim());
    const txHash = parts[0] ?? null;
    const walletAddress = parts[1] ?? null;
    const chain = parts[2]?.toUpperCase() ?? null;
    const eventDate = parts[3] ? new Date(parts[3]) : null;
    const amountUsd = parts[4] ? Number(parts[4]) : null;
    return {
      type: "proceeds_event",
      chain,
      address: walletAddress,
      handle: null,
      amountUsd: Number.isFinite(amountUsd) ? amountUsd : null,
      eventDate: eventDate && !isNaN(eventDate.getTime()) ? eventDate : null,
      rawData: { txHash, walletAddress, chain, eventDate: parts[3], amountUsd: parts[4] },
    };
  }

  // Twitter handle
  if (HANDLE_RE.test(trimmed)) {
    const handle = trimmed.replace(/^@/, "");
    return { type: "handle", chain: null, address: null, handle, amountUsd: null, eventDate: null, rawData: { input: trimmed } };
  }

  throw new Error(`Cannot normalize input: "${trimmed.slice(0, 80)}"`);
}

// ── ÉTAPE B — Resolve ────────────────────────────────────────────────────────

async function resolve(entity: NormalizedEntity): Promise<WalletMatchResult | null> {
  if (entity.type === "wallet" && entity.address && entity.chain) {
    return resolveWalletToKol(entity.address, entity.chain);
  }

  if (entity.type === "handle" && entity.handle) {
    const profile = await prisma.kolProfile.findFirst({
      where: { handle: { equals: entity.handle, mode: "insensitive" } },
      select: { handle: true },
    });
    if (!profile) return { handle: null, confidence: "unresolved", source: "manual", evidence: [], requiresHumanReview: true };
    return { handle: profile.handle, confidence: "exact", source: "manual", evidence: [`KolProfile match: ${profile.handle}`], requiresHumanReview: false };
  }

  if (entity.type === "proceeds_event" && entity.address && entity.chain) {
    return resolveWalletToKol(entity.address, entity.chain);
  }

  if (entity.type === "casefile" && entity.handle) {
    const profile = await prisma.kolProfile.findFirst({
      where: { handle: { equals: entity.handle, mode: "insensitive" } },
      select: { handle: true },
    });
    if (!profile) return { handle: null, confidence: "unresolved", source: "manual", evidence: [], requiresHumanReview: true };
    return { handle: profile.handle, confidence: "exact", source: "manual", evidence: [`KolProfile match: ${profile.handle}`], requiresHumanReview: false };
  }

  return null;
}

// ── ÉTAPE C — Compute ────────────────────────────────────────────────────────

async function compute(
  entity: NormalizedEntity,
  resolveResult: WalletMatchResult | null,
  dryRun: boolean
): Promise<{ preview: Record<string, unknown>; manualReviewRequired: boolean }> {
  const preview: Record<string, unknown> = { entity, resolveResult };
  let manualReviewRequired = resolveResult?.requiresHumanReview ?? false;

  if (dryRun) return { preview, manualReviewRequired };

  if (entity.type === "wallet" && resolveResult?.confidence === "exact" && resolveResult.handle) {
    emitWalletLinked(resolveResult.handle, entity.address!, entity.chain!);
    await computeProceedsForHandle(resolveResult.handle);
  }

  if (entity.type === "proceeds_event" && entity.address && entity.chain && entity.rawData.txHash) {
    const txHash = String(entity.rawData.txHash);
    if (resolveResult?.confidence === "exact" && resolveResult.handle) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "KolProceedsEvent" (
          id, "kolHandle", "walletAddress", chain, "txHash",
          "eventDate", "amountUsd", "eventType", "ambiguous", "pricingSource"
        )
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::timestamptz, $6, 'TRADE', false, 'arkham_csv')
        ON CONFLICT ("txHash") DO NOTHING
      `,
        resolveResult.handle,
        entity.address,
        entity.chain,
        txHash,
        entity.eventDate ?? new Date(),
        entity.amountUsd ?? 0
      );
    } else {
      manualReviewRequired = true;
    }
  }

  if (entity.type === "casefile" && resolveResult?.confidence === "exact" && resolveResult.handle) {
    emitCasefileIngested(String(entity.rawData.caseId ?? ""), resolveResult.handle);
  }

  if (entity.type === "handle" && resolveResult?.confidence === "exact" && resolveResult.handle) {
    await computeProceedsForHandle(resolveResult.handle);
  }

  return { preview, manualReviewRequired };
}

// ── Main entry ───────────────────────────────────────────────────────────────

export async function ingest(
  input: string,
  source: IngestionSource,
  dryRun = false
): Promise<IngestionJob> {
  const rawInput = input.trim();
  const sourceChecksum = checksum(rawInput);

  const job = await prisma.ingestionJob.create({
    data: { source, rawInput, status: "pending", sourceChecksum, dryRun },
  });

  try {
    // A — Normalize
    const normalizedEntity = normalize(rawInput, source);
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "normalized", normalizedEntity: normalizedEntity as unknown as Prisma.InputJsonValue },
    });

    // B — Resolve
    const resolveResult = await resolve(normalizedEntity);
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "matched", resolveResult: resolveResult as unknown as Prisma.InputJsonValue ?? Prisma.JsonNull },
    });

    // C — Compute
    const { manualReviewRequired } = await compute(normalizedEntity, resolveResult, dryRun);
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "computed", manualReviewRequired },
    });

    // D — Publish
    if (!dryRun && resolveResult?.handle) {
      emitKolUpdated(resolveResult.handle);
    }
    const final = await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: dryRun ? "computed" : "published" },
    });

    return {
      id: final.id,
      source: final.source as IngestionSource,
      rawInput: final.rawInput,
      normalizedEntity: (final.normalizedEntity as unknown as NormalizedEntity) ?? null,
      resolveResult: (final.resolveResult as unknown as WalletMatchResult) ?? null,
      status: final.status as import("./types").IngestionStatus,
      sourceChecksum: final.sourceChecksum,
      dryRun: final.dryRun,
      errorReport: final.errorReport,
      manualReviewRequired: final.manualReviewRequired,
      createdAt: final.createdAt,
      updatedAt: final.updatedAt,
    };
  } catch (err) {
    const errorReport = err instanceof Error ? err.message : String(err);
    const failed = await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "failed", errorReport: errorReport.slice(0, 1000) },
    });
    return {
      id: failed.id,
      source: failed.source as IngestionSource,
      rawInput: failed.rawInput,
      normalizedEntity: null,
      resolveResult: null,
      status: "failed",
      sourceChecksum: failed.sourceChecksum,
      dryRun: failed.dryRun,
      errorReport: failed.errorReport,
      manualReviewRequired: failed.manualReviewRequired,
      createdAt: failed.createdAt,
      updatedAt: failed.updatedAt,
    };
  }
}
