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
  explorer_url?: string;
};

function explorerUrl(chain: string, address: string): string {
  const c = chain.toUpperCase();
  if (c === "ETH") return `https://etherscan.io/address/${address}`;
  if (c === "BSC") return `https://bscscan.com/address/${address}`;
  if (c === "SOL") return `https://solscan.io/account/${address}`;
  return `https://etherscan.io/address/${address}`;
}

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

  // Data source
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

  // Spenders — iterate top 5, resolve each
  if (params.spenders?.length) {
    for (let i = 0; i < Math.min(params.spenders.length, 5); i++) {
      const addr = params.spenders[i];
      const entity = resolveEntity(params.chain, addr);
      const isOfficial = entity.isOfficial;
      const shortAddr = `${addr.slice(0, 8)}...${addr.slice(-4)}`;
      items.push({
        id: `spender_${i}`,
        label: "Spender identified",
        value: isOfficial ? `${entity.name} (official)` : `Unknown spender — ${shortAddr}`,
        severity: isOfficial ? "low" : "high",
        why_en: isOfficial
          ? `${entity.name} is a verified official protocol.`
          : "Unverified spender — could be a drain contract.",
        why_fr: isOfficial
          ? `${entity.name} est un protocole officiel vérifié.`
          : "Spender non vérifié — pourrait être un contrat de drain.",
        badge: isOfficial ? "OFFICIAL" : "UNKNOWN",
        url: entity.url,
        explorer_url: explorerUrl(params.chain, addr),
      });
    }
  }

  // Freeze authority
  if (params.freezeAuthority) {
    items.push({
      id: "freeze_auth", label: "Freeze Authority", value: "ACTIVE", severity: "critical",
      why_en: "Deployer can freeze your tokens at any time.",
      why_fr: "Le déployeur peut geler vos tokens à tout moment.",
      badge: "CRITICAL",
    });
  }

  // Mint authority
  if (params.mintAuthority) {
    items.push({
      id: "mint_auth", label: "Mint Authority", value: "NOT REVOKED", severity: "critical",
      why_en: "Deployer can mint unlimited supply and dump.",
      why_fr: "Le déployeur peut minter une offre illimitée et dumper.",
      badge: "CRITICAL",
    });
  }

  // Unlimited approvals
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
