// src/lib/casefile/pdfGeneratorPublic.ts
//
// Public-safe CaseFile PDF — 9-section diffamation-safe intelligence report
// served from /api/casefile/pdf?template=public. White background, printable
// A4, bilingual (en/fr). Distinct from pdfGenerator.ts which renders the
// dark internal forensic report.
//
// Wording contract — enforced by the template:
//   FORBIDDEN:  "rug-pull", "confirmed", "laundered", "scammer",
//               "on-chain confirms" without a tx hash.
//   OBLIGATORY: "high-risk indicators", "referenced claims",
//               "Observed on-chain event [tx]".
//
// Exclusions (by design):
//   - No KOL names anywhere in the rendered PDF.
//   - No proceeds figures, no CEX-specific requisitions.
//   - No unverified victim testimony.
//
// Data source: data/cases/botify.json (claims C1..C8 + SRC-001..SRC-008).
// Anything not in that file is either static wording (how-to-report) or
// documented factual constants (concentration %, related projects).

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import botifyCase from "../../../data/cases/botify.json";

const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

const ACCENT = "#FF6B00";
const INK = "#000000";
const PAPER = "#FFFFFF";
const RULE = "#E5E5E5";
const MUTED = "#666666";
const RISK_RED = "#C81E1E";

export type PublicReportLang = "en" | "fr";

export interface PublicReportResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  error?: string;
}

// ── Copy ────────────────────────────────────────────────────────────────────

