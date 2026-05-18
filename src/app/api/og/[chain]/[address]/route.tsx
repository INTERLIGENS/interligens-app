// src/app/api/og/[chain]/[address]/route.tsx
// Dynamic OG image for deeplinks: /api/og/SOL/ADDRESS

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const VALID_CHAINS = new Set(["SOL", "ETH", "BASE", "ARB", "TRON"]);

const CHAIN_COLOR: Record<string, string> = {
  SOL:  "#9945FF",
  ETH:  "#627EEA",
  BASE: "#0052FF",
  ARB:  "#28A0F0",
  TRON: "#FF0013",
};

type Props = {
  params: Promise<{ chain: string; address: string }>;
};

export async function GET(_req: NextRequest, { params }: Props) {
  const { chain, address } = await params;
  const chainUp = chain.toUpperCase();

  if (!VALID_CHAINS.has(chainUp)) {
    return new Response("Invalid chain", { status: 404 });
  }

  const chainColor = CHAIN_COLOR[chainUp] ?? "#FF6B00";
  const shortAddr = address.slice(0, 8) + "…" + address.slice(-4);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#000000",
          padding: 60,
          fontFamily: "sans-serif",
          justifyContent: "space-between",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: "#FF6B00",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
              fontWeight: 900,
              fontSize: 20,
            }}
          >
            I
          </div>
          <span style={{ color: "#FF6B00", fontWeight: 900, fontSize: 24, letterSpacing: "0.2em" }}>
            INTERLIGENS
          </span>
        </div>

        {/* Main */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: chainColor,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            {chainUp} · On-Chain Risk Analysis
          </span>
          <span
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#FFFFFF",
              letterSpacing: "-0.02em",
              fontStyle: "italic",
            }}
          >
            TigerScore
          </span>
          <span style={{ fontSize: 20, color: "#52525b", fontFamily: "monospace" }}>
            {shortAddr}
          </span>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#FF6B00",
            }}
          />
          <span style={{ color: "#52525b", fontSize: 13, letterSpacing: "0.15em" }}>
            POWERED BY INTERLIGENS INTELLIGENCE
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
