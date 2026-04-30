import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet Risk Scan | INTERLIGENS",
  description: "Full wallet risk analysis for Solana, Ethereum, Base, and Arbitrum. Detects exposure to flagged contracts, scam patterns, and high-risk counterparties.",
  openGraph: {
    title: "Wallet Risk Scan | INTERLIGENS",
    description: "Full wallet risk analysis across chains — TigerScore™ powered.",
    url: "https://interligens.com/en/wallet-scan",
    siteName: "INTERLIGENS",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wallet Risk Scan | INTERLIGENS",
    description: "Full wallet risk analysis across chains — TigerScore™ powered.",
  },
};

export default function WalletScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