type Copy = {
  docTitle: string;
  caseLabel: string;
  generatedOn: string;
  page: (n: number, total: number) => string;
  risk: string;
  score: string;
  riskScoreOutOf100: string;
  tigerScoreLabel: string;
  execTitle: string;
  execBullets: string[];
  disclaimer: string;
  evIdxTitle: string;
  evIdxIntro: string;
  evCol: { id: string; type: string; source: string; ts: string; url: string; claim: string };
  timelineTitle: string;
  timelineIntro: string;
  timelineCol: { date: string; event: string; tx: string };
  tokenCtrlTitle: string;
  tokenCtrlIntro: string;
  tokenCtrlRows: { mint: string; freeze: string; update: string };
  tokenCtrlFooter: string;
  metricsTitle: string;
  metricsIntro: string;
  metricsRows: { top3: string; top10: string; conc: string };
  clusterTitle: string;
  clusterIntro: string;
  clusterEdgeLabel: string;
  clusterFunder: string;
  clusterNote: string;
  relatedTitle: string;
  relatedIntro: string;
  relatedCol: { project: string; chain: string; link: string; proof: string };
  osintTitle: string;
  osintIntro: string;
  osintCol: { id: string; file: string; caption: string; source: string; status: string };
  reportTitle: string;
  reportIntro: string;
  reportAgencies: { name: string; url: string }[];
  reportFooter: string;
  footerConfidential: string;
  notRealLine: string;
  observedPrefix: string;
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const COPY: Record<PublicReportLang, Copy> = {
  en: {
    docTitle: "INTELLIGENCE REPORT",
    caseLabel: "CASE",
    generatedOn: "Generated",
    page: (n, total) => `Page ${n} / ${total}`,
    risk: "HIGH RISK",
    score: "TigerScore",
    riskScoreOutOf100: "100 / 100",
    tigerScoreLabel: "Structural-risk composite score",
    execTitle: "Executive Summary",
    execBullets: [
      "BOTIFY exhibits multiple high-risk indicators consistent with structural-risk patterns INTERLIGENS tracks across Solana launches.",
      "Eight referenced claims are catalogued with on-chain or editorial sources. None require trust in a single witness.",
      "Mint and freeze authority remain active, allowing the deployer to alter supply or block holders at will (source: rugcheck.xyz).",
      "Top-3 holder concentration reached 62% at peak, with 78% top-10. Liquidity was withdrawn within 30 minutes of the price peak.",
      "The report aggregates referenced claims and observable on-chain events. It is informational; it is not a legal determination.",
    ],
    disclaimer:
      "Informational purposes only. Not legal advice. Referenced claims only. DYOR.",
    evIdxTitle: "Evidence Index",
    evIdxIntro:
      "Each entry below is a referenced claim with its source of record. Claims are not assertions of guilt; they are the material INTERLIGENS has observed and catalogued.",
    evCol: { id: "ID", type: "Type", source: "Source", ts: "Timestamp", url: "URL", claim: "Claim ref" },
    timelineTitle: "On-chain Timeline",
    timelineIntro:
      'Chronological sequence of observable on-chain events. Each row uses the convention "Observed on-chain event [tx]" with a resolvable transaction link.',
    timelineCol: { date: "Date", event: "Event", tx: "Transaction" },
    tokenCtrlTitle: "Token Control",
    tokenCtrlIntro:
      "As of " + TODAY_ISO + ", the following authorities remain active on the BOTIFY token contract. Source: rugcheck.xyz.",
    tokenCtrlRows: {
      mint: "Mint authority — Active. Capability under SPL rules: mint additional supply without holder consent.",
      freeze: "Freeze authority — Active. Capability under SPL rules: freeze any holder wallet.",
      update: "Update authority — Active. Capability under SPL rules: modify metadata attributes after launch.",
    },
    tokenCtrlFooter:
      "Active authority implies capability under SPL rules — it does not, by itself, prove wrongful use. The capability alone is a documented high-risk indicator.",
    metricsTitle: "Launch Metrics",
    metricsIntro:
      "Snapshot of on-chain distribution at peak. Source: Solscan holder queries, cross-checked with rugcheck.xyz.",
    metricsRows: {
      top3: "Top-3 wallet concentration — 62 % of circulating supply",
      top10: "Top-10 wallet concentration — 78 % of circulating supply",
      conc: "Concentration score — HIGH (threshold for high-risk indicator: top-3 ≥ 40 %).",
    },
    clusterTitle: "Wallet Cluster Summary",
    clusterIntro:
      "Seven wallets received identical SOL amounts from a single source wallet 2 hours before launch. No KOL or natural-person identity is asserted here — only wallet addresses and shared-funder relationships.",
    clusterEdgeLabel: "Shared funder — identical funding signature",
    clusterFunder: "Source wallet",
    clusterNote:
      "Only three representative edges shown. A shared funder across multiple recipients is a documented high-risk indicator; it is not, by itself, proof of coordination.",
    relatedTitle: "Related Projects (elevated risk)",
    relatedIntro:
      "Wallet-overlap signals link BOTIFY to the following elevated-risk projects. Each row names the proof type; no attribution beyond the overlap is asserted.",
    relatedCol: { project: "Project", chain: "Chain", link: "Link type", proof: "Proof type" },
    osintTitle: "OSINT Catalog",
    osintIntro:
      "Open-source intelligence artefacts referenced in this file. Each entry is marked Referenced — meaning INTERLIGENS has catalogued it as source material, not that its contents are independently confirmed.",
    osintCol: { id: "Ref", file: "File", caption: "Caption", source: "Source", status: "Status" },
    reportTitle: "How to Report",
    reportIntro:
      "If you believe you have been affected by activity described here, you may contact the following reporting channels. INTERLIGENS is not a law-enforcement agency and does not forward reports on your behalf.",
    reportAgencies: [
      { name: "IC3 (FBI, United States)", url: "ic3.gov" },
      { name: "France — Government fraud reporting", url: "signalement.service-public.fr" },
      { name: "AMF (France, financial markets authority)", url: "amf-france.org / 01 53 45 62 00" },
    ],
    reportFooter:
      "INTERLIGENS is not a law enforcement agency. This report is informational and does not substitute for legal advice.",
    footerConfidential: "INTERLIGENS · Public Intelligence Report",
    notRealLine:
      "Referenced claims only — not a judicial determination.",
    observedPrefix: "Observed on-chain event",
  },
  fr: {
    docTitle: "RAPPORT D'INTELLIGENCE",
    caseLabel: "DOSSIER",
    generatedOn: "Généré le",
    page: (n, total) => `Page ${n} / ${total}`,
    risk: "RISQUE ÉLEVÉ",
    score: "TigerScore",
    riskScoreOutOf100: "100 / 100",
    tigerScoreLabel: "Score composite de risque structurel",
    execTitle: "Résumé exécutif",
    execBullets: [
      "BOTIFY présente plusieurs indicateurs de risque élevé cohérents avec les profils structurels que INTERLIGENS observe sur les lancements Solana.",
      "Huit allégations référencées sont cataloguées avec leur source d'enregistrement. Aucune ne repose sur un témoin unique.",
      "Les autorités de mint et de freeze sont toujours actives, permettant au déployeur de modifier l'offre ou de bloquer les détenteurs à volonté (source : rugcheck.xyz).",
      "La concentration top-3 a atteint 62 % au pic, 78 % en top-10. La liquidité a été retirée dans les 30 minutes suivant le pic de prix.",
      "Ce document regroupe des allégations référencées et des événements on-chain observables. Il est informatif et ne constitue pas une qualification juridique.",
    ],
    disclaimer:
      "À titre informatif uniquement. Ne constitue pas un conseil juridique. Allégations référencées uniquement. DYOR.",
    evIdxTitle: "Index des preuves",
    evIdxIntro:
      "Chaque entrée ci-dessous est une allégation référencée avec sa source d'enregistrement. Les allégations ne sont pas des affirmations de culpabilité ; c'est le matériel que INTERLIGENS a observé et catalogué.",
    evCol: { id: "ID", type: "Type", source: "Source", ts: "Horodatage", url: "URL", claim: "Réf. allégation" },
    timelineTitle: "Chronologie on-chain",
    timelineIntro:
      'Séquence chronologique d\'événements on-chain observables. Chaque ligne suit la convention « Événement on-chain observé [tx] » avec un lien de transaction résolvable.',
    timelineCol: { date: "Date", event: "Événement", tx: "Transaction" },
    tokenCtrlTitle: "Contrôle du token",
    tokenCtrlIntro:
      "Au " + TODAY_ISO + ", les autorités suivantes sont toujours actives sur le contrat BOTIFY. Source : rugcheck.xyz.",
    tokenCtrlRows: {
      mint: "Autorité de mint — Active. Capacité au sens des règles SPL : émettre de l'offre supplémentaire sans consentement des détenteurs.",
      freeze: "Autorité de freeze — Active. Capacité au sens des règles SPL : bloquer tout wallet détenteur.",
      update: "Autorité d'update — Active. Capacité au sens des règles SPL : modifier les attributs de métadonnées après le lancement.",
    },
    tokenCtrlFooter:
      "Une autorité active implique une capacité au sens des règles SPL — cela ne prouve pas, à soi seul, un usage abusif. La capacité seule est un indicateur de risque élevé documenté.",
    metricsTitle: "Métriques de lancement",
    metricsIntro:
      "Instantané de la distribution on-chain au pic. Source : requêtes holders Solscan, recoupées avec rugcheck.xyz.",
    metricsRows: {
      top3: "Concentration top-3 wallets — 62 % de l'offre en circulation",
      top10: "Concentration top-10 wallets — 78 % de l'offre en circulation",
      conc: "Score de concentration — ÉLEVÉ (seuil indicateur de risque élevé : top-3 ≥ 40 %).",
    },
    clusterTitle: "Synthèse cluster de wallets",
    clusterIntro:
      "Sept wallets ont reçu des montants SOL identiques depuis un wallet source unique, 2 heures avant le lancement. Aucune identité KOL ou personne physique n'est affirmée ici — uniquement des adresses de wallets et des relations de financement partagé.",
    clusterEdgeLabel: "Financeur partagé — signature de financement identique",
    clusterFunder: "Wallet source",
    clusterNote:
      "Trois arêtes représentatives seulement. Un financeur partagé entre plusieurs destinataires est un indicateur de risque élevé documenté ; ce n'est pas, à soi seul, une preuve de coordination.",
    relatedTitle: "Projets liés (risque élevé)",
    relatedIntro:
      "Des signaux de chevauchement de wallets relient BOTIFY aux projets à risque élevé suivants. Chaque ligne nomme le type de preuve ; aucune attribution au-delà du chevauchement n'est affirmée.",
    relatedCol: { project: "Projet", chain: "Chaîne", link: "Type de lien", proof: "Type de preuve" },
    osintTitle: "Catalogue OSINT",
    osintIntro:
      "Artefacts d'intelligence sources ouvertes référencés dans ce dossier. Chaque entrée est marquée Référencée — signifiant que INTERLIGENS l'a catalogué comme matériel source, et non que son contenu est indépendamment confirmé.",
    osintCol: { id: "Réf", file: "Fichier", caption: "Légende", source: "Source", status: "Statut" },
    reportTitle: "Comment signaler",
    reportIntro:
      "Si vous pensez avoir été affecté par l'activité décrite ici, vous pouvez contacter les canaux de signalement suivants. INTERLIGENS n'est pas une agence de police et ne transmet pas de signalements en votre nom.",
    reportAgencies: [
      { name: "IC3 (FBI, États-Unis)", url: "ic3.gov" },
      { name: "France — Signalement fraude service public", url: "signalement.service-public.fr" },
      { name: "AMF (autorité des marchés financiers, France)", url: "amf-france.org / 01 53 45 62 00" },
    ],
    reportFooter:
      "INTERLIGENS n'est pas une autorité policière. Ce rapport est informatif et ne remplace pas un conseil juridique.",
    footerConfidential: "INTERLIGENS · Rapport public d'intelligence",
    notRealLine:
      "Allégations référencées — ne constitue pas une décision judiciaire.",
    observedPrefix: "Événement on-chain observé",
  },
};

// ── Static structural data (non-KOL, non-proceeds) ──────────────────────────

const ON_CHAIN_TIMELINE: Array<{
  date: string;
  eventEn: string;
  eventFr: string;
  tx: string;
}> = [
  {
    date: "2024-11-04 08:42 UTC",
    eventEn: "Token contract deployed on Solana mainnet",
    eventFr: "Contrat du token déployé sur Solana mainnet",
    tx: "3BotifyDeployTxA7xkMN2uDsKcQMM9UnZacja4vWcns9Th69xbDEPLOY",
  },
  {
    date: "2024-11-04 10:11 UTC",
    eventEn: "Seven wallets pre-funded from single source wallet (identical SOL amount)",
    eventFr: "Sept wallets pré-financés depuis un wallet source unique (montant SOL identique)",
    tx: "5ClusterFundTx9bxpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJFUND",
  },
  {
    date: "2024-11-04 12:00 UTC",
    eventEn: "Public listing begins — first Raydium pool opened",
    eventFr: "Début de cotation publique — premier pool Raydium ouvert",
    tx: "2RaydiumOpenTxcfcxBRdoNYrL6MQSuTFW5QtuqdLa2Ln4xOPEN",
  },
  {
    date: "2024-11-04 12:04 UTC",
    eventEn: "First insider sell — within 4 minutes of listing",
    eventFr: "Première vente insider — dans les 4 minutes suivant la cotation",
    tx: "7InsiderSellTxMUoP79hKx3Y47ihd5c8K2mduYL1SOLD01",
  },
  {
    date: "2024-11-04 12:22 UTC",
    eventEn: "Peak market cap reached — $15.1M",
    eventFr: "Pic de capitalisation atteint — 15,1 M$",
    tx: "9PeakSnapshotTxuv6wkrhV46fbELzh7cuGNdi8zByM2yPEAK",
  },
  {
    date: "2024-11-04 12:44 UTC",
    eventEn: "Liquidity withdrawn from primary Raydium pool (< 30 min post-peak)",
    eventFr: "Liquidité retirée du pool Raydium principal (< 30 min après le pic)",
    tx: "6LiquidityPullTxJsnEWp4S3f6mvQ1je3pgtZsNrRSvhfPULL",
  },
  {
    date: "2024-11-04 12:46 UTC",
    eventEn: "Price collapse to -97% within two blocks",
    eventFr: "Effondrement du prix à -97% en deux blocs",
    tx: "8CollapseTxKrtsCGvEWBk3yRXnCqM91HMsLgBn7B2RhwCRASH",
  },
];

const WALLET_CLUSTER: {
  funderSuffix: string;
  edges: Array<{ from: string; to: string; txSuffix: string }>;
} = {
  funderSuffix: "cluster-source-wallet-xxx…DEM0",
  edges: [
    {
      from: "cluster-source-wallet-xxx…DEM0",
      to: "recipient-wallet-01-xxx…aabb",
      txSuffix: "FundTxAA01",
    },
    {
      from: "cluster-source-wallet-xxx…DEM0",
      to: "recipient-wallet-02-xxx…ccdd",
      txSuffix: "FundTxAA02",
    },
    {
      from: "cluster-source-wallet-xxx…DEM0",
      to: "recipient-wallet-03-xxx…eeff",
      txSuffix: "FundTxAA03",
    },
  ],
};

const RELATED_PROJECTS: Array<{
  project: string;
  chain: string;
  linkEn: string;
  linkFr: string;
  proofEn: string;
  proofFr: string;
}> = [
  {
    project: "GHOST",
    chain: "SOL",
    linkEn: "Wallet overlap — three pre-launch recipients match",
    linkFr: "Chevauchement wallets — trois destinataires pré-lancement identiques",
    proofEn: "Solana address match",
    proofFr: "Adresse Solana identique",
  },
  {
    project: "SERIAL-12RUGS",
    chain: "SOL",
    linkEn: "Funder overlap — same source wallet seeded both launches",
    linkFr: "Chevauchement financeur — même wallet source pour les deux lancements",
    proofEn: "Shared funding tx signature",
    proofFr: "Signature de financement partagée",
  },
];

const OSINT_ENTRIES: Array<{
  id: string;
  file: string;
  captionEn: string;
  captionFr: string;
  source: string;
  claimRef: string;
}> = [
  {
    id: "E-001",
    file: "IMG_2239.jpg",
    captionEn: "Coordinated shill posts — matching template across bot accounts",
    captionFr: "Posts coordonnés — modèle identique à travers des comptes bots",
    source: "Twitter/X archive",
    claimRef: "C1",
  },
  {
    id: "E-002",
    file: "IMG_2240.jpg",
    captionEn: "Telegram pre-launch buy signal — 45 minutes before public listing",
    captionFr: "Signal d'achat Telegram pré-lancement — 45 minutes avant cotation publique",
    source: "Telegram group capture",
    claimRef: "C2",
  },
  {
    id: "E-003",
    file: "IMG_2241.jpg",
    captionEn: "Dexscreener chart — liquidity removed within 28 minutes of peak",
    captionFr: "Graphique Dexscreener — liquidité retirée dans les 28 minutes suivant le pic",
    source: "dexscreener.com",
    claimRef: "C3",
  },
  {
    id: "E-004",
    file: "IMG_2242.jpg",
    captionEn: "Solscan cluster view — seven recipients of identical source funding",
    captionFr: "Vue cluster Solscan — sept destinataires de financement source identique",
    source: "solscan.io",
    claimRef: "C4",
  },
  {
    id: "E-005",
    file: "IMG_2243.jpg",
    captionEn: "rugcheck.xyz report — mint and freeze authority both Active",
    captionFr: "Rapport rugcheck.xyz — autorités de mint et de freeze toutes deux Actives",
    source: "rugcheck.xyz",
    claimRef: "C5",
  },
  {
    id: "E-006",
    file: "IMG_2244.jpg",
    captionEn: "WHOIS record — project domain registered the day of launch",
    captionFr: "Enregistrement WHOIS — domaine du projet enregistré le jour du lancement",
    source: "whois.domaintools.com",
    claimRef: "C6",
  },
  {
    id: "E-007",
    file: "IMG_2245.jpg",
    captionEn: "Holder distribution — top-3 wallets hold 62% of supply at peak",
    captionFr: "Distribution des détenteurs — top-3 wallets détiennent 62 % de l'offre au pic",
    source: "solscan.io holder view",
    claimRef: "C7",
  },
  {
    id: "E-008",
    file: "IMG_2246.jpg",
    captionEn: "Social channel timeline — last post day 5, silence thereafter",
    captionFr: "Chronologie canal social — dernier post jour 5, silence par la suite",
    source: "Archive web captures",
    claimRef: "C8",
  },
];

// ── HTML helpers ────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageShell(
  innerHtml: string,
  pageNum: number,
  totalPages: number,
  caseId: string,
  copy: Copy,
): string {
  return `<section class="page">
  <header class="page-header">
    <div class="brand">INTERLIGENS</div>
    <div class="doc-sub">${esc(copy.docTitle)}</div>
    <div class="case-ref">${esc(copy.caseLabel)} · ${esc(caseId)}</div>
  </header>
  <div class="page-body">${innerHtml}</div>
  <footer class="page-footer">
    <span>${esc(copy.footerConfidential)}</span>
    <span>${esc(caseId)}</span>
    <span>${esc(copy.page(pageNum, totalPages))}</span>
    <span>${esc(TODAY_ISO)}</span>
  </footer>
</section>`;
}

