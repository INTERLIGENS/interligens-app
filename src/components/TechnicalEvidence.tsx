"use client";
import React from "react";
import { buildOnChainEvidence, type EvidenceItem } from "@/lib/evidence/builder";

type Lang = "en" | "fr";
type Chain = "ethereum" | "solana";

const SEVERITY_COLOR: Record<string, string> = {
  low:      "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
  med:      "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  high:     "text-[#F85B05] border-[#F85B05]/30 bg-[#F85B05]/5",
  critical: "text-red-500 border-red-500/30 bg-red-500/5",
};

const BADGE_COLOR: Record<string, string> = {
  OFFICIAL: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  UNKNOWN:  "bg-zinc-800 text-zinc-400 border border-zinc-700",
  CRITICAL: "bg-red-500/10 text-red-400 border border-red-500/30",
  FALLBACK: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
};

// Detect if value looks like an address → apply break-all
function isAddress(v: string): boolean {
  return /^(0x[a-fA-F0-9]{8}|[1-9A-HJ-NP-Za-km-z]{8})/.test(v.trim());
}

interface Props {
  lang: Lang;
  chain: Chain;
  show: boolean;
  provider_used?: string;
  data_source?: string | any;
  source_detail?: string;
  rpc_fallback_used?: boolean;
  cache_hit?: boolean;
  rpc_down?: boolean;
  rpc_error?: string;
  counterparties?: string[];
  spenders?: string[];
  freezeAuthority?: boolean;
  mintAuthority?: boolean;
  unlimitedCount?: number;
}

export default function TechnicalEvidence({
  lang, chain, show,
  provider_used, data_source, source_detail, rpc_fallback_used, cache_hit,
  rpc_down, rpc_error, spenders, counterparties, freezeAuthority, mintAuthority, unlimitedCount,
}: Props) {
  if (!show) return null;

  const chainKey = chain === "ethereum" ? "ETH" : "SOL";

  // Only use builder — no local additions
  const items: EvidenceItem[] = buildOnChainEvidence({
    chain: chainKey,
    provider_used, data_source: (data_source as any), source_detail, rpc_fallback_used, cache_hit,
    rpc_down, rpc_error, counterparties, spenders,
    freezeAuthority, mintAuthority, unlimitedCount,
  });

  // Static fallback (max 3) only when builder returns nothing
  const STATIC: Record<Chain, EvidenceItem[]> = {
    ethereum: [
      { id: "s1", label: "Unlimited Approvals", value: "Check your approvals", severity: "critical",
        why_en: "Grants full access to your tokens; a malicious contract can drain your wallet anytime.",
        why_fr: "Donne un accès total à vos jetons ; un contrat malveillant peut vider votre wallet." },
      { id: "s2", label: "Counterparty Reputation", value: "Verify before signing", severity: "high",
        why_en: "Interaction with fresh addresses often indicates sybil attacks or rug-pull setups.",
        why_fr: "L'interaction avec des adresses récentes indique souvent des rug-pulls." },
      { id: "s3", label: "Hidden DelegateCall", value: "Check proxy contracts", severity: "high",
        why_en: "Allows the contract to execute external logic, bypassing safety guards.",
        why_fr: "Permet au contrat d'exécuter une logique externe, contournant les sécurités." },
    ],
    solana: [
      { id: "s1", label: "Freeze Authority", value: "Check token config", severity: "critical",
        why_en: "The mint authority can freeze your tokens, preventing any sell or transfer.",
        why_fr: "L'autorité de mint peut geler vos jetons, empêchant toute vente ou transfert." },
      { id: "s2", label: "Mutable Metadata", value: "Check on-chain metadata", severity: "med",
        why_en: "The project can change the token's name/image to impersonate others.",
        why_fr: "Le projet peut changer le nom/image du jeton pour usurper une identité." },
      { id: "s3", label: "Unknown Programs", value: "Verify all interactions", severity: "high",
        why_en: "Transactions interact with unofficial programs that haven't been audited.",
        why_fr: "La transaction interagit avec des programmes non officiels, sans audit." },
    ],
  };

  const displayItems = (items.length > 0 ? items : STATIC[chain]).slice(0, 3);

  return (
    <div className="mt-6 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">
        {lang === "fr" ? "Preuves on-chain vérifiables" : "Verifiable On-Chain Evidence"}
        <span className="ml-2 text-zinc-700">({displayItems.length}/3)</span>
      </p>

      {displayItems.map((item) => (
        <div key={item.id} className={`rounded-xl border p-4 ${SEVERITY_COLOR[item.severity]}`}>

          {/* Row 1: label + badge */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-widest shrink-0">
              {item.label}
            </span>
            {item.badge && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${BADGE_COLOR[item.badge] ?? BADGE_COLOR.UNKNOWN}`}>
                {item.badge}
              </span>
            )}
          </div>

          {/* Row 2: value (break-all if address) */}
          <p className={`font-mono mb-1 opacity-80 ${isAddress(item.value) ? "text-[10px] break-all" : "text-xs truncate"}`}>
            {item.value}
          </p>

          {/* Row 3: why (1 line) */}
          <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
            {lang === "fr" ? item.why_fr : item.why_en}
          </p>

          {/* Row 4: Explorer button */}
          {item.explorer_url && (
            <a
              href={item.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
            >
              Explorer ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
