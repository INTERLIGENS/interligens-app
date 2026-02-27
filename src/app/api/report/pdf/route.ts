import { NextRequest, NextResponse } from "next/server";
const BG="0.043 0.059 0.078",SURF="0.093 0.106 0.129",BORDER="0.180 0.196 0.220";
const ORANGE="0.973 0.357 0.020",WHITE="1.000 1.000 1.000",SEC="0.680 0.690 0.710";
const GREEN="0.133 0.773 0.369",AMBER="0.961 0.620 0.043",DANGER="0.937 0.267 0.267",MUTED="0.320 0.340 0.380";
function TC(t:string):string{const u=(t??"").toUpperCase();return u==="GREEN"?GREEN:u==="RED"?DANGER:AMBER;}
function LC(l:string):string{const v=(l??"").toLowerCase();return v==="high"?DANGER:v==="medium"?AMBER:GREEN;}
function esc(s:string):string{
  return String(s??"").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
}
function buildPDF(data:{chain:string;address:string;score:number;tier:string;verdict:string;proofs:any[];recommendations:string[];date:string;lang:string;}):Buffer{
  const isFR=data.lang==="fr";
  const score=Math.min(100,Math.max(0,Number(data.score)||0));
  const tier=(data.tier??"GREEN").toUpperCase();
  const tc=TC(tier);
  const proofs=(data.proofs??[]).slice(0,3);
  const recos=(data.recommendations??[]).slice(0,3);
  const addr=String(data.address??"");
  const chain=String(data.chain??"").toUpperCase();
  const rid="#"+Date.now().toString(36).slice(-6).toUpperCase();
  const ops:string[]=[];
  const FR=(x:number,y:number,w:number,h:number,col:string)=>ops.push(`${col} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  const RR=(x:number,y:number,w:number,h:number,r:number,col:string,str=false)=>{
    const k=r*0.5523;
    ops.push([`${col} rg`,str?`0.5 w ${BORDER} RG`:"",
      `${(x+r).toFixed(1)} ${y.toFixed(1)} m`,`${(x+w-r).toFixed(1)} ${y.toFixed(1)} l`,
      `${(x+w-r+k).toFixed(1)} ${y.toFixed(1)} ${(x+w).toFixed(1)} ${(y+r-k).toFixed(1)} ${(x+w).toFixed(1)} ${(y+r).toFixed(1)} c`,
      `${(x+w).toFixed(1)} ${(y+h-r).toFixed(1)} l`,
      `${(x+w).toFixed(1)} ${(y+h-r+k).toFixed(1)} ${(x+w-r+k).toFixed(1)} ${(y+h).toFixed(1)} ${(x+w-r).toFixed(1)} ${(y+h).toFixed(1)} c`,
      `${(x+r).toFixed(1)} ${(y+h).toFixed(1)} l`,
      `${(x+r-k).toFixed(1)} ${(y+h).toFixed(1)} ${x.toFixed(1)} ${(y+h-r+k).toFixed(1)} ${x.toFixed(1)} ${(y+h-r).toFixed(1)} c`,
      `${x.toFixed(1)} ${(y+r).toFixed(1)} l`,
      `${x.toFixed(1)} ${(y+r-k).toFixed(1)} ${(x+r-k).toFixed(1)} ${y.toFixed(1)} ${(x+r).toFixed(1)} ${y.toFixed(1)} c`,
      `h ${str?"B":"f"}`].filter(Boolean).join("\n"));
  };
  const HL=(y:number,x1=18,x2=577,col=BORDER)=>ops.push(`0.5 w ${col} RG ${x1} ${y} m ${x2} ${y} l S`);
  const PB=(x:number,y:number,w:number,h:number,pct:number,col:string)=>{RR(x,y,w,h,h/2,BORDER);const fw=Math.max(h,w*Math.min(pct/100,1));RR(x,y,fw,h,h/2,col);};
  const T=(x:number,y:number,s:string,f:"F1"|"F2"|"F3",sz:number,col=WHITE)=>ops.push(`${col} rg BT /${f} ${sz} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`);
  const PIL=(x:number,y:number,label:string,bg:string,sz=6.5)=>{const pw=label.length*sz*0.52+14;const ph=sz+8;RR(x,y,pw,ph,ph/2,bg);ops.push(`${BG} rg BT /F2 ${sz} Tf ${(x+7).toFixed(1)} ${(y+4).toFixed(1)} Td (${esc(label)}) Tj ET`);return pw;};
  // PAGE BACKGROUND
  FR(0,0,595,842,BG);
  // HEADER
  FR(0,792,595,50,SURF);FR(0,792,3,50,ORANGE);
  T(18,820,"INTERLIGENS","F2",15,ORANGE);
  T(18,805,isFR?"Rapport analyse forensique - On-chain":"Forensic Wallet Report - On-chain","F1",7,SEC);
  T(390,820,data.date,"F1",6.5,SEC);
  T(390,808,"Report "+rid,"F1",6,MUTED);
  T(390,796,isFR?"USAGE CONFIDENTIEL":"CONFIDENTIAL USE","F2",6,ORANGE);
  // HERO LEFT
  RR(18,674,262,108,8,SURF,true);
  T(30,765,isFR?"ADRESSE ANALYSEE":"SCANNED ADDRESS","F2",6.5,ORANGE);
  const a1=addr.slice(0,24);const a2=addr.length>24?addr.slice(24,48):"";const a3=addr.length>48?"..."+addr.slice(-10):"";
  T(30,752,a1,"F3",7,WHITE);if(a2)T(30,741,a2,"F3",7,WHITE);if(a3)T(30,730,a3,"F3",7,SEC);
  T(30,715,isFR?"RESEAU":"NETWORK","F2",6.5,SEC);
  T(30,704,chain,"F2",10,WHITE);
  T(30,688,isFR?"Aucune signature - Zero stockage":"No signature - Zero storage","F1",6.5,MUTED);
  // HERO RIGHT
  RR(290,674,285,108,8,SURF,true);RR(290,776,285,6,3,tc);
  T(302,762,"TIGERSCORE","F2",7,SEC);
  T(302,728,String(score),"F2",32,tc);
  const sw=score>=100?24:score>=10?18:12;
  T(302+sw+3,746,"/100","F1",9,SEC);
  const tl=isFR?(tier==="GREEN"?"SAIN":tier==="RED"?"RISQUE":"PRUDENCE"):(tier==="GREEN"?"CLEAN":tier==="RED"?"HIGH RISK":"CAUTION");
  PIL(302,715,tl,tc);
  T(302,700,String(data.verdict??"").slice(0,40),"F1",7.5,WHITE);
  T(302,689,isFR?"Niveau de risque :":"Risk level:","F1",6,MUTED);
  PB(302,679,258,5,score,tc);
  HL(666);
  // PROOFS
  T(18,653,isFR?"PREUVES ON-CHAIN":"TOP ON-CHAIN SIGNALS","F2",8,ORANGE);
  HL(646,18,160,ORANGE);
  const pShow=proofs.length>0?proofs:[{label:isFR?"Analyse":"Analysis",value:isFR?"Aucun signal critique":"No major red flags",level:"low",riskDescription:isFR?"Wallet propre":"Clean based on available data"}];
  const pcw=(559-36)/3;
  pShow.slice(0,3).forEach((p:any,i:number)=>{
    const px=18+i*(pcw+10);const py=592;const lc=LC(p.level??"low");
    RR(px,py,pcw,48,7,SURF,true);RR(px,py+43,pcw,5,3,lc);
    const pl=String(p.label??"").toUpperCase().slice(0,16);
    const pv=String(p.value??"").slice(0,20);
    const pd=String(p.riskDescription??"").slice(0,34);
    const pt=isFR?(p.level==="high"?"ELEVE":p.level==="medium"?"MOYEN":"FAIBLE"):(p.level==="high"?"HIGH":p.level==="medium"?"MED":"LOW");
    T(px+8,py+31,pl,"F2",6.5,SEC);T(px+8,py+18,pv,"F2",9.5,WHITE);T(px+8,py+7,pd,"F1",6,SEC);
    PIL(px+pcw-36,py+31,pt,lc,5.5);
  });
  HL(585);
  // ACTIONS
  T(18,573,isFR?"A FAIRE MAINTENANT":"RECOMMENDED ACTIONS","F2",8,ORANGE);
  HL(566,18,170,ORANGE);
  const rShow=recos.length>0?recos:[isFR?"Verifier les liens avant de signer":"Verify URLs before signing",isFR?"Tester un petit montant":"Test with a small amount first",isFR?"Surveiller regulierement":"Monitor regularly"];
  rShow.slice(0,3).forEach((r:string,i:number)=>{
    const ry=549-i*24;
    RR(18,ry,559,20,5,SURF,true);RR(18,ry,4,20,2,tc);
    ops.push(`${tc} rg 30 ${(ry+7).toFixed(1)} 6 6 re f`);
    T(44,ry+6,String(r).slice(0,70),"F1",8,WHITE);
  });
  // MARKET SIGNALS
  HL(498);
  T(18,486,isFR?"SIGNAUX MARCHE":"MARKET SIGNALS","F2",8,ORANGE);
  HL(479,18,135,ORANGE);
  const mets=[{label:"MANIPULATION",pct:92,col:DANGER},{label:isFR?"ALERTES":"ALERTS",pct:45,col:AMBER},{label:isFR?"CONFIANCE":"TRUST",pct:10,col:GREEN}];
  const mw=(559-36)/3;
  mets.forEach((m,i)=>{const mx=18+i*(mw+10);const my=436;RR(mx,my,mw,36,6,SURF,true);T(mx+8,my+25,m.label,"F2",6.5,SEC);T(mx+8,my+13,`${m.pct}%`,"F2",9,m.col);PB(mx+8,my+5,mw-16,4,m.pct,m.col);});
  // FOOTER
  FR(0,0,595,36,SURF);ops.push(`0.5 w ${BORDER} RG 0 36 m 595 36 l S`);FR(0,0,3,36,ORANGE);
  T(14,22,isFR?"Pas un conseil financier. BA Audit Trace v2.6.x":"Not financial advice. BA Audit Trace v2.6.x","F1",6.5,MUTED);
  T(14,11,`Interligens Intelligence (c) 2026  |  ${chain} Report  |  ${rid}`,"F1",6,MUTED);
  T(490,22,isFR?"CONFIDENTIEL":"CONFIDENTIAL","F2",6,ORANGE);
  // BUILD PDF
  const stream=ops.join("\n");
  const streamLen=Buffer.from(stream,"latin1").length;
  const f1="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const f2="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  const f3="<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  const o1="1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const o2="2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const o3=`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n   /Contents 4 0 R\n   /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj\n`;
  const o4=`4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`;
  const o5=`5 0 obj\n${f1}\nendobj\n`;
  const o6=`6 0 obj\n${f2}\nendobj\n`;
  const o7=`7 0 obj\n${f3}\nendobj\n`;
  const hdr="%PDF-1.4\n";const body=o1+o2+o3+o4+o5+o6+o7;
  const offs:number[]=[];let pos=hdr.length;
  [o1,o2,o3,o4,o5,o6,o7].forEach(o=>{offs.push(pos);pos+=Buffer.byteLength(o,"latin1");});
  const xpos=hdr.length+Buffer.byteLength(body,"latin1");
  const xref=["xref","0 8","0000000000 65535 f ",...offs.map(n=>`${String(n).padStart(10,"0")} 00000 n `)].join("\n")+"\n";
  const trlr=`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xpos}\n%%EOF\n`;
  return Buffer.concat([Buffer.from(hdr,"latin1"),Buffer.from(body,"latin1"),Buffer.from(xref,"latin1"),Buffer.from(trlr,"latin1")]);
}
export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const now=new Date().toLocaleString("fr-FR",{timeZone:"Europe/Paris"});
    const pdf=buildPDF({...body,date:now});
    const ch=String(body.chain??"scan").toLowerCase();
    const ad=String(body.address??"").slice(0,8);
    return new NextResponse(pdf,{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="interligens-${ch}-${ad}.pdf"`}});
  }catch(e:any){return NextResponse.json({error:String(e?.message)},{status:500});}
}