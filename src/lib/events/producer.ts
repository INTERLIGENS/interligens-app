// src/lib/events/producer.ts
// Fire-and-forget event emitters. Each function inserts a DomainEvent row
// then immediately invokes processEvent() without blocking the caller.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { processEvent } from "./processor";

type EventType =
  | "scan.completed"
  | "wallet.linked"
  | "proceeds.recomputed"
  | "kol.updated"
  | "casefile.ingested";

async function emit(type: EventType, payload: Record<string, unknown>): Promise<void> {
  try {
    const event = await prisma.domainEvent.create({
      data: { type, payload: payload as Prisma.InputJsonValue, status: "pending" },
    });
    // Background — do not await, do not let failure propagate to caller
    void processEvent(event).catch(() => {});
  } catch {
    // Emit failure must never surface to the caller
  }
}

export function emitScanCompleted(
  address: string,
  chain: string,
  tigerscore: number
): void {
  void emit("scan.completed", { address, chain, tigerscore });
}

export function emitWalletLinked(
  handle: string,
  address: string,
  chain: string
): void {
  void emit("wallet.linked", { handle, address, chain });
}

export function emitProceedsRecomputed(
  handle: string,
  newTotal: number
): void {
  void emit("proceeds.recomputed", { handle, newTotal });
}

export function emitKolUpdated(handle: string): void {
  void emit("kol.updated", { handle });
}

export function emitCasefileIngested(
  caseId: string,
  handle: string
): void {
  void emit("casefile.ingested", { caseId, handle });
}