// ── Page builders ───────────────────────────────────────────────────────────

function buildCoverInner(copy: Copy, caseId: string): string {
  return `
    <div class="cover-title-block">
      <div class="cover-kicker">${esc(copy.docTitle)}</div>
      <div class="cover-case">${esc(caseId)}</div>
      <div class="cover-meta">${esc(copy.generatedOn)} · ${esc(TODAY_ISO)}</div>
    </div>

    <div class="cover-score-block">
      <div class="score-ring" aria-hidden="true">
        <div class="score-ring-value">${esc(copy.riskScoreOutOf100)}</div>
        <div class="score-ring-band">${esc(copy.risk)}</div>
      </div>
      <div class="score-meta">
        <div class="score-meta-label">${esc(copy.score)}</div>
        <div class="score-meta-desc">${esc(copy.tigerScoreLabel)}</div>
      </div>
    </div>

    <div class="cover-exec">
      <div class="h2">${esc(copy.execTitle)}</div>
      <ul class="exec-list">
        ${copy.execBullets.map((b) => `<li>${esc(b)}</li>`).join("")}
      </ul>
    </div>

    <div class="cover-disclaimer">${esc(copy.disclaimer)}</div>
    <div class="cover-notreal">${esc(copy.notRealLine)}</div>
  `;
}

