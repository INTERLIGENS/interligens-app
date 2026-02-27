import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BG="0.043 0.059 0.078",CARD="0.075 0.090 0.112",HD="0.048 0.062 0.080";
const STR="0.118 0.136 0.160",OR="0.973 0.357 0.020",W="1.000 1.000 1.000";
const SEC="0.580 0.600 0.640",MUT="0.260 0.280 0.310",BLK="0 0 0";
const GRN="0.133 0.773 0.369",AMB="0.961 0.620 0.043",DNG="0.937 0.267 0.267";
const PW=595,PH=842,MARGIN=20,FOOTER_H=26,HEADER_H=42;
const SAFE_TOP = PH - HEADER_H - 14;
const SAFE_BOT = FOOTER_H + 10;

function esc(s:string):string{
  return String(s??"")
    .replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")
    .replace(/[^\x00-\x7E]/g,()=>"?");
}
function tc(t:string){const u=(t??"").toUpperCase();return u==="GREEN"?GRN:u==="RED"?DNG:AMB;}
function sc(s:string){const v=(s??"").toLowerCase();return v==="corroborated"?GRN:v==="unverified"?AMB:OR;}

type O=string[];
function fill(o:O,x:number,y:number,w:number,h:number,c:string){if(w>0&&h>0)o.push(`${c} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);}
function box(o:O,x:number,y:number,w:number,h:number){if(h>0)o.push(`${CARD} rg ${STR} RG 0.4 w ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re B`);}
function hl(o:O,y:number,x1=MARGIN,x2=PW-MARGIN){o.push(`0.4 w ${STR} RG ${x1.toFixed(1)} ${y.toFixed(1)} m ${x2.toFixed(1)} ${y.toFixed(1)} l S`);}
function tx(o:O,x:number,y:number,s:string,f:"R"|"B",sz:number,c=W){o.push(`${c} rg BT /${f==="B"?"F2":"F1"} ${sz} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`);}
function lbl(o:O,x:number,y:number,s:string,c=SEC){o.push(`${c} rg BT /F2 6.5 Tf 0.8 Tc ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s.toUpperCase())}) Tj 0 Tc ET`);}
function pill(o:O,x:number,y:number,label:string,bg:string,sz=7):number{
  const PH2=16,cw=sz*0.60,tw=label.length*cw,pw=Math.max(32,tw+18);
  fill(o,x,y,pw,PH2,bg);
  o.push(`${BLK} rg BT /F2 ${sz} Tf ${(x+(pw-tw)/2).toFixed(1)} ${(y+(PH2-sz)*0.35).toFixed(1)} Td (${esc(label)}) Tj ET`);
  return pw;
}
function ring(o:O,cx:number,cy:number,R:number,score:number,c:string){
  const r2=(d:number)=>(d-90)*Math.PI/180;
  o.push(`q 2.5 w ${STR} RG`);
  for(let i=0;i<=72;i++){const a=r2(i*5);o.push(`${(cx+R*Math.cos(a)).toFixed(2)} ${(cy+R*Math.sin(a)).toFixed(2)} ${i===0?"m":"l"}`);}
  o.push("S Q");
  const sw=Math.max(5,(score/100)*360),st=Math.max(12,Math.ceil(sw/3));
  o.push(`q 5 w ${c} RG`);
  for(let i=0;i<=st;i++){const a=r2((i/st)*sw);o.push(`${(cx+R*Math.cos(a)).toFixed(2)} ${(cy+R*Math.sin(a)).toFixed(2)} ${i===0?"m":"l"}`);}
  o.push("S Q");
  const ea=r2(sw),ex=cx+R*Math.cos(ea),ey=cy+R*Math.sin(ea);
  o.push(`q ${c} rg`);
  for(let i=0;i<=12;i++){const a=i*Math.PI/6;o.push(`${(ex+4.5*Math.cos(a)).toFixed(2)} ${(ey+4.5*Math.sin(a)).toFixed(2)} ${i===0?"m":"l"}`);}
  o.push("f Q");
}
function ellip(s:string,max=32):string{if(s.length<=max)return s;const h=Math.floor((max-3)/2);return s.slice(0,h)+"..."+s.slice(-h);}

function pageHdr(o:O,title:string,sub:string,pn:number,tp:number,rid:string){
  fill(o,0,PH-HEADER_H,PW,HEADER_H,HD);
  fill(o,0,PH-HEADER_H,4,HEADER_H,OR);
  tx(o,MARGIN+4,PH-20,"INTERLIGENS","B",12,OR);
  tx(o,MARGIN+4,PH-31,title,"B",8.5,W);
  tx(o,MARGIN+4,PH-40,sub,"R",6,SEC);
  tx(o,PW-60,PH-22,`${pn}/${tp}`,"R",7,MUT);
  tx(o,PW-95,PH-32,rid,"R",5.5,MUT);
  fill(o,0,0,PW,FOOTER_H,HD);
  fill(o,0,0,4,FOOTER_H,OR);
  tx(o,14,10,"Not financial advice - Interligens Intelligence (c) 2026 - CaseFile Engine v1.1","R",5.5,MUT);
}

// ── PAGE 1: COVER ─────────────────────────────────────────────────────────────
function buildCover(cf:any,rid:string,totalPages:number):O{
  const o:O=[];
  fill(o,0,0,PW,PH,BG);
  pageHdr(o,"CASE FILE","Forensic Intelligence Report",1,totalPages,rid);

  const score=cf.verdict?.score??0;
  const tier=(cf.verdict?.tier??"RED").toUpperCase();
  const tCol=tc(tier);
  const sym=cf.on_chain?.asset?.symbol??"TOKEN";
  const mint=cf.case?.input?.value??"";
  const tierLbl=tier==="RED"?"HIGH RISK":tier==="ORANGE"?"CAUTION":"CLEAN";

  // Title band
  fill(o,0,PH-HEADER_H-88,PW,82,HD);
  fill(o,0,PH-HEADER_H-88,6,82,DNG);
  tx(o,28,PH-HEADER_H-24,`$${sym} -- CASE FILE`,"B",20,W);
  tx(o,28,PH-HEADER_H-40,"Forensic Analysis | Detective Referenced + On-chain","R",8,SEC);
  tx(o,28,PH-HEADER_H-54,`Chain: SOLANA | Mint: ${ellip(mint,42)}`,"R",7,MUT);
  tx(o,28,PH-HEADER_H-68,`Scan: ${(cf.case?.scan_timestamp??"").slice(0,19).replace("T"," ")} | ${cf.case?.engine_version??"v1"} | Source: ${cf.case?.offchain_source??"n/a"}`,"R",6.5,MUT);

  // Score ring
  const rcx=76,rcy=PH-HEADER_H-88-80,rR=44;
  ring(o,rcx,rcy,rR,score,tCol);
  const ss=String(score);
  tx(o,ss.length>=3?rcx-16:ss.length===2?rcx-11:rcx-7,rcy+10,ss,"B",22,tCol);
  tx(o,rcx-10,rcy-5,"/100","R",7,SEC);
  lbl(o,rcx-24,rcy-22,"TIGERSCORE",MUT);

  // Verdict panel
  const vx=155,vy=PH-HEADER_H-88-20;
  lbl(o,vx,vy,"VERDICT");
  pill(o,vx,vy-22,tierLbl,tCol,9);
  tx(o,vx,vy-44,`Score: ${score}/100`,"B",11,tCol);
  (cf.verdict?.retail_summary??[]).forEach((s:string,i:number)=>{
    fill(o,vx,vy-62-(i*16),5,5,tCol);
    tx(o,vx+10,vy-59-(i*16),String(s).slice(0,60),"R",7,W);
  });

  // Claims status table
  const claims=cf.off_chain?.claims??[];
  const linking=cf.evidence_linking??[];
  let cy=PH-HEADER_H-88-180;

  hl(o,cy+14);
  lbl(o,MARGIN,cy,"CLAIMS STATUS -- EVIDENCE PACK ("+claims.length+" claims)",OR);
  cy-=18;

  claims.forEach((c:any)=>{
    if(cy < SAFE_BOT+20) return;
    const link=linking.find((l:any)=>l.claim_id===c.id);
    const st=link?.final_status??c.status??"Referenced";
    const stCol=sc(st);
    box(o,MARGIN,cy-18,PW-MARGIN*2,20);
    fill(o,MARGIN,cy-18,3,20,stCol);
    tx(o,MARGIN+8,cy-7,c.id,"B",7,OR);
    tx(o,MARGIN+30,cy-7,String(c.topic??"").slice(0,48),"R",7,W);
    pill(o,PW-MARGIN-80,cy-17,st,stCol,6);
    cy-=24;
  });

  return o;
}

// ── PAGE 2: ON-CHAIN ──────────────────────────────────────────────────────────
function buildOnChain(cf:any,rid:string,totalPages:number):O{
  const o:O=[];
  fill(o,0,0,PW,PH,BG);
  pageHdr(o,"ON-CHAIN EVIDENCE","Machine-verifiable signals",2,totalPages,rid);

  const asset=cf.on_chain?.asset??{};
  const mkts=cf.on_chain?.markets??{};
  const dist=cf.on_chain?.distribution??{};
  const flows=cf.on_chain?.flows??{};
  let cy=SAFE_TOP;

  lbl(o,MARGIN,cy,"ASSET SNAPSHOT",OR); cy-=16;
  [["Mint",ellip(asset.mint??"n/a",44)],["Symbol",asset.symbol??"n/a"],
   ["Decimals",String(asset.decimals??"n/a")],["Supply",String(asset.supply??"n/a")],
   ["Mint Authority",asset.mintAuthority??"revoked/null"]
  ].forEach(([k,v])=>{box(o,MARGIN,cy-20,PW-MARGIN*2,22);tx(o,MARGIN+8,cy-8,k,"B",7,SEC);tx(o,160,cy-8,v.slice(0,52),"R",7,W);cy-=26;});

  cy-=6;hl(o,cy);cy-=14;
  lbl(o,MARGIN,cy,"MARKET SNAPSHOT",OR); cy-=16;
  [["Primary Pool",ellip(mkts.primary_pool??"n/a",44)],["DEX",mkts.dex??"n/a"],
   ["Price USD",String(mkts.price_usd??"n/a")],
   ["Liquidity USD",mkts.liquidity_usd?`$${Number(mkts.liquidity_usd).toLocaleString()}`:"n/a"],
   ["Volume 24h",mkts.volume_24h_usd?`$${Number(mkts.volume_24h_usd).toLocaleString()}`:"n/a"],
   ["FDV",mkts.fdv_usd?`$${Number(mkts.fdv_usd).toLocaleString()}`:"n/a"]
  ].forEach(([k,v])=>{box(o,MARGIN,cy-20,PW-MARGIN*2,22);tx(o,MARGIN+8,cy-8,k,"B",7,SEC);tx(o,160,cy-8,v.slice(0,52),"R",7,W);cy-=26;});

  cy-=6;hl(o,cy);cy-=14;
  lbl(o,MARGIN,cy,`DISTRIBUTION -- TOP-10: ${dist.top10_pct??"n/a"}%`,OR); cy-=16;
  const flags=dist.concentration_flags??[];
  if(flags.length){
    flags.forEach((f:string)=>{pill(o,MARGIN,cy-16,f,DNG,6.5);cy-=22;});
  }
  const holders=(dist.top_holders??[]).slice(0,9);
  const HCW=(PW-MARGIN*2-14)/3;
  holders.forEach((h:any,i:number)=>{
    const col=i%3,row=Math.floor(i/3);
    const hx=MARGIN+col*(HCW+7),hy=cy-(row+1)*24;
    box(o,hx,hy,HCW,22);
    tx(o,hx+5,hy+12,`#${h.rank} ${ellip(h.address,16)}`,"R",6,SEC);
    tx(o,hx+HCW-34,hy+12,`${h.pct}%`,"B",6.5,parseFloat(h.pct)>5?AMB:W);
  });
  cy-=Math.ceil(holders.length/3)*24+8;

  cy-=6;hl(o,cy);cy-=14;
  lbl(o,MARGIN,cy,"FLOW SIGNALS",OR); cy-=16;
  (flows.notable_wallets??[]).forEach((w:any)=>{
    box(o,MARGIN,cy-20,PW-MARGIN*2,22);
    tx(o,MARGIN+8,cy-8,ellip(w.wallet??"",30),"R",7,W);
    tx(o,250,cy-8,String(w.role??"").slice(0,28),"B",7,OR);
    pill(o,PW-MARGIN-90,cy-18,w.status??"Referenced",sc(w.status??""),6);
    cy-=26;
  });
  (flows.wash_trading_signals??[]).forEach((s:string)=>{
    fill(o,MARGIN+4,cy-10,5,5,AMB);
    tx(o,MARGIN+14,cy-7,String(s).slice(0,70),"R",6.5,AMB);
    cy-=16;
  });

  return o;
}

