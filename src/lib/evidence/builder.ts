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
  provider_used?: string;
  spenders?: string[];
  freezeAuthority?: boolean;
  mintAuthority?: boolean;
  unlimitedCount?: number;
}): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  if (params.provider_used) {
    const providerName = params.provider_used.replace("https://", "").split("/")[0];
    items.push({
      id: "provider", label: "Data Provider", value: providerName, severity: "low",
      why_en: "On-chain data fetched from this RPC provider.",
      why_fr: "Données on-chain récupérées depuis ce fournisseur RPC.",
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
