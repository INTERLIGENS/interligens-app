import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkAuth } from "@/lib/security/auth";
import { kolHandleToMint } from "@/lib/kol/handleToMint";

export const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";

// ── CaseDB hardcoded (V0 — no fs dependency) ──────────────────────────────────
const CASE_DB: Record<string, any> = {
  [BOTIFY_MINT]: {
    symbol: "BOTIFY", name: "Botify",
    sources: {
      dethective_threads: [
        "https://x.com/dethective/status/1997766979898450185",
        "https://x.com/dethective/status/2000321916608147714",
      ],
      screenshots: ["IMG_2239.jpg","IMG_2240.jpg","IMG_2241.jpg","IMG_2242.jpg",
                    "IMG_2243.jpg","IMG_2244.jpg","IMG_2245.jpg","IMG_2246.jpg"],
      attachments: ["BOTIFY_SCAM.zip","Dossier_BOTIFY_INTERLIGENS.pdf"],
    },
    claims: [
      { id:"C1", topic:"Budget marketing",
        claim:"Budget quasi-entier depense en marketing/listings: Gate $190k, MEXC $90k, TikTok/IG $233k+. Produit inactif selon thread.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2239.jpg",caption:"Thread 1/8 - The Budget"},
          {type:"thread",ref:"https://x.com/dethective/status/1997766979898450185",caption:"@dethective 07/12/2025"},
        ]},
      { id:"C2", topic:"KOL Twitter shilling",
        claim:"KOLs payes stablecoins + % supply vesting. Gordon: 10k stables + 0.665% supply. Shilling non declare jusqu'a unlock.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2240.jpg",caption:"Thread 2/8 - Twitter Marketing"},
          {type:"thread",ref:"https://x.com/dethective/status/1997766979898450185",caption:"@dethective 07/12/2025"},
        ]},
      { id:"C3", topic:"Telegram callers payes",
        claim:"Callers Telegram payes 5 chiffres: WulfCrypto $21k, SolanaRockets $26k, CryptoZin $10k pour vendre au retail.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2241.jpg",caption:"Thread 3/8 - Telegram Callers"},
          {type:"thread",ref:"https://x.com/dethective/status/1997766979898450185",caption:"@dethective 07/12/2025"},
        ]},
      { id:"C4", topic:"TikTok marketing",
        claim:"Push TikTok: $25k pour une video, $27.25k pour 7 semaines. Onboarding retail via FOMO mainstream.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2242.jpg",caption:"Thread 4/8 - TikTok Marketing"},
          {type:"thread",ref:"https://x.com/dethective/status/1997766979898450185",caption:"@dethective 07/12/2025"},
        ]},
      { id:"C5", topic:"Fake metrics / bots",
        claim:"90% du narratif non organique. Paiements volume bots + faux holders. Trump Whale: $20k pour narratif.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2243.jpg",caption:"Thread 5/8 - Fake Metrics"},
          {type:"thread",ref:"https://x.com/dethective/status/2000321916608147714",caption:"@dethective 07/12/2025"},
        ]},
      { id:"C6", topic:"On-chain: Gordon daily releases",
        claim:"Deal Gordon: 10k fixe + 1% supply sur 14 jours (0.053%/jour). Daily releases observables on-chain.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2244.jpg",caption:"Thread 6/8 - On-Chain Case Gordon"},
          {type:"thread",ref:"https://x.com/dethective/status/2000321916608147714",caption:"@dethective 07/12/2025"},
        ]},
      { id:"C7", topic:"Friends & Family insiders",
        claim:"Documents internes: Mom 0.055%, Dad 0.055%, Illya 0.05% + SAM insiders 0.25%. Risque dump a l'unlock.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2245.jpg",caption:"Thread 7/8 - Friends & Family"},
          {type:"thread",ref:"https://x.com/dethective/status/2000321916608147714",caption:"@dethective 07/12/2025"},
        ]},
      { id:"C8", topic:"Retail = exit liquidity",
        claim:"Retail finance la chaine: listings->MM->influenceurs->plateformes->bots. EV negatif structurel.",
        status:"Referenced",
        evidence:[
          {type:"screenshot",ref:"IMG_2246.jpg",caption:"Thread 8/8 - Conclusion"},
          {type:"thread",ref:"https://x.com/dethective/status/2000321916608147714",caption:"@dethective 07/12/2025"},
        ]},
    ],
  },
};

