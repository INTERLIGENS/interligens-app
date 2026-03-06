import { describe, it, expect, vi } from "vitest";
import { graphKey, graphTTL, INVESTIGATION_TTL } from "../cache";
import { detectSharedFunder, detectCoTrading, detectLpOverlap, computeOverallStatus } from "../cluster";
import { computeRelatedProjects } from "../related";
import type { WalletTxData } from "../expand";
import type { HeliusTx, Cluster } from "../types";

const MINT_A = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";
const MINT_B = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const FUNDER = "FunderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const W_A    = "WalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const W_B    = "WalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const W_C    = "WalletCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const OTHER  = "OtherMintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

function tx(overrides: Partial<HeliusTx>): HeliusTx {
  return { signature:`sig_${Math.random().toString(36).slice(2)}`, timestamp:1700000000, type:"TRANSFER", source:"SYSTEM_PROGRAM", fee:5000, feePayer:W_A, accountData:[], tokenTransfers:[], nativeTransfers:[], ...overrides };
}

// ── cache ────────────────────────────────────────────────────────────────────
describe("cache keys & TTLs", () => {
  it("graphKey mint format", () => expect(graphKey(MINT_A,"mint",1,30)).toBe(`graph:sol:mint:${MINT_A}:h1:d30`));
  it("graphKey wallet format", () => expect(graphKey(W_A,"wallet",2,90)).toBe(`graph:sol:wallet:${W_A}:h2:d90`));
  it("TTL h1/d30 = 900", () => expect(graphTTL(1,30)).toBe(900));
  it("TTL h2/d30 = 7200", () => expect(graphTTL(2,30)).toBe(7200));
  it("TTL h2/d90 = 21600", () => expect(graphTTL(2,90)).toBe(21600));
  it("INVESTIGATION_TTL = 86400", () => expect(INVESTIGATION_TTL).toBe(86400));
});

// ── shared funder ─────────────────────────────────────────────────────────────
describe("detectSharedFunder", () => {
  const txA = tx({ signature:"sig_fa", timestamp:1700000000, nativeTransfers:[{fromUserAccount:FUNDER,toUserAccount:W_A,amount:50_000_000}], accountData:[], tokenTransfers:[] });
  const txB = tx({ signature:"sig_fb", timestamp:1700000100, nativeTransfers:[{fromUserAccount:FUNDER,toUserAccount:W_B,amount:50_000_000}], accountData:[], tokenTransfers:[] });
  const wdata = new Map<string,WalletTxData>([[W_A,{address:W_A,hop:1,txs:[txA],counterparties:[]}],[W_B,{address:W_B,hop:1,txs:[txB],counterparties:[]}]]);

  it("détecte funder commun dans fenêtre 5min", () => {
    const c = detectSharedFunder([W_A,W_B], wdata);
    expect(c.length).toBeGreaterThanOrEqual(1);
    expect(c[0].heuristic).toBe("shared_funder");
    expect(c[0].strength).toBe("HIGH");
  });
  it("status CORROBORATED si proofs présents", () => {
    const c = detectSharedFunder([W_A,W_B], wdata);
    expect(c[0].status).toBe("CORROBORATED");
    expect(c[0].proofs.length).toBeGreaterThan(0);
  });
  it("ne cluster pas si financement > 5min d\'écart", () => {
    const txC = tx({ timestamp:1700000000+600, nativeTransfers:[{fromUserAccount:FUNDER,toUserAccount:W_C,amount:50_000_000}], accountData:[], tokenTransfers:[] });
    const wd2 = new Map([[W_A,{address:W_A,hop:1 as const,txs:[txA],counterparties:[]}],[W_C,{address:W_C,hop:1 as const,txs:[txC],counterparties:[]}]]);
    expect(detectSharedFunder([W_A,W_C],wd2).length).toBe(0);
  });
});

