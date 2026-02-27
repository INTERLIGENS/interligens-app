import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get("tokenId")?.trim() ?? "";

  if (!/^0x[a-fA-F0-9]{32}$/i.test(tokenId)) {
    return NextResponse.json({ ok: false, message: "Not a valid Hyperliquid token id" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotMeta" }),
      cache: "no-store",
    });
    const data = await res.json();
    const tokens: any[] = Array.isArray(data?.tokens) ? data.tokens : [];
    const match = tokens.find((t: any) => t?.tokenId?.toLowerCase() === tokenId.toLowerCase());

    if (match?.evmContract) {
      return NextResponse.json({ ok: true, evmAddress: match.evmContract, name: match.name ?? "" });
    }
    return NextResponse.json({ ok: false, message: "EVM address not found for this token id. Use the 'Evm Address' field shown in Hyperliquid." });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not resolve token id." });
  }
}
