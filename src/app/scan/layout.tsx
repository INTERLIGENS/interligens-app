import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Scanner | INTERLIGENS",
  description: "Instant blockchain risk score for any Solana, Ethereum, BSC, Base, Arbitrum, or TRON token. Powered by TigerScore™.",
  openGraph: {
    title: "Token Scanner | INTERLIGENS",
    description: "Instant blockchain risk score for any token. Powered by TigerScore™.",
    url: "https://interligens.com/scan",
    siteName: "INTERLIGENS",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Token Scanner | INTERLIGENS",
    description: "Instant blockchain risk score for any token. Powered by TigerScore™.",
  },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
