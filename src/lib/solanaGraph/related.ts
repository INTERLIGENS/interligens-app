// src/lib/solanaGraph/related.ts
import { RelatedProject, EvidenceStatus, Cluster } from "./types";
import { WalletTxData } from "./expand";
const MIN_SHARED=2; const MAX_RELATED=20;

function buildMintMap(walletData: Map<string,WalletTxData>, excl?: string): Map<string,Set<string>> {
  const m=new Map<string,Set<string>>();
  for(const[a,d]of walletData){for(const tx of d.txs){for(const tt of tx.tokenTransfers??[]){if(!tt.mint||tt.mint===excl)continue;const s=m.get(tt.mint)??new Set();s.add(tt.fromUserAccount);s.add(tt.toUserAccount);s.add(a);m.set(tt.mint,s);}for(const ad of tx.accountData??[]){for(const tbc of ad.tokenBalanceChanges??[]){if(!tbc.mint||tbc.mint===excl)continue;const s=m.get(tbc.mint)??new Set();s.add(tbc.userAccount);s.add(a);m.set(tbc.mint,s);}}}}
  return m;
}

function score(sw: string[], sig: string[]): number {
  let s=Math.min(sw.length*10,50);
  if(sig.includes("cluster_overlap"))s+=20;
  if(sig.includes("lp_overlap"))s+=20;
  if(sig.includes("co_trading"))s+=10;
  return Math.min(s,100);
}

export async function computeRelatedProjects(targetMint: string|undefined, seedWallets: string[], walletData: Map<string,WalletTxData>, clusters: Cluster[]): Promise<RelatedProject[]> {
  const mm=buildMintMap(walletData,targetMint); const ss=new Set(seedWallets); const cands:RelatedProject[]=[];
  for(const[mint,wallets]of mm){
    const sw=[...wallets].filter(w=>ss.has(w)); if(sw.length<MIN_SHARED)continue;
    const sig:string[]=[];
    if(clusters.some(c=>c.wallets.some(w=>wallets.has(w))&&c.wallets.some(w=>ss.has(w))))sig.push("cluster_overlap");
    if(clusters.some(c=>c.heuristic==="co_trading"&&c.wallets.some(w=>wallets.has(w))))sig.push("co_trading");
    if(clusters.some(c=>c.heuristic==="lp_overlap"&&c.wallets.some(w=>wallets.has(w))))sig.push("lp_overlap");
    if(sw.length>0)sig.push("shared_wallets");
    cands.push({mint,link_score:score(sw,sig),shared_wallets:sw.length,shared_wallet_addresses:sw.slice(0,5),signals:sig,status:sig.includes("cluster_overlap")?"CORROBORATED":"REFERENCED"});
  }
  cands.sort((a,b)=>b.link_score-a.link_score); return cands.slice(0,MAX_RELATED);
}

export async function enrichRelatedProjects(projects: RelatedProject[]): Promise<RelatedProject[]> {
  if(!projects.length)return projects;
  const enriched=await Promise.allSettled(projects.slice(0,10).map(async p=>{
    try{const res=await fetch(`https://api.dexscreener.com/latest/dex/tokens/${p.mint}`,{signal:AbortSignal.timeout(3000)});if(!res.ok)return p;const data=await res.json() as any;const pair=data.pairs?.[0];return{...p,symbol:pair?.baseToken?.symbol,name:pair?.baseToken?.name};}catch{return p;}
  }));
  return[...enriched.map((r,i)=>r.status==="fulfilled"?r.value:projects[i]),...projects.slice(10)];
}
