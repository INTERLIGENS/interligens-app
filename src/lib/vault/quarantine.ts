// src/lib/vault/quarantine.ts
export type QuarantineReason =
  | "license_missing"
  | "mixed_chains"
  | "invalid_ratio"
  | "weak_evidence"
  | "source_paused";

export interface QuarantineResult {
  quarantine: boolean;
  reasons: QuarantineReason[];
  warnings: string[];
}

export interface QuarantineInput {
  inputType: string;
  license?: string | null;
  sourceStatus?: string;
  sourceType?: string;
  chains: string[];
  totalRows: number;
  invalidRows: number;
  labelTypes: string[];
  hasEvidence: boolean;
}

const HIGH_RISK_LABELS = ["scam","phishing","drainer","exploiter"];
const COMMUNITY_SOURCES = ["investigator","community"];

export function evaluateQuarantine(input: QuarantineInput): QuarantineResult {
  const reasons: QuarantineReason[] = [];
  const warnings: string[] = [];

  // 1. License missing for external sources
  const externalTypes = ["url","file"];
  if (externalTypes.includes(input.inputType) && !input.license) {
    reasons.push("license_missing");
    warnings.push("License manquante pour source externe");
  }

  // 2. Mixed chains
  const uniqueChains = [...new Set(input.chains.filter(Boolean))];
  if (uniqueChains.length > 1) {
    reasons.push("mixed_chains");
    warnings.push(`Chaînes mixtes détectées: ${uniqueChains.join(", ")}`);
  }

  // 3. Invalid address ratio > 5%
  if (input.totalRows > 0) {
    const ratio = input.invalidRows / input.totalRows;
    if (ratio > 0.05) {
      reasons.push("invalid_ratio");
      warnings.push(`Taux d'adresses invalides: ${(ratio * 100).toFixed(1)}%`);
    }
  }

  // 4. High-risk label + weak community source
  const hasHighRisk = input.labelTypes.some(l => HIGH_RISK_LABELS.includes(l));
  const isCommunity = input.sourceType && COMMUNITY_SOURCES.includes(input.sourceType);
  if (hasHighRisk && isCommunity && !input.hasEvidence) {
    reasons.push("weak_evidence");
    warnings.push("Label à haut risque sans evidence depuis source communautaire");
  }

  // 5. Source paused
  if (input.sourceStatus === "paused") {
    reasons.push("source_paused");
    warnings.push("Source en pause");
  }

  return { quarantine: reasons.length > 0, reasons, warnings };
}
