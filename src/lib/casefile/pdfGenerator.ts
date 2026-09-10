// src/lib/casefile/pdfGenerator.ts
//
// Generic CaseFile PDF generator. Takes a structured OSINT JSON and renders
// an adaptive PDF via Puppeteer (Sparticuz Chromium on serverless).
//
// Sections are included only when the corresponding input data is present.

import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import { assertNoContainedClaim, isAddressWithheld } from "./containment";
import type { PublicClaim } from "./canonicalReader";

const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

const ACCENT = "#FF6B00";

// ─── BUILD 13 · S1B — L'IDENTITÉ PORTABLE DU DOCUMENT ──────────────────────
//
// ██  Ce qui distingue deux documents doit VOYAGER AVEC LE FICHIER.        ██
//
// Mesuré le 2026-09-10 : trois générateurs produisent des PDF nommés
// `casefile-*.pdf`, et AUCUN ne portait de marque d'autorité. Le générateur
// NON autoritaire (`src/components/pdf/pdfRenderer.ts`) s'intitulait
// « INTERLIGENS CaseFile » — la formulation la plus officielle des trois —
// quand celui-ci disait « INTERLIGENS — CASEFILE ». La distinction n'existait
// que dans le CHEMIN D'URL, qui ne voyage pas avec le fichier.
//
// La doctrine appliquée ici n'est pas nouvelle : elle est au dépôt depuis
// BUILD 10 · P3, en tête de `__tests__/casefile/pdf-report-authority.test.ts` —
//
//     « Admin-only contrôle QUI PEUT PRODUIRE l'artefact. Cela ne gouverne
//       pas CE QUE L'ARTEFACT PEUT PUBLIER. »
//
// On dit CE QUE C'EST, jamais ce que ça vaut : aucune formule suggérant une
// certification, un agrément ou une valeur probante.

/**
 * Version du FORMAT DE DOCUMENT. Délibérément nommée à part, et dans un autre
 * espace de noms, que le `version: "1.0"` de `GraphReport`
 * (`src/lib/solanaGraph/types.ts:27`) : ce sont deux objets sans rapport, et
 * les confondre est exactement le raccourci qui a laissé une garde
 * insatisfiable en place six mois. Un lecteur qui voit `casefile-doc/1` ne
 * peut pas le prendre pour la version d'un rapport de graphe.
 */
export const CASEFILE_DOC_FORMAT = "casefile-doc/1";

/**
 * L'état d'autorité, dans le vocabulaire du registre des surfaces
 * (`src/lib/casefile/surfaceRegistry.ts` — CANONICAL | PRESET | NONE). Le
 * document IMPRIME ce que le registre DÉCLARE : l'autorité visuelle ne peut
 * pas contredire l'autorité gouvernée.
 */
export const CASEFILE_AUTHORITY = "CANONICAL";

/** Sérialisation déterministe : clés triées, à toute profondeur. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}

/**
 * L'empreinte de l'ENREGISTREMENT SOURCE — pas du PDF.
 *
 * Un PDF ne peut pas porter son propre sha256 : l'y insérer change le fichier,
 * donc change l'empreinte. C'est structurellement impossible, et le précédent
 * du dépôt fait déjà le bon geste — `renderGraphPDF(graphCase, lang, sha256)`
 * (`src/lib/pdf/graph/templateGraph.ts:34`) reçoit l'empreinte de la DONNÉE.
 *
 * Le champ est donc nommé et légendé pour qu'aucun lecteur ne croie tenir
 * l'empreinte du fichier qu'il a en main. Affirmer le contraire sur un
 * livrable destiné à un conseil serait précisément la classe de défaut qu'on
 * vient de fermer.
 *
 * L'horodatage de génération n'entre PAS dans le calcul : l'empreinte
 * identifie la source, pas le tirage. Deux tirages de la même source portent
 * donc la même empreinte, et c'est voulu.
 */
export function caseFileSourceDigest(input: unknown): string {
  return createHash("sha256").update(stable(input), "utf8").digest("hex");
}

// ── Input types ──────────────────────────────────────────────────────────────

export type CaseFileMeta = {
  case_id: string;
  token_name?: string;
  ticker?: string;
  mint?: string;
  chain?: string;
  deployer?: string;
  status?: string;
  severity?: string;
  summary?: string;
  summary_fr?: string;
  launched_at?: string;
  ath_market_cap_usd?: number;
  current_market_cap_usd?: number;
  drawdown_pct?: number;
};

