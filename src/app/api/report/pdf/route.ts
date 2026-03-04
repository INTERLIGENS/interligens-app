import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

const BG="0.020 0.020 0.020",CARD="0.058 0.070 0.086",HD="0.035 0.045 0.058";
const STR="0.110 0.130 0.155",OR="0.973 0.357 0.020",W="1.000 1.000 1.000";
const SEC="0.540 0.560 0.600",MUT="0.220 0.240 0.270",BLK="0 0 0";
const GRN="0.063 0.733 0.329",AMB="0.921 0.580 0.020",DNG="0.897 0.220 0.220";

function esc(s:string):string{
  return String(s??"")
    .replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")
    .replace(/\u00e9/g,"e").replace(/\u00e8/g,"e").replace(/\u00ea/g,"e")
    .replace(/\u00e0/g,"a").replace(/\u00e2/g,"a").replace(/\u00f4/g,"o")
    .replace(/\u00f9/g,"u").replace(/\u00fb/g,"u").replace(/\u00ee/g,"i")
    .replace(/\u00e7/g,"c").replace(/\u00e2/g,"a").replace(/\u00c9/g,"E")
    .replace(/[\x80-\xff]/g,"?");
}
function tc(t:string){const u=(t??"").toUpperCase();return u==="GREEN"?GRN:u==="RED"?DNG:AMB;}
function lc(l:string){const v=(l??"").toLowerCase();return v==="high"||v==="critical"?DNG:v==="medium"||v==="med"?AMB:GRN;}
type O=string[];
const PW=595;

