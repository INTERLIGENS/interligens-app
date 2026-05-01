export type EventType = "SCAN" | "PAGE_VIEW" | "ERROR" | "PARTNER_API";

export interface EventData {
  address?: string;
  chain?: string;
  score?: number;
  tier?: string;
  source?: "demo" | "scan" | "partner" | "mobile";
  duration_ms?: number;
  error?: string;
}

export interface AnalyticsEvent {
  type: EventType;
  timestamp: string;
  data: EventData;
}
