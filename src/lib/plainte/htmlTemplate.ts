// src/lib/plainte/htmlTemplate.ts
//
// Legal-dossier HTML template. White-background judicial document format.
// Generates a full multi-section PDF from PlainteInput.

import type { PlainteInput, Jurisdiction } from "./data";

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtMoney(n: number | undefined, currency = "€"): string {
  if (!n && n !== 0) return "—";
  return `${n.toLocaleString("fr-FR")} ${currency}`;
}

const GLOSSARY = [
  ["Blockchain", "Registre numérique public, permanent et infalsifiable. Chaque transaction y est enregistrée de façon définitive et consultable par n'importe qui dans le monde. Équivalent numérique d'un registre notarié consultable publiquement."],
  ["Portefeuille numérique (Wallet)", "Équivalent d'un compte bancaire sur la blockchain. Identifié par une adresse unique (suite de lettres et chiffres). Son propriétaire est la seule personne pouvant autoriser des transferts depuis ce compte, grâce à une clé privée secrète."],
  ["Adresse de portefeuille", "Identifiant public d'un portefeuille. Exemple : 2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ. Visible par tous, comparable à un IBAN."],
  ["Transaction", "Toute opération enregistrée sur la blockchain (achat, vente, transfert). Chaque transaction possède une signature unique et immuable qui prouve son existence, sa date, ses parties et son montant."],
  ["Signature de transaction", "Identifiant unique et infalsifiable d'une transaction. Permet à n'importe qui de vérifier les détails de l'opération sur un explorateur blockchain public."],
  ["Token / Jeton numérique", "Actif numérique créé et échangé sur une blockchain. Comparable à une action ou une monnaie virtuelle."],
  ["Mint", "Adresse unique identifiant un type de token sur la blockchain Solana. Équivalent du code ISIN d'une valeur mobilière."],
  ["CEX (Exchange centralisé)", "Plateforme d'échange de cryptomonnaies soumise à des obligations légales d'identification (KYC). Exemples : Coinbase, Binance, OKX. Ces plateformes collectent et conservent des pièces d'identité vérifiées."],
  ["KYC (Know Your Customer)", "Procédure d'identification obligatoire imposée aux exchanges centralisés par la réglementation anti-blanchiment. Un utilisateur KYC a fourni un passeport ou une carte d'identité vérifiée."],
  ["DEX (Exchange décentralisé)", "Plateforme d'échange sans intermédiaire centralisé, sans KYC. Les transactions y sont automatiques et traçables on-chain mais anonymes."],
  ["Seed phrase", "Suite de 12 à 24 mots permettant de prendre le contrôle total d'un portefeuille. Sa divulgation donne à un tiers un accès irréversible à tous les fonds."],
  ["Drain", "Technique de vol automatisé vidant instantanément un portefeuille de la totalité de son contenu sans le consentement du propriétaire."],
  ["Réseau Sybil", "Ensemble de portefeuilles en apparence indépendants mais contrôlés par une seule et même entité. Utilisé pour dissimuler une coordination illicite."],
  ["Insider Trading on-chain", "Achat de tokens avant une annonce publique grâce à des informations non publiques. Détectable par l'horodatage immuable des transactions blockchain."],
  ["Layering (stratification)", "Technique de blanchiment consistant à faire transiter des fonds illicites à travers une série de portefeuilles intermédiaires pour en brouiller la traçabilité."],
  ["Solscan / Etherscan", "Explorateurs blockchain publics permettant à quiconque de vérifier n'importe quelle transaction en tapant sa signature."],
  ["Arkham Intelligence", "Plateforme professionnelle d'analyse blockchain permettant de visualiser et d'identifier les flux de fonds entre portefeuilles."],
  ["RPC (Remote Procedure Call)", "Méthode technique permettant d'interroger directement la blockchain pour extraire des données vérifiables."],
];