export type CaseFileClaim = {
  claim_id: string;
  title: string;
  severity?: string;
  status?: string;
  description?: string;
  description_fr?: string;
  date?: string;
  category?: string;
  actors?: string[];
};

export type CaseFileSmokingGun = {
  id: string;
  title: string;
  legal_weight?: string;
  description?: string;
  implication_fr?: string;
};

export type CaseFileWallet = {
  label: string;
  address: string;
  role?: string;
  chain?: string;
  severity?: string;
};

export type CaseFileTimelineEvent = {
  date: string;
  title: string;
  description?: string;
  category?: string;
  actor?: string;
};

export type CaseFileShiller = {
  handle: string;
  real_name?: string;
  role?: string;
  followers?: number;
  severity?: string;
  timing?: string;
  key_quote?: string;
};

export type CaseFileRequisition = {
  priority: number;
  target: string;
  object: string;
  justification?: string;
};

/**
 * BUILD 9 / ÉTAPE 5 — le bloc canonique du rapport interne.
 *
 * Quand il est présent, les claims viennent de l'AUTORITÉ et de nulle part
 * ailleurs : `new_claims` du preset n'est pas lu. Quand il est absent, les
 * claims du preset sont rendus sous un intitulé qui le DIT.
 *
 * Il n'y a donc pas de repli silencieux — il y a deux rendus, et chacun
 * annonce d'où il tient ce qu'il montre. Un rapport forensique qui ne dit pas
 * quelle autorité il cite ne vaut pas mieux qu'une note.
 */
export type CaseFileCanonicalBlock = {
  ref: string;
  /** TOUS les états. La surface interne voit le dossier, pas sa projection. */
  claims: readonly PublicClaim[];
};

export type CaseFileInput = {
  case_meta: CaseFileMeta;
  /**
   * Quand les DONNÉES ont été mesurées — distinct de quand le document a été
   * produit. Un dossier a besoin des deux faits, et les confondre perd de
   * l'information : un tirage d'aujourd'hui peut porter une mesure d'hier.
   *
   * Optionnel parce qu'aucun appelant ne le transporte AUJOURD'HUI. Quand il
   * manque, le document le DIT au lieu de laisser le lecteur supposer que
   * l'horodatage de génération est celui de la mesure. On ne fabrique pas la
   * valeur manquante ; on nomme son absence.
   */
  snapshot_at?: string;
  timeline?: CaseFileTimelineEvent[];
  shillers?: CaseFileShiller[];
  wallets_onchain?: CaseFileWallet[];
  new_claims?: CaseFileClaim[];
  canonical?: CaseFileCanonicalBlock;
  smoking_guns?: {
    tier_1?: CaseFileSmokingGun[];
    tier_2?: CaseFileSmokingGun[];
    tier_3?: CaseFileSmokingGun[];
    verdict_fr?: string;
  };
  requisitions?: CaseFileRequisition[];
};

export type CaseFilePdfResult = {
  success: boolean;
  pdfBytes?: Uint8Array;
  r2Key?: string;
  error?: string;
};

// ── HTML builder ─────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function severityColor(s?: string): string {
  if (!s) return "#888";
  const up = s.toUpperCase();
  if (up === "CRITICAL") return "#FF0000";
  if (up === "HIGH" || up === "RED") return ACCENT;
  if (up === "MEDIUM") return "#FFA500";
  return "#888";
}

