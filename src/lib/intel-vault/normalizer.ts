// src/lib/intel-vault/normalizer.ts
import type { NormalizedRow, ParseOptions, Chain, LabelType, Confidence, Visibility } from "./types";
import { detectChain } from "./address";

export function buildRow(
  address: string,
  opts: ParseOptions & { evidence?: string }
): NormalizedRow {
  const chain: Chain = opts.defaultChain ?? detectChain(address) as Chain;
  return {
    chain,
    address: address.trim(),
    labelType: (opts.defaultLabelType ?? "other") as LabelType,
    label: opts.label ?? opts.sourceName ?? "unknown",
    confidence: opts.confidence ?? "low",
    sourceName: opts.sourceName ?? "unknown",
    sourceUrl: opts.sourceUrl,
    evidence: opts.evidence,
    visibility: opts.visibility ?? "internal_only",
    license: undefined,
    tosRisk: "low",
  };
}
