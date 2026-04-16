// src/lib/plainte/htmlTemplate.ts
//
// Legal-dossier HTML template. White-background judicial document format.
// All 10 GPT review corrections applied.

import type { PlainteInput, Jurisdiction, PreuveStatut, PlainteTheme } from "./data";

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtMoney(n: number | undefined, currency = "€"): string {
  if (!n && n !== 0) return "—";
  return `${n.toLocaleString("fr-FR")} ${currency}`;
}

// ── Glossary ─────────────────────────────────────────────────────────────────

const GLOSSARY: [string, string][] = [
  ["Blockchain", "Registre numérique public, permanent et infalsifiable. Chaque transaction y est enregistrée de façon définitive et consultable par n'importe qui dans le monde. Équivalent numérique d'un registre notarié consultable publiquement."],
  ["Portefeuille numérique (Wallet)", "Équivalent d'un compte bancaire sur la blockchain. Identifié par une adresse unique (suite de lettres et chiffres). Son propriétaire est la seule personne pouvant autoriser des transferts depuis ce compte, grâce à une clé privée secrète."],
  ["Adresse de portefeuille", "Identifiant public d'un portefeuille. Exemple : 2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ. Visible par tous, comparable à un IBAN."],
  ["Transaction", "Toute opération enregistrée sur la blockchain (achat, vente, transfert). Chaque transaction possède une signature unique et immuable qui prouve son existence, sa date, ses parties et son montant."],
  ["Signature de transaction", "Identifiant unique et infalsifiable d'une transaction. Permet à n'importe qui de vérifier les détails de l'opération sur un explorateur blockchain public."],
  ["Token / Jeton numérique", "Actif numérique créé et échangé sur une blockchain. Comparable à une action ou une monnaie virtuelle."],
  ["Mint", "Adresse unique identifiant un type de token sur la blockchain Solana. Équivalent du code ISIN d'une valeur mobilière."],
  ["CEX (Exchange centralisé)", "Plateforme d'échange de cryptomonnaies soumise à des obligations légales d'identification (KYC). Exemples : Coinbase, Binance, OKX."],
  ["KYC (Know Your Customer)", "Procédure d'identification obligatoire imposée aux exchanges centralisés par la réglementation anti-blanchiment."],
  ["DEX (Exchange décentralisé)", "Plateforme d'échange sans intermédiaire centralisé, sans KYC. Les transactions y sont automatiques et traçables on-chain mais anonymes."],
  ["Seed phrase", "Suite de 12 à 24 mots permettant de prendre le contrôle total d'un portefeuille. Sa divulgation donne à un tiers un accès irréversible à tous les fonds."],
  ["Drain", "Technique de vol automatisé vidant instantanément un portefeuille de la totalité de son contenu sans le consentement du propriétaire."],
  ["Réseau Sybil", "Ensemble de portefeuilles en apparence indépendants mais contrôlés par une seule et même entité."],
  ["Insider Trading on-chain", "Achat de tokens avant une annonce publique grâce à des informations non publiques. Détectable par l'horodatage immuable des transactions blockchain."],
  ["Layering (stratification)", "Technique de blanchiment consistant à faire transiter des fonds illicites à travers une série de portefeuilles intermédiaires pour en brouiller la traçabilité."],
  ["Solscan / Etherscan", "Explorateurs blockchain publics permettant à quiconque de vérifier n'importe quelle transaction en tapant sa signature."],
  ["Arkham Intelligence", "Plateforme professionnelle d'analyse blockchain permettant de visualiser et d'identifier les flux de fonds entre portefeuilles."],
  ["RPC (Remote Procedure Call)", "Méthode technique permettant d'interroger directement la blockchain pour extraire des données vérifiables."],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const map: Record<string, string> = { insider_trading: "Insider Trading", pump_dump: "Pump & Dump", manipulation_marche: "Manipulation de marché", drain_phishing: "Drain / Phishing", blanchiment: "Blanchiment" };
  return map[t] || t;
}

