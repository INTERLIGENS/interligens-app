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
//   OBLIGATORY: "high-risk indicators", "referenced claims".
//   RETIRÉ:     « Observed on-chain event [tx] » — cette convention exigeait
//               une signature résolvable ; les sept qui la soutenaient étaient
//               fabriquées. Voir le bloc CONTAINMENT plus bas.
//
// Exclusions (by design):
//   - No KOL names anywhere in the rendered PDF.
//   - No proceeds figures, no CEX-specific requisitions.
//   - No unverified victim testimony.
//
// ── BUILD 9 / ÉTAPE 5 — l'autorité de ce rendu ──────────────────────────────
//
// Data source (AVANT) : data/cases/botify.json — un JSON legacy, lu ici même.
// Data source (MAINTENANT) : la `PublicProjection`, passée par l'appelant.
//
// Ce fichier ne lit plus AUCUNE autorité de dossier. Il reçoit ce qui est
// publiable, déjà projeté, et il le rend. La différence n'est pas cosmétique :
// tant que le générateur allait chercher son propre JSON, la route pouvait
// bien parler d'autorité canonique, le PDF servait autre chose.
//
// Restent deux sections FACTUELLES STATIQUES — contrôle du token et métriques
// de lancement — qui ne proviennent d'aucune autorité canonique mais citent
// une source nommée (rugcheck.xyz, requêtes holders Solscan). Elles
// documentent BOTIFY et RIEN D'AUTRE : le gabarit refuse de se rendre sous
// l'en-tête d'un autre dossier plutôt que de lui attribuer ce matériel.
//
// Trois autres — chronologie, cluster, projets liés — sont RETIRÉES de la
// publication : elles reposaient sur des signatures fabriquées. Voir le bloc
// CONTAINMENT.

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import {
  BOTIFY_CASEFILE_REF,
  type PublicProjection,
  type RenderedClaim,
  type WithheldNotice,
} from "./publicProjection";
import type { ExclusionReason } from "./publicationState";

const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

const ACCENT = "#FF6B00";
const INK = "#000000";
const PAPER = "#FFFFFF";
const RULE = "#E5E5E5";
const MUTED = "#666666";
const RISK_RED = "#C81E1E";

// ─── BUILD 9 — LES FAITS STATIQUES SONT DES DONNÉES, PAS DU RENDERER ───────
//
// ██  Le renderer ne connaît AUCUN dossier. Il rend celui qu'on lui donne.  ██
//
// Ces sections — contrôle du token, métriques de lancement — ne proviennent
// d'aucune structure canonique : aucune table n'a été ratifiée pour elles.
// Elles reposent sur une SOURCE NOMMÉE (rugcheck.xyz, requêtes holders
// Solscan), et c'est ce qui les rend publiables.
//
// Elles étaient écrites en dur dans la copy, avec « BOTIFY » dans la phrase.
// Le gabarit refusait donc de se rendre pour tout autre dossier — c'était le
// bon réflexe, et la mauvaise mécanique : il rendait le renderer inutilisable
// pour VINE, qui est l'une des deux fixtures obligatoires du gate BUILD 9.
//
// Elles sont désormais INDEXÉES PAR DOSSIER. Un dossier sans entrée n'est pas
// refusé : ses sections rendent un retrait structuré. C'est la différence
// entre « je ne sais pas rendre ce dossier » et « ce dossier ne porte pas ces
// faits » — et seule la seconde est vraie.
//
// AJOUTER UNE ENTRÉE ICI EST UNE DÉCISION DE PUBLICATION. Elle exige des faits
// démontrés et une source nommée. Ne jamais recopier l'entrée d'un dossier
// vers un autre : ce serait lui attribuer un matériel qu'il ne porte pas.

interface FactSection {
  /** La source nommée. Sans elle, la section n'est pas publiable. */
  readonly source: string;
  readonly rowsEn: readonly string[];
  readonly rowsFr: readonly string[];
}

interface DossierFacts {
  readonly tokenControl?: FactSection;
  readonly launchMetrics?: FactSection;
  /** Points de résumé adossés à ces faits. Jamais transposables. */
  readonly execEn?: readonly string[];
  readonly execFr?: readonly string[];
}

