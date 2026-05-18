import { logEvent } from "./logger";
import type { EventData } from "./types";

export function logScan(data: Pick<EventData, "address" | "chain" | "score" | "tier" | "source" | "duration_ms">): void {
  logEvent({ type: "SCAN", timestamp: new Date().toISOString(), data });
}

export function logPageView(data: Pick<EventData, "source">): void {
  logEvent({ type: "PAGE_VIEW", timestamp: new Date().toISOString(), data });
}

export function logError(data: Pick<EventData, "error" | "source" | "address">): void {
  logEvent({ type: "ERROR", timestamp: new Date().toISOString(), data });
}

export function logPartnerApi(data: Pick<EventData, "address" | "chain" | "score" | "tier" | "duration_ms">): void {
  logEvent({ type: "PARTNER_API", timestamp: new Date().toISOString(), data });
}