// ── co-trading ────────────────────────────────────────────────────────────────
describe("detectCoTrading", () => {
  const make = (w: string, sig: string) => tx({ signature:sig, feePayer:w, tokenTransfers:[{fromUserAccount:w,toUserAccount:W_C,mint:MINT_A,tokenAmount:100},{fromUserAccount:w,toUserAccount:W_C,mint:MINT_B,tokenAmount:200}], accountData:[], nativeTransfers:[] });
  const wd = new Map([[W_A,{address:W_A,hop:1 as const,txs:[make(W_A,"s_a")],counterparties:[]}],[W_B,{address:W_B,hop:1 as const,txs:[make(W_B,"s_b")],counterparties:[]}]]);
  it("détecte co-trading sur mints communs", () => { const c=detectCoTrading(wd); expect(c.length).toBeGreaterThanOrEqual(1); expect(c[0].heuristic).toBe("co_trading"); });
  it("ne cluster pas sur 1 seul mint commun", () => {
    const wd2 = new Map([[W_A,{address:W_A,hop:1 as const,txs:[tx({tokenTransfers:[{fromUserAccount:W_A,toUserAccount:W_C,mint:MINT_A,tokenAmount:1}],accountData:[],nativeTransfers:[]})],counterparties:[]}],[W_B,{address:W_B,hop:1 as const,txs:[tx({tokenTransfers:[{fromUserAccount:W_B,toUserAccount:W_C,mint:MINT_A,tokenAmount:1}],accountData:[],nativeTransfers:[]})],counterparties:[]}]]);
    expect(detectCoTrading(wd2).length).toBe(0);
  });
});

// ── lp overlap ────────────────────────────────────────────────────────────────
describe("detectLpOverlap", () => {
  const RAY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
  const lp = (w: string, s: string) => tx({ signature:s, feePayer:w, tokenTransfers:[{fromUserAccount:w,toUserAccount:RAY,mint:MINT_A,tokenAmount:10},{fromUserAccount:w,toUserAccount:RAY,mint:MINT_B,tokenAmount:20}], accountData:[{account:RAY,nativeBalanceChange:0,tokenBalanceChanges:[]}], nativeTransfers:[] });
  const wd = new Map([[W_A,{address:W_A,hop:1 as const,txs:[lp(W_A,"s_la")],counterparties:[]}],[W_B,{address:W_B,hop:1 as const,txs:[lp(W_B,"s_lb")],counterparties:[]}]]);
  it("détecte LP overlap", () => { const c=detectLpOverlap(wd); expect(c.length).toBeGreaterThanOrEqual(1); expect(c[0].heuristic).toBe("lp_overlap"); });
});

// ── overall status ────────────────────────────────────────────────────────────
describe("computeOverallStatus", () => {
  it("CORROBORATED si au moins 1 cluster corroboré", () => expect(computeOverallStatus([{id:"c1",label:"",strength:"HIGH",heuristic:"shared_funder",wallets:[],proofs:[{type:"shared_funder",tx_signature:"x",timestamp:0,detail:""}],status:"CORROBORATED"}])).toBe("CORROBORATED"));
  it("PARTIAL si clusters mais aucun CORROBORATED", () => expect(computeOverallStatus([{id:"c1",label:"",strength:"MED",heuristic:"co_trading",wallets:[],proofs:[],status:"REFERENCED"}])).toBe("PARTIAL"));
  it("REFERENCED si aucun cluster", () => expect(computeOverallStatus([])).toBe("REFERENCED"));
});

// ── related projects ──────────────────────────────────────────────────────────
describe("computeRelatedProjects", () => {
  const shared = tx({ tokenTransfers:[{fromUserAccount:W_A,toUserAccount:W_C,mint:OTHER,tokenAmount:100},{fromUserAccount:W_B,toUserAccount:W_C,mint:OTHER,tokenAmount:100}], accountData:[], nativeTransfers:[] });
  const wd = new Map([[W_A,{address:W_A,hop:1 as const,txs:[shared],counterparties:[]}],[W_B,{address:W_B,hop:1 as const,txs:[shared],counterparties:[]}]]);
  it("détecte token lié avec wallets communs", async () => { const r=await computeRelatedProjects(MINT_A,[W_A,W_B],wd,[]); expect(r.length).toBeGreaterThanOrEqual(1); expect(r[0].mint).toBe(OTHER); });
  it("link_score > 0 pour token avec wallets communs", async () => { const r=await computeRelatedProjects(MINT_A,[W_A,W_B],wd,[]); expect(r[0].link_score).toBeGreaterThan(0); });
  it("exclut le mint cible des projets liés", async () => { const r=await computeRelatedProjects(MINT_A,[W_A,W_B],wd,[]); expect(r.every(p=>p.mint!==MINT_A)).toBe(true); });
});