// ── On-chain collectors ───────────────────────────────────────────────────────
async function fetchMetadata(mint: string) {
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",
        params:[mint,{encoding:"jsonParsed"}]}),
      signal: AbortSignal.timeout(6000),
    });
    const d = await r.json();
    const info = d?.result?.value?.data?.parsed?.info;
    return info ? {decimals:info.decimals??null,supply:info.supply??null,mintAuthority:info.mintAuthority??null} : null;
  } catch { return null; }
}

async function fetchMarkets(mint: string) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      {signal:AbortSignal.timeout(6000)});
    const d = await r.json();
    const pairs = (d?.pairs??[]).sort((a:any,b:any)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));
    if (!pairs.length) return null;
    const p = pairs[0];
    return {
      primary_pool:p.pairAddress??null, dex:p.dexId??null,
      price_usd:p.priceUsd??null, liquidity_usd:p.liquidity?.usd??null,
      volume_24h_usd:p.volume?.h24??null, fdv_usd:p.fdv??null,
    };
  } catch { return null; }
}

async function fetchHolders(mint: string) {
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getTokenLargestAccounts",params:[mint]}),
      signal: AbortSignal.timeout(6000),
    });
    const d = await r.json();
    const holders = d?.result?.value??[];
    if (!holders.length) return null;
    const total = holders.reduce((s:number,h:any)=>s+Number(h.uiAmount||0),0);
    if (!total) return null;
    const top10 = holders.slice(0,10).reduce((s:number,h:any)=>s+Number(h.uiAmount||0),0);
    return {
      top_holders: holders.slice(0,20).map((h:any,i:number)=>({
        rank:i+1, address:h.address, amount:h.uiAmount??0,
        pct:((Number(h.uiAmount||0)/total)*100).toFixed(2),
      })),
      top10_pct: ((top10/total)*100).toFixed(1),
    };
  } catch { return null; }
}

// ── Evidence linker ───────────────────────────────────────────────────────────
function linkEvidence(claims: any[], onChain: any) {
  return claims.map((c:any) => {
    const checks: any[] = [];
    let status = c.status ?? "Referenced";
    const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");
    const liq = Number(onChain?.markets?.liquidity_usd ?? 0);

    if ((c.id==="C5"||c.id==="C7") && top10 > 40) {
      checks.push({check:"top10_concentration", result:`Top-10: ${top10}%`});
      status = "Corroborated";
    }
    if (c.id==="C1" && liq > 0 && liq < 100000) {
      checks.push({check:"low_liquidity", result:`Liquidity: $${liq.toLocaleString()}`});
      status = "Corroborated";
    }
    return {claim_id:c.id, on_chain_checks:checks, final_status:status};
  });
}

