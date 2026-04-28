"use client";
import React, { useState } from "react";
import type { ScanContextResponse } from "@/app/api/v1/scan-context/route";

export interface TokenInfoCardProps {
  data: ScanContextResponse | null;
  loading?: boolean;
}

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    });
  return (
    <button
      onClick={copy}
      aria-label="Copy address"
      className="shrink-0 text-[#3a3a3a] hover:text-[#FF6B00] transition-colors"
    >
      {done ? (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
          <path d="M3.5 3.5V2a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

function ChainBadge({ chain }: { chain: string }) {
  return (
    <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-[#FF6B00]/70 border border-[#FF6B00]/20 rounded px-1.5 py-px leading-none">
      {chain}
    </span>
  );
}

// The shared identity bar shell — bg slightly above #0A0A0A hero, fine border
function IdentityBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1E1E1E] rounded-lg overflow-hidden">
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1E1E1E] rounded-lg animate-pulse">
      <div className="h-3 w-20 rounded bg-[#1C1C1C] shrink-0" />
      <div className="h-3 w-12 rounded bg-[#1C1C1C] shrink-0" />
      <div className="h-4 w-8 rounded bg-[#1C1C1C] shrink-0" />
      <div className="text-[#1C1C1C] text-xs shrink-0 select-none">|</div>
      <div className="h-3 w-24 rounded bg-[#1C1C1C] min-w-0" />
    </div>
  );
}

function TokenVariant({ data }: { data: ScanContextResponse }) {
  const { tokenInfo: t, chain } = data;
  const addr = t?.address ?? data.target;

  return (
    <IdentityBar>
      {/* Name — dominant */}
      <span className="shrink-0 text-[13px] font-bold text-white tracking-wide">
        {t?.name ?? "Unknown"}
      </span>

      {/* Ticker — secondary */}
      {t?.symbol && (
        <span className="shrink-0 text-[11px] text-[#4a4a4a]">
          ${t.symbol}
        </span>
      )}

      {/* Chain badge */}
      <ChainBadge chain={chain} />

      {/* Thin structural separator */}
      <span className="shrink-0 text-[#252525] text-xs select-none">|</span>

      {/* Address — utility, truncates naturally */}
      <span className="text-[10px] font-mono text-[#444] truncate min-w-0">
        {truncate(addr)}
      </span>

      {/* Copy */}
      <CopyButton text={addr} />
    </IdentityBar>
  );
}

function WalletVariant({ data }: { data: ScanContextResponse }) {
  const addr = data.target;
  return (
    <IdentityBar>
      <span className="shrink-0 text-[11px] font-black uppercase tracking-widest text-[#363636]">
        Wallet
      </span>
      <ChainBadge chain={data.chain} />
      <span className="shrink-0 text-[#252525] text-xs select-none">|</span>
      <span className="text-[10px] font-mono text-[#444] truncate min-w-0">
        {truncate(addr)}
      </span>
      <CopyButton text={addr} />
    </IdentityBar>
  );
}

export default function TokenInfoCard({ data, loading = false }: TokenInfoCardProps) {
  if (loading) return <Skeleton />;
  if (!data) return null;
  if (data.entityType === "wallet") return <WalletVariant data={data} />;
  return <TokenVariant data={data} />;
}
