// src/lib/solanaGraph/cluster.ts
import { Cluster, ClusterProof, EvidenceStatus } from "./types";
import { WalletTxData } from "./expand";
const WINDOW = 300; const CO_MIN = 2; const LP_MIN = 2;
let _seq = 0; const nextId = () => `cluster_${(++_seq).toString().padStart(4,"0")}`;

export function detectSharedFunder(seedAddresses: string[], walletData: Map<string, WalletTxData>): Cluster[] {
  const fm = new Map<string, Array<{wallet:string;sig:string;ts:number}>>();
  for (const seed of seedAddresses) { const d = walletData.get(seed); if (!d) continue; for (const tx of d.txs) { for (const nt of tx.nativeTransfers??[]) { if (nt.toUserAccount===seed&&nt.fromUserAccount&&nt.fromUserAccount!==seed&&nt.amount>10_000_000) { const e=fm.get(nt.fromUserAccount)??[]; e.push({wallet:seed,sig:tx.signature,ts:tx.timestamp}); fm.set(nt.fromUserAccount,e); } } } }
  const clusters: Cluster[] = [];
  for (const [funder,events] of fm) {
    if (events.length<2) continue;
    const sorted=[...events].sort((a,b)=>a.ts-b.ts); const groups: Array<typeof events>=[]; let cur=[sorted[0]];
    for (let i=1;i<sorted.length;i++) { if (sorted[i].ts-sorted[i-1].ts<=WINDOW){cur.push(sorted[i]);}else{if(cur.length>=2)groups.push(cur);cur=[sorted[i]];} }
    if (cur.length>=2) groups.push(cur);
    for (const g of groups) { const proofs: ClusterProof[]=g.map(e=>({type:"shared_funder" as const,tx_signature:e.sig,timestamp:e.ts,detail:`Funder ${funder.slice(0,8)}… funded ${e.wallet.slice(0,8)}…`})); clusters.push({id:nextId(),label:`Shared Funder — ${funder.slice(0,8)}…`,strength:"HIGH",heuristic:"shared_funder",wallets:[funder,...new Set(g.map(e=>e.wallet))],proofs,status:proofs.length>0?"CORROBORATED":"REFERENCED"}); }
  }
  return clusters;
}

function getMints(d: WalletTxData): Set<string> { const m=new Set<string>(); for(const tx of d.txs){for(const tt of tx.tokenTransfers??[]){if(tt.mint)m.add(tt.mint);}for(const ad of tx.accountData??[]){for(const tbc of ad.tokenBalanceChanges??[]){if(tbc.mint)m.add(tbc.mint);}}} return m; }

export function detectCoTrading(walletData: Map<string, WalletTxData>): Cluster[] {
  const wm=new Map<string,Set<string>>(); for(const[a,d]of walletData)wm.set(a,getMints(d));
  const addrs=Array.from(wm.keys()); const clusters:Cluster[]=[]; const done=new Set<string>();
  for(let i=0;i<addrs.length;i++){if(done.has(addrs[i]))continue;const g:string[]=[],pt:ClusterProof[]=[],mi=wm.get(addrs[i])!;
    for(let j=i+1;j<addrs.length;j++){const sh=[...mi].filter(m=>wm.get(addrs[j])!.has(m));if(sh.length>=CO_MIN){if(!g.includes(addrs[i]))g.push(addrs[i]);g.push(addrs[j]);const di=walletData.get(addrs[i]);if(di){for(const tx of di.txs){if((tx.tokenTransfers??[]).some(t=>sh.includes(t.mint))){pt.push({type:"co_trading",tx_signature:tx.signature,timestamp:tx.timestamp,detail:`Co-traded ${sh.slice(0,2).join(",")} entre ${addrs[i].slice(0,8)}… et ${addrs[j].slice(0,8)}…`});break;}}}}}
    if(g.length>=2){for(const x of g)done.add(x);clusters.push({id:nextId(),label:`Co-Trading Cluster (${g.length} wallets)`,strength:"MED",heuristic:"co_trading",wallets:g,proofs:pt.slice(0,10),status:pt.length>0?"CORROBORATED":"REFERENCED"});}
  }
  return clusters;
}

const LP_PROG=new Set(["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8","9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP","LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"]);

export function detectLpOverlap(walletData: Map<string, WalletTxData>): Cluster[] {
  const wlp=new Map<string,Set<string>>();
  for(const[a,d]of walletData){const lp=new Set<string>();for(const tx of d.txs){if((tx.accountData??[]).some(ad=>LP_PROG.has(ad.account))){for(const tt of tx.tokenTransfers??[]){if(tt.mint)lp.add(tt.mint);}}}if(lp.size>0)wlp.set(a,lp);}
  const addrs=Array.from(wlp.keys());const clusters:Cluster[]=[]; const done=new Set<string>();
  for(let i=0;i<addrs.length;i++){if(done.has(addrs[i]))continue;const g:string[]=[],pt:ClusterProof[]=[],li=wlp.get(addrs[i])!;
    for(let j=i+1;j<addrs.length;j++){const sh=[...li].filter(m=>wlp.get(addrs[j])!.has(m));if(sh.length>=LP_MIN){if(!g.includes(addrs[i]))g.push(addrs[i]);g.push(addrs[j]);const di=walletData.get(addrs[i]);if(di?.txs[0])pt.push({type:"lp_overlap",tx_signature:di.txs[0].signature,timestamp:di.txs[0].timestamp,detail:`LP overlap ${sh.length} pools entre ${addrs[i].slice(0,8)}… et ${addrs[j].slice(0,8)}…`});}}
    if(g.length>=2){for(const x of g)done.add(x);clusters.push({id:nextId(),label:`LP Overlap Cluster (${g.length} wallets)`,strength:"MED",heuristic:"lp_overlap",wallets:g,proofs:pt.slice(0,10),status:pt.length>0?"CORROBORATED":"REFERENCED"});}
  }
  return clusters;
}

export function runAllHeuristics(seedAddresses: string[], walletData: Map<string, WalletTxData>): Cluster[] {
  _seq=0;
  const all=[...detectSharedFunder(seedAddresses,walletData),...detectCoTrading(walletData),...detectLpOverlap(walletData)];
  const deduped:Cluster[]=[];
  for(const c of all){const dup=deduped.some(d=>{const inter=c.wallets.filter(w=>d.wallets.includes(w)).length;return inter/new Set([...c.wallets,...d.wallets]).size>=0.75;});if(!dup)deduped.push(c);}
  return deduped;
}
export function computeOverallStatus(clusters: Cluster[]): EvidenceStatus {
  if(clusters.some(c=>c.status==="CORROBORATED"))return "CORROBORATED";
  if(clusters.length>0)return "PARTIAL";
  return "REFERENCED";
}