const FACTS_BY_REF: Record<string, DossierFacts> = {
  [BOTIFY_CASEFILE_REF]: {
    tokenControl: {
      source: "rugcheck.xyz",
      rowsEn: [
        "Mint authority — Active. Capability under SPL rules: mint additional supply without holder consent.",
        "Freeze authority — Active. Capability under SPL rules: freeze any holder wallet.",
        "Update authority — Active. Capability under SPL rules: modify metadata attributes after launch.",
      ],
      rowsFr: [
        "Autorité de mint — Active. Capacité au sens des règles SPL : émettre de l'offre supplémentaire sans consentement des détenteurs.",
        "Autorité de freeze — Active. Capacité au sens des règles SPL : bloquer tout wallet détenteur.",
        "Autorité d'update — Active. Capacité au sens des règles SPL : modifier les attributs de métadonnées après le lancement.",
      ],
    },
    launchMetrics: {
      source: "Solscan holder queries",
      rowsEn: [
        "Top-3 wallet concentration — 62 % of circulating supply",
        "Top-10 wallet concentration — 78 % of circulating supply",
        "Concentration score — HIGH (threshold for high-risk indicator: top-3 >= 40 %).",
      ],
      rowsFr: [
        "Concentration top-3 wallets — 62 % de l'offre en circulation",
        "Concentration top-10 wallets — 78 % de l'offre en circulation",
        "Score de concentration — ÉLEVÉ (seuil indicateur de risque élevé : top-3 >= 40 %).",
      ],
    },
    execEn: [
      "BOTIFY exhibits multiple high-risk indicators consistent with structural-risk patterns INTERLIGENS tracks across Solana launches.",
      "Mint and freeze authority remain active, allowing the deployer to alter supply or block holders at will (source: rugcheck.xyz).",
      "Top-3 holder concentration reached 62% at peak, with 78% top-10 (source: Solscan holder queries).",
    ],
    execFr: [
      "BOTIFY présente plusieurs indicateurs de risque élevé cohérents avec les profils structurels que INTERLIGENS observe sur les lancements Solana.",
      "Les autorités de mint et de freeze sont toujours actives, permettant au déployeur de modifier l'offre ou de bloquer les détenteurs à volonté (source : rugcheck.xyz).",
      "La concentration top-3 a atteint 62 % au pic, 78 % en top-10 (source : requêtes holders Solscan).",
    ],
  },
};