// ── GraphReport shape ─────────────────────────────────────────────────────────
describe("GraphReport shape", () => {
  it("a les champs requis", () => {
    const r = { version:"1.0" as const, generated_at:new Date().toISOString(), query:{mint:MINT_A,hops:1 as const,days:30 as const}, provider:{name:"Helius" as const,tier:"developer" as const,note:""}, limits:{max_seeds:50 as const,tx_per_wallet:300 as const,max_expanded_hop1:50 as const,max_expanded_hop2:25 as const,seeds_used:0,wallets_expanded_hop1:0,wallets_expanded_hop2:0,tx_fetched:0}, seed_wallets:[], clusters:[], related_projects:[], overall_status:"REFERENCED" as const, cache_hit:false };
    expect(r.version).toBe("1.0");
    expect(r.limits.max_seeds).toBe(50);
    expect(r.limits.tx_per_wallet).toBe(300);
  });
});

// ── expand limits ─────────────────────────────────────────────────────────────
describe("expand limits", async () => {
  it("constantes correctes", async () => {
    const { MAX_TX_PER_WALLET, MAX_HOP1, MAX_HOP2 } = await import("../expand");
    expect(MAX_TX_PER_WALLET).toBe(300);
    expect(MAX_HOP1).toBe(50);
    expect(MAX_HOP2).toBe(25);
  });
});

// ── PDF section string test ───────────────────────────────────────────────────
describe("pdfRenderer — Scam Family section", () => {
  it("contient le header Scam Family Graph quand graphReport fourni", async () => {
    const { renderCaseFilePDF } = await import("@/components/pdf/pdfRenderer");
    const fakeScan: any = {
      mint: MINT_A, scanned_at: new Date().toISOString(),
      off_chain: { claims:[], source:"test", status:"Referenced", summary:"test", case_id:"TEST" },
      on_chain: { markets: { source:null, primary_pool:null, dex:null, url:null, price:null, liquidity_usd:null, volume_24h_usd:null, fdv_usd:null, fetched_at:new Date().toISOString(), cache_hit:false } },
      risk: { score:50, tier:"ORANGE", flags:[], breakdown:{ claim_penalty:0, severity_multiplier:1 } },
    };
    const fakeGraph: any = { version:"1.0", overall_status:"CORROBORATED", clusters:[{id:"c1",label:"Test Cluster",strength:"HIGH",heuristic:"shared_funder",wallets:[],proofs:[{type:"shared_funder",tx_signature:"abc123",timestamp:1700000000,detail:"test"}],status:"CORROBORATED"}], related_projects:[], limits:{seeds_used:2,tx_fetched:100,wallets_expanded_hop1:2,wallets_expanded_hop2:0,max_seeds:50}, query:{hops:1,days:30}, provider:{name:"Helius"}, cache_hit:false };
    const html = renderCaseFilePDF(fakeScan, "en", fakeGraph);
    expect(html).toContain("Scam Family Graph");
    expect(html).toContain("CORROBORATED");
  });

  it("affiche encadré unavailable quand graphReport est null", async () => {
    const { renderCaseFilePDF } = await import("@/components/pdf/pdfRenderer");
    const fakeScan: any = {
      mint: MINT_A, scanned_at: new Date().toISOString(),
      off_chain: { claims:[], source:"test", status:"Referenced", summary:"test", case_id:"TEST" },
      on_chain: { markets: { source:null, primary_pool:null, dex:null, url:null, price:null, liquidity_usd:null, volume_24h_usd:null, fdv_usd:null, fetched_at:new Date().toISOString(), cache_hit:false } },
      risk: { score:50, tier:"ORANGE", flags:[], breakdown:{ claim_penalty:0, severity_multiplier:1 } },
    };
    const html = renderCaseFilePDF(fakeScan, "en", null);
    expect(html).toContain("Scam Family Graph");
    expect(html).toContain("unavailable");
  });
});
