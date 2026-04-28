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
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000)     return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)         return `$${(value / 1_000).toFixed(2)}K`;
  if (value < 0.01)           return `$${value.toExponential(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  if (value < 0.0001) return `$${value.toExponential(2)}`;
  if (value < 1)      return `$${value.toFixed(6)}`;
  return `$${value.toFixed(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChainBadge({ chain }: { chain: string }) {
  return (
    <span
      className="shrink-0 rounded border border-[#FF6B00]/40 bg-[#FF6B00]/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#FF6B00]"
    >
      {chain}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      aria-label="Copy address"
      className="ml-1 shrink-0 text-[#FF6B00] opacity-60 hover:opacity-100 transition-opacity"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 6l3 3 5-5" stroke="#FF6B00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="4" y="4" width="7" height="7" rx="1" stroke="#FF6B00" strokeWidth="1.2" />
          <path d="M4 4V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H8" stroke="#FF6B00" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="1" y="5" width="18" height="12" rx="2" stroke="#A8A8A8" strokeWidth="1.4" />
      <path d="M1 8h18" stroke="#A8A8A8" strokeWidth="1.4" />
      <circle cx="14.5" cy="12" r="1.5" fill="#A8A8A8" />
      <path d="M5 5V4a3 3 0 016 0v1" stroke="#A8A8A8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="w-full rounded border border-[#1F1F1F] bg-[#000000] p-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[#111]" />
          <div className="h-4 w-32 rounded bg-[#111]" />
        </div>
        <div className="h-5 w-10 rounded bg-[#111]" />
      </div>
      <div className="mt-2.5 flex gap-4">
        <div className="h-3 w-16 rounded bg-[#111]" />
        <div className="h-3 w-20 rounded bg-[#111]" />
        <div className="h-3 w-12 rounded bg-[#111]" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-3 w-24 rounded bg-[#111]" />
        <div className="h-3 w-32 rounded bg-[#111]" />
      </div>
    </div>
  );
}

// ─── Token variant ────────────────────────────────────────────────────────────

function TokenVariant({ data }: { data: ScanContextResponse }) {
  const { tokenInfo, marketData, chain } = data;
  const address = tokenInfo?.address ?? "";

  return (
    <div className="w-full rounded border border-[#1F1F1F] bg-[#000000] p-3">
      {/* Row 1 — logo + name + chain */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {tokenInfo?.logoUrl ? (
            <img
              src={tokenInfo.logoUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover shrink-0 bg-[#111]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-[#111] shrink-0" />
          )}
          <span className="truncate text-sm font-bold text-[#FFFFFF]">
            {tokenInfo?.name ?? "Unavailable"}
            {tokenInfo?.symbol && (
              <span className="ml-1 text-[#FF6B00]"> · ${tokenInfo.symbol}</span>
            )}
          </span>
        </div>
        <ChainBadge chain={chain} />
      </div>

      {/* Row 2 — price · mcap · age */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#A8A8A8]">
        <span>
          <span className="text-[#FFFFFF]">{formatPrice(marketData?.priceUsd ?? null)}</span>
          {" "}price
        </span>
        <span>
          <span className="text-[#FFFFFF]">{formatUsd(marketData?.marketCapUsd ?? null)}</span>
          {" "}mcap
        </span>
        <span>
          <span className="text-[#FFFFFF]">
            {tokenInfo?.tokenAgeDays !== null && tokenInfo?.tokenAgeDays !== undefined
              ? `${tokenInfo.tokenAgeDays}d`
              : "—"}
          </span>
          {" "}age
        </span>
      </div>

      {/* Row 3 — vol · address */}
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#A8A8A8]">
        <span>
          <span className="text-[#FFFFFF]">{formatUsd(marketData?.volume24hUsd ?? null)}</span>
          {" "}vol 24h
        </span>
        <span className="flex items-center gap-0.5">
          <span className="font-mono text-[#A8A8A8]">{truncateAddress(address)}</span>
          <CopyButton text={address} />
        </span>
      </div>
    </div>
  );
}

// ─── Wallet variant ───────────────────────────────────────────────────────────

function WalletVariant({ data }: { data: ScanContextResponse }) {
  const { walletInfo, chain, target } = data;
  const address = target;

  const label =
    walletInfo?.linkedKOL
      ? `KOL-linked · ${walletInfo.linkedKOL}`
      : walletInfo?.walletType ?? "Unlabeled";

  return (
    <div className="w-full rounded border border-[#1F1F1F] bg-[#000000] p-3">
      {/* Row 1 — icon + label + chain */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WalletIcon />
          <span className="text-xs font-black uppercase tracking-widest text-[#FFFFFF]">
            WALLET
          </span>
        </div>
        <ChainBadge chain={chain} />
      </div>

      {/* Row 2 — label */}
      <div className="mt-2 text-[11px] text-[#A8A8A8]">
        <span className="font-black uppercase tracking-widest">Label</span>
        {"  "}
        <span className="text-[#FFFFFF]">{label}</span>
      </div>

      {/* Row 3 — address */}
      <div className="mt-1.5 flex items-center text-[11px]">
        <span className="font-mono text-[#A8A8A8]">{truncateAddress(address)}</span>
        <CopyButton text={address} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TokenInfoCard({ data, loading = false }: TokenInfoCardProps) {
  if (loading) return <Skeleton />;
  if (!data) return null;
  if (data.entityType === "wallet") return <WalletVariant data={data} />;
  return <TokenVariant data={data} />;
}
