import { SignalResult, LaundryRisk, RecoveryDifficulty } from "./signals";

export function computeLaundryRisk(signals: SignalResult[]): LaundryRisk {
  const families = new Set(signals.map(s => s.family));
  const hasConfirmedMixer = signals.some(s => s.family === "MIXER" && s.confirmed);
  const hasDeg = families.has("DEG");
  const hasFrag = families.has("FRAG");
  const hasBridge = families.has("BRIDGE");
  const hasPriv = families.has("PRIV");

  if ((hasFrag && hasConfirmedMixer) || (hasFrag && hasPriv && hasDeg)) return "CRITICAL";
  if ((hasFrag && hasBridge) || (hasFrag && hasDeg) || hasConfirmedMixer) return "HIGH";
  if (families.size >= 2) return "MODERATE";
  return "LOW";
}

export function computeRecoveryDifficulty(
  signals: SignalResult[],
  trailBreakHop?: number
): RecoveryDifficulty {
  if (trailBreakHop && trailBreakHop <= 3) return "SEVERE";
  const hasPrivOrMixer = signals.some(
    s => s.family === "PRIV" || (s.family === "MIXER" && s.confirmed)
  );
  if (hasPrivOrMixer) return "SEVERE";
  if (signals.some(s => s.family === "DEG")) return "PARTIAL";
  return "LOW";
}

export function computeTrailType(signals: SignalResult[]): string {
  const families = signals.map(s => s.family);
  if (families.includes("FRAG") && families.includes("BRIDGE") && families.includes("MIXER"))
    return "Multi-hop fragmentation with bridge cascade and mixer exposure";
  if (families.includes("FRAG") && families.includes("BRIDGE"))
    return "Multi-hop fragmentation with cross-chain exit";
  if (families.includes("FRAG") && families.includes("PRIV"))
    return "Fragmentation with privacy rail transition";
  if (families.includes("MIXER"))
    return families.includes("FRAG") ? "Fragmented routing with mixer exposure" : "Direct mixer exposure";
  if (families.includes("FRAG") && families.includes("CASH"))
    return "Fragmentation with probable cash-out preparation";
  if (families.includes("DEG"))
    return "Trail degradation — routing becomes unresolvable";
  return "Obfuscated routing pattern detected";
}