const factsFor = (ref: string): DossierFacts => FACTS_BY_REF[ref] ?? {};


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
  /** Ce qu'on écrit quand le score n'est PAS établi. Jamais « 0 », jamais « /100 ». */
  scoreUnset: string;
  tigerScoreLabel: string;
  execTitle: string;
  execTail: string;
  /** Le décompte des claims publiés vient de la projection, jamais d'une constante. */
  execClaimsBullet: (n: number) => string;
  disclaimer: string;
  evIdxTitle: string;
  evIdxIntro: string;
  evIdxEmpty: string;
  evCol: { id: string; type: string; source: string; ts: string; url: string; claim: string };
  unresolvedLabel: string;
  withheldLabel: string;
  withheldTitle: string;
  withheldIntro: string;
  withheldCol: { reason: string; field: string; count: string };
  withheldReason: Record<ExclusionReason, string>;
  timelineTitle: string;
  /** Rendu à la place d'une section dont les pièces ont été retirées. */
  sectionWithheldIntro: string;
  tokenCtrlTitle: string;
  tokenCtrlIntro: (source: string) => string;
  tokenCtrlFooter: string;
  metricsTitle: string;
  metricsIntro: (source: string) => string;
  clusterTitle: string;
  relatedTitle: string;
  osintTitle: string;
  osintIntro: string;
  osintCol: {
    id: string; type: string; caption: string;
    source: string; captured: string; integrity: string;
  };
  osintEmpty: string;
  reportTitle: string;
  reportIntro: string;
  reportAgencies: { name: string; url: string }[];
  reportFooter: string;
  footerConfidential: string;
  notRealLine: string;
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
    scoreUnset: "Not established",
    tigerScoreLabel: "Structural-risk composite score",
    execTitle: "Executive Summary",
    execClaimsBullet: (n) =>
      n === 0
        ? "No referenced claim in this file currently meets the publication requirements. The material remains attached to the file; nothing here is asserted to be false."
        : `${n} referenced claim${n > 1 ? "s are" : " is"} catalogued with its source of record. None require trust in a single witness.`,
    execTail: "The report aggregates referenced claims. It is informational; it is not a legal determination.",
    disclaimer:
      "Informational purposes only. Not legal advice. Referenced claims only. DYOR.",
    evIdxTitle: "Evidence Index",
    evIdxIntro:
      "Each entry below is a referenced claim with its source of record. Claims are not assertions of guilt; they are the material INTERLIGENS has observed and catalogued.",
    evIdxEmpty:
      "No claim in this file currently meets the publication requirements. The material remains attached to the file. Absence of provenance is not a finding of falsity, and no further conclusion is drawn from it.",
    evCol: { id: "ID", type: "Type", source: "Source", ts: "Timestamp", url: "URL", claim: "Claim ref" },
    unresolvedLabel: "Unresolved reference",
    withheldLabel: "Withheld piece",
    withheldTitle: "Withheld from publication",
    withheldIntro:
      "Material attached to this file that is not published. Each line names the field that governs the decision — never its content. Absence of provenance is not a finding of falsity.",
    withheldCol: { reason: "Reason", field: "Field", count: "Items" },
    withheldReason: {
      EXCLUDED_FROM_PUBLICATION: "Excluded from publication",
      INSUFFICIENT_PROVENANCE: "Insufficient provenance",
    },
    timelineTitle: "On-chain Timeline",
    sectionWithheldIntro:
      "This section is withheld from publication. The material it relied on does not meet the provenance requirements, and no substitute has been introduced. Absence of provenance is not a finding of falsity.",
    tokenCtrlTitle: "Token Control",
    // BUILD 9 / ÉTAPE 5 — la date de GÉNÉRATION ne datait pas cette
    // observation, elle la maquillait. Rien n'a été constaté le jour de
    // l'export ; la phrase le dit désormais sans horodatage inventé.
    tokenCtrlIntro: (source) =>
      `The following authorities are reported active on this token contract. Source: ${source}.`,
    tokenCtrlFooter:
      "Active authority implies capability under SPL rules — it does not, by itself, prove wrongful use. The capability alone is a documented high-risk indicator.",
    metricsTitle: "Launch Metrics",
    metricsIntro: (source) =>
      `Snapshot of on-chain distribution at peak. Source: ${source}.`,
    clusterTitle: "Wallet Cluster Summary",
    relatedTitle: "Related Projects (elevated risk)",
    osintTitle: "OSINT Catalog",
    osintIntro:
      "Open-source intelligence artefacts referenced in this file. Each entry is catalogued as source material; that is not a statement that its contents are independently confirmed.",
    osintCol: {
      id: "Ref", type: "Type", caption: "Caption",
      source: "Origin", captured: "Captured", integrity: "Integrity",
    },
    osintEmpty:
      "No catalogued artefact currently carries the integrity, origin and capture timestamp required for publication. The artefacts remain attached to the file.",
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
  },
  fr: {
    docTitle: "RAPPORT D'INTELLIGENCE",
    caseLabel: "DOSSIER",
    generatedOn: "Généré le",
    page: (n, total) => `Page ${n} / ${total}`,
    risk: "RISQUE ÉLEVÉ",
    score: "TigerScore",
    scoreUnset: "Non établi",
    tigerScoreLabel: "Score composite de risque structurel",
    execTitle: "Résumé exécutif",
    execClaimsBullet: (n) =>
      n === 0
        ? "Aucune allégation référencée de ce dossier ne satisfait à ce jour les conditions de publication. Le matériel reste rattaché au dossier ; rien ici n'est affirmé faux."
        : `${n} allégation${n > 1 ? "s" : ""} référencée${n > 1 ? "s sont cataloguées" : " est cataloguée"} avec sa source d'enregistrement. Aucune ne repose sur un témoin unique.`,
    execTail: "Ce document regroupe des allégations référencées. Il est informatif et ne constitue pas une qualification juridique.",
    disclaimer:
      "À titre informatif uniquement. Ne constitue pas un conseil juridique. Allégations référencées uniquement. DYOR.",
    evIdxTitle: "Index des preuves",
    evIdxIntro:
      "Chaque entrée ci-dessous est une allégation référencée avec sa source d'enregistrement. Les allégations ne sont pas des affirmations de culpabilité ; c'est le matériel que INTERLIGENS a observé et catalogué.",
    evIdxEmpty:
      "Aucune allégation de ce dossier ne satisfait à ce jour les conditions de publication. Le matériel reste rattaché au dossier. Une provenance absente n'est pas une preuve de fausseté, et aucune conclusion supplémentaire n'en est tirée.",
    evCol: { id: "ID", type: "Type", source: "Source", ts: "Horodatage", url: "URL", claim: "Réf. allégation" },
    unresolvedLabel: "Référence non résolue",
    withheldLabel: "Pièce retenue",
    withheldTitle: "Retenu hors publication",
    withheldIntro:
      "Matériel rattaché à ce dossier et non publié. Chaque ligne nomme le CHAMP qui commande la décision — jamais son contenu. Une provenance absente n'est pas une preuve de fausseté.",
    withheldCol: { reason: "Motif", field: "Champ", count: "Éléments" },
    withheldReason: {
      EXCLUDED_FROM_PUBLICATION: "Exclu de la publication",
      INSUFFICIENT_PROVENANCE: "Provenance insuffisante",
    },
    timelineTitle: "Chronologie on-chain",
    sectionWithheldIntro:
      "Cette section est retirée de la publication. Le matériel sur lequel elle reposait ne satisfait pas les exigences de provenance, et aucune pièce de substitution n'a été introduite. Une provenance absente n'est pas une preuve de fausseté.",
    tokenCtrlTitle: "Contrôle du token",
    // Voir la note côté `en` : la date de génération ne datait pas cette
    // observation, elle la maquillait.
    tokenCtrlIntro: (source) =>
      `Les autorités suivantes sont rapportées actives sur ce contrat de token. Source : ${source}.`,
    tokenCtrlFooter:
      "Une autorité active implique une capacité au sens des règles SPL — cela ne prouve pas, à soi seul, un usage abusif. La capacité seule est un indicateur de risque élevé documenté.",
    metricsTitle: "Métriques de lancement",
    metricsIntro: (source) =>
      `Instantané de la distribution on-chain au pic. Source : ${source}.`,
    clusterTitle: "Synthèse cluster de wallets",
    relatedTitle: "Projets liés (risque élevé)",
    osintTitle: "Catalogue OSINT",
    osintIntro:
      "Artefacts d'intelligence sources ouvertes référencés dans ce dossier. Chaque entrée est cataloguée comme matériel source ; ce n'est pas une affirmation que son contenu est indépendamment confirmé.",
    osintCol: {
      id: "Réf", type: "Type", caption: "Légende",
      source: "Origine", captured: "Capture", integrity: "Intégrité",
    },
    osintEmpty:
      "Aucun artefact catalogué ne porte à ce jour l'empreinte, l'origine et l'horodatage de capture exigés pour une publication. Les artefacts restent rattachés au dossier.",
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
  },
};

