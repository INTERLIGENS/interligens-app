// src/lib/intelligence/retractionEngine.ts
// Correction / false-positive engine.
// Records an amendment, attempts entity update, rebuilds snapshot, emits kol.updated.
// All retractions are persisted as an immutable audit trail in the Retraction table.

import { prisma } from "@/lib/prisma";
import { buildKolCanonicalSnapshot } from "@/lib/kol/canonical";
import { emitKolUpdated } from "@/lib/events/producer";

// ── Public types ─────────────────────────────────────────────────────────────

export type EntityType = "kol_profile" | "casefile" | "score" | "proceeds";
export type RetractionSeverity = "minor" | "major" | "critical";
export type RetractionInitiator = "admin" | "system" | "investigator";
export type RetractionStatus = "pending" | "applied" | "rejected";

export interface RetractionInput {
  entityType: EntityType;
  entityId: string;
  kolHandle: string | null;
  reason: string;
  previousValue: string | null;
  correctedValue: string | null;
  severity: RetractionSeverity;
  initiatedBy: RetractionInitiator;
}

export interface RetractionRecord {
  id: string;
  entityType: EntityType;
  entityId: string;
  kolHandle: string | null;
  reason: string;
  previousValue: string | null;
  correctedValue: string | null;
  severity: RetractionSeverity;
  initiatedBy: RetractionInitiator;
  status: RetractionStatus;
  appliedAt: Date | null;
  createdAt: Date;
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_ENTITY_TYPES: EntityType[] = ["kol_profile", "casefile", "score", "proceeds"];
const VALID_SEVERITIES: RetractionSeverity[] = ["minor", "major", "critical"];
const VALID_INITIATORS: RetractionInitiator[] = ["admin", "system", "investigator"];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRetractionInput(input: Partial<RetractionInput>): ValidationResult {
  const errors: string[] = [];
  if (!input.entityType || !VALID_ENTITY_TYPES.includes(input.entityType)) {
    errors.push(`entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}`);
  }
  if (!input.entityId || typeof input.entityId !== "string" || input.entityId.trim().length === 0) {
    errors.push("entityId is required");
  }
  if (!input.reason || typeof input.reason !== "string" || input.reason.trim().length < 5) {
    errors.push("reason must be at least 5 characters");
  }
  if (input.severity && !VALID_SEVERITIES.includes(input.severity)) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(", ")}`);
  }
  if (input.initiatedBy && !VALID_INITIATORS.includes(input.initiatedBy)) {
    errors.push(`initiatedBy must be one of: ${VALID_INITIATORS.join(", ")}`);
  }
  return { valid: errors.length === 0, errors };
}

// ── Entity mutation helpers ────────────────────────────────────────────────────

async function applyEntityUpdate(input: RetractionInput): Promise<void> {
  switch (input.entityType) {
    case "kol_profile": {
      if (!input.kolHandle) break;
      const note = `[Retraction ${new Date().toISOString().slice(0, 10)}] ${input.reason}${input.correctedValue ? ` → ${input.correctedValue}` : ""}`;
      await prisma.$executeRaw`
        UPDATE "KolProfile"
        SET "internalNote" = CASE
          WHEN "internalNote" IS NULL THEN ${note}
          ELSE "internalNote" || E'\n' || ${note}
        END
        WHERE handle = ${input.kolHandle}
      `;
      break;
    }
    case "proceeds": {
      // Mark the proceeds event as ambiguous if we have the txHash as entityId
      await prisma.$executeRaw`
        UPDATE "KolProceedsEvent"
        SET "ambiguous" = true
        WHERE "txHash" = ${input.entityId}
      `;
      break;
    }
    case "score":
    case "casefile":
      // Score is rebuilt via buildKolCanonicalSnapshot; casefile corrections are manual.
      break;
  }
}

// ── Core engine ───────────────────────────────────────────────────────────────

/**
 * Apply a retraction: update entity, rebuild snapshot, emit event, log.
 * Returns the newly created Retraction record.
 */
export async function applyRetraction(input: RetractionInput): Promise<RetractionRecord> {
  const validation = validateRetractionInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid retraction input: ${validation.errors.join("; ")}`);
  }

  // 1. Insert with status "pending" first
  const id = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "Retraction"
      ("id", "entityType", "entityId", "kolHandle", "reason",
       "previousValue", "correctedValue", "severity", "initiatedBy",
       "status", "appliedAt", "createdAt")
    VALUES
      (gen_random_uuid()::text, ${input.entityType}, ${input.entityId},
       ${input.kolHandle}, ${input.reason}, ${input.previousValue},
       ${input.correctedValue}, ${input.severity}, ${input.initiatedBy},
       'pending', NULL, now())
    RETURNING id
  `.then((rows) => rows[0].id);

  try {
    // 2. Apply entity update
    await applyEntityUpdate(input);

    // 3. Rebuild KolCanonicalSnapshot if we have a handle
    if (input.kolHandle) {
      await buildKolCanonicalSnapshot(input.kolHandle);
    }

    // 4. Emit kol.updated so downstream processors pick up the change
    if (input.kolHandle) {
      emitKolUpdated(input.kolHandle);
    }

    // 5. Mark as applied
    await prisma.$executeRaw`
      UPDATE "Retraction"
      SET "status" = 'applied', "appliedAt" = now()
      WHERE "id" = ${id}
    `;

    return fetchRetractionById(id);
  } catch (err) {
    // If application fails, mark as pending (human must retry)
    console.error("[retractionEngine] applyRetraction entity update failed", err);
    const record = await fetchRetractionById(id);
    return record;
  }
}

/**
 * Reject a retraction (admin decision).
 */
export async function rejectRetraction(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Retraction"
    SET "status" = 'rejected'
    WHERE "id" = ${id} AND "status" = 'pending'
  `;
}

/**
 * Fetch all retractions, optionally filtered by kolHandle or status.
 */
export async function getRetractions(
  handle?: string,
  status?: RetractionStatus,
): Promise<RetractionRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (handle) {
    conditions.push(`"kolHandle" = $${idx++}`);
    params.push(handle);
  }
  if (status) {
    conditions.push(`"status" = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return prisma.$queryRawUnsafe<RetractionRecord[]>(
    `SELECT id, "entityType", "entityId", "kolHandle", "reason",
            "previousValue", "correctedValue", "severity", "initiatedBy",
            "status", "appliedAt", "createdAt"
     FROM "Retraction"
     ${where}
     ORDER BY "createdAt" DESC
     LIMIT 500`,
    ...params,
  );
}

async function fetchRetractionById(id: string): Promise<RetractionRecord> {
  const rows = await prisma.$queryRaw<RetractionRecord[]>`
    SELECT id, "entityType", "entityId", "kolHandle", "reason",
           "previousValue", "correctedValue", "severity", "initiatedBy",
           "status", "appliedAt", "createdAt"
    FROM "Retraction"
    WHERE id = ${id}
  `;
  if (rows.length === 0) throw new Error(`Retraction ${id} not found after insert`);
  return rows[0];
}