// ── PAGES 3+: OFF-CHAIN (auto-paginate) ───────────────────────────────────────
function buildOffChainPages(cf:any,rid:string,startPage:number,totalPages:number):O[]{
  const pages:O[]=[];
  const claims=cf.off_chain?.claims??[];
  const linking=cf.evidence_linking??[];
  const sources=cf.off_chain?.sources??{};
  const CLAIM_H=72;
  const HEADER_BLOCK=80; // space for section title + thread URLs

  let o:O=[];
  fill(o,0,0,PW,PH,BG);
  pageHdr(o,"OFF-CHAIN EVIDENCE",`Detective Referenced Pack -- ${claims.length} claims`,startPage,totalPages,rid);
  let cy=SAFE_TOP;
  let pageN=startPage;

  // Section header
  lbl(o,MARGIN,cy,"DETECTIVE EVIDENCE PACK -- @dethective REFERENCED",OR);
  fill(o,MARGIN,cy-3,280,1.5,OR);
  cy-=14;
  tx(o,MARGIN,cy,"Source: threads publics @dethective (X) + documents associes","R",7,SEC); cy-=12;
  (sources.dethective_threads??[]).forEach((url:string)=>{
    fill(o,MARGIN,cy-8,5,5,OR);
    tx(o,MARGIN+10,cy-5,url.slice(0,72),"R",6.5,MUT); cy-=13;
  });
  cy-=8; hl(o,cy); cy-=14;

  // Claims — auto paginate
  for(const c of claims){
    // Need new page?
    if(cy - CLAIM_H < SAFE_BOT){
      pages.push(o);
      pageN++;
      o=[];
      fill(o,0,0,PW,PH,BG);
      pageHdr(o,"OFF-CHAIN EVIDENCE (suite)",`Claims (cont.)`,pageN,totalPages,rid);
      cy=SAFE_TOP;
    }

    const link=linking.find((l:any)=>l.claim_id===c.id);
    const st=link?.final_status??c.status??"Referenced";
    const stCol=sc(st);

    box(o,MARGIN,cy-CLAIM_H,PW-MARGIN*2,CLAIM_H);
    fill(o,MARGIN,cy-CLAIM_H,4,CLAIM_H,stCol);

    // Header row
    tx(o,MARGIN+10,cy-13,`${c.id} -- ${String(c.topic??"").slice(0,44)}`,"B",8,W);
    pill(o,PW-MARGIN-82,cy-24,st,stCol,6.5);

    // Claim text (2 lines)
    const clm=String(c.claim??"");
    tx(o,MARGIN+10,cy-26,clm.slice(0,76),"R",6.5,SEC);
    if(clm.length>76) tx(o,MARGIN+10,cy-36,clm.slice(76,150),"R",6.5,SEC);

    // Evidence refs
    const evs=(c.evidence??[]).slice(0,2);
    evs.forEach((e:any,ei:number)=>{
      const ex=MARGIN+10+ei*260;
      fill(o,ex,cy-50,6,6,stCol);
      const refStr=`${e.type}: ${String(e.ref??"").slice(0,32)}`;
      tx(o,ex+10,cy-47,refStr,"R",5.5,MUT);
    });

    // Corroboration
    if(link?.on_chain_checks?.length){
      const corr=link.on_chain_checks.map((ch:any)=>ch.result).join(" | ").slice(0,60);
      tx(o,MARGIN+10,cy-60,"On-chain: "+corr,"B",6,GRN);
    }

    cy -= CLAIM_H+8;
  }

  pages.push(o);
  return pages;
}

