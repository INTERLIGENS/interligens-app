import type { AnalyticsEvent } from "./types";

export function logEvent(event: AnalyticsEvent): void {
  console.log(JSON.stringify(event));
}
