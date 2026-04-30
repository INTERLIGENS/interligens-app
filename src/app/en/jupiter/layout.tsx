import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Safe Swap via Jupiter | INTERLIGENS",
  description: "Swap Solana tokens with pre-trade risk scanning. INTERLIGENS checks every token before you trade — powered by TigerScore™.",
  openGraph: {
    title: "Safe Swap via Jupiter | INTERLIGENS",
    description: "Swap tokens with pre-trade risk scanning. TigerScore™ checks every token before you swap.",
    url: "https://interligens.com/en/jupiter",
    siteName: "INTERLIGENS",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Safe Swap via Jupiter | INTERLIGENS",
    description: "Swap tokens with pre-trade risk scanning. TigerScore™ checks every token before you swap.",
  },
};

export default function JupiterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
