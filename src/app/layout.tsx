import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "INTERLIGENS",
  description: "Blockchain Intelligence Platform — Forensic analysis for Solana, Ethereum & TRON.",
  manifest: "/manifest.json",
  themeColor: "#F85B05",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "INTERLIGENS",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="INTERLIGENS" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F85B05" />
      </head>
      <body>{children}</body>
    </html>
  );
}
