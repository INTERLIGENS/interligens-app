import type { Metadata } from "next";

// page.tsx for this route is a Client Component (three.js / react-force-graph-3d
// need the browser), and Client Components cannot export `metadata`. This
// server-component layout carries the SEO metadata for the route instead.
export const metadata: Metadata = {
  title: "Constellation — 3D demo | INTERLIGENS",
  description:
    "Interactive 3D constellation: a forensic network-graph demo of documented on-chain relationships between tokens, wallets, and KOLs.",
};

export default function ConstellationDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
