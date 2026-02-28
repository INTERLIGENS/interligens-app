import { NextRequest, NextResponse } from "next/server";

const MOCKS: Record<string, any> = {
  green: {
    chain: "SOL", scanned_at: new Date().toISOString(),
    off_chain: { status: "Unverified", source: "none", case_id: null, summary: null, claims: [], sources: [] },
    on_chain: { markets: { source: null, primary_pool: null, dex: null, url: null, price: null, liquidity_usd: null, volume_24h_usd: null, fdv_usd: null, fetched_at: new Date().toISOString(), cache_hit: false } },
    risk: { score: 12, tier: "GREEN", breakdown: { base_score: 12, claim_penalty: 0, severity_multiplier: 1 }, flags: [] },
  },
  orange: {
    chain: "SOL", scanned_at: new Date().toISOString(),
    off_chain: { status: "Unverified", source: "none", case_id: null, summary: null, claims: [], sources: [] },
    on_chain: { markets: { source: null, primary_pool: null, dex: null, url: null, price: null, liquidity_usd: null, volume_24h_usd: null, fdv_usd: null, fetched_at: new Date().toISOString(), cache_hit: false } },
    risk: { score: 55, tier: "AMBER", breakdown: { base_score: 55, claim_penalty: 0, severity_multiplier: 1 }, flags: ["LOW_LIQUIDITY"] },
  },
  red: {
    chain: "SOL", scanned_at: new Date().toISOString(),
    off_chain: {
      status: "Referenced", source: "case_db",
      case_id: `CASE-${new Date().getFullYear()}-BOTIFY-001`,
      summary: "BOTIFY token exhibits multiple high-severity rug-pull indicators. Eight independent claims referenced by detective evidence.",
      claims: [
        { id:"C1", title:"Coordinated Shill Campaign", severity:"HIGH", status:"REFERENCED", description:"Multiple bot accounts posted identical content within minutes.", evidence_files:["IMG_2239.jpg"], thread_url:"https://twitter.com/search?q=%24BOTIFY", category:"social_manipulation" },
        { id:"C2", title:"Insider Pre-Launch Pump", severity:"HIGH", status:"REFERENCED", description:"Insider buy signals distributed 45min before listing.", evidence_files:["IMG_2240.jpg"], thread_url:"https://t.me/+BOTIFY_insiders", category:"insider_trading" },
        { id:"C3", title:"Liquidity Withdrawal < 30min", severity:"CRITICAL", status:"REFERENCED", description:"100% liquidity removed within 28min of price peak.", evidence_files:["IMG_2241.jpg"], thread_url:"https://dexscreener.com/solana/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", category:"rug_pull" },
        { id:"C4", title:"Sybil Wallet Cluster", severity:"HIGH", status:"REFERENCED", description:"7 wallets pre-funded from same source 2h before launch.", evidence_files:["IMG_2242.jpg"], thread_url:"https://solscan.io/token/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", category:"sybil_attack" },
        { id:"C5", title:"Mint Authority Not Revoked", severity:"CRITICAL", status:"REFERENCED", description:"Mint and freeze authority remain active on contract.", evidence_files:["IMG_2243.jpg"], thread_url:"https://rugcheck.xyz/tokens/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb", category:"contract_risk" },
        { id:"C6", title:"Anonymous Team / Same-Day Domain", severity:"MEDIUM", status:"REFERENCED", description:"Domain registered same day as launch. No team identities.", evidence_files:["IMG_2244.jpg"], thread_url:null, category:"identity_risk" },
        { id:"C7", title:"Whale Concentration 62%", severity:"HIGH", status:"REFERENCED", description:"Top 3 wallets held 62% of supply at peak.", evidence_files:["IMG_2245.jpg"], thread_url:"https://solscan.io/token/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb#holders", category:"tokenomics_risk" },
        { id:"C8", title:"Social Media Abandonment", severity:"HIGH", status:"REFERENCED", description:"All official channels went silent on day 5.", evidence_files:["IMG_2246.jpg"], thread_url:null, category:"project_abandonment" },
      ],
      sources: [],
    },
    on_chain: { markets: { source: null, primary_pool: null, dex: null, url: null, price: null, liquidity_usd: null, volume_24h_usd: null, fdv_usd: null, fetched_at: new Date().toISOString(), cache_hit: false } },
    risk: { score: 100, tier: "RED", breakdown: { base_score: 0, claim_penalty: 85, severity_multiplier: 1.2 }, flags: ["referenced_claims=8", "CRITICAL_CLAIM_PRESENT"] },
  },
};

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") ?? "red";
  const data = MOCKS[mode] ?? MOCKS.red;
  return NextResponse.json({ ...data, scanned_at: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store" }
  });
}
