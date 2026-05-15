/**
 * scripts/osint/rebuildRecitPdf.ts
 *
 * Regenerates CLE_USB_BOTIFY/RECIT_COMPLET_AFFAIRE_BOTIFY.pdf with updated
 * section VIII injecting the real Helius trace from out-botify-david-trace.json.
 *
 * Uses local Playwright chromium (no network download).
 * One-shot, no deploy, no commit. Overwrites the PDF in place.
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_PDF = "/Users/dood/Desktop/CLE_USB_BOTIFY/RECIT_COMPLET_AFFAIRE_BOTIFY.pdf";
const TRACE_JSON = join(process.cwd(), "scripts/osint/out-botify-david-trace.json");

type TraceEvent = {
  date: string;
  blockTime: number;
  txHash: string;
  type: "buy" | "sell" | "receive" | "send" | "unknown";
  botifyDelta: number;
  solDelta: number;
  usdEstimate: number;
  counterparty: string | null;
};

type TraceFile = {
  summary: {
    wallet: string;
    mint: string;
    tokenAccountsFound: number;
    currentBalance: number;
    signaturesInspected: number;
    eventsWithBotifyMovement: number;
    totalBought: number;
    totalSold: number;
    totalReceived: number;
    totalSent: number;
    totalUsdBuy: number;
    firstActivity: string | null;
    lastActivity: string | null;
  };
  events: TraceEvent[];
};

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi} UTC`;
}

function shortAddr(a: string | null): string {
  if (!a) return "—";
  if (a.length <= 12) return a;
  return `${a.slice(0, 8)}…${a.slice(-4)}`;
}

function shortTx(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-4)}`;
}

function typeBadge(t: TraceEvent["type"]): string {
  const map: Record<TraceEvent["type"], { color: string; label: string }> = {
    buy: { color: "#1B7F3A", label: "BUY DEX" },
    sell: { color: "#C03232", label: "SELL" },
    receive: { color: "#1F4E96", label: "RECEIVE" },
    send: { color: "#D97706", label: "SEND" },
    unknown: { color: "#666", label: "?" },
  };
  const m = map[t];
  return `<span style="display:inline-block;padding:2px 8px;background:${m.color};color:#fff;font-size:9px;font-weight:700;border-radius:3px;letter-spacing:0.5px;">${m.label}</span>`;
}

function buildSectionVIII(trace: TraceFile): string {
  const { events, summary } = trace;

  const rows = events
    .map(
      (e) => `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td>${typeBadge(e.type)}</td>
        <td style="text-align:right;font-weight:600;color:${e.botifyDelta > 0 ? "#1B7F3A" : "#C03232"};">${e.botifyDelta > 0 ? "+" : ""}${fmtInt(e.botifyDelta)}</td>
        <td style="font-family:Menlo,monospace;font-size:9px;">${shortAddr(e.counterparty)}</td>
        <td style="font-family:Menlo,monospace;font-size:9px;">${shortTx(e.txHash)}</td>
      </tr>`
    )
    .join("");

  return `
    <h2>VIII. Mon préjudice — wallet Ledger tracé on-chain (trace Helius)</h2>

    <p>Mon wallet Solana Ledger Hardware Wallet sur lequel j'ai détenu les tokens $BOTIFY :</p>

    <p class="mono">${summary.wallet}</p>

    <p>Ce hardware wallet Ledger requiert une confirmation physique pour chaque transaction (pression du bouton physique). Les achats et transferts de $BOTIFY depuis ce wallet sont donc délibérés et traçables avec certitude à ma personne.</p>

    <p>J'ai fait réaliser une extraction complète de l'historique on-chain via Helius RPC (méthodes <code>getSignaturesForAddress</code> + <code>getTransaction</code>) sur l'associated token account <code>7sYgaPTKzg4fZwAXMT7irrnt5w2cGNKb7HFni1s3btYM</code> et sur l'adresse principale du wallet. <strong>${summary.signaturesInspected} signatures</strong> ont été inspectées, parmi lesquelles <strong>${summary.eventsWithBotifyMovement} transactions</strong> impliquent un mouvement du token $BOTIFY.</p>

    <div class="callout">
      <strong>Synthèse financière :</strong><br>
      <strong>Seul et unique achat réel cash :</strong> 4,50 SOL ≈ <strong>$675</strong> le 5 avril 2025 (TX <code>AfwtzH2HXqG6…</code>) pour 75 592 BOTIFY.<br>
      <strong>Tokens reçus gratuitement (airdrop/distribution)</strong> : 1 343 469 BOTIFY en 4 transferts entrants depuis deux adresses distributrices.<br>
      <strong>Tokens sortis vers le pool/AMM</strong> : 1 419 061 BOTIFY en 6 transferts sortants vers la même adresse <code>5Q544fKr…e4j1</code>.<br>
      <strong>Balance actuelle du wallet</strong> : 0 BOTIFY (vidé le 5 janvier 2026).<br>
      <strong>Période d'activité</strong> : ${fmtDate(summary.firstActivity ?? "")} → ${fmtDate(summary.lastActivity ?? "")}.
    </div>

    <h3>Chronologie complète des 11 événements BOTIFY (Helius RPC)</h3>

    <table class="events-table">
      <thead>
        <tr>
          <th>Date UTC</th>
          <th>Type</th>
          <th style="text-align:right;">BOTIFY</th>
          <th>Contrepartie</th>
          <th>TX hash</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="note-box">
      <strong>Note méthodologique critique — reclassification des "sends" :</strong><br>
      Les 6 transferts sortants sont tous dirigés vers la même adresse <code>5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1</code>. Cette adresse est également la contrepartie du swap d'achat DEX du 5 avril 2025, ce qui est <strong>la signature comportementale d'un pool AMM</strong> (Raydium, Meteora ou PumpSwap) et non d'un wallet utilisateur classique.<br><br>
      Par conséquent, les 6 "sends" documentés dans le tableau ci-dessus sont selon toute vraisemblance des <strong>ventes déguisées</strong> — des swaps BOTIFY→SOL ou BOTIFY→USDC routés via jito-bundle ou instruction imbriquée où le SOL/USDC de contrepartie sort sur une autre TX ou vers un wallet de destination différent. Le script de trace, fondé uniquement sur le delta SOL du wallet David dans la TX, ne peut les classifier comme "sell" et les étiquette conservativement "send".<br><br>
      <strong>À confirmer côté enquête</strong> : résoudre la nature exacte de <code>5Q544fKr…e4j1</code> via Arkham Intelligence ou inspection des <code>innerInstructions</code> de chaque TX. Si pool confirmé, requalifier les 6 transferts sortants en ventes, pour un total de <strong>1 419 061 BOTIFY liquidés</strong> entre le 25 avril 2025 et le 5 janvier 2026.
    </div>

    <h3>Adresses contreparties identifiées</h3>

    <table class="party-table">
      <thead>
        <tr>
          <th>Adresse</th>
          <th>Nature présumée</th>
          <th>BOTIFY entrant</th>
          <th>BOTIFY sortant</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="mono-cell">BnVtpmb68JS3wf1zBHCevtt6epq5VDBxjxfGVYWsWVN9</td>
          <td>Distributeur initial (airdrop)</td>
          <td style="color:#1B7F3A;font-weight:600;">+1 181 781</td>
          <td>0</td>
        </tr>
        <tr>
          <td class="mono-cell">5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1</td>
          <td><strong>Pool AMM probable</strong> (à confirmer)</td>
          <td style="color:#1B7F3A;font-weight:600;">+121 199</td>
          <td style="color:#C03232;font-weight:600;">−1 419 061</td>
        </tr>
        <tr>
          <td class="mono-cell">3BMa6SkeiJ6e1g2jRq4JyZ265ioPh5zSa1qJrnd63rXu</td>
          <td>Distributeur tardif (airdrop saison 2)</td>
          <td style="color:#1B7F3A;font-weight:600;">+116 081</td>
          <td>0</td>
        </tr>
      </tbody>
    </table>

    <p>J'ai acheté des tokens $BOTIFY après avoir été exposé aux publications coordonnées des KOLs du réseau. Sans ces publications frauduleuses rémunérées, je n'aurais pas investi. Ces publications constituent une tromperie délibérée sur les qualités du produit au sens de l'article 313-1 du Code pénal.</p>

    <p>En parallèle, mon wallet Solana <code>FAGpqfADoU1GwoybSpnXA1L83R3RcU6JwFnQzHQucubT</code> a fait l'objet d'un drain (vidage forcé) par l'adresse <code>5Bb8LEnNdS3CBY6fDPBSegDmzx8WgXVzfBADP9tgB77Q</code> en début d'année 2025 — affaire distincte (VINE) ayant également fait l'objet d'un dépôt de plainte à la BEFTI.</p>
  `;
}

function buildFullHtml(trace: TraceFile): string {
  const sectionVIII = buildSectionVIII(trace);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Récit complet de l'affaire BOTIFY</title>
<style>
  @page { size: A4; margin: 24mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    color: #111;
    font-size: 11px;
    line-height: 1.55;
    background: #fff;
  }
  h1 {
    font-size: 22px;
    text-align: center;
    margin-bottom: 4px;
    letter-spacing: 1px;
    font-weight: 800;
  }
  h1 + .subtitle {
    text-align: center;
    color: #E66000;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .subtitle-sm {
    text-align: center;
    font-size: 10px;
    color: #666;
    margin-bottom: 12px;
  }
  h2 {
    color: #E66000;
    font-size: 14px;
    margin-top: 22px;
    margin-bottom: 10px;
    font-weight: 700;
    border-bottom: 1px solid rgba(230,96,0,0.25);
    padding-bottom: 3px;
    page-break-after: avoid;
  }
  h3 {
    color: #333;
    font-size: 12px;
    margin-top: 16px;
    margin-bottom: 8px;
    font-weight: 700;
    page-break-after: avoid;
  }
  p { margin: 0 0 8px 0; text-align: justify; }
  code, .mono { font-family: Menlo, Consolas, monospace; font-size: 10px; color: #333; }
  .mono { display: block; padding: 4px 0; word-break: break-all; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
  th {
    background: #1B2A4A;
    color: #fff;
    text-align: left;
    padding: 6px 8px;
    font-weight: 600;
    font-size: 10px;
  }
  td {
    border-bottom: 1px solid #E5E5E5;
    padding: 5px 8px;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #FAFAFA; }
  .info-table td { border: 1px solid #D0D0D0; padding: 6px 10px; font-size: 10.5px; }
  .info-table td:first-child { background: #F5F5F5; font-weight: 600; width: 150px; }
  .callout {
    border: 1px solid rgba(230,96,0,0.5);
    background: rgba(255,237,220,0.5);
    padding: 10px 12px;
    margin: 10px 0;
    font-size: 10.5px;
    line-height: 1.6;
    border-radius: 3px;
  }
  .note-box {
    border: 1px solid rgba(230,96,0,0.7);
    background: #FFF8F0;
    padding: 10px 12px;
    margin: 12px 0;
    font-size: 10px;
    line-height: 1.6;
    border-left: 3px solid #E66000;
  }
  .events-table th, .events-table td { font-size: 9.5px; padding: 4px 6px; }
  .party-table .mono-cell { font-family: Menlo, monospace; font-size: 9px; }
  ul { margin: 4px 0 10px 16px; padding: 0; }
  li { margin: 3px 0; }
  .section { page-break-inside: avoid; }
  h2 { page-break-before: auto; }
  .chron-row { display: flex; gap: 12px; margin: 4px 0; font-size: 10px; }
  .chron-date { color: #E66000; font-weight: 600; min-width: 110px; }
  .chron-text { flex: 1; }
  .rag { color: #C03232; }
  .ok { color: #1B7F3A; }
  .priority-box {
    border: 1px solid #D0D0D0;
    padding: 8px 12px;
    margin: 6px 0;
    font-size: 10px;
    background: #FAFAFA;
  }
  .priority-box.p1 { border-left: 4px solid #C03232; }
  .priority-box.p2 { border-left: 4px solid #E66000; }
  .priority-box.p3 { border-left: 4px solid #1B4E96; }
  .priority-label { font-weight: 700; color: #333; }
  .footer-note {
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px solid #E66000;
    text-align: center;
    font-size: 10.5px;
    color: #555;
  }
  .sig {
    text-align: center;
    margin-top: 8px;
    font-weight: 700;
    color: #222;
  }
</style>
</head>
<body>

<h1>RÉCIT COMPLET DE L'AFFAIRE BOTIFY</h1>
<div class="subtitle">Fraude crypto organisée sur Solana — De DIONE à GHOST</div>
<div class="subtitle-sm">Chronologie complète, acteurs identifiés, préjudice documenté</div>

<table class="info-table">
  <tr><td>Destinataire</td><td>BEFTI — Brigade d'Enquête sur les Fraudes aux Technologies de l'Information<br>Tél. : 01 55 75 75 02 — 36 rue du Louvre, 75001 Paris</td></tr>
  <tr><td>Date</td><td>15 avril 2026</td></tr>
  <tr><td>Auteur</td><td>David (plaignant) — fondateur INTERLIGENS</td></tr>
  <tr><td>Objet</td><td>Récit factuel complet — fraude crypto organisée, pump-and-dump Solana</td></tr>
  <tr><td>Mon wallet Ledger</td><td class="mono" style="padding:0;">Hka5a2b35xPAuDgAxCX1r5yzFXG7vPLahrBCqPG1GSB3</td></tr>
  <tr><td>Token BOTIFY</td><td class="mono" style="padding:0;">BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb (mint Solana)</td></tr>
</table>

<div class="callout">
  <strong>Objet :</strong> Ce document est le récit factuel et chronologique de la fraude BOTIFY, rédigé par David, victime directe ayant acheté des tokens $BOTIFY. Il couvre l'intégralité du schéma depuis DIONE Protocol (2022) jusqu'à GHOST (2025-2026), en passant par le lancement frauduleux de BOTIFY (jan-fév 2025). Il inclut mon témoignage personnel et celui de @mariaqueennft (lanceuse d'alerte, 150 000 $ de pertes), qui a divulgué le document interne BOTIFY.
</div>

<h2>I. Contexte personnel — qui je suis et comment j'ai été ciblé</h2>
<p>Je suis David, entrepreneur français basé dans l'Essonne (Île-de-France). Fondateur d'INTERLIGENS, plateforme d'intelligence anti-arnaque crypto que j'ai créée après avoir moi-même été victime de cette fraude. Ce récit est celui d'une victime directe et d'un enquêteur.</p>
<p>J'ai investi dans le token $BOTIFY en janvier 2025, attiré par les publications coordonnées de plusieurs dizaines d'influenceurs crypto sur X (Twitter). Ces influenceurs — Brandon Kokoski (@bkokoski), @GordonGekko, @planted, et une cinquantaine d'autres — construisaient une image de crédibilité et de légitimité autour du projet. Je pensais investir dans une vraie plateforme d'intelligence de trading basée sur l'IA.</p>
<p>Cette description était entièrement mensongère. BOTIFY était un schéma de pump-and-dump soigneusement orchestré, dont les promoteurs avaient été rémunérés à l'avance en tokens pour créer une demande artificielle.</p>
<div class="callout">
  <strong>Mon wallet Ledger (Solana) :</strong> <code>Hka5a2b35xPAuDgAxCX1r5yzFXG7vPLahrBCqPG1GSB3</code><br><br>
  Hardware wallet sécurisé physiquement. Chaque transaction nécessitait confirmation physique de ma part. L'historique complet des achats/transferts de $BOTIFY est consultable sur Solscan et via Helius RPC — la section VIII ci-dessous en fournit l'extraction exhaustive.
</div>

<h2>II. Les acteurs — portraits et rôles dans la fraude</h2>
<table>
  <thead><tr><th>Pseudonyme</th><th>Identité</th><th>Rôle</th><th>Lieu</th></tr></thead>
  <tbody>
    <tr><td>@bkokoski<br>Brandon Kokoski</td><td>Confirmé Arkham + LinkedIn</td><td>Co-fondateur. Développeur principal. Ex-VP/COO Dione Protocol (août 2022→mars 2026). Payroll employés depuis son wallet USDT. Cashout $110K USDC en 3h30 le 20/03/2026.</td><td>Toronto, Canada</td></tr>
    <tr><td>James (Telegram)</td><td>Inconnu (à identifier)</td><td>CO FOUNDER Botify.Cloud. Trésorerie : $380K+ (doc interne). Wallet KOL : n4wJXMCz...Jg68</td><td>Inconnu</td></tr>
    <tr><td>OrbitApe (Telegram)</td><td>Inconnu (via Cobo.com)</td><td>PROPRIÉTAIRE Botify.Cloud. $817K+ documentés (Arkham + doc). Utilise Cobo.com (custody institutionnel).</td><td>Inconnu</td></tr>
    <tr><td>@sxyz500<br>@samjoleary<br>SAMBO</td><td>Sam O'Leary. Confirmé Telegram + vol ADL→HK</td><td>Co-fondateur. KOL 2% (8.5m tokens). $209K+ cashouts (Binance + BloFin). 8 wallets F&amp;F identifiés.</td><td>Melbourne/Adélaïde, Australie</td></tr>
    <tr><td>@planted<br>Djordje | Mr S</td><td>Djordje Stupar. Aveu public 19/03/2025</td><td>"Voix publique" BOTIFY (auto-décrit). Spaces host Telegram. Promotion $GHOST.</td><td>Inconnu</td></tr>
    <tr><td>@GordonGekko</td><td>Inconnu (OKX à requérir en priorité)</td><td>KOL 1.665% supply BOTIFY. $40K+ cashouts BOTIFY confirmés (finding $445K SWIF retiré pour vérification). Actif le 4 avril 2026. MaestroBots.</td><td>Inconnu</td></tr>
  </tbody>
</table>
<p>Au-delà des fondateurs, 50+ KOLs payés en tokens et une équipe de 16 salariés ($13,010/semaine masse salariale) complétaient la structure. La liste complète est dans le dossier technique remis sur clé USB.</p>

<h2>III. Phase 1 — DIONE Protocol : construction de la crédibilité (2022–2024)</h2>
<p>Pour comprendre BOTIFY, il faut remonter à DIONE Protocol. Ce projet blockchain présenté comme infrastructure décentralisée pour l'énergie a servi de tremplin à Brandon Kokoski pour bâtir sa réputation.</p>
<p>Depuis août 2022, Kokoski occupait le poste de VP et COO de Dione Protocol. Sur deux ans, il a :</p>
<ul>
  <li>Construit une audience X conséquente en publiant sur blockchain, IA et crypto</li>
  <li>Établi des relations avec des exchanges (MEXC, gate.io) qui serviront pour BOTIFY</li>
  <li>Tissé un réseau d'influenceurs : @GordonGekko, @planted, et 50+ futurs KOLs BOTIFY</li>
  <li>Recruté des ingénieurs (Paul $2800/sem, Armel $3200/sem) et community managers</li>
  <li>Rodé la méthodologie pump-and-dump sur les tokens DIONE ($DIONE, $OVPP)</li>
</ul>
<div class="callout">
  <strong>Preuve de continuité DIONE → BOTIFY :</strong> Les wallets ETH de Kokoski (label "kokoskib" Arkham Intelligence) sont identiques pour les deux projets. Wallet deployer DIONE = même infrastructure que BOTIFY. Portfolio Arkham EVM : $400,732 (gelable immédiatement).
</div>
<p>Le 30 avril 2025, @GordonGekko publiait une photo de réunion avec BK et @planted : "Me and my friend Alex (Blackrock) just had a HUGE meeting with @kokoski and @planted from $DIONE" (105,300 vues). Cette image prouve la collaboration tripartite préexistante à BOTIFY.</p>
<p>Le 19 mars 2026, simultanément à l'effondrement de BOTIFY, BK annonce quitter Dione : "After dedicating my time towards @DioneProtocol since August 2022, I'm stepping back." Le lendemain (20 mars), il cashout $110,000 USDC en 3h30.</p>

<h2>IV. Phase 2 — BOTIFY : préparation et lancement (nov 2024 – fév 2025)</h2>
<p>BOTIFY a été présenté comme une plateforme d'intelligence de trading IA sur Solana. Cette description était entièrement frauduleuse. Le projet était un pump-and-dump préparé des mois à l'avance, avec une infrastructure industrielle.</p>
<h3>Ce que le document interne révèle</h3>
<table>
  <thead><tr><th>Élément</th><th>Détail</th></tr></thead>
  <tbody>
    <tr><td>Supply totale</td><td>1,000,000,000 tokens $BOTIFY</td></tr>
    <tr><td>Allocation KOLs</td><td>18.02% = 180M tokens pour 50+ influenceurs</td></tr>
    <tr><td>Masse salariale</td><td>$13,010/semaine · 16 employés · payés en USDT par BK</td></tr>
    <tr><td>Frais listing</td><td>$90,000 MEXC · $80,000 UEFA · $150,000 TikTok</td></tr>
    <tr><td>GordonGekko</td><td>55 SOL ($10K) cash + 0.665% supply + posts quotidiens exigés</td></tr>
    <tr><td>Vol Sam</td><td>"19.642 SOL Flights S.O ADL-HK" = billet BK payé trésorerie BOTIFY</td></tr>
    <tr><td>Trump whale</td><td>"$20,000 to FF to ML (trump whale wallet)" — lien BOTIFY↔$TRUMP</td></tr>
    <tr><td>Score RugCheck</td><td>1/100 — pire score possible — preuve manipulation tokenomics</td></tr>
  </tbody>
</table>
<h3>Le mécanisme du pump — comment les victimes ont été manipulées</h3>
<p><strong>Étape 1 — Pré-lancement (nov–déc 2024) :</strong> Distribution secrète des tokens à 50+ KOLs avant toute annonce publique. Chaque influenceur reçoit ses tokens à coût zéro avec obligation de posts promotionnels selon calendrier.</p>
<p><strong>Étape 2 — Lancement coordonné (jan 2025) :</strong> Annonce simultanée par tous les KOLs. Le token apparaît porté par 50 influenceurs avec millions d'abonnés cumulés. J'achète mes tokens $BOTIFY dans cette phase. La demande est artificielle.</p>
<p><strong>Étape 3 — Volume artificiel :</strong> Le market maker Myrrha/MM (wallet 5aMV3Sp...) crée du volume via bloXroute MEV sur Raydium, simulant une liquidité réelle. Preuve de manipulation de marché on-chain.</p>
<p><strong>Étape 4 — Le dump :</strong> KOLs et fondateurs vendent au pic. Edu Rio : $347K via MEXC. MoneyLord : $48K sur Bybit en 1 jour. BK via HeaiD : $110K en 3h30. Total tracé : $1,803,537 sur 52 wallets.</p>
<p><strong>Étape 5 — L'effondrement :</strong> Sans volume artificiel ni posts KOLs, le token s'effondre. Les investisseurs retail — dont moi — se retrouvent avec des tokens sans valeur. Préjudice total estimé : $5,770,000+.</p>

<h2>V. Phase 3 — Le dump organisé et l'effondrement (fév–mars 2025)</h2>
<p>La chronologie des cashouts prouve un dump coordonné, pas une vente panique. Données Arkham Intelligence sur 52 wallets :</p>
<table>
  <thead><tr><th>Acteur</th><th>USD cashout</th><th>CEX</th><th>Période</th></tr></thead>
  <tbody>
    <tr><td>Edu Rio (2 wallets)</td><td>$347,237</td><td>MEXC (5 comptes)</td><td>Jan–fév 2025</td></tr>
    <tr><td>Sam O'Leary + relay</td><td>$209,931</td><td>Binance x3 + BloFin x2</td><td>Jan–mars 2026</td></tr>
    <tr><td>@MoneyLord</td><td>$85,484</td><td>Bybit x2 ($48K en 1 jour)</td><td>27 fév 2025</td></tr>
    <tr><td>Nekoz</td><td>$85,506</td><td>Non identifié direct</td><td>Sept 2025–mars 2026</td></tr>
    <tr><td>OrbitApe</td><td>$817,327</td><td>Cobo.com + LBank</td><td>2025–2026</td></tr>
    <tr><td>GordonGekko</td><td>$485,627+</td><td>Binance + OKX DEX</td><td>2025–2026</td></tr>
    <tr><td>Barbie</td><td>$65,289</td><td>MEXC ($22,826 principal)</td><td>Jan–mai 2025</td></tr>
    <tr><td>@ElonTrades</td><td>$53,313</td><td>MEXC ($27,507 en 1 TX)</td><td>17 avr 2025</td></tr>
    <tr><td>Shah</td><td>$57,348</td><td>Binance Hot Wallet</td><td>Fév–oct 2025</td></tr>
    <tr><td>Wulf (@wulfcryptox)</td><td>$36,592</td><td>Bybit ($28,168 en 1 TX)</td><td>2 mars 2025</td></tr>
    <tr><td>Matt (team)</td><td>$37,939</td><td>FixedFloat (no-KYC)</td><td>Mai–juil 2025</td></tr>
    <tr><td>Paul (Sr AI)</td><td>$28,592</td><td>ChangeNOW x6 (no-KYC)</td><td>Jan–fév 2025</td></tr>
    <tr><td><strong>TOTAL TRACÉ</strong></td><td><strong>$1,803,537+</strong></td><td>12 CEX différents</td><td>2025–2026</td></tr>
  </tbody>
</table>
<p><em>Note : $1,803,537 = minimum visible (Arkham fenêtre 16 TX + Helius 100 TX). Préjudice réel estimé $5,770,000+ — la différence sera établie par les exchanges sur réquisition.</em></p>

<h2>VI. Phase 4 — Les fuites et les aveux</h2>
<h3>@mariaqueennft — lanceuse d'alerte et victime principale</h3>
<p>Maria est la figure centrale qui a rendu possible l'ensemble de ce dossier. Elle a travaillé avec l'équipe BOTIFY pendant plusieurs mois, pensant sincèrement participer à un projet légitime. Elle avait investi plus de 150 000 $ de ses propres fonds en faisant confiance aux fondateurs.</p>
<p>Quand elle a réalisé la nature frauduleuse du projet — en observant les dumps des fondateurs et l'effondrement programmé — elle a pris la décision courageuse de divulguer le document interne BOTIFY sur X. Ce document de plusieurs pages, avec wallets, montants, règles de vesting et hashes de transactions Solscan vérifiables, est la pièce maîtresse de ce dossier.</p>
<div class="callout">
  Maria : victime ET témoin prioritaire. Pertes : 150 000 $+. Dispose de preuves internes de première main sur la structure de BOTIFY. Doit être entendue et protégée. Identité obtenue via réquisition à X (Twitter).
</div>
<p>En février 2026, Maria publie "The Kokoski Pattern" — thread documentant 13 tokens successivement ruggés en lien avec BK. Le 27 février, elle confirme Sam O'Leary comme co-développeur de $GHOST.</p>
<h3>@planted (Djordje Stupar) — l'aveu public du 19 mars 2025</h3>
<p>Djordje Stupar (@planted), désigné dans le groupe Telegram Botify.Cloud comme "Djordje | Mr S" et "spaces host", a publié sur X le 19 mars 2025 un post admettant son rôle de "voix publique" de BOTIFY. Cet aveu, capturé en screenshot et archivé dans le dossier (pièce E-09), constitue une preuve directe de sa participation consciente à la fraude.</p>
<h3>@dethective — l'investigateur en ligne</h3>
<p>@dethective est l'investigateur on-chain qui a premier rendu public le document BOTIFY divulgué par Maria. Bêta-testeur NDA d'INTERLIGENS.</p>
<!-- TO_VERIFY (2026-05-15): claim sortie du rendu PDF — « @dethective a exposé le schéma $TRUMP insiders — GordonGekko seul y a réalisé $445,000 de profits pendant 30 tweets de promotion ». NON VÉRIFIÉE: aucun TX hash Solana, contradiction de token $TRUMP (ici) vs $SWIF (scamUniverse.json / seedBotifyComplete.ts) non tranchée. Ne pas réintégrer aux PDFs sans audit on-chain. Cf. MIGRATION_RETAILVISION.md section 'Finding $445K — retiré'. -->

<h2>VII. Phase 5 — GHOST : la récidive avec les mêmes acteurs (2025–2026)</h2>
<p>Après l'effondrement de BOTIFY, les mêmes acteurs ont relancé le même schéma avec le token $GHOST (mint Solana : BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST). Cette récidive est documentée et prouvée :</p>
<ul>
  <li>Novembre 2025 : @GordonGekko publie des posts promotionnels $GHOST — "$GHOST keeps showing up in the right wallets", "loaded", "HUGE week ahead for $GHOST".</li>
  <li>@planted héberge un Twitter Space $GHOST avec 658 auditeurs — exactement son rôle sur BOTIFY.</li>
  <li>Sam O'Leary (@sxyz500) confirmé co-développeur $GHOST par @mariaqueennft (27/02/2026).</li>
  <li>Wallet Brazil (KOL BOTIFY 0.91%) détient du $GHOST en déc 2025 — même réseau.</li>
  <li>@GhostWareOS listé sur App Store Canada ET Australie — lien BK (Toronto) et SAM (Adélaïde).</li>
</ul>
<div class="callout">
  Conclusion : $GHOST = continuation directe du réseau BOTIFY. L'enquête sur BOTIFY doit nécessairement inclure $GHOST dans son périmètre. Les mêmes wallets, les mêmes acteurs, les mêmes méthodes.
</div>

${sectionVIII}

<h2>IX. Le préjudice de @mariaqueennft — 150 000 $ perdus, lanceuse d'alerte</h2>
<p>Maria a travaillé directement avec l'équipe BOTIFY, pensant participer à un projet légitime. Les fraudeurs recrutent délibérément des personnes crédibles pour leur donner une légitimité externe — Maria en a été la victime.</p>
<ul>
  <li>Recrutement ciblé : Maria a été approchée pour ses compétences en communication crypto. Les fondateurs savaient qu'une collaboratrice crédible renforcerait la confiance publique.</li>
  <li>Investissement personnel : Convaincue de la légitimité du projet, elle a investi ses propres fonds — plus de 150 000 $ au total.</li>
  <li>La révélation : En observant les dumps des fondateurs et l'effondrement programmé, elle a réalisé la nature frauduleuse du schéma.</li>
  <li>La décision courageuse : Elle a rendu public le document interne BOTIFY sur X, s'exposant personnellement pour permettre à d'autres victimes de comprendre et de se défendre.</li>
  <li>Thread 22/02/2026 : "The Kokoski Pattern" — 13 tokens ruggés liés à BK documentés.</li>
  <li>Thread 27/02/2026 : Sam O'Leary (@sxyz500) confirmé co-développeur $GHOST.</li>
</ul>
<div class="callout">
  Maria : victime principale ET témoin clé de première instance.<br>
  Pertes documentées : 150 000 $+. Preuves internes de première main. Doit être entendue en priorité, avec mesures de protection. Identité complète via réquisition à X (Twitter). Handle : @mariaqueennft.
</div>

<h2>X. Chronologie générale — de 2022 à aujourd'hui</h2>
<div class="chron-row"><div class="chron-date">Août 2022</div><div class="chron-text">Brandon Kokoski rejoint Dione Protocol comme VP/COO. Début construction crédibilité crypto.</div></div>
<div class="chron-row"><div class="chron-date">2022–2024</div><div class="chron-text">BK développe réseau : influenceurs (Gordon, planted), exchanges, ingénieurs. Pump-and-dump DIONE/$OVPP.</div></div>
<div class="chron-row"><div class="chron-date">Avr 2025 [rétrospectif]</div><div class="chron-text">Photo réunion GordonGekko + BK + @planted (105K vues X). Preuve collaboration tripartite planifiée.</div></div>
<div class="chron-row"><div class="chron-date">Nov–déc 2024</div><div class="chron-text">Préparation BOTIFY : doc interne, distribution allocations tokens 50+ KOLs, infrastructure mise en place.</div></div>
<div class="chron-row"><div class="chron-date">Janv 2025</div><div class="chron-text">LANCEMENT PUBLIC BOTIFY. Campagne coordonnée 50+ KOLs. J'achète des tokens $BOTIFY (wallet Hka5a2b35...). Maria travaille pour le projet.</div></div>
<div class="chron-row"><div class="chron-date">Jan–fév 2025</div><div class="chron-text">Phase pump : volume artificiel Myrrha/MM (bloXroute MEV). Paul reçoit $28K USDT de BK (ChangeNOW x6). Armel $21K (Bitget).</div></div>
<div class="chron-row"><div class="chron-date">27 fév 2025</div><div class="chron-text">MoneyLord dump : $48,117 sur Bybit en 1 journée. Acceleration dump coordonné.</div></div>
<div class="chron-row"><div class="chron-date">Jan–fév 2025</div><div class="chron-text">Edu Rio vide ses wallets : $347,237 via MEXC (5 comptes). Plus gros cashout documenté KOL.</div></div>
<div class="chron-row"><div class="chron-date">Mars 2025</div><div class="chron-text">Aveu public @planted. Effondrement $BOTIFY. Maria réalise l'arnaque. 150 000 $ de pertes.</div></div>
<div class="chron-row"><div class="chron-date">Avr–juil 2025</div><div class="chron-text">Suite cashouts : ElonTrades $53K (MEXC), Exy $38K (Rollbit), Barbie $65K (MEXC), Matt $37K (FixedFloat).</div></div>
<div class="chron-row"><div class="chron-date">Début 2025 (VINE)</div><div class="chron-text">Mon wallet FAGpqfAD... drainé par 5Bb8LEnN... Plainte BEFTI séparée en cours.</div></div>
<div class="chron-row"><div class="chron-date">Nov 2025</div><div class="chron-text">Lancement $GHOST. GordonGekko + planted + SAM relancent le même schéma.</div></div>
<div class="chron-row"><div class="chron-date">Fév 2026</div><div class="chron-text">Maria publie "The Kokoski Pattern" (13 tokens ruggés BK). Confirmation SAM co-dev GHOST.</div></div>
<div class="chron-row"><div class="chron-date">19 mars 2026</div><div class="chron-text">BK annonce quitter Dione Protocol. @planted aveu public "voix BOTIFY".</div></div>
<div class="chron-row"><div class="chron-date">20 mars 2026</div><div class="chron-text">BK cashout coordonné $110,000 USDC en 3h30 via HeaiD. Effacement traces.</div></div>
<div class="chron-row"><div class="chron-date">30 mars 2026</div><div class="chron-text">Brommy envoie $20,227 USDC sur Coinbase (1 TX).</div></div>
<div class="chron-row"><div class="chron-date">4 avr 2026</div><div class="chron-text">GordonGekko actif sur pump.fun + OKX DEX (10 jours avant aujourd'hui).</div></div>
<div class="chron-row"><div class="chron-date">7 avr 2026</div><div class="chron-text">Sibel (@sibeleth) reçoit $1,000 USDC depuis Binance Hot Wallet.</div></div>
<div class="chron-row"><div class="chron-date">10 avr 2026</div><div class="chron-text">Hardy actif ($29,474 — $MOLTING token).</div></div>
<div class="chron-row"><div class="chron-date">12-14 avr 2026</div><div class="chron-text">OD actif sur OKX DEX ($20,439). Fraude toujours en cours.</div></div>
<div class="chron-row"><div class="chron-date">15 avr 2026</div><div class="chron-text">Remise du présent dossier à BEFTI.</div></div>

<h2>XI. Preuves disponibles — sur clé USB</h2>
<table>
  <thead><tr><th>Réf.</th><th>Type</th><th>Description</th><th>Statut</th></tr></thead>
  <tbody>
    <tr><td>E-06</td><td>Document interne</td><td>4 PDFs BOTIFY divulgués : KOL table (50+ wallets), payroll 16 employés, F&amp;F (14 wallets), trésorerie janv 2025</td><td>Clé USB</td></tr>
    <tr><td>E-13</td><td>Screenshots TG</td><td>6 captures groupe Botify.Cloud : James CO FOUNDER, OrbitApe PROPRIÉTAIRE, SAMBO, Djordje | Mr S</td><td>Clé USB</td></tr>
    <tr><td>E-17</td><td>Arkham CSV</td><td>52 exports CSV Arkham Intelligence — un par wallet analysé — $1,803,537 tracés</td><td>Clé USB</td></tr>
    <tr><td>E-20</td><td>Photos evidence</td><td>Gordon X posts $GHOST, réunion BK+Gordon+planted (105K vues), identité, BK/DIONE, DonWedge, etc.</td><td>Clé USB</td></tr>
    <tr><td>E-09</td><td>Aveu public</td><td>@planted 19/03/2025 — "voix publique BOTIFY" admis publiquement sur X</td><td>Screenshot archivé</td></tr>
    <tr><td>E-07</td><td>Thread X</td><td>@mariaqueennft 22/02/2026 — The Kokoski Pattern (13 tokens ruggés BK)</td><td>Screenshot archivé</td></tr>
    <tr><td>E-08</td><td>Thread X</td><td>@mariaqueennft 27/02/2026 — @sxyz500 co-dev GHOST confirmé</td><td>Screenshot archivé</td></tr>
    <tr><td>E-10</td><td>RugCheck</td><td>$BOTIFY score 1/100 — pire score possible — manipulation tokenomics prouvée</td><td>rugcheck.xyz</td></tr>
    <tr><td>E-16</td><td>Rapport CC</td><td>BOTIFY_KOL_SCAN_REPORT.json — 165 TX BOTIFY seedées, $964K+ documentés, 28 handles</td><td>Clé USB</td></tr>
    <tr><td>E-11</td><td>Arkham</td><td>BK wallet confirmé "kokoskib" par Arkham Intelligence</td><td>Screenshot Arkham</td></tr>
    <tr><td>E-21</td><td>Wallet David</td><td>Hka5a2b35... — historique achats/transferts $BOTIFY extrait via Helius RPC — 11 events documentés (cf. section VIII)</td><td>JSON &amp; section VIII</td></tr>
  </tbody>
</table>

<h2>XII. Demandes judiciaires prioritaires</h2>
<div class="priority-box p1"><span class="priority-label">PRIORITÉ 1 — Canada :</span> IDENTIFICATION ET ARRESTATION de Brandon Kokoski, Toronto, Canada. Gel immédiat du portfolio EVM Arkham ($400,732 USDC/USDT — données Arkham 23/03/2026). Réquisition exchanges canadiens et banques. Contact : RCMP — Gendarmerie Royale du Canada.</div>
<div class="priority-box p1"><span class="priority-label">PRIORITÉ 1 — Australie :</span> IDENTIFICATION ET ARRESTATION de Sam O'Leary, Melbourne/Adélaïde, Australie. Gel des comptes Binance (EB9P7, AYJfd, 7qH8k) et BloFin (CyUkM) liés à ses wallets. Contact : AFP (Australian Federal Police) + AUSTRAC.</div>
<div class="priority-box p2"><span class="priority-label">PRIORITÉ 2 — Réquisitions CEX (28 comptes) :</span> Binance (6 adresses) · BloFin · MEXC (8 comptes) · Bybit (5 comptes) · Bitget · Coinbase (5 comptes) · Cobo.com · LBank · Kraken · Rollbit · HitBTC. Objectif : identification KYC des titulaires de chaque compte dépôt.</div>
<div class="priority-box p2"><span class="priority-label">PRIORITÉ 2 — Réquisition X + Meta :</span> Identité civile complète : @GordonGekko · @planted (Djordje Stupar) · @mariaqueennft (victime + témoin) · @dethective · @wulfcryptox · @bkokoski (complément) · @sxyz500 (Sam O'Leary, complément).</div>
<div class="priority-box p2"><span class="priority-label">PRIORITÉ 2 — Réquisition X — @TheFudHound (témoin direct) :</span> Handle <strong>@TheFudHound</strong>. Rôle : <strong>dev contractuel Dione Protocol non payé</strong>, témoin direct de travail commandité par Brandon Kokoski. Preuves : <strong>3 posts X publics (décembre 2023 – janvier 2024)</strong> documentant le défaut de paiement et la relation contractuelle. Objectif réquisition : identité civile complète, email, numéro de téléphone, IP de connexion, date de création du compte — pour audition en qualité de témoin direct de la relation employeur/sous-traitant avec Kokoski pendant la phase DIONE (phase de construction de la crédibilité avant BOTIFY).</div>
<div class="priority-box p3"><span class="priority-label">PRIORITÉ 3 — Apple Inc. :</span> @GhostWareOS — App Store Canada ET Australie. Lien BK (Toronto) et SAM (Australie). Preuve de collaboration post-BOTIFY. Apple Legal, 1 Apple Park Way, Cupertino CA 95014.</div>
<div class="priority-box p3"><span class="priority-label">PRIORITÉ 3 — Arkham Intelligence :</span> Données complètes entités @GordonGekko, OrbitApe, James. Identité wallets non encore résolus. Arkham Intelligence Inc., San Francisco CA.</div>

<div class="footer-note">
  Je reste à disposition de la BEFTI pour tout complément, remise de preuves supplémentaires ou audition.<br>
  L'ensemble du dossier technique est disponible sur la clé USB jointe.
</div>
<div class="sig">David — INTERLIGENS — 15 avril 2026</div>

</body>
</html>`;
}

async function main(): Promise<void> {
  const trace = JSON.parse(readFileSync(TRACE_JSON, "utf8")) as TraceFile;
  const html = buildFullHtml(trace);

  writeFileSync("/tmp/recit-botify.html", html, "utf8");
  console.error(`[rebuild] HTML ${html.length} bytes → /tmp/recit-botify.html`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "15mm", right: "15mm" },
    });
    writeFileSync(OUT_PDF, pdfBytes);
    console.error(`[rebuild] PDF written: ${OUT_PDF} (${pdfBytes.length} bytes)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
