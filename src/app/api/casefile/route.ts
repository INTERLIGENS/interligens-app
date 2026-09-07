import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkAuth } from "@/lib/security/auth";
import { kolHandleToMint } from "@/lib/kol/handleToMint";
import { BOTIFY_MINT, casefileLookupKey } from "@/lib/kol-memory/tokenIdentity";
import { loadCanonicalCaseFile } from "@/lib/casefile/canonicalReader";
import { canonicalRefForMint } from "@/lib/casefile/publicProjection";
import { toInternalCaseView } from "@/lib/casefile/internalView";
import {
  linkEvidence,
  computeLegacyCaseScore,
} from "@/lib/casefile/legacyCaseScore";

// ─── BUILD 9 / ÉTAPE 7 — OPTION A : L'AUTORITÉ, ET UNE SEULE ───────────────
//
// ██  La CASE_DB en ligne est partie. Ce dossier vient de l'autorité.      ██
//
// Cette route portait sa PROPRE base de dossiers, en dur dans le fichier :
// huit claims C1…C8, leurs sources, et un bloc de wallets. En face,
// `token_casefiles` + `CaseFileClaim` portaient huit autres claims — sous les
// MÊMES identifiants C1…C8, avec des contenus entièrement différents :
//
//   CASE_DB      C1 Budget marketing · C3 Telegram callers · C5 Fake metrics
//   canonique    C1 Coordinated Shill · C3 Liquidity Withdrawal · C5 Mint&Freeze
//
// Deux corpus disjoints publiés sous les mêmes clefs. C'est la définition
// même des « deux autorités concurrentes » que BUILD 9 supprime, et c'était
// invisible parce que les identifiants concordaient.
//
// ─── Pourquoi le score ne bouge pas ───────────────────────────────────────
//
// Le scoreur local est indexé sur les IDENTIFIANTS, jamais sur le contenu — et
// les deux jeux sont identiques. Il a été sorti d'ici verbatim, sans qu'une
// règle ni un seuil change, pour que cette phrase soit un TEST et non une
// promesse : voir src/lib/casefile/legacyCaseScore.ts.
//
// Ce n'est pas `computeTigerScore`. Les six entrées de celui-ci restent en
// HOLD, intouchées — leur bascule est une décision de scoring séparée.
//
// ─── Surface ADMIN : elle voit tout, et elle le DIT ───────────────────────
//
// `checkAuth` est toujours exigé (SEC P0). Appliquer ici le filtre PUBLIC
// rendrait zéro claim à un opérateur dont le travail est précisément de voir
// ce qui n'est pas publié. La route reçoit donc le dossier ENTIER — et chaque
// claim porte son `state`.

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

  // Offchain ingest — la lecture passe par le contrat d'alias (E2).
  const lookupKey = casefileLookupKey(sanitizeMint);
  // ── L'autorité canonique, et AUCUN repli ───────────────────────────────
  //
  // Si l'identité ne désigne aucun dossier, ou si l'autorité ne le porte pas,
  // la réponse le DIT. Elle ne se rabat sur aucune base locale : c'est
  // précisément la seconde autorité qu'on vient de supprimer.
  const ref = canonicalRefForMint(lookupKey);
  const dossier = ref ? await loadCanonicalCaseFile(ref) : null;
  const vue = dossier ? toInternalCaseView(dossier) : null;
  const offchainSource = vue ? "canonical" : "none";

  const offChain = vue ?? {
    ref: null,
    symbol: null,
    name: null,
    tiger_score: null,
    verdict: null,
    sources: [],
    claims: [],
  };

  console.log("[OFFCHAIN]", {
    mint: sanitizeMint,
    lookupKey,
    match: lookupKey === BOTIFY_MINT,
    source: offchainSource,
    claims: offChain.claims.length,
  });

  // ── POINT 5 — l'enrichissement on-chain interroge l'IDENTITÉ, pas l'entrée ─
  //
  // Ces trois appels recevaient `sanitizeMint` brut. Quand l'entrée était la
  // clé de route synthétique — une chaîne qui n'existe dans AUCUNE ligne et sur
  // aucune chaîne — ils interrogeaient donc un actif inexistant et rendaient
  // `null` partout, pendant que le dossier, lui, était bien trouvé via
  // `lookupKey`. D'où deux vérités concurrentes pour un même sujet : même
  // dossier, données on-chain différentes, score différent (RED/75 vs RED/70).
  //
  // Le contrat d'alias était correct ; il n'était appliqué qu'à un seul des
  // deux consommateurs.
  const [metadata, markets, holders] = await Promise.all([
    fetchMetadata(lookupKey),
    fetchMarkets(lookupKey),
    fetchHolders(lookupKey),
  ]);

  const top10 = parseFloat(holders?.top10_pct ?? "0");
  const concentrationFlags: string[] = [];
  if (top10 > 50) concentrationFlags.push("high_top10_concentration");
  if (top10 > 70) concentrationFlags.push("extreme_concentration");

  const onChain = {
    asset: {
      // POINT 5 — l'actif est désigné par son identité canonique. Rendre ici la
      // chaîne de 43 caractères revenait à AFFIRMER qu'elle est un mint.
      mint: lookupKey,
      name: vue?.name ?? null,
      symbol: vue?.symbol ?? null,
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
    // ── BUILD 9 / ÉTAPE 7 — les flux viennent du dossier, ou sont vides ───
    //
    // `notable_wallets` portait deux adresses TRONQUÉES codées en dur, sous
    // des rôles nommés. Elles viennent désormais de `token_casefiles."keyWallets"`.
    // Un tableau vide sur BOTIFY est ATTENDU : le dossier ne porte aucun bloc
    // de wallets on-chain, et en fabriquer un pour remplir la forme serait
    // exactement ce que cette étape supprime.
    //
    // `wash_trading_signals` est RETIRÉ : ses deux entrées étaient annotées
    // « [Referenced - C5] », or le C5 canonique dit autre chose que le C5 de
    // la CASE_DB. Les reconduire aurait rattaché un signal à une assertion qui
    // ne le porte pas — une provenance fabriquée par simple homonymie d'ID.
    flows: {
      notable_wallets: (dossier?.keyWallets ?? []).map((w) => ({
        wallet: w.address,
        role: w.role,
        status: "Referenced",
      })),
    },
  };

  const linking = linkEvidence(offChain.claims, onChain);
  const {score, tier} = computeLegacyCaseScore(offChain.claims, linking, onChain);

  if (offChain.claims.length === 0 && lookupKey === BOTIFY_MINT) {
    console.error("[SCORING] ERROR: BOTIFY claims=0 — autorité canonique vide");
  }
  console.log(`[SCORING] score=${score} tier=${tier} claims=${offChain.claims.length}`);

  const retailSummary = tier==="RED" ? [
    "Token structure pour exit liquidity retail.",
    "Budget oriente marketing, produit inexistant.",
    "KOLs, bots, callers payes - EV negatif pour le retail.",
  ] : tier==="ORANGE" ? [
    "Signaux suspects. Prudence recommandee.",
  ] : ["Aucun signal majeur detecte."];

  const caseId = crypto.randomBytes(4).toString("hex").toUpperCase();

  // ── POINT 5 — la résolution est DÉCLARÉE, pas silencieuse ────────────────
  //
  // `input` annonçait `{type:"mint", value:<43 caractères>}` : la réponse
  // affirmait qu'une clé de route est un mint. Elle porte désormais ce qui a
  // été REÇU et ce vers quoi cela a RÉSOLU, séparément.
  //
  // Une résolution silencieuse reste non auditable : un lecteur qui reçoit le
  // dossier canonique pour une entrée alias doit pouvoir voir POURQUOI.
  const isAlias = lookupKey !== sanitizeMint;
  const input = {
    // `type` ne ment plus : une clé de route n'est pas annoncée comme un mint.
    type: isAlias ? "route_alias" : "mint",
    value: sanitizeMint,
    resolved_to: lookupKey,
    alias_of: isAlias ? lookupKey : null,
    resolution: isAlias ? "botify_synthetic_route_key" : "identity",
  };

  const caseFile: any = {
    case: {
      case_id: caseId,
      chain: "solana",
      input,
      scan_timestamp: new Date().toISOString(),
      engine_version: "CaseFile-v2.0",
      offchain_source: offchainSource,
    },
    verdict: {tier, score, retail_summary: retailSummary},
    on_chain: onChain,
    off_chain: offChain,
    evidence_linking: linking,
  };

  // ── POINT 5 — deux hachages, parce qu'ils répondent à deux questions ─────
  //
  // `report_hash` porte `case_id` (aléatoire) et `scan_timestamp` (l'horloge).
  // Il ne peut donc PAS être identique entre deux appels, même à entrée
  // identique — il identifie une ÉMISSION, pas un dossier. Le forcer à
  // l'égalité supposerait de retirer l'aléa et l'horodatage, c'est-à-dire de
  // changer ce qu'il désigne : hors périmètre du point 5.
  //
  // `canonical_hash` répond à la question posée : deux entrées qui désignent le
  // même sujet rendent-elles le même dossier ? Il couvre l'identité résolue, le
  // verdict, l'on-chain et l'off-chain — et RIEN de ce qui varie par émission.
  caseFile.case.canonical_hash = crypto.createHash("sha256")
    .update(JSON.stringify({
      subject: lookupKey,
      chain: "solana",
      verdict: caseFile.verdict,
      on_chain: onChain,
      off_chain: offChain,
      evidence_linking: linking,
    }))
    .digest("hex").slice(0, 16);

  caseFile.report_hash = crypto.createHash("sha256")
    .update(JSON.stringify(caseFile)).digest("hex").slice(0,16);

  return NextResponse.json(caseFile);
}
