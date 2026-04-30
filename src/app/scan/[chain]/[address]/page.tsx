// src/app/scan/[chain]/[address]/page.tsx
// Universal deeplink: https://app.interligens.com/scan/SOL/ADDRESS
// Validates chain + address, renders metadata for social sharing, redirects to demo.

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

const VALID_CHAINS = new Set(["SOL", "ETH", "BASE", "ARB", "TRON"]);

const CHAIN_ALIAS: Record<string, string> = {
  SOL:  "Solana",
  ETH:  "Ethereum",
  BASE: "Base",
  ARB:  "Arbitrum",
  TRON: "TRON",
};

function isValidAddress(chain: string, address: string): boolean {
  switch (chain.toUpperCase()) {
    case "ETH":
    case "BASE":
    case "ARB":
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case "TRON":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    case "SOL":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    default:
      return false;
  }
}

function getDemoPath(chain: string, address: string): string {
  const prefix =
    chain === "BASE"  ? "base:" :
    chain === "ARB"   ? "arb:"  :
    chain === "TRON"  ? ""      : "";
  return `/en/demo?addr=${encodeURIComponent(prefix + address)}&auto=1`;
}

type Props = {
  params: Promise<{ chain: string; address: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, address } = await params;
  const chainUp = chain.toUpperCase();

  if (!VALID_CHAINS.has(chainUp) || !isValidAddress(chainUp, address)) {
    return { title: "Invalid Scan Link | INTERLIGENS" };
  }

  const chainName = CHAIN_ALIAS[chainUp] ?? chainUp;
  const shortAddr = address.slice(0, 8) + "…" + address.slice(-4);
  const ogUrl = `/api/og/${chainUp}/${address}`;

  return {
    title: `TigerScore: ${shortAddr} | INTERLIGENS`,
    description: `On-chain risk analysis for ${chainName} address ${shortAddr}. Powered by INTERLIGENS intelligence.`,
    openGraph: {
      title: `TigerScore: ${shortAddr} | INTERLIGENS`,
      description: `Risk analysis — ${chainName} · INTERLIGENS`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `TigerScore: ${shortAddr} | INTERLIGENS`,
      description: `Risk analysis — ${chainName} · INTERLIGENS`,
      images: [ogUrl],
    },
  };
}

export default async function ScanDeeplink({ params }: Props) {
  const { chain, address } = await params;
  const chainUp = chain.toUpperCase();

  if (!VALID_CHAINS.has(chainUp)) {
    notFound();
  }

  if (!isValidAddress(chainUp, address)) {
    notFound();
  }

  redirect(getDemoPath(chainUp, address));
}