// ── PAGE APPENDIX ─────────────────────────────────────────────────────────────
function buildAppendix(cf:any,rid:string,pageN:number,totalPages:number):O{
  const o:O=[];
  fill(o,0,0,PW,PH,BG);
  pageHdr(o,"APPENDIX","CaseFile hash + proof index",pageN,totalPages,rid);

  const hash=crypto.createHash("sha256").update(JSON.stringify(cf)).digest("hex");
  const claims=cf.off_chain?.claims??[];
  const linking=cf.evidence_linking??[];
  let cy=SAFE_TOP;

  lbl(o,MARGIN,cy,"CASEFILE INTEGRITY",OR); cy-=16;
  box(o,MARGIN,cy-28,PW-MARGIN*2,30);
  tx(o,MARGIN+8,cy-10,"SHA-256:","B",7,SEC);
  tx(o,MARGIN+8,cy-22,hash,"R",6,MUT); cy-=36;

  lbl(o,MARGIN,cy,"REPORT METADATA",OR); cy-=16;
  [["Case ID",cf.case?.case_id??""],["Engine",cf.case?.engine_version??""],
   ["Offchain Source",cf.case?.offchain_source??""],
   ["Timestamp",(cf.case?.scan_timestamp??"").slice(0,19).replace("T"," ")],
   ["Tier",cf.verdict?.tier??""],["Score",String(cf.verdict?.score??0)],
   ["Claims count",String(claims.length)]
  ].forEach(([k,v])=>{
    box(o,MARGIN,cy-20,PW-MARGIN*2,22);
    tx(o,MARGIN+8,cy-8,k,"B",7,SEC); tx(o,180,cy-8,String(v).slice(0,52),"R",7,W); cy-=26;
  });

  cy-=8; hl(o,cy); cy-=14;
  lbl(o,MARGIN,cy,"PROOF INDEX",OR); cy-=16;
  for(const c of claims){
    if(cy<SAFE_BOT+20) break;
    const link=linking.find((l:any)=>l.claim_id===c.id);
    const st=link?.final_status??c.status??"Referenced";
    box(o,MARGIN,cy-20,PW-MARGIN*2,22);
    fill(o,MARGIN,cy-20,3,22,sc(st));
    tx(o,MARGIN+8,cy-8,c.id,"B",7,OR);
    tx(o,MARGIN+30,cy-8,String(c.topic??"").slice(0,40),"R",7,W);
    pill(o,PW-MARGIN-82,cy-19,st,sc(st),6);
    cy-=26;
  }

  cy-=8; hl(o,cy); cy-=14;
  lbl(o,MARGIN,cy,"SOURCES",OR); cy-=14;
  [
    "Thread 1: https://x.com/dethective/status/1997766979898450185",
    "Thread 2: https://x.com/dethective/status/2000321916608147714",
    "Screenshots: IMG_2239-IMG_2246.jpg (8 captures @dethective)",
    "Attachments: BOTIFY_SCAM.zip | Dossier_BOTIFY_INTERLIGENS.pdf",
  ].forEach(s=>{tx(o,MARGIN,cy,s,"R",6.5,MUT);cy-=12;});
  cy-=6;
  tx(o,MARGIN,cy,"DISCLAIMER: Off-chain claims are Referenced from public sources. On-chain data may be partial.","R",6,AMB);

  return o;
}

