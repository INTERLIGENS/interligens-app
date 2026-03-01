import { resolveEntity } from "../entities/registry";
import { isKnownBad } from "../entities/knownBad";

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
  rpc_fallback_used?: boolean;
  cache_hit?: boolean;
  rpc_down?: boolean;
  rpc_error?: string;
  spenders?: string[];
  counterparties?: string[];
  freezeAuthority?: boolean;
  mintAuthority?: boolean;
  unlimitedCount?: number;
}): EvidenceItem[] {
  // Priority buckets: CRITICAL(known_bad) > OFFICIAL > RPC_SOURCE > others
  const criticalItems: EvidenceItem[] = [];
  const officialItems: EvidenceItem[] = [];
  const rpcItems: EvidenceItem[] = [];
  const otherItems: EvidenceItem[] = [];

  // 1) RPC source item (always computed, placed in rpcItems)
  const ds = params.data_source ?? (params.provider_used ? "etherscan" : undefined);
  const sd = params.source_detail ?? params.provider_used;
  const isFallback = params.rpc_fallback_used || ds === "rpc_fallback";

  if (params.rpc_down) {
    rpcItems.push({
      id: "rpc_down", label: "RPC Unavailable",
      value: params.rpc_error ?? "All RPC endpoints failed",
      severity: "med",
      why_en: "On-chain RPC data could not be retrieved. Results may be incomplete.",
      why_fr: "Les données RPC on-chain n'ont pas pu être récupérées. Résultats potentiellement incomplets.",
      badge: "FALLBACK",
    });
  } else if (ds && sd) {
    const dsLabel: Record<string, string> = {
      etherscan: "Etherscan",
      rpc_primary: "RPC Primary",
      rpc_fallback: "RPC Fallback",
      unknown: "Unknown",
    };
    rpcItems.push({
      id: "provider", label: "Data Source",
      value: `${dsLabel[ds] ?? ds} — ${sd.replace("https://","").split("/")[0]}`,
      severity: isFallback ? "med" : "low",
      why_en: isFallback
        ? "Primary RPC unavailable — fallback endpoint used."
        : "On-chain data source used for this scan.",
      why_fr: isFallback
        ? "RPC primaire indisponible — endpoint de secours utilisé."
        : "Source de données on-chain utilisée pour ce scan.",
      badge: isFallback ? "FALLBACK" : undefined,
    });
  }

  // 2) Known-bad check (CRITICAL bucket)
  const allAddrs = [...(params.spenders ?? []), ...(params.counterparties ?? [])];
  const seenBad = new Set<string>();
  for (const addr of allAddrs) {
    if (seenBad.has(addr.toLowerCase())) continue;
    const bad = isKnownBad(params.chain, addr);
    if (bad) {
      seenBad.add(addr.toLowerCase());
      criticalItems.push({
        id: `known_bad_${criticalItems.length}`,
        label: "Known bad address",
        value: `${bad.label} — ${addr.slice(0, 8)}...${addr.slice(-4)}`,
        severity: "critical",
        why_en: `This address is flagged as ${bad.category} (confidence: ${bad.confidence}).`,
        why_fr: `Cette adresse est signalée comme ${bad.category} (confiance: ${bad.confidence}).`,
        badge: "CRITICAL",
        explorer_url: explorerUrl(params.chain, addr),
      });
    }
  }

  // 3) Spenders (OFFICIAL bucket if official, otherItems if unknown)
  if (params.spenders?.length) {
    for (let i = 0; i < Math.min(params.spenders.length, 5); i++) {
      const addr = params.spenders[i];
      if (seenBad.has(addr.toLowerCase())) continue;
      const entity = resolveEntity(params.chain, addr);
      const shortAddr = `${addr.slice(0, 8)}...${addr.slice(-4)}`;
      const item: EvidenceItem = {
        id: `spender_${i}`,
        label: "Spender identified",
        value: entity.isOfficial ? `${entity.name} (official)` : `Unknown spender — ${shortAddr}`,
        severity: entity.isOfficial ? "low" : "high",
        why_en: entity.isOfficial
          ? `${entity.name} is a verified official protocol.`
          : "Unverified spender — could be a drain contract.",
        why_fr: entity.isOfficial
          ? `${entity.name} est un protocole officiel vérifié.`
          : "Spender non vérifié — pourrait être un contrat de drain.",
        badge: entity.isOfficial ? "OFFICIAL" : "UNKNOWN",
        url: entity.url,
        explorer_url: explorerUrl(params.chain, addr),
      };
      if (entity.isOfficial) officialItems.push(item);
      else otherItems.push(item);
    }
  }

  // 4) Counterparties (max 2, OFFICIAL or other)
  if (params.counterparties?.length) {
    let cpCount = 0;
    for (let i = 0; i < Math.min(params.counterparties.length, 5); i++) {
      if (cpCount >= 2) break;
      const addr = params.counterparties[i];
      if (seenBad.has(addr.toLowerCase())) continue;
      const entity = resolveEntity(params.chain, addr);
      const shortAddr = `${addr.slice(0, 8)}...${addr.slice(-4)}`;
      const item: EvidenceItem = {
        id: `counterparty_${i}`,
        label: "Counterparty identified",
        value: entity.isOfficial ? `${entity.name} (official)` : `Unknown — ${shortAddr}`,
        severity: entity.isOfficial ? "low" : "high",
        why_en: entity.isOfficial
          ? `${entity.name} is a verified official protocol.`
          : "Unverified counterparty — assess risk before interacting.",
        why_fr: entity.isOfficial
          ? `${entity.name} est un protocole officiel vérifié.`
          : "Contrepartie non vérifiée — évaluez le risque avant d'interagir.",
        badge: entity.isOfficial ? "OFFICIAL" : "UNKNOWN",
        url: entity.url,
        explorer_url: explorerUrl(params.chain, addr),
      };
      if (entity.isOfficial) officialItems.push(item);
      else otherItems.push(item);
      cpCount++;
    }
  }

  // 5) Freeze / mint / unlimited (other)
  if (params.freezeAuthority) {
    otherItems.push({
      id: "freeze_auth", label: "Freeze Authority", value: "ACTIVE", severity: "critical",
      why_en: "Deployer can freeze your tokens at any time.",
      why_fr: "Le déployeur peut geler vos tokens à tout moment.",
      badge: "CRITICAL",
    });
  }
  if (params.mintAuthority) {
    otherItems.push({
      id: "mint_auth", label: "Mint Authority", value: "NOT REVOKED", severity: "critical",
      why_en: "Deployer can mint unlimited supply and dump.",
      why_fr: "Le déployeur peut minter une offre illimitée et dumper.",
      badge: "CRITICAL",
    });
  }
  if ((params.unlimitedCount ?? 0) > 0) {
    otherItems.push({
      id: "unlimited_approvals", label: "Unlimited Approvals", value: `${params.unlimitedCount} detected`, severity: "critical",
      why_en: "Spender has unlimited access to drain your wallet.",
      why_fr: "Le spender a un accès illimité pour vider votre wallet.",
      badge: "CRITICAL",
    });
  }

  // Priority merge: CRITICAL > OFFICIAL > RPC_SOURCE(always kept if fallback) > others
  // If rpc_fallback_used, guarantee rpcItems slot in top 3
  const CAP = 3;
  const merged: EvidenceItem[] = [];
  merged.push(...criticalItems);
  merged.push(...officialItems);

  // Reserve slot for RPC item if fallback or rpc_down
  const rpcMustShow = isFallback || params.rpc_down;
  if (!rpcMustShow) {
    // Fill normally
    merged.push(...rpcItems);
    merged.push(...otherItems);
    return merged.slice(0, CAP);
  } else {
    // Guarantee rpc item appears — take top (CAP-1) from critical+official+other, then add rpc
    const withoutRpc = [...criticalItems, ...officialItems, ...otherItems];
    const topN = withoutRpc.slice(0, CAP - 1);
    return [...topN, ...rpcItems.slice(0, 1)];
  }
}