function jurisdictionLabel(j: Jurisdiction): string {
  if (j === "FR") return "Brigade d'Enquête sur les Fraudes aux Technologies de l'Information (BEFTI) — Direction Régionale de la Police Judiciaire de Paris";
  if (j === "US") return "U.S. Securities and Exchange Commission, Division of Enforcement / Federal Bureau of Investigation, Cyber Division";
  return "Eurojust / Autorité nationale compétente";
}

function docTypeLabel(j: Jurisdiction): string {
  if (j === "FR") return "PLAINTE PÉNALE";
  if (j === "US") return "COMPLAINT";
  return "SIGNALEMENT";
}

function niveauLabel(n: string): string {
  if (n === "on_chain") return "ÉTABLI ON-CHAIN";
  if (n === "documentaire") return "DOCUMENTAIRE";
  return "MIXTE";
}

function infractionLabel(t: string): string {
  const map: Record<string, string> = {
    insider_trading: "Insider Trading",
    pump_dump: "Pump & Dump",
    manipulation_marche: "Manipulation de marché",
    drain_phishing: "Drain / Phishing",
    blanchiment: "Blanchiment",
  };
  return map[t] || t;
}

export function buildPlainteHtml(input: PlainteInput): string {
  const now = new Date().toISOString().slice(0, 10);
  const ref = `INTERLIGENS-${(input.nom || "CASE").replace(/[^A-Z0-9]/gi, "").slice(0, 20)}-${now.replace(/-/g, "")}`;

  let html = `<!DOCTYPE html><html lang="${input.juridiction === "US" ? "en" : "fr"}"><head><meta charset="UTF-8"><style>
@page{size:A4;margin:18mm 16mm 24mm 16mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',Georgia,serif;color:#111;font-size:11px;line-height:1.55;background:#fff}
.header-band{background:#000;color:#fff;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:0}
.header-band .logo{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.header-band .logo .box{width:22px;height:22px;background:#FF6B00;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#000;border-radius:3px}
.header-band .conf{color:#ff4444;font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700}
.page-content{padding:0 4px}
h1{font-size:18px;text-align:center;margin:20px 0 6px;font-weight:800;letter-spacing:1px}
h2{font-size:13px;background:#1a1a1a;color:#fff;padding:7px 12px;margin:18px 0 10px;text-transform:uppercase;letter-spacing:2px;font-weight:700;page-break-after:avoid}
h3{font-size:11.5px;font-weight:700;margin:12px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
p{margin:0 0 8px;text-align:justify}
table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0}
th{background:#e8e8e8;padding:5px 8px;text-align:left;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #ccc}
td{padding:5px 8px;border:1px solid #ddd;vertical-align:top}
tr:nth-child(even) td{background:#f8f8f8}
.mono{font-family:'Courier New',Consolas,monospace;font-size:9.5px;background:#f0f0f0;padding:1px 4px;word-break:break-all}
.mono-block{font-family:'Courier New',Consolas,monospace;font-size:9px;background:#f4f4f4;padding:6px 10px;border:1px solid #ddd;margin:6px 0;word-break:break-all;line-height:1.5}
.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:8px;font-weight:700;color:#fff}
.badge-critique{background:#c41e1e}
.badge-haute{background:#FF6B00}
.badge-moyenne{background:#888}
.callout{border:1px solid #999;padding:10px;margin:8px 0;font-size:10px;background:#fafafa;border-left:4px solid #FF6B00}
.cover-center{text-align:center;margin:30px 0}
.cover-table td{border:none;padding:4px 10px;font-size:11px}
.cover-table td:first-child{font-weight:700;text-align:right;width:160px;color:#444}
.footer{position:fixed;bottom:0;left:0;right:0;padding:4px 20px;font-size:8px;color:#888;text-align:center;border-top:1px solid #ddd}
.page-break{page-break-before:always}
.glossary-term{font-weight:700;color:#1a1a1a}
.glossary-def{color:#333}
.req-model{background:#f0f0f0;border:1px solid #ccc;padding:8px;font-size:9px;font-family:'Courier New',monospace;margin:6px 0;white-space:pre-wrap}
.contacts-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0}
.contact-box{border:1px solid #ddd;padding:8px;font-size:9px}
.contact-box .title{font-weight:700;font-size:10px;margin-bottom:4px}
</style></head><body>`;

  // HEADER BAND
  html += `<div class="header-band"><div class="logo"><div class="box">I</div> INTERLIGENS</div><div class="conf">DOCUMENT JUDICIAIRE CONFIDENTIEL</div></div>`;

  // PAGE DE GARDE
  html += `<div class="page-content"><div class="cover-center">
  <h1>DOSSIER DE ${docTypeLabel(input.juridiction)}</h1>
  <div style="font-size:14px;color:#444;margin:8px 0">Affaire : ${esc(input.nom)}</div>
  <div style="font-size:10px;color:#666;margin:4px 0">À l'attention de : ${jurisdictionLabel(input.juridiction)}</div>
  <div style="font-size:9px;color:#888;margin:12px 0">Référence : ${ref} · Date : ${now} · Version 1.0</div>
  </div>
  <table class="cover-table"><tbody>
  <tr><td>Plaignant</td><td>${esc(input.plaignantNom)}</td></tr>
  <tr><td>Qualité</td><td>${esc(input.plaignantQualite)}</td></tr>
  ${input.plaignantEmail ? `<tr><td>Contact</td><td>${esc(input.plaignantEmail)}</td></tr>` : ""}
  <tr><td>Nature des faits</td><td>${input.typeInfraction.map(t => infractionLabel(t)).join(" · ")}</td></tr>
  <tr><td>Préjudice estimé</td><td>${fmtMoney(input.prejudiceEUR)} / ${fmtMoney(input.prejudiceUSD, "$")}</td></tr>
  <tr><td>Niveau de preuve</td><td>${niveauLabel(input.niveauPreuve)}</td></tr>
  </tbody></table>
  <div class="callout" style="margin-top:20px;font-size:9px;font-style:italic">Ce dossier a été constitué avec l'assistance de la plateforme d'intelligence anti-fraude INTERLIGENS (app.interligens.com). Toutes les données on-chain citées sont publiquement vérifiables sur la blockchain. Ce document ne constitue pas un avis juridique.</div>`;

  // SECTION 0 — GLOSSAIRE
  html += `<div class="page-break"></div><h2>Section 0 — Lexique technique — À lire en premier</h2>
  <p style="font-size:10px;color:#666;margin-bottom:10px;font-style:italic">Ce glossaire permet à tout lecteur, sans connaissance technique préalable, de comprendre les preuves présentées dans ce dossier.</p>`;
  for (const [term, def] of GLOSSARY) {
    html += `<p><span class="glossary-term">${esc(term)}</span> — <span class="glossary-def">${esc(def)}</span></p>`;
  }

  // SECTION 1 — RÉSUMÉ EXÉCUTIF
  html += `<div class="page-break"></div><h2>Section 1 — Résumé exécutif des faits</h2>
  <p>Le présent dossier expose les faits constitutifs de <strong>${input.typeInfraction.map(t => infractionLabel(t)).join(", ")}</strong> survenus entre le ${esc(input.datesFaits)} sur la blockchain ${esc(input.blockchain)}, impliquant le token <strong>${esc(input.token || input.nom)}</strong>${input.mint ? ` (mint : <span class="mono">${esc(input.mint)}</span>)` : ""}.</p>
  <p>Le plaignant, ${esc(input.plaignantNom)} (${esc(input.plaignantQualite)}), a subi un préjudice estimé à <strong>${fmtMoney(input.prejudiceEUR)}</strong> (${fmtMoney(input.prejudiceUSD, "$")})${input.walletVictime ? ` depuis le portefeuille <span class="mono">${esc(input.walletVictime)}</span>` : ""}.</p>
  <p>${input.suspects.length} suspect(s) identifié(s). ${input.preuvesCles.length} preuve(s) clé(s) documentée(s). ${input.requisitions.length} réquisition(s) judiciaire(s) recommandée(s).</p>`;
  if (input.ampleur) {
    html += `<p><strong>Ampleur du schéma</strong> : ${input.ampleur.victimesIdentifiees ?? "—"} victimes identifiées, ${input.ampleur.walletIntermediaires ?? "—"} wallets intermédiaires, ${input.ampleur.transactionsTotales ?? "—"} transactions, extrapolation ${esc(input.ampleur.extrapolationTotale)}.</p>`;
  }

  // SECTION 2 — PARTIES
  html += `<div class="page-break"></div><h2>Section 2 — Identification des parties</h2>`;
  html += `<h3>Partie A — Le plaignant / victime</h3><table><tbody>
  <tr><td style="font-weight:700;width:160px">Nom</td><td>${esc(input.plaignantNom)}</td></tr>
  <tr><td style="font-weight:700">Qualité</td><td>${esc(input.plaignantQualite)}</td></tr>`;
  if (input.walletVictime) html += `<tr><td style="font-weight:700">Wallet victime</td><td><span class="mono">${esc(input.walletVictime)}</span></td></tr>`;
  if (input.walletsVictime) input.walletsVictime.forEach(w => { html += `<tr><td style="font-weight:700">Wallet</td><td><span class="mono">${esc(w)}</span></td></tr>`; });
  html += `<tr><td style="font-weight:700">Préjudice</td><td>${fmtMoney(input.prejudiceEUR)} / ${fmtMoney(input.prejudiceUSD, "$")}</td></tr>
  <tr><td style="font-weight:700">Dates</td><td>${esc(input.datesFaits)}</td></tr>
  </tbody></table>`;

  html += `<h3>Partie B — Suspects / mis en cause (${input.suspects.length})</h3>
  <table><thead><tr><th>Identité</th><th>Rôle</th><th>Wallet(s)</th><th>Certitude</th><th>Preuve</th></tr></thead><tbody>`;
  for (const s of input.suspects) {
    const ws = s.wallet ? `<span class="mono">${esc(s.wallet)}</span>` : s.wallets ? s.wallets.map(w => `<span class="mono">${esc(w)}</span>`).join("<br>") : "—";
    const certBadge = s.certitude === "ETABLI" ? "badge-critique" : s.certitude === "PROBABLE" ? "badge-haute" : "badge-moyenne";
    html += `<tr><td style="font-weight:600">${esc(s.handle)}</td><td style="font-size:9px">${esc(s.role || "")}</td><td>${ws}</td><td><span class="badge ${certBadge}">${s.certitude}</span></td><td style="font-size:9px">${esc(s.preuve || "")}</td></tr>`;
  }
  html += `</tbody></table>`;

  // SECTION 3 — CHRONOLOGIE
  if (input.chronologie?.length) {
    html += `<div class="page-break"></div><h2>Section 3 — Chronologie détaillée</h2>
    <table><thead><tr><th>Date</th><th>Heure UTC</th><th>Événement</th><th>Acteurs</th><th>Preuve</th><th>Force</th></tr></thead><tbody>`;
    for (const c of input.chronologie) {
      const forceBadge = c.force === "CRITIQUE" ? "badge-critique" : c.force === "HAUTE" ? "badge-haute" : "badge-moyenne";
      html += `<tr><td>${esc(c.date)}</td><td>${esc(c.heure || "—")}</td><td>${esc(c.evenement)}</td><td style="font-size:9px">${esc(c.acteurs || "")}</td><td style="font-size:9px">${esc(c.preuve || "")}</td><td>${c.force ? `<span class="badge ${forceBadge}">${c.force}</span>` : "—"}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  // SECTION 4 — PREUVES
  html += `<div class="page-break"></div><h2>Section 4 — Preuves techniques on-chain (${input.preuvesCles.length})</h2>`;
  for (const p of input.preuvesCles) {
    const forceBadge = p.force === "CRITIQUE" ? "badge-critique" : p.force === "HAUTE" ? "badge-haute" : "badge-moyenne";
    html += `<div style="border:1px solid #ddd;padding:10px;margin:8px 0;border-left:4px solid ${p.force === "CRITIQUE" ? "#c41e1e" : p.force === "HAUTE" ? "#FF6B00" : "#888"}">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong>${esc(p.id)} — ${esc(p.nature)}</strong><span class="badge ${forceBadge}">${p.force}</span></div>
    <p style="font-size:10px">${esc(p.description)}</p>`;
    if (p.adresse) html += `<div class="mono-block">Adresse : ${esc(p.adresse)}</div>`;
    if (p.ata) html += `<div class="mono-block">ATA : ${esc(p.ata)}</div>`;
    if (p.wallet) html += `<div class="mono-block">Wallet : ${esc(p.wallet)}</div>`;
    if (p.wallets) html += `<div class="mono-block">${p.wallets.map(w => esc(w)).join("\n")}</div>`;
    if (p.verification) html += `<div style="font-size:9px;color:#666;margin-top:4px">Vérification : ${esc(p.verification)}</div>`;
    if (p.note) html += `<div style="font-size:9px;color:#888;font-style:italic;margin-top:4px">${esc(p.note)}</div>`;
    html += `</div>`;
  }

  // SECTION 5 — QUALIFICATIONS
  html += `<div class="page-break"></div><h2>Section 5 — Qualifications pénales applicables</h2>`;
  if (input.qualificationsFR?.length) {
    html += `<h3>Droit français</h3><ul style="margin:6px 0 12px 20px">`;
    for (const q of input.qualificationsFR) html += `<li style="margin:4px 0;font-size:10.5px">${esc(q)}</li>`;
    html += `</ul>`;
  }
  if (input.qualificationsUS?.length) {
    html += `<h3>Droit américain</h3><ul style="margin:6px 0 12px 20px">`;
    for (const q of input.qualificationsUS) html += `<li style="margin:4px 0;font-size:10.5px">${esc(q)}</li>`;
    html += `</ul>`;
  }

  // SECTION 6 — RÉQUISITIONS
  html += `<div class="page-break"></div><h2>Section 6 — Réquisitions judiciaires recommandées (${input.requisitions.length})</h2>
  <table><thead><tr><th>Priorité</th><th>Cible</th><th>Demande</th><th>Fondement</th><th>Contact</th><th>Délai</th></tr></thead><tbody>`;
  for (const r of input.requisitions) {
    html += `<tr><td style="font-weight:700;color:${r.priorite === "P1" ? "#c41e1e" : r.priorite === "P2" ? "#FF6B00" : "#888"}">${esc(r.priorite)}</td><td style="font-weight:600">${esc(r.cible)}</td><td style="font-size:9px">${esc(r.demande)}</td><td style="font-size:9px">${esc(r.fondement || "")}</td><td style="font-size:9px">${esc(r.contact || "")}</td><td style="font-size:9px">${esc(r.delai || "")}</td></tr>`;
  }
  html += `</tbody></table>`;

  // SECTION 7 — PRÉJUDICE
  html += `<h2>Section 7 — Préjudice et demandes</h2>
  <h3>Préjudice matériel direct</h3>
  <table class="cover-table"><tbody>
  <tr><td>Préjudice EUR</td><td><strong>${fmtMoney(input.prejudiceEUR)}</strong></td></tr>
  <tr><td>Préjudice USD</td><td><strong>${fmtMoney(input.prejudiceUSD, "$")}</strong></td></tr>
  </tbody></table>
  ${input.prejudiceMoral ? `<h3>Préjudice moral</h3><p>${esc(input.prejudiceMoral)}</p>` : ""}
  <h3>Demandes au titre de la procédure</h3>
  <ul style="margin:6px 0 12px 20px;font-size:10.5px">
  <li>Ouverture d'une enquête judiciaire pour les faits exposés</li>
  <li>Gel des avoirs identifiés sur les wallets et comptes exchange listés</li>
  <li>Exécution des réquisitions judiciaires détaillées en Section 6</li>
  <li>Désignation d'un expert judiciaire en analyse blockchain si nécessaire</li>
  </ul>`;

  // SECTION 8 — PIÈCES
  if (input.piecesJointes?.length) {
    html += `<h2>Section 8 — Inventaire des pièces jointes</h2>
    <table><thead><tr><th>Réf.</th><th>Nature</th><th>Date</th><th>Source</th><th>Prouve</th><th>Format</th></tr></thead><tbody>`;
    for (const p of input.piecesJointes) {
      html += `<tr><td>${esc(p.ref)}</td><td>${esc(p.nature)}</td><td>${esc(p.date || "")}</td><td>${esc(p.source || "")}</td><td style="font-size:9px">${esc(p.prouve || "")}</td><td>${esc(p.format || "")}</td></tr>`;
    }
    html += `</tbody></table>`;
  } else {
    html += `<h2>Section 8 — Inventaire des pièces</h2><p style="color:#666;font-style:italic">Les preuves techniques (Section 4) font office de pièces jointes. Le détail des preuves additionnelles pourra être communiqué sur demande du magistrat instructeur.</p>`;
  }

  // SECTION 9 — DÉCLARATION
  html += `<div class="page-break"></div><h2>Section 9 — Déclaration de véracité</h2>
  <p>Je soussigné(e) <strong>${esc(input.plaignantNom)}</strong>, déclare que les informations contenues dans ce dossier sont exactes et sincères à ma connaissance. Je certifie que les données on-chain présentées ont été extraites directement depuis la blockchain publique ${esc(input.blockchain)} via les méthodes RPC standards et sont publiquement vérifiables.</p>
  <p style="margin-top:20px">Fait à __________________, le ${now}</p>
  <p style="margin-top:30px">Signature : ___________________</p>`;

  // SECTION 10 — CONTACTS
  html += `<h2>Section 10 — Contacts et ressources</h2>`;
  if (input.juridiction === "FR" || input.juridiction === "EU") {
    html += `<h3>France</h3><table class="cover-table"><tbody>
    <tr><td>BEFTI</td><td>01 55 75 75 02 — befti@interieur.gouv.fr</td></tr>
    <tr><td>Pré-plainte en ligne</td><td>pre-plainte-en-ligne.gouv.fr</td></tr>
    <tr><td>Info Escroqueries</td><td>0 805 805 817</td></tr>
    <tr><td>AMF</td><td>amf-france.org/fr/contacts</td></tr>
    <tr><td>Cybermalveillance</td><td>cybermalveillance.gouv.fr</td></tr>
    </tbody></table>`;
  }
  if (input.juridiction === "US" || input.juridiction === "EU") {
    html += `<h3>États-Unis</h3><table class="cover-table"><tbody>
    <tr><td>SEC Enforcement</td><td>sec.gov/tcr</td></tr>
    <tr><td>FBI IC3</td><td>ic3.gov</td></tr>
    <tr><td>CFTC</td><td>cftc.gov/complaint</td></tr>
    <tr><td>FinCEN</td><td>fincen.gov</td></tr>
    </tbody></table>`;
  }
  if (input.juridiction === "EU") {
    html += `<h3>Union Européenne</h3><table class="cover-table"><tbody>
    <tr><td>Eurojust</td><td>eurojust.europa.eu</td></tr>
    <tr><td>ESMA</td><td>esma.europa.eu</td></tr>
    <tr><td>Europol</td><td>europol.europa.eu/report-a-crime</td></tr>
    </tbody></table>`;
  }

  html += `</div></body></html>`;
  return html;
}
