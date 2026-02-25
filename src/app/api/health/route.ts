import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.HELIUS_API_KEY || "";
  const url = process.env.HELIUS_RPC_URL || "";
  return NextResponse.json({
    ok: true,
    heliusKeyPresent: key.length > 0,
    heliusKeyLen: key.length,
    heliusUrlPresent: url.length > 0,
    heliusUrlLen: url.length,
  });
}
