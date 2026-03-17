// Source trust scoring
// Trusted sources get confidence boosted + IOC auto-routed without needs_manual

export interface TrustProfile {
  handle: string;
  trustLevel: "high" | "medium" | "low";
  autoElevate: boolean; // boost confidence by +0.15
}

const TRUSTED_SOURCES: TrustProfile[] = [
  { handle: "@zachxbt",       trustLevel: "high",   autoElevate: true },
  { handle: "@tayvano_",      trustLevel: "high",   autoElevate: true },
  { handle: "@pcaversaccio",  trustLevel: "high",   autoElevate: true },
  { handle: "@officer_cia",   trustLevel: "medium", autoElevate: false },
  { handle: "@0xfoobar",      trustLevel: "medium", autoElevate: false },
];

export function getTrustProfile(investigatorHandle?: string): TrustProfile | null {
  if (!investigatorHandle) return null;
  const normalized = investigatorHandle.toLowerCase().replace(/^@/, "");
  return TRUSTED_SOURCES.find(s => s.handle.replace(/^@/, "") === normalized) ?? null;
}

export function applyTrustBoost(confidence: number, investigatorHandle?: string): number {
  const trust = getTrustProfile(investigatorHandle);
  if (!trust || !trust.autoElevate) return confidence;
  return Math.min(1.0, confidence + 0.15);
}