// ── Scoring ───────────────────────────────────────────────────────────────────
function computeScore(claims: any[], linking: any[], onChain: any, mint: string) {
  if (claims.length === 0 && mint === BOTIFY_MINT) {
    console.error("[SCORING] ERROR: BOTIFY claims=0 — offchain ingest failed");
  }

  let score = 0;
  const ids = new Set(claims.map((c:any)=>c.id));

  if (["C2","C3","C4"].some(id=>ids.has(id))) score += 25;
  if (ids.has("C5")) score += 20;
  if (ids.has("C7")) score += 15;
  if (ids.has("C1")) score += 5;
  if (ids.has("C8")) score += 5;

  const corroborated = linking.filter((l:any)=>l.final_status==="Corroborated").length;
  score += Math.min(corroborated * 5, 15);
  const top10 = parseFloat(onChain?.distribution?.top10_pct ?? "0");
  if (top10 > 40) score += 10;

  // Guardrail: >= 6 claims => RED
  if (claims.length >= 6 && score < 70) score = 70;

  score = Math.min(100, Math.max(0, score));
  const tier = score >= 70 ? "RED" : score >= 35 ? "ORANGE" : "GREEN";

  console.log(`[SCORING] score=${score} tier=${tier} claims=${claims.length} corroborated=${corroborated}`);
  return {score, tier};
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // SEC P0 — auth is ALWAYS required. The previous ?mock=1 retail
  // bypass allowed unauth'd callers to pull the full casefile JSON
  // (claims, notable wallets, wash-trading signals). Gate closed.
  const _auth = await checkAuth(req);
  if (!_auth.authorized) return _auth.response!;

  // Accept either ?mint= (canonical) or ?handle= (KOL page CaseFile button).
  // The handle→mint resolution lives in @/lib/kol/handleToMint so there is
  // ONE source of truth for which KOLs are linked to which cases.
  const mintParam = (req.nextUrl.searchParams.get("mint") ?? "").trim();
  const handleParam = (req.nextUrl.searchParams.get("handle") ?? "").trim();
  const resolvedFromHandle = handleParam ? kolHandleToMint(handleParam) : null;
  const sanitizeMint = mintParam || resolvedFromHandle || "";
  if (!sanitizeMint) {
    return NextResponse.json(
      { error: handleParam ? "handle has no linked case mint" : "mint or handle required" },
      { status: 400 }
    );
  }

  // Offchain ingest
  const caseEntry = CASE_DB[sanitizeMint] ?? null;
  const offchainSource = caseEntry ? "case_db" : "none";

  const offChain = caseEntry ? {
    sources: caseEntry.sources,
    claims: caseEntry.claims,
  } : {
    sources: {dethective_threads:[], screenshots:[], attachments:[]},
    claims: [],
  };

  console.log("[OFFCHAIN]", {
    mint: sanitizeMint,
    match: sanitizeMint === BOTIFY_MINT,
    source: offchainSource,
    claims: offChain.claims.length,
  });

  // On-chain (parallel, graceful)
  const [metadata, markets, holders] = await Promise.all([
    fetchMetadata(sanitizeMint),
    fetchMarkets(sanitizeMint),
    fetchHolders(sanitizeMint),
  ]);

  const top10 = parseFloat(holders?.top10_pct ?? "0");
  const concentrationFlags: string[] = [];
  if (top10 > 50) concentrationFlags.push("high_top10_concentration");
  if (top10 > 70) concentrationFlags.push("extreme_concentration");

  const onChain = {
    asset: {
      mint: sanitizeMint,
      name: caseEntry?.name ?? null,
      symbol: caseEntry?.symbol ?? null,
      decimals: metadata?.decimals ?? null,
      supply: metadata?.supply ?? null,
      mintAuthority: metadata?.mintAuthority ?? null,
    },
    markets: markets ?? {
      primary_pool:null, dex:null, price_usd:null,
      liquidity_usd:null, volume_24h_usd:null, fdv_usd:null,
    },
    distribution: {
      top_holders: holders?.top_holders ?? [],
      top10_pct: holders?.top10_pct ?? null,
      concentration_flags: concentrationFlags,
    },
    flows: {
      notable_wallets: caseEntry ? [
        {wallet:"3X9RErem7...KxqcnaqA6", role:"Gordon_KOL_daily_releases", status:"Referenced"},
        {wallet:"FXBXg6sqVN...3m7xE", role:"Trump_Whale_wallet", status:"Referenced"},
      ] : [],
      wash_trading_signals: caseEntry ? [
        "volume_bot_activity [Referenced - C5]",
        "fake_holders_detected [Referenced - C5]",
      ] : [],
    },
  };

  const linking = linkEvidence(offChain.claims, onChain);
  const {score, tier} = computeScore(offChain.claims, linking, onChain, sanitizeMint);

  const retailSummary = tier==="RED" ? [
    "Token structure pour exit liquidity retail.",
    "Budget oriente marketing, produit inexistant.",
    "KOLs, bots, callers payes - EV negatif pour le retail.",
  ] : tier==="ORANGE" ? [
    "Signaux suspects. Prudence recommandee.",
  ] : ["Aucun signal majeur detecte."];

  const caseId = crypto.randomBytes(4).toString("hex").toUpperCase();

  const caseFile: any = {
    case: {
      case_id: caseId,
      chain: "solana",
      input: {type:"mint", value:sanitizeMint},
      scan_timestamp: new Date().toISOString(),
      engine_version: "CaseFile-v1.1",
      offchain_source: offchainSource,
    },
    verdict: {tier, score, retail_summary: retailSummary},
    on_chain: onChain,
    off_chain: offChain,
    evidence_linking: linking,
  };

  caseFile.report_hash = crypto.createHash("sha256")
    .update(JSON.stringify(caseFile)).digest("hex").slice(0,16);

  return NextResponse.json(caseFile);
}
