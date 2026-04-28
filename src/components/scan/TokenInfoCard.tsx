"use client";
import React, { useState } from "react";
import type { ScanContextResponse } from "@/app/api/v1/scan-context/route";

export interface TokenInfoCardProps {
  data: ScanContextResponse | null;
  loading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatUsd(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)         return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatPrice(v: number | null): string {
  if (v === null) return "";
  if (v < 0.00001) return `$${v.toExponential(2)}`;
  if (v < 0.01)    return `$${v.toFixed(6)}`;
  if (v < 1)       return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#FF6B00" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" stroke="#666" strokeWidth="1" />
      <path d="M3.5 3.5V2a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H7" stroke="#666" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      aria-label="Copy address"
      className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
    >
      <CopyIcon copied={copied} />
    </button>
  );
}

// ─── Chain badge ──────────────────────────────────────────────────────────────

function ChainBadge({ chain }: { chain: string }) {
  return (
    <span className="text-[9px] font-black uppercase tracking-widest text-[#FF6B00] border border-[#FF6B00]/30 rounded px-1 py-px leading-none">
      {chain}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex items-center gap-3 py-1 animate-pulse">
      <div className="h-6 w-6 rounded-full bg-[#1a1a1a] shrink-0" />
      <div className="h-3 w-28 rounded bg-[#1a1a1a]" />
      <div className="h-3 w-16 rounded bg-[#1a1a1a] ml-auto" />
    </div>
  );
}

// ─── TOKEN variant — 2 rows, compact ─────────────────────────────────────────

function TokenVariant({ data }: { data: ScanContextResponse }) {
  const { tokenInfo: t, marketData: m, chain } = data;
  const addr = t?.address ?? data.target;

  return (
    <div className="py-1.5 space-y-0.5">
      {/* Row 1 — logo · name · symbol · chain · price */}
      <div className="flex items-center gap-1.5 min-w-0">
        {t?.logoUrl ? (
          <img
            src={t.logoUrl}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 rounded-full object-cover shrink-0 bg-[#111]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="h-5 w-5 rounded-full bg-[#1a1a1a] shrink-0" />
        )}

        <span className="text-[13px] font-bold text-white truncate">
          {t?.name ?? "Unknown"}
          {t?.symbol && (
            <span className="text-[#A8A8A8] font-normal"> · ${t.symbol}</span>
          )}
        </span>

        <ChainBadge chain={chain} />

        {m?.priceUsd != null && (
          <span className="ml-auto shrink-0 text-[13px] font-bold text-[#FF6B00]">
            {formatPrice(m.priceUsd)}
          </span>
        )}
      </div>

      {/* Row 2 — mcap · vol · age · address */}
      <div className="flex items-center gap-2 text-[10px] text-[#A8A8A8] pl-6">
        {m?.marketCapUsd != null && (
          <span>MCap <span className="text-[#FFFFFF]">{formatUsd(m.marketCapUsd)}</span></span>
        )}
        {m?.volume24hUsd != null && (
          <span>Vol <span className="text-[#FFFFFF]">{formatUsd(m.volume24hUsd)}</span></span>
        )}
        {t?.tokenAgeDays != null && (
          <span>Age <span className="text-[#FFFFFF]">{t.tokenAgeDays}d</span></span>
        )}
        <span className="ml-auto flex items-center font-mono">
          {truncateAddress(addr)}
          <CopyButton text={addr} />
        </span>
      </div>
    </div>
  );
}

// ─── WALLET variant — 1 row, minimal ─────────────────────────────────────────

function WalletVariant({ data }: { data: ScanContextResponse }) {
  const addr = data.target;
  return (
    <div className="flex items-center gap-2 py-1.5 text-[10px] text-[#A8A8A8]">
      <span className="font-black uppercase tracking-widest text-[#A8A8A8]">Wallet</span>
      <span className="text-[#444]">·</span>
      <ChainBadge chain={data.chain} />
      <span className="ml-auto flex items-center font-mono">
        {truncateAddress(addr)}
        <CopyButton text={addr} />
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TokenInfoCard({ data, loading = false }: TokenInfoCardProps) {
  if (loading) return <Skeleton />;
  if (!data) return null;
  if (data.entityType === "wallet") return <WalletVariant data={data} />;
  return <TokenVariant data={data} />;
}