type ThemeColors = {
  bg: string; text: string; textMuted: string; textLight: string;
  headerBg: string; headerText: string;
  sectionBg: string; sectionText: string;
  tableBg1: string; tableBg2: string; tableBorder: string;
  cardBg: string; cardBorder: string;
  monoBg: string; monoText: string;
  calloutBg: string; calloutBorder: string;
  qualNote: string; leakedBg: string; leakedBorder: string; leakedText: string;
  disclaimerText: string; font: string;
};

const PRINT_THEME: ThemeColors = {
  bg: "#fff", text: "#000", textMuted: "#666", textLight: "#888",
  headerBg: "#fff", headerText: "#000",
  sectionBg: "#f0f0f0", sectionText: "#000",
  tableBg1: "#fff", tableBg2: "#f5f5f5", tableBorder: "#ccc",
  cardBg: "#fff", cardBorder: "#ddd",
  monoBg: "#f0f0f0", monoText: "#000",
  calloutBg: "#fafafa", calloutBorder: "#999",
  qualNote: "#666", leakedBg: "#fff8f0", leakedBorder: "#FF6B00", leakedText: "#cc6600",
  disclaimerText: "#999", font: "'Times New Roman',Georgia,serif",
};

const INTERLIGENS_THEME: ThemeColors = {
  bg: "#000", text: "#fff", textMuted: "#aaa", textLight: "#666",
  headerBg: "#000", headerText: "#fff",
  sectionBg: "#111", sectionText: "#fff",
  tableBg1: "#0a0a0a", tableBg2: "#111", tableBorder: "#333",
  cardBg: "#0d0d0d", cardBorder: "#333",
  monoBg: "#1a1a1a", monoText: "#FF6B00",
  calloutBg: "#0a0a0a", calloutBorder: "#FF6B00",
  qualNote: "#aaa", leakedBg: "#1a0f00", leakedBorder: "#FF6B00", leakedText: "#FF6B00",
  disclaimerText: "#555", font: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

function getTheme(t?: PlainteTheme): ThemeColors {
  return t === "interligens" ? INTERLIGENS_THEME : PRINT_THEME;
}

function statutStyle(s?: PreuveStatut): { color: string; label: string; bg: string } {
  if (s === "CONSTATE") return { color: "#2d7a2d", label: "FAIT CONSTATÉ", bg: "#f0fff0" };
  if (s === "ATTRIBUE") return { color: "#FF6B00", label: "ATTRIBUTION / CORRÉLATION", bg: "#fff8f0" };
  return { color: "#888", label: "À CONFIRMER PAR RÉQUISITION", bg: "#f8f8f8" };
}

function statutBadge(s?: PreuveStatut): string {
  const st = statutStyle(s);
  return `<span style="display:inline-block;padding:2px 6px;font-size:7px;font-weight:700;color:${st.color};border:1px solid ${st.color};border-radius:3px;text-transform:uppercase;letter-spacing:0.5px">${st.label}</span>`;
}

// ── Main HTML builder ────────────────────────────────────────────────────────

export function buildPlainteHtml(input: PlainteInput, theme?: PlainteTheme): string {
  const now = new Date().toISOString().slice(0, 10);
  const ref = `INTERLIGENS-${(input.nom || "CASE").replace(/[^A-Z0-9]/gi, "").slice(0, 20)}-${now.replace(/-/g, "")}`;
  const T = getTheme(theme);

  let html = `<!DOCTYPE html><html lang="${input.juridiction === "US" ? "en" : "fr"}"><head><meta charset="UTF-8"><style>
@page{size:A4;margin:18mm 16mm 24mm 16mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:${T.font};color:${T.text};font-size:11px;line-height:1.55;background:${T.bg}}
.header-band{background:${theme === "interligens" ? "#000" : "#fff"};color:${T.headerText};padding:10px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #FF6B00}
.header-band .logo{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${theme === "interligens" ? "#fff" : "#000"}}
.header-band .logo .box{width:22px;height:22px;background:#FF6B00;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#000;border-radius:3px}
.header-band .conf{color:#ff4444;font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700}
.page-content{padding:0 4px}
h1{font-size:18px;text-align:center;margin:20px 0 6px;font-weight:800;letter-spacing:1px;color:${T.text}}
h2{font-size:13px;background:${T.sectionBg};color:${T.sectionText};padding:7px 12px;margin:18px 0 10px;text-transform:uppercase;letter-spacing:2px;font-weight:700;page-break-after:avoid;border-left:4px solid #FF6B00}
h3{font-size:11.5px;font-weight:700;margin:12px 0 6px;border-bottom:1px solid ${T.tableBorder};padding-bottom:3px;color:${T.text}}
p{margin:0 0 8px;text-align:justify}
table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0}
th{background:${T.sectionBg};padding:5px 8px;text-align:left;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid ${T.tableBorder};color:${T.sectionText}}
td{padding:5px 8px;border:1px solid ${T.tableBorder};vertical-align:top;color:${T.text}}
tr:nth-child(even) td{background:${T.tableBg2}}
tr:nth-child(odd) td{background:${T.tableBg1}}
.mono{font-family:'Courier New',Consolas,monospace;font-size:9.5px;background:${T.monoBg};color:${T.monoText};padding:1px 4px;word-break:break-all}
.mono-block{font-family:'Courier New',Consolas,monospace;font-size:9px;background:${T.monoBg};color:${T.monoText};padding:6px 10px;border:1px solid ${T.cardBorder};margin:6px 0;word-break:break-all;line-height:1.5}
.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:8px;font-weight:700}
.badge-critique{${theme === "interligens" ? "background:#c41e1e;color:#fff" : "background:#fff;color:#cc0000;border:1px solid #cc0000"}}
.badge-haute{${theme === "interligens" ? "background:#FF6B00;color:#fff" : "background:#fff;color:#FF6B00;border:1px solid #FF6B00"}}
.badge-moyenne{${theme === "interligens" ? "background:#888;color:#fff" : "background:#fff;color:#666;border:1px solid #666"}}
.callout{border:1px solid ${T.calloutBorder};padding:10px;margin:8px 0;font-size:10px;background:${T.calloutBg};border-left:4px solid #FF6B00;color:${T.textMuted}}
.cover-center{text-align:center;margin:30px 0}
.cover-table td{border:none;padding:4px 10px;font-size:11px;color:${T.text}}
.cover-table td:first-child{font-weight:700;text-align:right;width:160px;color:${T.textMuted}}
.qual-note{font-style:italic;color:${T.qualNote};font-size:9px;margin:2px 0 8px 12px}
.leaked-warning{background:${T.leakedBg};border:1px solid ${T.leakedBorder};border-left:4px solid ${T.leakedBorder};padding:8px;margin:6px 0;font-size:9px;color:${T.leakedText}}
.disclaimer-footer{font-size:7px;color:${T.disclaimerText};text-align:center;margin-top:8px;padding-top:4px;border-top:1px solid ${T.cardBorder}}
.page-break{page-break-before:always}
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
    html += `<p><strong style="color:#1a1a1a">${esc(term)}</strong> — <span style="color:#333">${esc(def)}</span></p>`;
  }

  // SECTION 1 — RÉSUMÉ EXÉCUTIF
  html += `<div class="page-break"></div><h2>Section 1 — Résumé exécutif des faits</h2>
  <p>Le présent dossier expose les faits constitutifs de <strong>${input.typeInfraction.map(t => infractionLabel(t)).join(", ")}</strong> survenus entre le ${esc(input.datesFaits)} sur la blockchain ${esc(input.blockchain)}, impliquant le token <strong>${esc(input.token || input.nom)}</strong>${input.mint ? ` (mint : <span class="mono">${esc(input.mint)}</span>)` : ""}.</p>
  <p>Le plaignant, ${esc(input.plaignantNom)} (${esc(input.plaignantQualite)}), a subi un préjudice estimé à <strong>${fmtMoney(input.prejudiceEUR)}</strong> (${fmtMoney(input.prejudiceUSD, "$")})${input.walletVictime ? ` depuis le portefeuille <span class="mono">${esc(input.walletVictime)}</span>` : ""}.</p>
  <p>${input.suspects.length} suspect(s) identifié(s). ${input.preuvesCles.length} preuve(s) clé(s) documentée(s). ${input.requisitions.length} réquisition(s) judiciaire(s) recommandée(s).</p>`;
  if (input.ampleur) {
    html += `<p><strong>Ampleur du schéma</strong> : ${input.ampleur.victimesIdentifiees ?? "—"} victimes identifiées, ${input.ampleur.walletIntermediaires ?? "—"} wallets intermédiaires, ${input.ampleur.transactionsTotales ?? "—"} transactions, extrapolation ${esc(input.ampleur.extrapolationTotale)}.</p>`;
  }

  // ── MOD 3 : COMPÉTENCE TERRITORIALE (FR only, between S1 and S2) ───────
  if (input.juridiction === "FR") {
    html += `<h2>Compétence territoriale</h2>
    <p>Le plaignant réside en France (département 91 — Essonne, Île-de-France). Les faits ont produit leurs effets sur le territoire français, le préjudice ayant été subi par une personne physique résidant en France. La compétence de la juridiction parisienne est établie conformément aux articles 43 et 706-72 du Code de procédure pénale. Les infractions commises via un réseau de communication électronique sont réputées commises en France lorsqu'elles lèsent une personne physique résidant sur le territoire (Art. 113-2 Code pénal).</p>`;
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

  // SECTION 3 — CHRONOLOGIE (MOD 2: statut column)
  if (input.chronologie?.length) {
    html += `<div class="page-break"></div><h2>Section 3 — Chronologie détaillée</h2>
    <table><thead><tr><th>Date</th><th>Heure UTC</th><th>Événement</th><th>Acteurs</th><th>Preuve</th><th>Force</th><th>Statut</th></tr></thead><tbody>`;
    for (const c of input.chronologie) {
      const forceBadge = c.force === "CRITIQUE" ? "badge-critique" : c.force === "HAUTE" ? "badge-haute" : "badge-moyenne";
      html += `<tr><td>${esc(c.date)}</td><td>${esc(c.heure || "—")}</td><td>${esc(c.evenement)}</td><td style="font-size:9px">${esc(c.acteurs || "")}</td><td style="font-size:9px">${esc(c.preuve || "")}</td><td>${c.force ? `<span class="badge ${forceBadge}">${c.force}</span>` : "—"}</td><td>${statutBadge(c.statut as PreuveStatut | undefined)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  // SECTION 4 — PREUVES (MOD 2: 3 visual levels + MOD 10: leaked warning)
  html += `<div class="page-break"></div><h2>Section 4 — Preuves techniques (${input.preuvesCles.length})</h2>`;
  for (const p of input.preuvesCles) {
    const st = statutStyle(p.statut);
    const forceBadge = p.force === "CRITIQUE" ? "badge-critique" : p.force === "HAUTE" ? "badge-haute" : "badge-moyenne";
    const isLeaked = p.statut === "A_CONFIRMER" && (p.nature.toLowerCase().includes("document interne") || p.nature.toLowerCase().includes("leaked"));
    html += `<div style="border:1px solid #ddd;padding:10px;margin:8px 0;border-left:4px solid ${st.color};background:${st.bg}">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="font-size:8px;font-weight:700;color:${st.color};text-transform:uppercase;letter-spacing:1px">${st.label}</div><span class="badge ${forceBadge}">${p.force}</span></div>
    <div style="font-weight:700;margin-bottom:6px">${esc(p.id)} — ${esc(p.nature)}</div>
    <p style="font-size:10px">${esc(p.description)}</p>`;
    if (isLeaked) {
      html += `<div class="leaked-warning">⚠ PIÈCE D'ORIENTATION — Cette pièce nécessite une authentification formelle avant d'être présentée comme preuve centrale. Joindre si possible : hash SHA-256 du fichier + date et contexte de réception + corroborations on-chain ligne par ligne.</div>`;
    }
    if (p.adresse) html += `<div class="mono-block">Adresse : ${esc(p.adresse)}</div>`;
    if (p.ata) html += `<div class="mono-block">ATA : ${esc(p.ata)}</div>`;
    if (p.wallet) html += `<div class="mono-block">Wallet : ${esc(p.wallet)}</div>`;
    if (p.wallets) html += `<div class="mono-block">${p.wallets.map(w => esc(w)).join("\n")}</div>`;
    if (p.verification) html += `<div style="font-size:9px;color:#666;margin-top:4px">Vérification : ${esc(p.verification)}</div>`;
    if (p.note) html += `<div style="font-size:9px;color:#888;font-style:italic;margin-top:4px">${esc(p.note)}</div>`;
    html += `</div>`;
  }

  // SECTION 5 — QUALIFICATIONS (MOD 1: bandeau + MOD 4: prescription)
  html += `<div class="page-break"></div><h2>Section 5 — Qualifications pénales applicables</h2>`;
  if (input.qualificationsFR?.length) {
    html += `<h3>Droit français</h3><ul style="margin:6px 0 0 20px">`;
    for (const q of input.qualificationsFR) html += `<li style="margin:4px 0;font-size:10.5px">${esc(q)}</li>`;
    html += `</ul><div class="qual-note">Qualification principale / subsidiaire proposée au vu des éléments actuellement disponibles, susceptible d'être affinée par les enquêteurs ou le parquet.</div>`;
  }
  if (input.qualificationsUS?.length) {
    html += `<h3>Droit américain</h3><ul style="margin:6px 0 0 20px">`;
    for (const q of input.qualificationsUS) html += `<li style="margin:4px 0;font-size:10.5px">${esc(q)}</li>`;
    html += `</ul><div class="qual-note">Qualification principale / subsidiaire proposée au vu des éléments actuellement disponibles, susceptible d'être affinée par les enquêteurs ou le parquet.</div>`;
  }
  // MOD 4 — Prescription
  html += `<h3>Prescription</h3>
  <p>Les faits visés datent de ${esc(input.datesFaits)}. Le délai de prescription applicable aux délits est de 6 ans à compter du jour où l'infraction a été commise (Art. 8 du Code de procédure pénale). La présente plainte est déposée dans le délai légal.</p>`;

  // SECTION 6 — RÉQUISITIONS
  html += `<div class="page-break"></div><h2>Section 6 — Réquisitions judiciaires recommandées (${input.requisitions.length})</h2>
  <table><thead><tr><th>Priorité</th><th>Cible</th><th>Demande</th><th>Fondement</th><th>Contact</th><th>Délai</th></tr></thead><tbody>`;
  for (const r of input.requisitions) {
    html += `<tr><td style="font-weight:700;color:${r.priorite === "P1" ? "#c41e1e" : r.priorite === "P2" ? "#FF6B00" : "#888"}">${esc(r.priorite)}</td><td style="font-weight:600">${esc(r.cible)}</td><td style="font-size:9px">${esc(r.demande)}</td><td style="font-size:9px">${esc(r.fondement || "")}</td><td style="font-size:9px">${esc(r.contact || "")}</td><td style="font-size:9px">${esc(r.delai || "")}</td></tr>`;
  }
  html += `</tbody></table>`;

  // SECTION 7 — PRÉJUDICE (MOD 6: méthode de calcul structurée)
  html += `<h2>Section 7 — Préjudice et demandes</h2>
  <h3>Méthode de calcul du préjudice</h3>
  <table class="cover-table"><tbody>
  <tr><td>Cours ${esc(input.token || "token")}/USD au moment du fait</td><td>À préciser — source CoinGecko données historiques (coingecko.com)</td></tr>
  <tr><td>Quantité investie / volée</td><td>Voir Section 4 — preuves techniques</td></tr>
  <tr><td>Valeur USD au moment du fait</td><td><strong>${fmtMoney(input.prejudiceUSD, "$")}</strong></td></tr>
  <tr><td>Taux EUR/USD BCE</td><td>Taux du jour applicable — à préciser</td></tr>
  <tr><td>Valeur EUR au moment du fait</td><td><strong>${fmtMoney(input.prejudiceEUR)}</strong></td></tr>
  <tr><td>Préjudice total retenu</td><td><strong>${fmtMoney(input.prejudiceEUR)}</strong></td></tr>
  </tbody></table>
  <p style="font-size:9px;color:#666;font-style:italic">Les cours historiques sont publiquement vérifiables sur CoinGecko (coingecko.com) — source reconnue par les juridictions pour l'évaluation des cryptoactifs.</p>`;
  if (input.prejudiceMoral) html += `<h3>Préjudice moral</h3><p>${esc(input.prejudiceMoral)}</p>`;

  // MOD 5 — Constitution de partie civile (Section 7bis)
  html += `<h2>Section 7bis — Constitution de partie civile</h2>
  <p>Conformément aux articles 85 et suivants du Code de procédure pénale, le plaignant entend se constituer partie civile afin d'obtenir réparation intégrale du préjudice subi.</p>
  <p>Le plaignant a personnellement subi le préjudice décrit, ayant investi ses fonds propres depuis ses wallets personnels identifiés en Section 2. Sans les manœuvres frauduleuses décrites dans ce dossier, le plaignant n'aurait pas subi le préjudice financier documenté.</p>
  <p>Le plaignant sollicite :</p>
  <ol style="margin:6px 0 12px 20px;font-size:10.5px">
  <li>L'ouverture d'une enquête préliminaire sur les faits exposés</li>
  <li>Le gel conservatoire des avoirs crypto identifiés en Section 2</li>
  <li>L'exécution des réquisitions judiciaires détaillées en Section 6</li>
  <li>La désignation d'un expert judiciaire en analyse blockchain</li>
  <li>La réparation intégrale du préjudice matériel et moral subi</li>
  </ol>`;

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

  // SECTION 9 — DÉCLARATION + MOD 9: instructions de dépôt
  html += `<div class="page-break"></div><h2>Section 9 — Déclaration de véracité</h2>
  <p>Je soussigné(e) <strong>${esc(input.plaignantNom)}</strong>, déclare que les informations contenues dans ce dossier sont exactes et sincères à ma connaissance. Je certifie que les données on-chain présentées ont été extraites directement depuis la blockchain publique ${esc(input.blockchain)} via les méthodes RPC standards et sont publiquement vérifiables.</p>
  <p style="margin-top:20px">Fait à __________________, le ${now}</p>
  <p style="margin-top:30px">Signature : ___________________</p>

  <h3 style="margin-top:24px">Instructions de dépôt physique</h3>
  <ul style="margin:6px 0 12px 20px;font-size:10px;line-height:1.7">
  <li>Imprimer en <strong>2 exemplaires minimum</strong> (1 pour le service enquêteur, 1 pour le plaignant)</li>
  <li>Porter sur chaque page la mention manuscrite <em>"Certifié conforme à l'original"</em> + signature du plaignant</li>
  <li>Joindre les pièces dans l'ordre de l'inventaire Section 8</li>
  <li>Apporter une <strong>clé USB</strong> contenant : PDF complet du dossier + tous les fichiers sources (exports on-chain, captures, JSON) + fichier INVENTAIRE.txt listant chaque fichier avec sa date de capture et son hash SHA-256</li>
  <li>Se munir d'une <strong>pièce d'identité en cours de validité</strong></li>
  </ul>`;

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

  // MOD 10 — Disclaimer footer on every page conceptually (added at end)
  html += `<div class="disclaimer-footer">Ce document est généré à titre d'aide à la constitution de dossier par INTERLIGENS (app.interligens.com). Il ne constitue pas un avis juridique. Consultez un avocat spécialisé en droit du numérique avant dépôt.</div>`;

  html += `</div></body></html>`;
  return html;
}
