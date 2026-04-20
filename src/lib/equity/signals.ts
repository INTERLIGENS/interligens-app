/**
 * EquityWatch — admin signal board helpers.
 *
 * Thin wrappers over the Prisma `EquitySignal` delegate. All functions
 * are admin-surface only; call sites (page, route handler) gate via
 * `requireAdminCookie` / `requireAdminApi` before invoking these.
 *
 * The Prisma table ships via `prisma/migrations/manual_equity_watch/
 * migration.sql`. Until that migration is applied to Neon, these helpers
 * will throw at runtime — the admin UI catches the throw and renders the
 * "migration pending" placeholder rather than a generic 500.
 */

import { prisma } from "@/lib/prisma";
import type { EquitySignal } from "@prisma/client";

export type SuspectLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface NewEquitySignalInput {
  ticker: string;
  entityName: string;
  tradeDate: Date;
  tweetDate?: Date | null;
  deltaHours?: number | null;
  suspectLevel?: SuspectLevel;
  notes?: string | null;
  source: string;
}

export async function addEquitySignal(
  input: NewEquitySignalInput,
): Promise<EquitySignal> {
  const ticker = input.ticker.trim().toUpperCase();
  if (!ticker) throw new Error("ticker required");
  if (!input.entityName.trim()) throw new Error("entityName required");
  if (!input.source.trim()) throw new Error("source required");

  return prisma.equitySignal.create({
    data: {
      ticker,
      entityName: input.entityName.trim(),
      tradeDate: input.tradeDate,
      tweetDate: input.tweetDate ?? null,
      deltaHours: input.deltaHours ?? null,
      suspectLevel: input.suspectLevel ?? "LOW",
      notes: input.notes?.trim() ?? null,
      source: input.source.trim(),
    },
  });
}

export async function getRecentSignals(limit = 100): Promise<EquitySignal[]> {
  return prisma.equitySignal.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(500, limit)),
  });
}

export async function getSignalsByTicker(
  ticker: string,
  limit = 100,
): Promise<EquitySignal[]> {
  return prisma.equitySignal.findMany({
    where: { ticker: ticker.trim().toUpperCase() },
    orderBy: { tradeDate: "desc" },
    take: Math.max(1, Math.min(500, limit)),
  });
}
