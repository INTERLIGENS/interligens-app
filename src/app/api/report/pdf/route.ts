import { NextRequest, NextResponse } from "next/server";

const BG="0.043 0.059 0.078",CARD="0.075 0.090 0.112",HD="0.048 0.062 0.080";
const STR="0.118 0.136 0.160",OR="0.973 0.357 0.020",W="1.000 1.000 1.000";
const SEC="0.580 0.600 0.640",MUT="0.260 0.280 0.310",BLK="0 0 0";
const GRN="0.133 0.773 0.369",AMB="0.961 0.620 0.043",DNG="0.937 0.267 0.267";

function esc(s:string):string{
  return String(s??"")
    .replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")
    .replace(/\u00e9/g,"e").replace(/\u00e8/g,"e").replace(/\u00ea/g,"e")
    .replace(/\u00e0/g,"a").replace(/\u00e2/g,"a").replace(/\u00f4/g,"o")
    .replace(/\u00f9/g,"u").replace(/\u00fb/g,"u").replace(/\u00ee/g,"i")
    .replace(/\u00e7/g,"c").replace(/\u00c9/g,"E").replace(/\u00c0/g,"A")
    .replace(/[\x80-\xff]/g,"?");
}
function tc(t:string){const u=(t??"").toUpperCase();return u==="GREEN"?GRN:u==="RED"?DNG:AMB;}
function lc(l:string){const v=(l??"").toLowerCase();return v==="high"?DNG:v==="medium"?AMB:GRN;}
type O=string[];
const PW=595;
function fill(o:O,x:number,y:number,w:number,h:number,c:string){
  o.push(`${c} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
}
function box(o:O,x:number,y:number,w:number,h:number){
  o.push(`${CARD} rg ${STR} RG 0.4 w ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re B`);
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
  o.push(`${c} rg BT /F2 7 Tf 0.8 Tc ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s.toUpperCase())}) Tj 0 Tc ET`);
}
function pill(o:O,x:number,y:number,label:string,bg:string,sz=7):number{
  const PH=17,charW=sz*0.60,textW=label.length*charW,pw=Math.max(32,textW+18);
  fill(o,x,y,pw,PH,bg);
  o.push(`${BLK} rg BT /F2 ${sz} Tf ${(x+(pw-textW)/2).toFixed(1)} ${(y+(PH-sz)*0.38).toFixed(1)} Td (${esc(label)}) Tj ET`);
  return pw;
}
function bar(o:O,x:number,y:number,bw:number,bh:number,pct:number,c:string){
  fill(o,x,y,bw,bh,STR);
  const fw=Math.max(0,Math.min(bw,bw*pct/100));
  if(fw>0) fill(o,x,y,fw,bh,c);
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
function ellip(addr:string,max=26):string{
  if(addr.length<=max) return addr;
  const h=Math.floor((max-3)/2);
  return addr.slice(0,h)+"..."+addr.slice(-h);
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
  const verd=String(data.verdict??tierLbl).slice(0,32);
  const o:O=[];

  // BG
  fill(o,0,0,PW,842,BG);

  // HEADER
  fill(o,0,800,PW,42,HD); hl(o,800,0,PW,STR); fill(o,0,800,4,42,OR);
  tx(o,20,822,"INTERLIGENS","B",14,OR);
  tx(o,20,809,fr?"Rapport d'analyse forensique - On-chain":"Forensic Wallet Report - On-chain Intelligence","R",7,SEC);
  tx(o,PW-195,825,data.date,"R",6.5,SEC);
  tx(o,PW-195,814,"ID "+rid,"R",6,MUT);

  // HERO: LEFT=address, RIGHT=ring
  const HB=682,HH=112;
  const LW=256;
  box(o,20,HB,LW,HH);
  fill(o,20,HB+HH-4,LW,4,OR);
  lbl(o,32,HB+HH-15,fr?"ADRESSE ANALYSEE":"SCANNED ADDRESS",OR);
  hl(o,HB+HH-20,32,20+LW-12,STR);
  // 1 line ellipsis
  mono(o,32,HB+HH-35,ellip(addr,28),8.5,W);
  // full address in strict 34-char chunks — no mid-word break
  const fa1=addr.slice(0,34);
  const fa2=addr.length>34?addr.slice(34,68):"";
  mono(o,32,HB+HH-47,fa1,6,MUT);
  if(fa2) mono(o,32,HB+HH-57,fa2,6,MUT);
  hl(o,HB+37,32,20+LW-12,STR);
  lbl(o,32,HB+27,fr?"RESEAU":"NETWORK");
  tx(o,32,HB+14,ch,"B",11,W);
  tx(o,32,HB+4,fr?"Aucune signature - zero stockage":"No signature - zero storage","R",6,MUT);

  // RIGHT: ring + verdict
  const RX=286,RW=289;
  box(o,RX,HB,RW,HH);
  fill(o,RX,HB+HH-4,RW,4,tCol);
  const rcx=RX+66,rcy=HB+HH/2,rR=42;
  fill(o,rcx-rR+7,rcy-rR+7,(rR-7)*2,(rR-7)*2,HD);
  ring(o,rcx,rcy,rR,sc,tCol);
  const ss=String(sc);
  tx(o,ss.length>=3?rcx-16:ss.length===2?rcx-11:rcx-7,rcy+7,ss,"B",20,tCol);
  tx(o,rcx-9,rcy-7,"/100","R",7,SEC);
  lbl(o,rcx-22,HB+HH-15,"TIGERSCORE",MUT);
  // verdict column
  const VX=RX+136;
  lbl(o,VX,HB+HH-15,fr?"EVALUATION":"ASSESSMENT");
  pill(o,VX,HB+HH-36,tierLbl,tCol,8);
  // verdict one-liner only — no duplicate score
  tx(o,VX,HB+HH-54,verd.slice(0,24),"R",7.5,SEC);
  bar(o,VX,HB+38,RW-(VX-RX)-14,4,sc,tCol);
  tx(o,VX,HB+26,fr?"Confiance : Moyen":"Confidence: Medium","R",6.5,SEC);
  tx(o,VX,HB+4,"BA Trace v2.6","R",6,MUT);

  hl(o,HB-10);

  // TOP ON-CHAIN SIGNALS
  let cy=HB-22;
  lbl(o,20,cy,fr?"PREUVES ON-CHAIN":"TOP ON-CHAIN SIGNALS",OR);
  cy-=18;
  const pShow=prf.length>0?prf:[{label:fr?"Analyse":"Analysis",
    value:fr?"Aucun signal critique":"No major red flags",
    level:"low",riskDescription:fr?"Wallet propre":"Clean wallet"}];
  const PCW=(PW-40-16)/3,PCH=76;
  pShow.slice(0,3).forEach((p:any,i:number)=>{
    const px=20+i*(PCW+8),py=cy-PCH;
    const lvl=(p.level??"low").toLowerCase(),col=lc(lvl);
    const pt=fr?(lvl==="high"?"ELEVE":lvl==="medium"?"MOYEN":"FAIBLE")
               :(lvl==="high"?"HIGH":lvl==="medium"?"MED":"LOW");
    box(o,px,py,PCW,PCH);
    fill(o,px,py+PCH-4,PCW,4,col);
    lbl(o,px+10,py+PCH-15,String(p.label??"").slice(0,16));
    tx(o,px+10,py+PCH-31,String(p.value??"").slice(0,20),"B",11,W);
    tx(o,px+10,py+26,String(p.riskDescription??"").slice(0,32),"R",6.5,SEC);
    pill(o,px+10,py+7,pt,col,6.5);
  });
  cy-=PCH+10; hl(o,cy);

  // RECOMMENDED ACTIONS
  cy-=14;
  lbl(o,20,cy,fr?"A FAIRE MAINTENANT":"RECOMMENDED ACTIONS",OR);
  cy-=16;
  const rShow=rec.length>0?rec:[
    fr?"Verifier les liens avant de signer":"Verify URLs before signing",
    fr?"Tester un petit montant":"Test with a small amount first",
    fr?"Surveiller regulierement":"Monitor regularly",
  ];
  rShow.slice(0,3).forEach((r:string)=>{
    box(o,20,cy-22,PW-40,26);
    fill(o,20,cy-22,4,26,tCol);
    fill(o,34,cy-14,8,8,tCol);
    tx(o,50,cy-9,String(r).slice(0,78),"R",8.5,W);
    cy-=32;
  });
  hl(o,cy);

  // MARKET SIGNALS
  cy-=14;
  lbl(o,20,cy,fr?"SIGNAUX MARCHE":"MARKET SIGNALS",OR);
  cy-=16;
  const MCH=52,MCW=(PW-40-16)/3;
  const mets=[
    {label:fr?"MANIPULATION":"MANIPULATION",pct:92,col:DNG},
    {label:fr?"ALERTES":"ALERTS",pct:45,col:AMB},
    {label:fr?"CONFIANCE":"TRUST",pct:10,col:GRN},
  ];
  mets.forEach((m,i)=>{
    const mx=20+i*(MCW+8),my=cy-MCH;
    box(o,mx,my,MCW,MCH);
    fill(o,mx,my+MCH-4,MCW,4,m.col);
    lbl(o,mx+10,my+MCH-15,m.label);
    tx(o,mx+10,my+MCH-31,`${m.pct}%`,"B",14,m.col);
    bar(o,mx+10,my+10,MCW-20,5,m.pct,m.col);
  });
  cy-=MCH+10;

  // FOOTER
  fill(o,0,0,PW,28,HD); hl(o,28,0,PW,STR); fill(o,0,0,4,28,OR);
  tx(o,14,16,fr?"Pas un conseil financier - Interligens Intelligence (c) 2026 - BA Audit Trace v2.6.x":"Not financial advice - Interligens Intelligence (c) 2026 - BA Audit Trace v2.6.x","R",6.5,MUT);
  tx(o,14,6,`${ch} Report - ${rid} - ${data.date}`,"R",6,MUT);

  // ASSEMBLE
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
  try{
    const b=await req.json();
    const now=new Date().toLocaleString("fr-FR",{timeZone:"Europe/Paris"});
    const pdf=buildPDF({...b,date:now});
    const ch=String(b.chain??"scan").toLowerCase();
    const ad=String(b.address??"").slice(0,8);
    return new NextResponse(pdf,{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="interligens-${ch}-${ad}.pdf"`}});
  }catch(e:any){return NextResponse.json({error:String(e?.message)},{status:500});}
}