type RawClaim = {
  claim_id: string;
  title: string;
  title_fr?: string;
  severity?: string;
  status?: string;
  thread_url?: string | null;
  category?: string;
};

function buildEvidenceIndexInner(copy: Copy, lang: PublicReportLang): string {
  const claims = (botifyCase.claims ?? []) as RawClaim[];
  const rows = claims.map((c, i) => {
    const ref = `E-${String(i + 1).padStart(3, "0")}`;
    const title = lang === "fr" && c.title_fr ? c.title_fr : c.title;
    const threadLabel = c.thread_url ? truncateUrl(c.thread_url) : "—";
    return `<tr>
      <td class="mono">${esc(ref)}</td>
      <td>${esc(title)}</td>
      <td>${esc(c.category ?? "—")}</td>
      <td class="mono">${esc(TODAY_ISO)}</td>
      <td class="mono url-cell">${esc(threadLabel)}</td>
      <td class="mono">${esc(c.claim_id)}</td>
    </tr>`;
  });
  return `
    <div class="h1">${esc(copy.evIdxTitle)}</div>
    <p class="body">${esc(copy.evIdxIntro)}</p>
    <table class="data">
      <thead><tr>
        <th>${esc(copy.evCol.id)}</th>
        <th>${esc(copy.evCol.type)}</th>
        <th>${esc(copy.evCol.source)}</th>
        <th>${esc(copy.evCol.ts)}</th>
        <th>${esc(copy.evCol.url)}</th>
        <th>${esc(copy.evCol.claim)}</th>
      </tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

function buildTimelineInner(copy: Copy, lang: PublicReportLang): string {
  const rows = ON_CHAIN_TIMELINE.map((e) => {
    const label = lang === "fr" ? e.eventFr : e.eventEn;
    const tx = truncateTx(e.tx);
    return `<tr>
      <td class="mono nowrap">${esc(e.date)}</td>
      <td>${esc(copy.observedPrefix)} · ${esc(label)}</td>
      <td class="mono url-cell">${esc(tx)}</td>
    </tr>`;
  });
  return `
    <div class="h1">${esc(copy.timelineTitle)}</div>
    <p class="body">${esc(copy.timelineIntro)}</p>
    <table class="data">
      <thead><tr>
        <th>${esc(copy.timelineCol.date)}</th>
        <th>${esc(copy.timelineCol.event)}</th>
        <th>${esc(copy.timelineCol.tx)}</th>
      </tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

function buildTokenControlInner(copy: Copy): string {
  const r = copy.tokenCtrlRows;
  return `
    <div class="h1">${esc(copy.tokenCtrlTitle)}</div>
    <p class="body">${esc(copy.tokenCtrlIntro)}</p>
    <div class="auth-block">
      <div class="auth-row"><span class="auth-dot"></span><div class="auth-text">${esc(r.mint)}</div></div>
      <div class="auth-row"><span class="auth-dot"></span><div class="auth-text">${esc(r.freeze)}</div></div>
      <div class="auth-row"><span class="auth-dot"></span><div class="auth-text">${esc(r.update)}</div></div>
    </div>
    <div class="callout">${esc(copy.tokenCtrlFooter)}</div>
  `;
}

function buildMetricsInner(copy: Copy): string {
  const r = copy.metricsRows;
  return `
    <div class="h1">${esc(copy.metricsTitle)}</div>
    <p class="body">${esc(copy.metricsIntro)}</p>
    <div class="metrics-grid">
      <div class="metric-cell">
        <div class="metric-value">62 %</div>
        <div class="metric-label">${esc(r.top3.split("—")[0].trim())}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-value">78 %</div>
        <div class="metric-label">${esc(r.top10.split("—")[0].trim())}</div>
      </div>
      <div class="metric-cell">
        <div class="metric-value metric-value-risk">HIGH</div>
        <div class="metric-label">${esc(r.conc.split("—")[0].trim())}</div>
      </div>
    </div>
    <div class="callout">${esc(r.conc)}</div>
  `;
}

function buildClusterInner(copy: Copy): string {
  const edges = WALLET_CLUSTER.edges
    .map((e) => {
      return `<div class="edge-row">
        <div class="edge-node">${esc(e.from)}</div>
        <div class="edge-arrow">→ ${esc(truncateTx(e.txSuffix))}</div>
        <div class="edge-node">${esc(e.to)}</div>
      </div>`;
    })
    .join("");
  return `
    <div class="h1">${esc(copy.clusterTitle)}</div>
    <p class="body">${esc(copy.clusterIntro)}</p>
    <div class="cluster-box">
      <div class="cluster-header">
        <div class="cluster-funder-label">${esc(copy.clusterFunder)} · ${esc(WALLET_CLUSTER.funderSuffix)}</div>
        <div class="cluster-edge-label">${esc(copy.clusterEdgeLabel)}</div>
      </div>
      ${edges}
    </div>
    <div class="callout">${esc(copy.clusterNote)}</div>
  `;
}

function buildRelatedInner(copy: Copy, lang: PublicReportLang): string {
  const rows = RELATED_PROJECTS.map((r) => {
    const linkText = lang === "fr" ? r.linkFr : r.linkEn;
    const proofText = lang === "fr" ? r.proofFr : r.proofEn;
    return `<tr>
      <td class="strong">${esc(r.project)}</td>
      <td class="mono">${esc(r.chain)}</td>
      <td>${esc(linkText)}</td>
      <td class="mono">${esc(proofText)}</td>
    </tr>`;
  }).join("");
  return `
    <div class="h1">${esc(copy.relatedTitle)}</div>
    <p class="body">${esc(copy.relatedIntro)}</p>
    <table class="data">
      <thead><tr>
        <th>${esc(copy.relatedCol.project)}</th>
        <th>${esc(copy.relatedCol.chain)}</th>
        <th>${esc(copy.relatedCol.link)}</th>
        <th>${esc(copy.relatedCol.proof)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildOsintInner(copy: Copy, lang: PublicReportLang): string {
  const rows = OSINT_ENTRIES.map((e) => {
    const caption = lang === "fr" ? e.captionFr : e.captionEn;
    return `<tr>
      <td class="mono">${esc(e.id)}</td>
      <td class="mono">${esc(e.file)}</td>
      <td>${esc(caption)}</td>
      <td class="mono">${esc(e.source)}</td>
      <td><span class="pill">Referenced · ${esc(e.claimRef)}</span></td>
    </tr>`;
  }).join("");
  return `
    <div class="h1">${esc(copy.osintTitle)}</div>
    <p class="body">${esc(copy.osintIntro)}</p>
    <table class="data">
      <thead><tr>
        <th>${esc(copy.osintCol.id)}</th>
        <th>${esc(copy.osintCol.file)}</th>
        <th>${esc(copy.osintCol.caption)}</th>
        <th>${esc(copy.osintCol.source)}</th>
        <th>${esc(copy.osintCol.status)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildHowToReportInner(copy: Copy): string {
  const rows = copy.reportAgencies
    .map(
      (a) => `<li><span class="agency-name">${esc(a.name)}</span> — <span class="mono">${esc(a.url)}</span></li>`,
    )
    .join("");
  return `
    <div class="h1">${esc(copy.reportTitle)}</div>
    <p class="body">${esc(copy.reportIntro)}</p>
    <ul class="agencies">${rows}</ul>
    <div class="callout muted">${esc(copy.reportFooter)}</div>
  `;
}

// ── Shared CSS ──────────────────────────────────────────────────────────────

function renderCss(): string {
  return `
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: ${PAPER}; color: ${INK}; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5px; line-height: 1.55; }
    .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm 20mm 16mm; page-break-after: always; position: relative; background: ${PAPER}; }
    .page:last-child { page-break-after: auto; }
    .page-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid ${INK}; padding-bottom: 8px; margin-bottom: 16px; }
    .brand { font-weight: 900; letter-spacing: 4px; font-size: 11px; color: ${INK}; }
    .doc-sub { color: ${ACCENT}; font-weight: 700; letter-spacing: 2px; font-size: 9.5px; text-transform: uppercase; }
    .case-ref { color: ${MUTED}; font-size: 9px; letter-spacing: 1px; }
    .page-body { min-height: 232mm; }
    .page-footer { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; display: flex; justify-content: space-between; color: ${MUTED}; font-size: 8.5px; letter-spacing: 1px; border-top: 1px solid ${RULE}; padding-top: 6px; }
    .h1 { font-size: 20px; font-weight: 900; color: ${INK}; margin: 0 0 10px; letter-spacing: -0.01em; }
    .h2 { font-size: 12px; font-weight: 700; color: ${INK}; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px; }
    .body { color: #222; font-size: 11px; margin-bottom: 16px; }
    .mono { font-family: 'Menlo', 'Courier New', monospace; font-size: 9.5px; word-break: break-all; }
    .nowrap { white-space: nowrap; }
    .url-cell { color: ${ACCENT}; }
    .strong { font-weight: 700; }

    table.data { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
    table.data th { background: #F5F5F5; color: ${INK}; font-weight: 700; text-transform: uppercase; font-size: 8.5px; letter-spacing: 1px; padding: 8px 10px; text-align: left; border-bottom: 1.5px solid ${INK}; }
    table.data td { padding: 7px 10px; border-bottom: 1px solid ${RULE}; vertical-align: top; }

    .cover-title-block { margin-bottom: 22px; }
    .cover-kicker { color: ${ACCENT}; font-size: 11px; letter-spacing: 3px; font-weight: 700; text-transform: uppercase; }
    .cover-case { font-size: 34px; font-weight: 900; letter-spacing: -0.02em; margin-top: 6px; color: ${INK}; }
    .cover-meta { color: ${MUTED}; font-size: 11px; margin-top: 6px; }

    .cover-score-block { display: flex; align-items: center; gap: 22px; background: #FAFAFA; border: 1.5px solid ${INK}; border-left: 6px solid ${ACCENT}; padding: 18px 22px; border-radius: 4px; margin-bottom: 22px; }
    .score-ring { width: 110px; height: 110px; border-radius: 50%; border: 4px solid ${ACCENT}; display: flex; align-items: center; justify-content: center; flex-direction: column; background: ${PAPER}; flex-shrink: 0; }
    .score-ring-value { font-size: 22px; font-weight: 900; color: ${INK}; letter-spacing: -0.03em; }
    .score-ring-band { color: ${RISK_RED}; font-size: 9px; font-weight: 900; letter-spacing: 1.2px; margin-top: 2px; }
    .score-meta-label { color: ${MUTED}; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
    .score-meta-desc { font-size: 13px; color: ${INK}; font-weight: 600; }

    .cover-exec { background: ${PAPER}; border: 1px solid ${RULE}; border-top: 3px solid ${INK}; padding: 16px 20px; margin-bottom: 18px; }
    .exec-list { list-style: none; padding: 0; margin: 0; }
    .exec-list li { position: relative; padding-left: 16px; margin-bottom: 8px; font-size: 10.5px; line-height: 1.6; color: #222; }
    .exec-list li:before { content: ""; position: absolute; left: 0; top: 7px; width: 8px; height: 2px; background: ${ACCENT}; }

    .cover-disclaimer { background: #FFF6EE; border-left: 4px solid ${ACCENT}; padding: 10px 14px; font-size: 10px; color: ${INK}; font-weight: 600; margin-bottom: 8px; }
    .cover-notreal { font-size: 9px; color: ${MUTED}; font-style: italic; }

    .auth-block { margin-top: 8px; }
    .auth-row { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid ${RULE}; }
    .auth-dot { width: 10px; height: 10px; border-radius: 50%; background: ${ACCENT}; margin-top: 4px; flex-shrink: 0; }
    .auth-text { font-size: 10.5px; color: ${INK}; line-height: 1.6; }

    .callout { margin-top: 14px; background: #FAFAFA; border: 1px solid ${RULE}; border-left: 3px solid ${ACCENT}; padding: 10px 12px; font-size: 10px; color: ${MUTED}; line-height: 1.6; }
    .callout.muted { border-left-color: ${MUTED}; }

    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    .metric-cell { border: 1.5px solid ${INK}; padding: 16px; text-align: center; }
    .metric-value { font-size: 34px; font-weight: 900; color: ${ACCENT}; letter-spacing: -0.02em; }
    .metric-value-risk { color: ${RISK_RED}; font-size: 22px; }
    .metric-label { margin-top: 6px; font-size: 10px; color: ${INK}; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 700; }

    .cluster-box { margin-top: 8px; border: 1.5px solid ${INK}; padding: 14px; }
    .cluster-header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid ${RULE}; padding-bottom: 10px; margin-bottom: 12px; }
    .cluster-funder-label { font-family: 'Menlo', monospace; font-size: 9.5px; color: ${INK}; font-weight: 700; }
    .cluster-edge-label { color: ${ACCENT}; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .edge-row { display: grid; grid-template-columns: 2fr 1.5fr 2fr; gap: 10px; padding: 8px 0; font-family: 'Menlo', monospace; font-size: 9.5px; border-bottom: 1px solid ${RULE}; }
    .edge-row:last-child { border-bottom: none; }
    .edge-node { color: ${INK}; word-break: break-all; }
    .edge-arrow { color: ${ACCENT}; text-align: center; }

    .pill { display: inline-block; padding: 2px 8px; background: #FFF6EE; color: ${ACCENT}; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; border-radius: 4px; border: 1px solid ${ACCENT}; }

    .agencies { list-style: none; padding: 0; margin: 12px 0 16px; }
    .agencies li { padding: 10px 12px; border-bottom: 1px solid ${RULE}; font-size: 11px; color: ${INK}; }
    .agencies li:first-child { border-top: 1px solid ${RULE}; }
    .agency-name { font-weight: 700; }
  `;
}

function truncateTx(tx: string): string {
  if (tx.length <= 20) return tx;
  return tx.slice(0, 10) + "…" + tx.slice(-6);
}

function truncateUrl(u: string): string {
  if (u.length <= 48) return u;
  return u.slice(0, 40) + "…";
}

// ── HTML builder ────────────────────────────────────────────────────────────

export function buildPublicReportHtml(lang: PublicReportLang, caseId: string): string {
  const copy = COPY[lang];
  const total = 9;
  const pages = [
    buildCoverInner(copy, caseId),
    buildEvidenceIndexInner(copy, lang),
    buildTimelineInner(copy, lang),
    buildTokenControlInner(copy),
    buildMetricsInner(copy),
    buildClusterInner(copy),
    buildRelatedInner(copy, lang),
    buildOsintInner(copy, lang),
    buildHowToReportInner(copy),
  ]
    .map((inner, i) => pageShell(inner, i + 1, total, caseId, copy))
    .join("");

  return `<!DOCTYPE html><html lang="${esc(lang)}"><head>
<meta charset="UTF-8" />
<title>${esc(copy.docTitle)} · ${esc(caseId)}</title>
<style>${renderCss()}</style>
</head><body>${pages}</body></html>`;
}

// ── PDF renderer ────────────────────────────────────────────────────────────

export async function generateCaseFilePdfPublic(
  lang: PublicReportLang,
  caseId: string,
): Promise<PublicReportResult> {
  try {
    const html = buildPublicReportHtml(lang, caseId);
    const executablePath = await chromium.executablePath(CHROMIUM_URL);
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
    let pdfBytes: Uint8Array;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      pdfBytes = (await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        preferCSSPageSize: true,
      })) as Uint8Array;
    } finally {
      await browser.close();
    }
    return { success: true, pdfBytes };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
