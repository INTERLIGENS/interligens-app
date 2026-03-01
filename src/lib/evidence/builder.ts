import { resolveEntity } from "../entities/registry";

export type EvidenceItem = {
  id: string;
  label: string;
  value: string;
  severity: "low" | "med" | "high" | "critical";
  why_en: string;
  why_fr: string;
  badge?: string;
  url?: string;
};

export function buildOnChainEvidence(params: {
  chain: string;
  provider_used?: string; // @deprecated
  data_source?: "etherscan" | "rpc_primary" | "rpc_fallback" | "unknown";
  source_detail?: string;
  spenders?: string[];
  freezeAuthority?: boolean;
  mintAuthority?: boolean;
  unlimitedCount?: number;
}): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  const ds = params.data_source ?? (params.provider_used ? "etherscan" : undefined);
  const sd = params.source_detail ?? params.provider_used;
  if (ds && sd) {
    const dsLabel: Record<string, string> = {
      etherscan: "Etherscan",
      rpc_primary: "RPC Primary",
      rpc_fallback: "RPC Fallback",
      unknown: "Unknown",
    };
    items.push({
      id: "provider", label: "Data Source",
      value: `${dsLabel[ds] ?? ds} — ${sd.replace("https://","").split("/")[0]}`,
      severity: "low",
      why_en: "On-chain data source used for this scan.",
      why_fr: "Source de données on-chain utilisée pour ce scan.",
    });
  }

  if (params.spenders?.length) {
    const topSpender = params.spenders[0];
    const entity = resolveEntity(params.chain, topSpender);
    items.push({
      id: "counterparty", label: "Top Counterparty",
      value: entity.isOfficial ? entity.name : `${topSpender.slice(0, 8)}... (Unknown)`,
      severity: entity.isOfficial ? "low" : "high",
      why_en: entity.isOfficial ? "Known official protocol." : "Unverified counterparty — potential risk.",
      why_fr: entity.isOfficial ? "Protocole officiel connu." : "Contrepartie non vérifiée — risque potentiel.",
      badge: entity.isOfficial ? "OFFICIAL" : "UNKNOWN",
      url: entity.url,
    });
  }

  if (params.freezeAuthority) {
    items.push({
      id: "freeze_auth", label: "Freeze Authority", value: "ACTIVE", severity: "critical",
      why_en: "Deployer can freeze your tokens at any time.",
      why_fr: "Le déployeur peut geler vos tokens à tout moment.",
      badge: "CRITICAL",
    });
  }

  if (params.mintAuthority) {
    items.push({
      id: "mint_auth", label: "Mint Authority", value: "NOT REVOKED", severity: "critical",
      why_en: "Deployer can mint unlimited supply and dump.",
      why_fr: "Le déployeur peut minter une offre illimitée et dumper.",
      badge: "CRITICAL",
    });
  }

  if ((params.unlimitedCount ?? 0) > 0) {
    items.push({
      id: "unlimited_approvals", label: "Unlimited Approvals", value: `${params.unlimitedCount} detected`, severity: "critical",
      why_en: "Spender has unlimited access to drain your wallet.",
      why_fr: "Le spender a un accès illimité pour vider votre wallet.",
      badge: "CRITICAL",
    });
  }

  return items.slice(0, 3);
}