function fill(o:O,x:number,y:number,w:number,h:number,c:string){
  o.push(`${c} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
}
function box(o:O,x:number,y:number,w:number,h:number){
  o.push(`${CARD} rg ${STR} RG 0.5 w ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re B`);
}
function hl(o:O,y:number,x1=20,x2=575,c=STR){
  o.push(`0.4 w ${c} RG ${x1.toFixed(1)} ${y.toFixed(1)} m ${x2.toFixed(1)} ${y.toFixed(1)} l S`);
}
function tx(o:O,x:number,y:number,s:string,f:"R"|"B",sz:number,c=W){
  o.push(`${c} rg BT /${f==="B"?"F2":"F1"} ${sz} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`);
}
function mono(o:O,x:number,y:number,s:string,sz:number,c=W){
  o.push(`${c} rg BT /F3 ${sz} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`);
}
function lbl(o:O,x:number,y:number,s:string,c=SEC){
  o.push(`${c} rg BT /F2 7 Tf 0.9 Tc ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s.toUpperCase())}) Tj 0 Tc ET`);
}
function pill(o:O,x:number,y:number,label:string,bg:string,sz=7,txtC=BLK):number{
  const PH=18,charW=sz*0.58,textW=label.length*charW,pw=Math.max(40,textW+22);
  fill(o,x,y,pw,PH,bg);
  o.push(`${txtC} rg BT /F2 ${sz} Tf ${(x+(pw-textW)/2).toFixed(1)} ${(y+(PH-sz)/2+1.5).toFixed(1)} Td (${esc(label)}) Tj ET`);
  return pw;
}
function bar(o:O,x:number,y:number,bw:number,bh:number,pct:number,c:string){
  fill(o,x,y,bw,bh,STR);
  const fw=Math.max(0,Math.min(bw,bw*pct/100));
  if(fw>0) fill(o,x,y,fw,bh,c);
}

// Proper donut ring: arc outline + filled arc + inner white circle
function donut(o:O,cx:number,cy:number,R:number,score:number,col:string){
  const r2=(d:number)=>(d-90)*Math.PI/180;
  const steps=120;
  // Background track (full circle)
  o.push(`q 10 w ${STR} RG`);
  for(let i=0;i<=steps;i++){
    const a=r2((i/steps)*360);
    o.push(`${(cx+R*Math.cos(a)).toFixed(2)} ${(cy+R*Math.sin(a)).toFixed(2)} ${i===0?"m":"l"}`);
  }
  o.push("S Q");
  if(score<=0) return;
  // Colored arc — no end dot
  const sw=Math.min(359.9,(score/100)*360);
  const st=Math.max(24,Math.ceil(sw/2));
  o.push(`q 10 w ${col} RG`);
  for(let i=0;i<=st;i++){
    const a=r2((i/st)*sw);
    o.push(`${(cx+R*Math.cos(a)).toFixed(2)} ${(cy+R*Math.sin(a)).toFixed(2)} ${i===0?"m":"l"}`);
  }
  o.push("S Q");
  // Round cap at start (top)
  const sa=r2(0),sx=cx+R*Math.cos(sa),sy=cy+R*Math.sin(sa);
  o.push(`q ${col} rg`);
  for(let i=0;i<=12;i++){const a=i*Math.PI/6;o.push(`${(sx+5*Math.cos(a)).toFixed(2)} ${(sy+5*Math.sin(a)).toFixed(2)} ${i===0?"m":"l"}`);}
  o.push("f Q");
  // Round cap at end
  const ea=r2(sw),ex=cx+R*Math.cos(ea),ey=cy+R*Math.sin(ea);
  o.push(`q ${col} rg`);
  for(let i=0;i<=12;i++){const a=i*Math.PI/6;o.push(`${(ex+5*Math.cos(a)).toFixed(2)} ${(ey+5*Math.sin(a)).toFixed(2)} ${i===0?"m":"l"}`);}
  o.push("f Q");
}

function ellip(addr:string,max=26):string{
  if(!addr||addr.length<=max) return addr;
  const h=Math.floor((max-3)/2);
  return addr.slice(0,h)+"..."+addr.slice(-h);
}
// Split address into chunks of n chars
function chunks(s:string,n:number):string[]{
  const r=[];
  for(let i=0;i<s.length;i+=n) r.push(s.slice(i,i+n));
  return r;
}

function buildPDF(data:{chain:string;address:string;score:number;tier:string;
  verdict:string;proofs:any[];recommendations:string[];date:string;lang:string;}):Buffer{
  const fr=data.lang==="fr";
  const sc=Math.min(100,Math.max(0,Number(data.score)||0));
  const tier=(data.tier??"GREEN").toUpperCase();
  const tCol=tc(tier);
  const ch=(data.chain??"").toUpperCase();
  const addr=String(data.address??"");
  const prf=(data.proofs??[]).slice(0,3);
  const rec=(data.recommendations??[]).slice(0,3);
  const rid=Date.now().toString(36).slice(-6).toUpperCase();
  const tierLbl=fr?(tier==="GREEN"?"SAIN":tier==="RED"?"DANGER":"PRUDENCE")
                  :(tier==="GREEN"?"CLEAN":tier==="RED"?"HIGH RISK":"CAUTION");
  const o:O=[];

  // BG
  fill(o,0,0,PW,842,BG);

  // ── HEADER ──────────────────────────────────────────────────
  fill(o,0,800,PW,42,HD);
  hl(o,800,0,PW,STR);
  fill(o,0,800,4,42,OR);
  tx(o,20,822,"INTERLIGENS","B",15,OR);
  tx(o,20,808,fr?"Rapport d'analyse forensique — On-chain":"Forensic Wallet Report — On-chain Intelligence","R",7,SEC);
  tx(o,PW-200,824,data.date,"R",6.5,SEC);
  tx(o,PW-200,812,"ID "+rid,"R",6,MUT);

  // ── HERO BAND ───────────────────────────────────────────────
  const HB=685,HH=108;
  const LW=252;

  // Left card: address
  box(o,20,HB,LW,HH);
  fill(o,20,HB+HH-4,LW,4,OR);
  lbl(o,32,HB+HH-16,fr?"ADRESSE ANALYSEE":"SCANNED ADDRESS",OR);
  hl(o,HB+HH-22,32,20+LW-10,STR);
  // Short ellipsis line
  mono(o,32,HB+HH-36,ellip(addr,30),8.5,W);
  hl(o,HB+HH-42,32,20+LW-10,MUT);
  // Full address in 34-char lines
  const addrChunks=chunks(addr,34);
  addrChunks.slice(0,3).forEach((c,i)=>mono(o,32,HB+HH-54-(i*10),c,5.5,MUT));
  hl(o,HB+36,32,20+LW-10,STR);
  lbl(o,32,HB+26,fr?"RESEAU":"NETWORK");
  tx(o,32,HB+13,ch,"B",12,W);
  tx(o,32,HB+3,fr?"Aucune signature requise":"No signature required","R",6,MUT);

  // Right card: TigerScore donut
  const RX=282,RW=293;
  box(o,RX,HB,RW,HH);
  fill(o,RX,HB+HH-4,RW,4,tCol);
  const rcx=RX+64,rcy=HB+HH/2-2,rR=40;
  donut(o,rcx,rcy,rR,sc,tCol);
  // Score text centered in donut
  const ss=String(sc);
  // Horizontal: Helvetica-Bold digit width ~13px at sz22, ~4.5px at sz7
  const scoreW=ss.length*13;
  const subW=4*4.5; // "/100" 4 chars
  const lblW=10*4.2; // "TIGERSCORE" 10 chars
  // Fixed offsets — calibrated visually, not computed
  const sxOff=ss.length===3?-18:ss.length===2?-13:-7;
  tx(o,rcx+sxOff,rcy+6,ss,"B",22,tCol);
  tx(o,rcx+sxOff,rcy-10,"/100","R",7,SEC);
  lbl(o,rcx+sxOff,rcy-21,"TIGERSCORE",MUT);

  // Verdict column — no duplicate text
  const VX=RX+138;
  lbl(o,VX,HB+HH-16,fr?"EVALUATION":"ASSESSMENT");
  hl(o,HB+HH-22,VX,RX+RW-14,STR);
  {
    const _sz=9,_cw=_sz*0.58,_tw=tierLbl.length*_cw,_pw=Math.max(40,_tw+22);
    const _colW=155,_px=VX+Math.max(0,(_colW-_pw)/2);
    pill(o,_px,HB+HH-42,tierLbl,tCol,_sz,tier==="RED"||tier==="GREEN"?W:BLK);
  }
  // Score bar only
  lbl(o,VX,HB+48,fr?"SCORE":"SCORE");
  bar(o,VX,HB+36,RW-(VX-RX)-18,5,sc,tCol);
  tx(o,VX,HB+22,`${sc}/100`,"B",11,tCol);
  tx(o,VX,HB+6,fr?"Analyse : On-chain":"Analysis: On-chain","R",6,MUT);

  hl(o,HB-12);

  // ── TOP ON-CHAIN PROOFS ──────────────────────────────────────
  let cy=HB-24;
  lbl(o,20,cy,fr?"PREUVES ON-CHAIN (TOP 3)":"TOP ON-CHAIN SIGNALS",OR);
  cy-=18;
  const pShow=prf.length>0?prf:[
    {label:fr?"Analyse":"Analysis",value:fr?"Aucun signal critique":"No major red flags",level:"low",riskDescription:fr?"Wallet propre":"Clean wallet"},
  ];
  const PCW=(PW-40-16)/3,PCH=72;
  pShow.slice(0,3).forEach((p:any,i:number)=>{
    const px=20+i*(PCW+8),py=cy-PCH;
    const lvl=(p.level??"low").toLowerCase(),col=lc(lvl);
    const pt=fr?(lvl==="high"||lvl==="critical"?"ELEVE":lvl==="medium"||lvl==="med"?"MOYEN":"FAIBLE")
               :(lvl==="high"||lvl==="critical"?"HIGH":lvl==="medium"||lvl==="med"?"MED":"LOW");
    box(o,px,py,PCW,PCH);
    fill(o,px,py+PCH-4,PCW,4,col);
    lbl(o,px+10,py+PCH-16,String(p.label??"").slice(0,18));
    tx(o,px+10,py+PCH-32,String(p.value??"").slice(0,22),"B",10.5,W);
    tx(o,px+10,py+32,String(p.riskDescription??"").slice(0,34),"R",6,SEC);
    pill(o,px+10,py+10,pt,col,6.5);
  });
  cy-=PCH+10;
  hl(o,cy);

  // ── RECOMMENDED ACTIONS ──────────────────────────────────────
  cy-=14;
  lbl(o,20,cy,fr?"A FAIRE MAINTENANT":"RECOMMENDED ACTIONS",OR);
  cy-=16;
  const rShow=rec.length>0?rec:[
    fr?"Verifier les liens avant de signer":"Verify URLs before signing",
    fr?"Tester un petit montant d'abord":"Test with a small amount first",
    fr?"Surveiller regulierement":"Monitor regularly",
  ];
  rShow.slice(0,3).forEach((r:string)=>{
    box(o,20,cy-22,PW-40,26);
    fill(o,20,cy-22,4,26,tCol);
    o.push(`${tCol} rg ${(35).toFixed(1)} ${(cy-16).toFixed(1)} m ${(40).toFixed(1)} ${(cy-11).toFixed(1)} l ${(40).toFixed(1)} ${(cy-16).toFixed(1)} l f`);
    tx(o,47,cy-14,String(r).slice(0,76),"R",8.5,W);
    cy-=30;
  });
  hl(o,cy);

  // ── MARKET SIGNALS ───────────────────────────────────────────
  cy-=14;
  lbl(o,20,cy,fr?"SIGNAUX MARCHE":"MARKET SIGNALS",OR);
  cy-=16;
  // 3 cards, bars start at same baseline x
  const MCH=56,MCW=(PW-40-16)/3,BARX=10,BARW=MCW-20;
  const mets=[
    {label:fr?"MANIPULATION":"MANIPULATION",pct:92,col:DNG,
     sub:fr?"Campagne de shill":"Shill campaign"},
    {label:fr?"ALERTES COMM.":"COMMUNITY ALERTS",pct:45,col:AMB,
     sub:fr?"Signalements en hausse":"Reports rising"},
    {label:fr?"CONFIANCE":"TRUST",pct:10,col:GRN,
     sub:fr?"Transparence OK":"Transparency OK"},
  ];
  mets.forEach((m,i)=>{
    const mx=20+i*(MCW+8),my=cy-MCH;
    box(o,mx,my,MCW,MCH);
    fill(o,mx,my+MCH-4,MCW,4,m.col);
    lbl(o,mx+BARX,my+MCH-15,m.label);
    tx(o,mx+BARX,my+MCH-30,`${m.pct}%`,"B",13,m.col);
    bar(o,mx+BARX,my+14,BARW,5,m.pct,m.col);
    tx(o,mx+BARX,my+4,m.sub,"R",6,SEC);
  });
  cy-=MCH+10;
  hl(o,cy);

  // ── INVESTIGATION CARD ──────────────────────────────────────
  cy-=14;
  lbl(o,20,cy,fr?"DOSSIER D'INVESTIGATION":"INVESTIGATION FILE",OR);
  cy-=14;
  const ICH=44,IW=PW-40;
  box(o,20,cy-ICH,IW,ICH);
  fill(o,20,cy-ICH,3,ICH,MUT);
  // 3 columns inside
  const cols=[
    {k:fr?"STATUT":"STATUS",  v:fr?"En attente":"Pending"},
    {k:fr?"ANALYSTE":"ANALYST",v:"—"},
    {k:fr?"PERIMETRE":"SCOPE", v:fr?"On-chain only (demo)":"On-chain only (demo)"},
  ];
  const CW=IW/3;
  cols.forEach((c,i)=>{
    const cx2=28+i*CW;
    lbl(o,cx2,cy-14,c.k);
    tx(o,cx2,cy-26,c.v,"B",8.5,W);
  });

  // ── FOOTER ───────────────────────────────────────────────────
  fill(o,0,0,PW,28,HD);
  hl(o,28,0,PW,STR);
  fill(o,0,0,4,28,OR);
  tx(o,14,16,fr?"Pas un conseil financier — Interligens Intelligence (c) 2026 — BA Audit Trace v2.6.x"
              :"Not financial advice — Interligens Intelligence (c) 2026 — BA Audit Trace v2.6.x","R",6,MUT);
  tx(o,14,5,`${ch} Report — ${rid} — ${data.date}`,"R",5.5,MUT);

  // ── ASSEMBLE PDF ─────────────────────────────────────────────
  const stream=o.join("\n"),slen=Buffer.from(stream,"latin1").length;
  const f1="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const f2="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  const f3="<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  const o1="1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const o2="2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const o3=`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n   /Contents 4 0 R\n   /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj\n`;
  const o4=`4 0 obj\n<< /Length ${slen} >>\nstream\n${stream}\nendstream\nendobj\n`;
  const o5=`5 0 obj\n${f1}\nendobj\n`,o6=`6 0 obj\n${f2}\nendobj\n`,o7=`7 0 obj\n${f3}\nendobj\n`;
  const hdr="%PDF-1.4\n",body=o1+o2+o3+o4+o5+o6+o7;
  const offs:number[]=[]; let pos=hdr.length;
  [o1,o2,o3,o4,o5,o6,o7].forEach(x=>{offs.push(pos);pos+=Buffer.byteLength(x,"latin1");});
  const xpos=hdr.length+Buffer.byteLength(body,"latin1");
  const xref=["xref","0 8","0000000000 65535 f ",...offs.map(n=>`${String(n).padStart(10,"0")} 00000 n `)].join("\n")+"\n";
  const trlr=`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xpos}\n%%EOF\n`;
  return Buffer.concat([Buffer.from(hdr,"latin1"),Buffer.from(body,"latin1"),Buffer.from(xref,"latin1"),Buffer.from(trlr,"latin1")]);
}

export async function POST(req:NextRequest){
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.pdf);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));
  try{
    const b=await req.json();
    const now=new Date().toLocaleString(b.lang==="fr"?"fr-FR":"en-GB",{timeZone:"Europe/Paris"});
    const pdf=buildPDF({...b,date:now});
    const ch=String(b.chain??"scan").toLowerCase();
    const ad=String(b.address??"").slice(0,8);
    return new NextResponse(pdf as unknown as BodyInit,{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="interligens-${ch}-${ad}.pdf"`}});
  }catch(e:any){return NextResponse.json({error:String(e?.message)},{status:500});}
}