// ── PDF assembler ─────────────────────────────────────────────────────────────
function assemblePDF(pages:O[]):Buffer{
  const N=pages.length;
  const fontBase=N*2+3;
  const streams=pages.map(p=>p.join("\n"));
  const objs:string[]=[];

  objs.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objs.push(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((_,i)=>`${i+3} 0 R`).join(" ")}] /Count ${N} >>\nendobj\n`);

  const fontRef=`/F1 ${fontBase} 0 R /F2 ${fontBase+1} 0 R /F3 ${fontBase+2} 0 R`;
  pages.forEach((_,i)=>{
    objs.push(`${i+3} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}]\n   /Contents ${N+i+3} 0 R /Resources << /Font << ${fontRef} >> >> >>\nendobj\n`);
  });
  pages.forEach((_,i)=>{
    const s=streams[i],sl=Buffer.from(s,"latin1").length;
    objs.push(`${N+i+3} 0 obj\n<< /Length ${sl} >>\nstream\n${s}\nendstream\nendobj\n`);
  });
  objs.push(`${fontBase} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objs.push(`${fontBase+1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);
  objs.push(`${fontBase+2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`);

  const total=objs.length+1;
  const hdr="%PDF-1.4\n";
  const body=objs.join("");
  const offs:number[]=[]; let pos=hdr.length;
  objs.forEach(o2=>{offs.push(pos);pos+=Buffer.byteLength(o2,"latin1");});
  const xpos=hdr.length+Buffer.byteLength(body,"latin1");
  const xref=["xref",`0 ${total}`,`0000000000 65535 f `,
    ...offs.map(n=>`${String(n).padStart(10,"0")} 00000 n `)].join("\n")+"\n";
  const trlr=`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xpos}\n%%EOF\n`;
  return Buffer.concat([Buffer.from(hdr,"latin1"),Buffer.from(body,"latin1"),
    Buffer.from(xref,"latin1"),Buffer.from(trlr,"latin1")]);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const mint=req.nextUrl.searchParams.get("mint")??"";
    if(!mint) return NextResponse.json({error:"mint required"},{status:400});

    const base=req.nextUrl.origin;
    let cf:any;
    try {
      const r=await fetch(`${base}/api/casefile?mint=${encodeURIComponent(mint)}`,
        {signal:AbortSignal.timeout(15000)});
      cf=await r.json();
    } catch(e) {
      return NextResponse.json({error:"CaseFile fetch failed: "+String(e)},{status:500});
    }

    const rid=cf.case?.case_id??Date.now().toString(36).toUpperCase();
    const claims=cf.off_chain?.claims??[];
    const offPages=Math.max(1,Math.ceil(claims.length/5)); // estimate
    const totalPages=3+offPages; // cover + onchain + offchain(n) + appendix

    const offChainPages=buildOffChainPages(cf,rid,3,totalPages);
    const realTotal=2+offChainPages.length+1;
    const appendixN=2+offChainPages.length+1;

    const allPages=[
      buildCover(cf,rid,realTotal),
      buildOnChain(cf,rid,realTotal),
      ...offChainPages.map((p,i)=>p), // already built
      buildAppendix(cf,rid,appendixN,realTotal),
    ];

    const pdf=assemblePDF(allPages);
    const sym=(cf.on_chain?.asset?.symbol??"token").toLowerCase();

    return new NextResponse(pdf,{status:200,headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":`attachment; filename="casefile-${sym}-${rid}.pdf"`,
    }});
  } catch(e:any){
    console.error("[casefile-pdf]",e);
    return NextResponse.json({error:String(e?.message)},{status:500});
  }
}
