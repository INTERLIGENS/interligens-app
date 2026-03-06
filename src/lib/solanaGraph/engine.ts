// src/lib/solanaGraph/engine.ts
import { GraphReport, HopsDepth, DaysWindow, GraphLimits } from "./types";
import { seedFromMint, seedFromWallet } from "./seed";
import { expandGraph, MAX_TX_PER_WALLET, MAX_HOP1, MAX_HOP2 } from "./expand";
import { runAllHeuristics, computeOverallStatus } from "./cluster";
import { computeRelatedProjects, enrichRelatedProjects } from "./related";
import { cacheGetGraph, cacheSetGraph, graphKey, graphTTL } from "./cache";

export async function buildGraphReport(mint?: string, wallet?: string, hops: HopsDepth=1, days: DaysWindow=30): Promise<GraphReport> {
  if(!mint&&!wallet) throw new Error("Must provide mint or wallet");
  const qt=mint??wallet!, qtype=mint?"mint":"wallet";
  const cKey=graphKey(qt,qtype,hops,days);
  const cached=await cacheGetGraph(cKey); if(cached) return{...cached,cache_hit:true};
  const sr=mint?await seedFromMint(mint):await seedFromWallet(wallet!);
  const sw=sr.seed_wallets, sa=sw.map(w=>w.address);
  const{walletData,stats}=await expandGraph(sa,hops,days);
  const clusters=runAllHeuristics(sa,walletData);
  const rel=await enrichRelatedProjects(await computeRelatedProjects(mint,sa,walletData,clusters));
  const limits: GraphLimits={max_seeds:50,tx_per_wallet:MAX_TX_PER_WALLET,max_expanded_hop1:MAX_HOP1,max_expanded_hop2:MAX_HOP2,seeds_used:sw.length,wallets_expanded_hop1:stats.wallets_expanded_hop1,wallets_expanded_hop2:stats.wallets_expanded_hop2,tx_fetched:stats.tx_fetched};
  const report: GraphReport={version:"1.0",generated_at:new Date().toISOString(),computed_at:new Date().toISOString(),query:{mint,wallet,hops,days},provider:{name:"Helius",tier:"developer",note:"Helius Developer ($49/mo). Enhanced transactions API."},limits,seed_wallets:sw,clusters,related_projects:rel,overall_status:computeOverallStatus(clusters),cache_hit:false};
  await cacheSetGraph(cKey,report,graphTTL(hops,days)); return report;
}