function buildHtml(input: CaseFileInput): string {
  const m = input.case_meta;
  // À LA SECONDE, et non à la journée. Mesuré le 2026-09-10 : les deux
  // générateurs canoniques tronquaient à `slice(0, 10)`, si bien que deux
  // tirages canoniques du même jour étaient TEMPORELLEMENT INDISTINGUABLES —
  // alors que le générateur NON autoritaire, lui, horodatait à la minute. Sur
  // l'axe qui compte pour une citation, l'artefact non gouverné était mieux
  // identifié que le gouverné. C'est cette inversion-là qu'on ferme.
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  // La référence est imprimée AVEC L'AUTORITÉ QUI LA NOMME, et jamais nue.
  //
  // Mesuré le 2026-09-10 : le même dossier BOTIFY porte TROIS références.
  //
  //   CASE-2024-BOTIFY-001   la valeur STOCKÉE — `data/cases/botify.json` et
  //                          `src/data/cases/botify.json`, 8 fichiers du dépôt
  //   CASE-2025-BOTIFY-001   `src/lib/casefile/presets.ts:55` — la même faute,
  //                          figée dans le code l'an dernier
  //   CASE-2026-BOTIFY-001   la valeur SERVIE cette année, et celle du PDF réel
  //                          rangé au dataroom investisseur
  //
  // La cause n'est pas une autorité de nommage double : c'est une RÉÉCRITURE EN
  // TRANSIT. `src/app/api/scan/solana/route.ts:184` remplace l'année du dossier
  // par L'ANNÉE COURANTE à l'instant de la requête —
  //
  //     case_id.replace(/CASE-\d{4}-/, `CASE-${new Date().getFullYear()}-`)
  //
  // La référence imprimée sur la pièce change donc CHAQUE 1ᵉʳ JANVIER, ce qui
  // invalide rétroactivement toute citation déjà émise, et paraît parfaitement
  // stable à tout test écrit dans l'année. La conséquence est déjà connue en
  // aval : `src/app/en/explorer/[caseId]/page.tsx:39-44` porte un contournement
  // documenté qui nomme cette route comme la cause.
  //
  // CE CHEMIN-CI NE RÉÉCRIT PAS — c'est la seule réécriture du dépôt, et elle
  // n'est pas ici. Le canonique porte donc une référence STABLE mais figée sur
  // une mauvaise année. Deux défauts distincts, un seul dossier.
  //
  // Ce document ne présente donc pas cet identifiant comme stable ou citable
  // entre systèmes : il dit de quel enregistrement il vient. Nommer la
  // provenance est ce qu'on peut affirmer aujourd'hui ; unifier l'autorité de
  // nommage et fermer la réécriture est un chantier, pas une mention.
  const ref = input.canonical?.ref || m.case_id;
  const refSource = input.canonical?.ref ? "canonical record" : "case metadata";
  const digest = caseFileSourceDigest(input);

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#000;color:#fff;font-size:11px;line-height:1.5}
.page{padding:28px;min-height:297mm;position:relative}
.header{border-bottom:3px solid ${ACCENT};padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
.header-left h1{font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:3px}
.header-left .sub{color:${ACCENT};font-size:14px;font-weight:700}
.header-right{text-align:right;font-size:9px;color:#888;line-height:1.6}
.section{margin-bottom:22px}
.section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${ACCENT};border-bottom:1px solid #333;padding-bottom:5px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:9.5px;margin:8px 0}
th{background:#1a1a1a;color:${ACCENT};font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:6px 8px;text-align:left;font-size:8.5px}
td{padding:5px 8px;border-bottom:1px solid #1a1a1a;vertical-align:top}
tr:nth-child(even) td{background:#0a0a0a}
.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;color:#fff}
.callout{background:#0a0a0a;border:1px solid #333;padding:10px;font-size:9px;color:#888;border-left:3px solid ${ACCENT};margin:10px 0}
.card{background:#111;border:1px solid #333;padding:12px;margin:8px 0;border-radius:4px}
.card-title{font-size:11px;font-weight:700;color:#fff;margin-bottom:6px}
.meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.meta-cell .label{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
.meta-cell .value{font-size:12px;font-weight:700;color:#fff}
.footer{border-top:1px solid #333;padding-top:10px;margin-top:22px;display:flex;justify-content:space-between;color:#555;font-size:8px}
.mono{font-family:Menlo,monospace;font-size:9px;word-break:break-all}
.page-break{page-break-after:always}
</style></head><body><div class="page">`;

  // HEADER
  html += `<div class="header">
    <div class="header-left">
      <div style="color:#888;font-size:9px;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">INTERLIGENS CaseFile · Canonical Artifact</div>
      <h1>${esc(m.case_id)}</h1>
      <div class="sub">${esc(m.ticker || m.token_name || "")} ${m.chain ? `· ${esc(m.chain.toUpperCase())}` : ""} ${m.severity ? `· <span class="badge" style="background:${severityColor(m.severity)}">${esc(m.severity)}</span>` : ""}</div>
    </div>
    <div class="header-right">
      Generated: ${generatedAt}<br>
      ${m.deployer ? `Deployer: ${esc(m.deployer)}<br>` : ""}
      ${m.mint ? `Mint: <span class="mono">${esc(m.mint)}</span><br>` : ""}
      ${m.status ? `Status: ${esc(m.status)}` : ""}
    </div>
  </div>`;

  // ── IDENTITÉ DE L'ARTEFACT ────────────────────────────────────────────
  // Elle est en tête, pas en annexe : un lecteur doit savoir CE QU'IL TIENT
  // avant de lire ce que ça dit. Quatre faits, aucun jugement de valeur.
  html += `<div class="callout" style="border-left-color:${ACCENT};margin-bottom:18px">
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 18px;font-size:9px;color:#aaa">
      <div><span style="color:#666;text-transform:uppercase;letter-spacing:1px">Reference</span> · <span class="mono" style="color:#fff">${esc(ref)}</span> <span style="color:#666">(${refSource})</span></div>
      <div><span style="color:#666;text-transform:uppercase;letter-spacing:1px">Authority</span> · <span style="color:#fff;font-weight:700">${CASEFILE_AUTHORITY}</span></div>
      <div><span style="color:#666;text-transform:uppercase;letter-spacing:1px">Generated at</span> · <span class="mono" style="color:#fff">${generatedAt}</span></div>
      <div><span style="color:#666;text-transform:uppercase;letter-spacing:1px">Document format</span> · <span class="mono" style="color:#fff">${CASEFILE_DOC_FORMAT}</span></div>
      <div style="grid-column:1/-1"><span style="color:#666;text-transform:uppercase;letter-spacing:1px">Data snapshot</span> · <span class="mono" style="color:#fff">${
        input.snapshot_at
          ? esc(input.snapshot_at)
          : "not recorded — the generation time above is NOT the measurement time"
      }</span></div>
      <div style="grid-column:1/-1"><span style="color:#666;text-transform:uppercase;letter-spacing:1px">Source digest</span> · <span class="mono" style="color:#fff">${digest}</span></div>
      <div style="grid-column:1/-1;color:#666;font-size:8px;line-height:1.5">
        Reference names the record this document was built from, as named by the authority shown in brackets. It is not asserted to be stable across systems.<br>
        Source digest is the SHA-256 of the source record this document was built from — <strong>not</strong> of this PDF file. A file cannot contain its own digest.
        Two renderings of the same source carry the same digest.
      </div>
    </div>
  </div>`;

  // META GRID
  const metaCells: Array<[string, string]> = [];
  if (m.launched_at) metaCells.push(["Launch", m.launched_at]);
  if (m.ath_market_cap_usd) metaCells.push(["ATH Cap", `$${(m.ath_market_cap_usd / 1e6).toFixed(0)}M`]);
  if (m.current_market_cap_usd) metaCells.push(["Current Cap", `$${(m.current_market_cap_usd / 1e6).toFixed(0)}M`]);
  if (m.drawdown_pct) metaCells.push(["Drawdown", `${m.drawdown_pct}%`]);
  if (metaCells.length > 0) {
    html += `<div class="meta-grid">${metaCells.map(([l, v]) => `<div class="meta-cell"><div class="label">${esc(l)}</div><div class="value">${esc(v)}</div></div>`).join("")}</div>`;
  }

  // EXECUTIVE SUMMARY
  if (m.summary_fr || m.summary) {
    html += `<div class="section"><div class="section-title">Executive Summary</div><div style="font-size:10.5px;line-height:1.65;color:#ccc">${esc(m.summary_fr || m.summary)}</div></div>`;
  }

  // SMOKING GUNS
  const sg = input.smoking_guns;
  if (sg) {
    html += `<div class="section"><div class="section-title">Smoking Guns</div>`;
    if (sg.verdict_fr) {
      html += `<div class="callout" style="border-left-color:#FF0000;margin-bottom:14px"><strong style="color:#FF6B6B">VERDICT :</strong> ${esc(sg.verdict_fr)}</div>`;
    }
    const tiers: Array<[string, string, CaseFileSmokingGun[] | undefined]> = [
      ["Tier 1 — Criminal", "#FF6B6B", sg.tier_1],
      ["Tier 2 — Coordination", ACCENT, sg.tier_2],
      ["Tier 3 — Contextual", "#888", sg.tier_3],
    ];
    for (const [label, color, list] of tiers) {
      if (!list?.length) continue;
      html += `<div style="font-size:9px;color:${color};text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:10px 0 6px">${label} (${list.length})</div>`;
      for (const g of list) {
        html += `<div class="card" style="border-left:3px solid ${color}">
          <div class="card-title"><span style="color:${color}">${esc(g.id)}</span> — ${esc(g.title)}</div>
          ${g.legal_weight ? `<div style="font-size:8px;color:#888;font-style:italic;margin-bottom:4px">${esc(g.legal_weight)}</div>` : ""}
          ${g.description ? `<div style="font-size:9px;color:#aaa;line-height:1.55">${esc(g.description).slice(0, 500)}${(g.description?.length ?? 0) > 500 ? "…" : ""}</div>` : ""}
        </div>`;
      }
    }
    html += `</div>`;
  }

  // ── CLAIMS — AUTORITÉ CANONIQUE (BUILD 9 / étape 5) ────────────────────
  //
  // Le type `CaseFileClaim` du preset ne porte ni `evidence_refs` ni
  // `thread_url` : le rapport rendait ID, sévérité, titre, date, catégorie —
  // et laissait tomber exactement ce qui démontre le claim. Une assertion
  // démontrable publiée sans son fondement est plus fragile qu'une assertion
  // prudente : elle a l'air soutenue.
  //
  // Ici, chaque claim porte son ÉTAT et sa provenance. Les références non
  // résolues sont rendues COMME NON RÉSOLUES, jamais comme un fondement.
  // ── BUILD 9 — LE DOCUMENT DÉCLARE SON AUTORITÉ, TOUJOURS ───────────────
  //
  // L'étiquette « HORS autorité canonique » ne s'affichait qu'avec des claims
  // de preset. Une génération à la demande sans claim du tout produisait donc
  // un rapport qui ne disait RIEN de sa provenance — et qui, mis côte à côte
  // avec un rapport canonique, en avait exactement l'apparence.
  //
  // Un lecteur doit pouvoir dire d'où vient ce qu'il lit sans ouvrir le code,
  // y compris quand la réponse est « de nulle part de gouverné ».
  if (!input.canonical) {
    html += `<div class="callout" style="border-left-color:#FFB800;color:#FFB800">
      Ce document n'est adossé à AUCUN dossier canonique. Ses sections
      proviennent d'un preset ou de données fournies à la génération. Il ne
      constitue pas une projection de l'autorité CaseFile.
    </div>`;
  }

  if (input.canonical) {
    const cl = input.canonical.claims;
    html += `<div class="section"><div class="section-title">Claims — autorité canonique · ${esc(input.canonical.ref)} (${cl.length})</div>`;
    html += `<table><tr><th>ID</th><th>État</th><th>Sev.</th><th>Title</th><th>Date</th><th>Fondement</th></tr>`;
    for (const c of cl) {
      const p = c.provenance;
      const nbSources = p?.sources.length ?? 0;
      const nbNonResolues = p?.unresolvedRefs.length ?? 0;
      // « — » quand il n'y a rien. Pas « 0 source », qui se lirait comme une
      // mesure alors que c'est une absence.
      const fondement = !p
        ? "—"
        : [
            nbSources > 0 ? `${nbSources} source${nbSources > 1 ? "s" : ""}` : null,
            p.threadUrl ? "thread" : null,
            nbNonResolues > 0 ? `${nbNonResolues} non résolue${nbNonResolues > 1 ? "s" : ""}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—";
      html += `<tr>
        <td style="font-weight:700;color:${ACCENT}">${esc(c.claimId)}</td>
        <td><span class="badge" style="background:#333">${esc(c.state)}</span></td>
        <td><span class="badge" style="background:${severityColor(c.severity ?? undefined)}">${esc(c.severity || "—")}</span></td>
        <td>${esc(c.title)}</td>
        <td>${esc(c.claimDate || "—")}</td>
        <td style="font-size:9px;color:#aaa">${esc(fondement)}</td>
      </tr>`;
    }
    html += `</table>`;

    for (const c of cl) {
      const p = c.provenance;
      if (!p) continue;
      html += `<div class="card"><div class="card-title"><span style="color:${ACCENT}">${esc(c.claimId)}</span> — provenance</div>`;
      if (p.threadUrl) {
        html += `<div style="font-size:9px;color:#aaa">thread : <span class="mono">${esc(p.threadUrl)}</span></div>`;
      }
      for (const s of p.sources) {
        // L'horodatage rendu est celui de la CAPTURE. Jamais celui du rendu.
        html += `<div style="font-size:9px;color:#aaa;margin-top:3px">
          <span class="mono" style="color:${ACCENT}">${esc(s.sourceId)}</span>
          · ${esc(s.sourceType)}
          · capturé ${esc(s.capturedAt ?? "—")}
          · origine ${esc(s.sourceUrl ?? "—")}
          · sha256 ${esc(s.sha256 ? s.sha256.slice(0, 16) + "…" : "—")}
        </div>`;
      }
      for (const r of p.unresolvedRefs) {
        html += `<div style="font-size:9px;color:#FFB800;margin-top:3px">référence NON RÉSOLUE : ${esc(r)}</div>`;
      }
      html += `</div>`;
    }
    // Ce que ce rapport ne tient PAS de l'autorité, et il faut le dire ici :
    // une fois les claims devenus canoniques, tout le document prend l'air
    // canonique. La chronologie et les réquisitions n'ont aucune table — la
    // DDL du bloc 3 a refusé de les créer, aucun fait n'étant démontré.
    html += `<div class="card" style="border-left:3px solid #FFB800">
      <div style="font-size:9px;color:#FFB800;line-height:1.55">
        Hors autorité canonique dans ce document : chronologie, réquisitions,
        wallets on-chain, shillers et smoking guns proviennent du preset.
        Aucune structure canonique ne porte la chronologie ni les réquisitions.
      </div>
    </div>`;
    html += `</div>`;
  }

  // CLAIMS — preset (rendu UNIQUEMENT à défaut de bloc canonique, et annoncé
  // comme tel : le lecteur doit pouvoir dire de quelle autorité vient ce
  // qu'il lit sans ouvrir le code).
  if (!input.canonical && input.new_claims?.length) {
    html += `<div class="section"><div class="section-title">Claims — HORS autorité canonique (${input.new_claims.length})</div><table><tr><th>ID</th><th>Sev.</th><th>Title</th><th>Date</th><th>Category</th></tr>`;
    for (const c of input.new_claims) {
      html += `<tr>
        <td style="font-weight:700;color:${ACCENT}">${esc(c.claim_id)}</td>
        <td><span class="badge" style="background:${severityColor(c.severity)}">${esc(c.severity || "—")}</span></td>
        <td>${esc(c.title)}</td>
        <td>${esc(c.date || "—")}</td>
        <td>${esc(c.category || "—")}</td>
      </tr>`;
    }
    html += `</table>`;
    for (const c of input.new_claims) {
      if (!c.description_fr && !c.description) continue;
      html += `<div class="card"><div class="card-title" style="color:${severityColor(c.severity)}"><span style="color:${ACCENT}">${esc(c.claim_id)}</span> — ${esc(c.title)}</div>
        <div style="font-size:9px;color:#aaa;line-height:1.55">${esc((c.description_fr || c.description || "").slice(0, 600))}${((c.description_fr || c.description || "").length > 600) ? "…" : ""}</div>
        ${c.actors?.length ? `<div style="font-size:8px;color:#666;margin-top:4px">Acteurs: ${c.actors.map(a => esc(a)).join(", ")}</div>` : ""}
      </div>`;
    }
    html += `</div>`;
  }

  // WALLETS
  if (input.wallets_onchain?.length) {
    html += `<div class="section"><div class="section-title">Wallets On-Chain (${input.wallets_onchain.length})</div><table><tr><th>Label</th><th>Address</th><th>Role</th><th>Chain</th><th>Sev.</th></tr>`;
    for (const w of input.wallets_onchain) {
      html += `<tr><td style="font-weight:600">${esc(w.label)}</td><td class="mono">${esc(w.address)}</td><td style="font-size:9px;color:#aaa">${esc(w.role || "")}</td><td>${esc(w.chain || "")}</td><td><span class="badge" style="background:${severityColor(w.severity)}">${esc(w.severity || "—")}</span></td></tr>`;
    }
    html += `</table></div>`;
  }

  // SHILLERS
  if (input.shillers?.length) {
    html += `<div class="section"><div class="section-title">Shillers (${input.shillers.length})</div><table><tr><th>Handle</th><th>Name</th><th>Role</th><th>Followers</th><th>Timing</th><th>Sev.</th></tr>`;
    for (const s of input.shillers) {
      html += `<tr><td style="font-weight:600;color:${ACCENT}">${esc(s.handle)}</td><td>${esc(s.real_name || "—")}</td><td style="font-size:9px">${esc(s.role || "")}</td><td>${s.followers?.toLocaleString() || "—"}</td><td style="font-size:9px">${esc(s.timing || "")}</td><td><span class="badge" style="background:${severityColor(s.severity)}">${esc(s.severity || "—")}</span></td></tr>`;
      if (s.key_quote) html += `<tr><td colspan="6" style="font-size:9px;color:#FF6B6B;font-style:italic;padding:2px 8px 6px">"${esc(s.key_quote)}"</td></tr>`;
    }
    html += `</table></div>`;
  }

  // TIMELINE
  if (input.timeline?.length) {
    html += `<div class="section"><div class="section-title">Timeline (${input.timeline.length})</div>`;
    for (const e of input.timeline) {
      html += `<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid #1a1a1a">
        <div style="min-width:85px;font-size:10px;color:${ACCENT};font-weight:600">${esc(e.date)}</div>
        <div><div style="font-size:10px;font-weight:600">${esc(e.title)}</div>
        ${e.description ? `<div style="font-size:9px;color:#888;margin-top:2px">${esc(e.description).slice(0, 300)}</div>` : ""}
        </div></div>`;
    }
    html += `</div>`;
  }

  // REQUISITIONS
  if (input.requisitions?.length) {
    html += `<div class="section"><div class="section-title">Réquisitions recommandées (${input.requisitions.length})</div>`;
    for (const r of input.requisitions) {
      const pColor = r.priority === 1 ? "#FF6B6B" : r.priority === 2 ? ACCENT : "#888";
      html += `<div class="card" style="border-left:3px solid ${pColor}">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
          <span style="font-size:12px;font-weight:700;color:${pColor}">P${r.priority}</span>
          <span style="font-size:11px;font-weight:700;color:#fff">${esc(r.target)}</span>
        </div>
        <div style="font-size:9px;color:#aaa">${esc(r.object)}</div>
        ${r.justification ? `<div style="font-size:8px;color:#666;font-style:italic;margin-top:4px">${esc(r.justification).slice(0, 300)}</div>` : ""}
      </div>`;
    }
    html += `</div>`;
  }

  // FOOTER
  // Le pied porte l'identité une seconde fois : une page détachée du reste
  // doit rester attribuable.
  html += `<div class="footer">
    <span>INTERLIGENS CaseFile · ${CASEFILE_AUTHORITY} · ${CASEFILE_DOC_FORMAT} · ${generatedAt}</span>
    <span>${esc(ref)} — CONFIDENTIEL</span>
  </div></div></body></html>`;

  return html;
}

// ── PDF rendering ────────────────────────────────────────────────────────────

export async function generateCaseFilePdf(
  input: CaseFileInput,
  options?: { uploadToR2?: boolean }
): Promise<CaseFilePdfResult> {
  try {
    const html = buildHtml(input);

    // ── CONTAINMENT P0 — le garde de sortie, sur le RENDU ──────────────────
    //
    // Le retrait est déjà fait à la source (presets.ts), mais un garde qui ne
    // vit que dans la source ne couvre pas un appelant qui construit son
    // `CaseFileInput` autrement — et `/api/casefile/generate` accepte
    // précisément un `data` arbitraire dans son corps de requête.
    //
    // Ce garde lit le HTML FINAL : c'est le dernier point où l'on peut encore
    // refuser. Il LÈVE plutôt que de nettoyer — nettoyer en silence laisserait
    // croire que la sortie est saine alors qu'une source amont continue de
    // produire le chiffre.
    assertNoContainedClaim(html, "generateCaseFilePdf");
    for (const w of input.wallets_onchain ?? []) {
      if (isAddressWithheld(w.address)) {
        throw new Error(
          `[containment] sortie refusée : l'adresse ${w.address} est ` +
            "`isPubliclyUsable = false`. Une adresse que le régime de publication " +
            "refuse ailleurs ne peut pas sortir nominativement d'un CaseFile.",
        );
      }
    }
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
      })) as Uint8Array;
    } finally {
      await browser.close();
    }

    let r2Key: string | undefined;
    if (options?.uploadToR2) {
      const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
      if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
        const r2 = new S3Client({
          region: "auto",
          endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
          },
        });
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const slug = input.case_meta.case_id.replace(/[^a-zA-Z0-9-]/g, "_");
        r2Key = `casefiles/${slug}/${slug}_${ts}.pdf`;
        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: r2Key,
            Body: pdfBytes,
            ContentType: "application/pdf",
            CacheControl: "no-cache",
          })
        );
      }
    }

    return { success: true, pdfBytes, r2Key };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Re-export for external consumption
export { buildHtml as buildCaseFileHtml };
