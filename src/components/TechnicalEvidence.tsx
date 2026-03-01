"use client";
import React, { useState } from "react";
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
};

interface Props {
  lang: Lang;
  chain: Chain;
  show: boolean;
  provider_used?: string; // @deprecated
  data_source?: string;
  source_detail?: string;
  counterparties?: string[];
  spenders?: string[];
  freezeAuthority?: boolean;
  mintAuthority?: boolean;
  unlimitedCount?: number;
}

export default function TechnicalEvidence({
  lang, chain, show,
  provider_used, data_source, source_detail, spenders, counterparties, freezeAuthority, mintAuthority, unlimitedCount,
}: Props) {
  if (!show) return null;

  const chainKey = chain === "ethereum" ? "ETH" : "SOL";
  const items: EvidenceItem[] = buildOnChainEvidence({
    chain: chainKey,
    provider_used, data_source, source_detail, counterparties,
    spenders,
    freezeAuthority,
    mintAuthority,
    unlimitedCount,
  });

  // Fallback static items if no dynamic data
  const STATIC: Record<Chain, EvidenceItem[]> = {
    ethereum: [
      { id: "s1", label: "Unlimited Approvals", value: "Check your approvals", severity: "critical",
        why_en: "Grants full access to your tokens; a malicious contract can drain your wallet anytime.",
        why_fr: "Donne un accès total à vos jetons ; un contrat malveillant peut vider votre wallet." },
      { id: "s2", label: "Counterparty Reputation", value: "Verify before signing",  severity: "high",
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

  const displayItems = items.length > 0 ? items : STATIC[chain];

  return (
    <div className="mt-6 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">
        {lang === "fr" ? "Preuves on-chain vérifiables" : "Verifiable On-Chain Evidence"}
      </p>
      {displayItems.map((item) => (
        <div key={item.id} className={`rounded-xl border p-4 ${SEVERITY_COLOR[item.severity]}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
            <div className="flex items-center gap-2">
              {item.badge && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${BADGE_COLOR[item.badge] ?? BADGE_COLOR.UNKNOWN}`}>
                  {item.badge}
                </span>
              )}
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] text-zinc-500 hover:text-white underline">
                  ↗
                </a>
              )}
            </div>
          </div>
          <p className="text-xs font-mono mb-1 opacity-80">{item.value}</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {lang === "fr" ? item.why_fr : item.why_en}
          </p>
        </div>
      ))}
    </div>
  );
}