// ── Static structural data (non-KOL, non-proceeds) ──────────────────────────

// ── BUILD 9 · CONTAINMENT — LES PIECES FABRIQUEES SONT PARTIES ──────────
//
// Trois constantes vivaient ici : ON_CHAIN_TIMELINE (7 signatures de
// transaction), WALLET_CLUSTER (1 financeur + 3 aretes + 3 destinataires) et
// RELATED_PROJECTS (dont la colonne « preuve » citait ces memes signatures).
//
// Elles n'etaient pas « non verifiees » : elles etaient IMPOSSIBLES. Mesure
// du 2026-09-07 — 47 a 57 caracteres la ou une signature Solana en fait 87 a
// 88, et six des sept portaient des caracteres HORS alphabet base58 (0, I,
// O, l). Aucune chaine de ce genre ne peut designer une transaction.
//
// Elles etaient rendues sur /api/casefile/public — surface retail, sans
// authentification — sous un en-tete promettant « un lien de transaction
// resolvable ».
//
// Elles ne sont pas remplacees. Aucune signature n'a ete cherchee, aucune
// n'a ete fabriquee, aucun RPC n'a ete appele. Les sections rendent
// desormais un RETRAIT STRUCTURE : une piece inventee ne se rachete pas
// avec un avertissement « non verifie ». Elle disparait comme piece
// probatoire, et son retrait se signale.
//
// L'historique git conserve les valeurs pour l'audit interne.

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
    <!-- La date porte son libellé. Une date NUE dans le pied d'un document
         forensique se lit comme une date de constatation — c'est exactement
         l'ambiguïté qui avait produit l'horodatage inventé de l'index. -->
    <span>${esc(copy.generatedOn)} ${esc(TODAY_ISO)}</span>
  </footer>
