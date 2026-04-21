import type { ClassificationContext } from "@/lib/contracts/website";

/**
 * Shared classification context for mocks. Not a real session id — deliberately
 * stable across renders so snapshots are deterministic.
 */
export const MOCK_CLASSIFICATION: ClassificationContext = {
  sessionId: "EKvYHCRh",
  issuedAt: "2026-04-18T22:17:00Z",
  standard: "Forensic Editorial v2",
  jurisdictionHint: "GLOBAL",
};