</section>`;
}

// ── Page builders ───────────────────────────────────────────────────────────

function buildCoverInner(copy: Copy, dossier: PublicProjection): string {
  // ── BUILD 9 / ÉTAPE 5 — le score de couverture n'est plus une constante ──
  //
  // L'anneau affichait « 100 / 100 » codé en dur, sous le libellé TigerScore,
  // pour un dossier dont l'autorité porte `tigerScore = NULL`. Ce n'était pas
  // un score arrondi : c'était un score qu'aucune autorité ne produit.
  //
  // NULL rend « non établi ». Jamais 0, jamais de dénominateur : « — / 100 »
  // laisserait encore croire qu'un score a été calculé et qu'il est bas.
  const scoreCell =
    dossier.tigerScore == null
      ? `<div class="score-ring-value score-unset">—</div>
         <div class="score-ring-band">${esc(copy.scoreUnset)}</div>`
      : `<div class="score-ring-value">${esc(String(dossier.tigerScore))} / 100</div>
         <div class="score-ring-band">${esc(copy.risk)}</div>`;

  // Les points du résumé viennent du DOSSIER, pas d'une constante. Un dossier
  // sans faits statiques n'hérite d'aucune affirmation — il rend le décompte
  // de ses claims publiés et la réserve générale, et rien de plus.
  const f = factsFor(dossier.ref);
  const bullets = [
    copy.execClaimsBullet(dossier.claims.length),
    ...((copy === COPY.fr ? f.execFr : f.execEn) ?? []),
    copy.execTail,
  ];

  return `
    <div class="cover-title-block">
      <div class="cover-kicker">${esc(copy.docTitle)}</div>
      <div class="cover-case">${esc(dossier.ref)}</div>
      <div class="cover-subject">${esc(dossier.codename)} · ${esc(dossier.ticker)}</div>
      <div class="cover-subject-title">${esc(dossier.title)}</div>
      <div class="cover-meta">${esc(copy.generatedOn)} · ${esc(TODAY_ISO)}</div>
    </div>

    <div class="cover-score-block">
      <div class="score-ring" aria-hidden="true">
        ${scoreCell}
      </div>
      <div class="score-meta">
        <div class="score-meta-label">${esc(copy.score)}</div>
        <div class="score-meta-desc">${esc(copy.tigerScoreLabel)}</div>
      </div>
    </div>

    <div class="cover-exec">
      <div class="h2">${esc(copy.execTitle)}</div>
      <ul class="exec-list">
        ${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}
      </ul>
    </div>

    <div class="cover-disclaimer">${esc(copy.disclaimer)}</div>
    <div class="cover-notreal">${esc(copy.notRealLine)}</div>
  `;
}

/**
 * Une section entière retirée de la publication.
 *
 * Elle garde sa PLACE et son titre — un lecteur qui connaissait le document
 * doit voir qu'il manque quelque chose, et pourquoi. Ce qu'elle ne garde pas,
 * c'est son contenu : le retrait nomme le CHAMP qui commande la décision, et
 * jamais la valeur retirée.
 *
 * C'est la différence avec un avertissement. « Signature non vérifiée » aurait
 * laissé la pièce sous les yeux du lecteur en lui demandant de s'en méfier —
 * or une pièce inventée ne se rachète pas par une mise en garde, elle cesse
 * d'être une pièce.
 */
function withheldSection(copy: Copy, titre: string, champ: string): string {
  return `
    <div class="h1">${esc(titre)}</div>
    <div class="callout muted">
      <div class="strong">${esc(copy.withheldTitle)}</div>
      <div>${esc(copy.sectionWithheldIntro)}</div>
      <div class="mono">${esc(copy.withheldCol.reason)} : ${esc(copy.withheldReason.INSUFFICIENT_PROVENANCE)}
        · ${esc(copy.withheldCol.field)} : ${esc(champ)}</div>
    </div>
  `;
}

/**
 * Les avis de retrait. Ils vivent SUR la page d'index, pas ailleurs :
 * un retrait qu'il faut aller chercher trois pages plus loin est un retrait
 * silencieux avec des étapes en plus.
 */
function buildWithheldBlock(copy: Copy, withheld: readonly WithheldNotice[]): string {
  if (withheld.length === 0) return "";
  const rows = withheld
    .map(
      (n) => `<tr>
      <td>${esc(copy.withheldReason[n.reason])}</td>
      <td class="mono">${esc(n.field)}</td>
      <td class="mono">${esc(String(n.count))}</td>
    </tr>`,
    )
    .join("");
  return `
    <div class="h2 withheld-title">${esc(copy.withheldTitle)}</div>
    <p class="body">${esc(copy.withheldIntro)}</p>
    <table class="data">
      <thead><tr>
        <th>${esc(copy.withheldCol.reason)}</th>
        <th>${esc(copy.withheldCol.field)}</th>
        <th>${esc(copy.withheldCol.count)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildEvidenceIndexInner(
  copy: Copy,
  lang: PublicReportLang,
  dossier: PublicProjection,
): string {
  // ── BUILD 9 / ÉTAPE 5 — l'index ne FABRIQUE plus sa provenance ──────────
  //
  // Trois des six colonnes ne rendaient pas ce que leur en-tête annonçait :
  //
  //   « Type »       recevait le TITRE du claim
  //   « Source »     recevait sa CATÉGORIE
  //   « Horodatage » recevait la date de GÉNÉRATION du PDF
  //
  // La dernière est la plus grave : chaque pièce paraissait captée le jour de
  // l'export. Un index de preuves qui invente ses horodatages ne documente
  // rien, il rassure.
  //
  // Et la source n'est plus le JSON legacy : elle est la projection publique.
  // Une pièce ne paraît ici que si elle porte empreinte, origine ET capture.
  //
  // Les trois absences restent DISTINCTES, chacune sur sa ligne : une pièce
  // publiable, une référence que le registre ne connaît pas, une pièce connue
  // mais non publiable. Les confondre reviendrait à en faire disparaître deux.
  let n = 0;
  const ligne = (
    type: string,
    source: string,
    ts: string,
    url: string,
    claimId: string,
  ): string => {
    n += 1;
    return `<tr>
      <td class="mono">${esc(`E-${String(n).padStart(3, "0")}`)}</td>
      <td>${esc(type)}</td>
      <td>${esc(source)}</td>
      <td class="mono">${esc(ts)}</td>
      <td class="mono url-cell">${esc(url)}</td>
      <td class="mono">${esc(claimId)}</td>
    </tr>`;
  };

  const rows: string[] = [];
  for (const c of dossier.claims as readonly RenderedClaim[]) {
    const p = c.provenance;
    const threadLabel = p.threadUrl ? truncateUrl(p.threadUrl) : "—";
    for (const s of p.sources) {
      rows.push(
        ligne(
          s.sourceType,
          s.caption ?? "—",
          s.capturedAt ?? "—",
          s.sourceUrl ? truncateUrl(s.sourceUrl) : threadLabel,
          c.claimId,
        ),
      );
    }
    for (const r of p.unresolvedRefs) {
      rows.push(ligne(copy.unresolvedLabel, r, "—", "—", c.claimId));
    }
    for (const r of p.withheldRefs) {
      rows.push(ligne(copy.withheldLabel, r, "—", "—", c.claimId));
    }
    if (p.sources.length === 0 && p.unresolvedRefs.length === 0 && p.withheldRefs.length === 0) {
      // Un claim publié sur son seul `thread_url` : le fil EST le fondement.
      const titre = lang === "fr" && c.titleFr ? c.titleFr : c.title;
      rows.push(ligne("thread", titre, c.claimDate ?? "—", threadLabel, c.claimId));
    }
  }

  const table =
    rows.length === 0
      ? `<p class="body callout muted">${esc(copy.evIdxEmpty)}</p>`
      : `<table class="data">
      <thead><tr>
        <th>${esc(copy.evCol.id)}</th>
        <th>${esc(copy.evCol.type)}</th>
        <th>${esc(copy.evCol.source)}</th>
        <th>${esc(copy.evCol.ts)}</th>
        <th>${esc(copy.evCol.url)}</th>
        <th>${esc(copy.evCol.claim)}</th>
      </tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;

  return `
    <div class="h1">${esc(copy.evIdxTitle)}</div>
    <p class="body">${esc(copy.evIdxIntro)}</p>
    ${table}
    ${buildWithheldBlock(copy, dossier.withheld)}
  `;
}

function buildTimelineInner(copy: Copy): string {
  // La convention de la section etait « evenement on-chain observe [tx] ».
  // Sans signature demontree, chaque ligne serait une affirmation sur des
  // evenements on-chain sans rien pour la soutenir : la valeur probante de
  // cette page DEPENDAIT de la signature. Elle est donc retiree entiere.
  return withheldSection(copy, copy.timelineTitle, "txSignature");
}

/**
 * Une section de faits statiques, ou son retrait.
 *
 * UN SEUL chemin de rendu pour les deux sections : elles présentent la même
 * chose — des lignes adossées à une source nommée. Deux mises en page
 * différentes pour la même nature de contenu, c'était deux endroits où
 * oublier le retrait.
 *
 * La grille de grands chiffres a disparu avec les valeurs codées en dur
 * qu'elle affichait (« 62 % », « 78 % », « HIGH ») : elles vivent désormais
 * dans les lignes, indexées par dossier. Une mise en page qui exige des
 * constantes dans le renderer n'est pas dossier-agnostique.
 */
function buildFactsInner(
  copy: Copy,
  titre: string,
  intro: (source: string) => string,
  section: FactSection | undefined,
  pied?: string,
): string {
  if (!section) return withheldSection(copy, titre, "source");
  const lignes = (copy === COPY.fr ? section.rowsFr : section.rowsEn)
    .map(
      (l) =>
        `<div class="auth-row"><span class="auth-dot"></span><div class="auth-text">${esc(l)}</div></div>`,
    )
    .join("");
  return `
    <div class="h1">${esc(titre)}</div>
    <p class="body">${esc(intro(section.source))}</p>
    <div class="auth-block">${lignes}</div>
    ${pied ? `<div class="callout">${esc(pied)}</div>` : ""}
  `;
}

function buildClusterInner(copy: Copy): string {
  // Meme dependance : le cluster ne demontrait rien sans ses adresses et ses
  // signatures de financement, et les deux etaient des marqueurs de
  // demonstration — non reproduits ici. Citer une piece retiree pour
  // expliquer son retrait la remet dans le source, et c'est exactement ce
  // que le test de non-reintroduction refuse.
  return withheldSection(copy, copy.clusterTitle, "txSignature");
}

function buildRelatedInner(copy: Copy): string {
  // Retire par DEPENDANCE, pas par elargissement : sa colonne « type de
  // preuve » citait la signature de financement partagee et le chevauchement
  // des trois destinataires pre-lancement — c'est-a-dire exactement les
  // pieces retirees juste au-dessus.
  return withheldSection(copy, copy.relatedTitle, "txSignature");
}

function buildOsintInner(copy: Copy, dossier: PublicProjection): string {
  // ── BUILD 9 / ÉTAPE 5 — le catalogue était la SECONDE autorité du PDF ────
  //
  // Il vivait dans une constante `OSINT_ENTRIES` : huit entrées codées en
  // dur, calquées une à une sur SRC-001…SRC-008 du JSON legacy. Deux listes
  // de preuves dans un même document, sans rien pour les tenir d'accord.
  //
  // La colonne « Fichier » rendait `IMG_2239.jpg` — le nom d'un fichier sur
  // une machine. Ça ne prouve rien et ça décrit une arborescence interne.
  // Elle cède la place à ce qui rend une pièce auditable : son ORIGINE et son
  // EMPREINTE. L'empreinte est tronquée pour la mise en page, jamais inventée.
  const rows = dossier.sources
    .map(
      (s) => `<tr>
      <td class="mono">${esc(s.sourceId)}</td>
      <td>${esc(s.sourceType)}</td>
      <td>${esc(s.caption ?? "—")}</td>
      <td class="mono url-cell">${esc(s.sourceUrl ? truncateUrl(s.sourceUrl) : "—")}</td>
      <td class="mono">${esc(s.capturedAt ?? "—")}</td>
      <td class="mono">${esc(s.sha256 ? s.sha256.slice(0, 16) + "…" : "—")}</td>
    </tr>`,
    )
    .join("");

  const table =
    dossier.sources.length === 0
      ? `<p class="body callout muted">${esc(copy.osintEmpty)}</p>`
      : `<table class="data">
      <thead><tr>
        <th>${esc(copy.osintCol.id)}</th>
        <th>${esc(copy.osintCol.type)}</th>
        <th>${esc(copy.osintCol.caption)}</th>
        <th>${esc(copy.osintCol.source)}</th>
        <th>${esc(copy.osintCol.captured)}</th>
        <th>${esc(copy.osintCol.integrity)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return `
    <div class="h1">${esc(copy.osintTitle)}</div>
    <p class="body">${esc(copy.osintIntro)}</p>
    ${table}
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
    .cover-subject { font-size: 15px; font-weight: 800; letter-spacing: 1px; margin-top: 4px; }
    .cover-subject-title { font-size: 11px; color: ${MUTED}; margin-top: 2px; }
    .cover-case { font-size: 34px; font-weight: 900; letter-spacing: -0.02em; margin-top: 6px; color: ${INK}; }
    .cover-meta { color: ${MUTED}; font-size: 11px; margin-top: 6px; }

    .cover-score-block { display: flex; align-items: center; gap: 22px; background: #FAFAFA; border: 1.5px solid ${INK}; border-left: 6px solid ${ACCENT}; padding: 18px 22px; border-radius: 4px; margin-bottom: 22px; }
    .score-ring { width: 110px; height: 110px; border-radius: 50%; border: 4px solid ${ACCENT}; display: flex; align-items: center; justify-content: center; flex-direction: column; background: ${PAPER}; flex-shrink: 0; }
    .score-ring-value { font-size: 22px; font-weight: 900; color: ${INK}; letter-spacing: -0.03em; }
    .score-ring-band { color: ${RISK_RED}; font-size: 9px; font-weight: 900; letter-spacing: 1.2px; margin-top: 2px; }
    /* Un score non établi n'emprunte NI la couleur NI la graisse d'un score.
       Le rendre en rouge sang avec un « — » ferait lire « très mauvais »
       là où la seule information est « pas calculé ». */
    .score-ring-value.score-unset { color: ${MUTED}; font-weight: 400; }
    .score-ring-value.score-unset + .score-ring-band { color: ${MUTED}; }
    .withheld-title { margin-top: 18px; }
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

function truncateUrl(u: string): string {
  if (u.length <= 48) return u;
  return u.slice(0, 40) + "…";
}

// ── HTML builder ────────────────────────────────────────────────────────────

/**
 * ─── BUILD 9 — LE GABARIT N'APPARTIENT PLUS À UN DOSSIER ──────────────────
 *
 * Il refusait de se rendre pour tout `ref` autre que BOTIFY, parce que ses
 * sections statiques décrivaient BOTIFY en dur. Le réflexe était juste — les
 * rendre sous un autre en-tête aurait attribué ce matériel à un dossier qui
 * ne le porte pas — mais la mécanique rendait le renderer inutilisable pour
 * VINE, l'une des deux fixtures obligatoires du gate BUILD 9.
 *
 * Les faits sont désormais indexés par dossier. Un dossier sans entrée ne se
 * voit plus refuser : ses sections rendent un retrait structuré. La protection
 * est la même — aucun matériel ne migre d'un dossier à l'autre — et elle ne
 * bloque plus le rendu.
 *
 * `STATIC_SECTIONS_DOCUMENT_REF` et `StaticSectionsMismatchError` restent
 * EXPORTÉS : deux routes gelées les importent, et ouvrir une fenêtre
 * d'exemption pour un nettoyage cosmétique serait un mauvais échange. L'erreur
 * n'est plus levée — dette signalée, à refermer à la prochaine fenêtre
 * légitime sur ces routes.
 */
export const STATIC_SECTIONS_DOCUMENT_REF = BOTIFY_CASEFILE_REF;

export class StaticSectionsMismatchError extends Error {
  constructor(ref: string) {
    super(
      `[casefile] gabarit public refusé pour ${ref}. Conservée pour les deux ` +
        "routes gelées qui l'importent ; la condition ne se produit plus depuis " +
        "que les faits statiques sont indexés par dossier.",
    );
    this.name = "StaticSectionsMismatchError";
  }
}

export function buildPublicReportHtml(
  lang: PublicReportLang,
  dossier: PublicProjection,
): string {
  const copy = COPY[lang];
  const faits = factsFor(dossier.ref);
  const total = 9;
  const pages = [
    buildCoverInner(copy, dossier),
    buildEvidenceIndexInner(copy, lang, dossier),
    buildTimelineInner(copy),
    buildFactsInner(copy, copy.tokenCtrlTitle, copy.tokenCtrlIntro, faits.tokenControl, copy.tokenCtrlFooter),
    buildFactsInner(copy, copy.metricsTitle, copy.metricsIntro, faits.launchMetrics),
    buildClusterInner(copy),
    buildRelatedInner(copy),
    buildOsintInner(copy, dossier),
    buildHowToReportInner(copy),
  ]
    .map((inner, i) => pageShell(inner, i + 1, total, dossier.ref, copy))
    .join("");

  return `<!DOCTYPE html><html lang="${esc(lang)}"><head>
<meta charset="UTF-8" />
<title>${esc(copy.docTitle)} · ${esc(dossier.ref)}</title>
<style>${renderCss()}</style>
</head><body>${pages}</body></html>`;
}

// ── PDF renderer ────────────────────────────────────────────────────────────

/**
 * `dossier` est REQUIS et n'a pas de valeur par défaut.
 *
 * C'est délibéré : un paramètre optionnel aurait laissé les deux routes
 * appeler le générateur exactement comme avant, et le repli vers le JSON
 * serait resté à une ligne de distance.
 */
export async function generateCaseFilePdfPublic(
  lang: PublicReportLang,
  dossier: PublicProjection,
): Promise<PublicReportResult> {
  try {
    const html = buildPublicReportHtml(lang, dossier);
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
