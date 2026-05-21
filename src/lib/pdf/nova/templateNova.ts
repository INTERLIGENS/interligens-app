/**
 * src/lib/pdf/nova/templateNova.ts
 *
 * Pure HTML renderer for the $NOVA synthetic casefile PDF.
 *
 * Inputs:
 *   - css     : the print-nova.css contents, inlined into <style> so Puppeteer
 *               does not need to resolve external requests.
 *   - version : human-readable version string (e.g. "v1.1"), shown on cover.
 *
 * The data is read from NOVA_CASEFILE_FIXTURE. Keeping data and presentation
 * separate makes the regression tests trivially assertable.
 */

import {
  NOVA_CASEFILE_FIXTURE,
  type NovaCasefileFixture,
  type NovaClaim,
  type NovaExhibit,
  type NovaWalletStep,
  type AttributionLevel,
  type SourceReliability,
  type Confidence,
} from "./data/novaCasefileFixture";

const e = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const attribTag = (lvl: AttributionLevel): string =>
  `<span class="tag tag--${lvl.toLowerCase()}">${e(lvl)}</span>`;

const srTag = (sr: SourceReliability): string =>
  `<span class="tag tag--${sr.toLowerCase()}">${e(sr)}</span>`;

const confTag = (c: Confidence): string =>
  `<span class="tag tag--conf-${c.toLowerCase()}">${e(c)}</span>`;

const riskTag = (r: "LOW" | "MED" | "HIGH"): string =>
  `<span class="tag tag--risk-${r.toLowerCase()}">${e(r)}</span>`;

const redactionLabel: Record<NovaExhibit["redaction"], string> = {
  public: "public",
  redacted: "redacted",
  "contains-pii": "contains-pii",
  "synthetic-pii-placeholder": "synthetic-pii-placeholder",
};

function renderCover(data: NovaCasefileFixture, version: string): string {
  return `
  <section class="cover">
    <div class="cover__overline">INTERLIGENS CASEFILE</div>
    <h1 class="cover__title">$NOVA</h1>
    <div class="cover__subtitle">Synthetic demonstration &middot; Format test only</div>

    <dl class="cover__meta">
      <dt>Casefile ID</dt><dd>${e(data.casefileId)}</dd>
      <dt>Date generated</dt><dd>${e(data.dateGenerated)}</dd>
      <dt>Version</dt><dd>${e(version)} &middot; Synthetic Demo</dd>
      <dt>Data classification</dt><dd>${e(data.dataClassification)}</dd>
      <dt>Intended use</dt><dd>${e(data.intendedUse)}</dd>
      <dt>Intended audience</dt><dd>${e(data.intendedAudience)}</dd>
      <dt>Operational triage</dt><dd>${e(data.operationalTriage)}</dd>
      <dt>Jurisdictions</dt><dd>${e(data.jurisdictions)}</dd>
    </dl>

    <div class="banner-synthetic" data-testid="synthetic-banner">
      <strong>SYNTHETIC SAMPLE &mdash; NOT REAL CASE &mdash; ADMIN ONLY</strong>
      All data in this casefile is synthetic. Wallet strings, transaction IDs,
      domains, handles, platform names and timelines are invented for format
      testing. Not for filing. Not public attribution.
    </div>

    <div class="disclaimer">
      <div class="disclaimer__heading">INTERLIGENS Casefile &mdash; Evidence structuring document</div>
      This document is <strong>not legal advice</strong>,
      <strong>does not constitute legal representation</strong>,
      <strong>does not recover assets</strong>,
      <strong>does not recommend litigation</strong>, and
      <strong>does not determine criminal or civil liability</strong>.
      It organizes factual, on-chain and source-based materials for review by
      qualified counsel or competent authorities. Any legal characterization,
      filing decision, recovery strategy or procedural step must be determined
      by licensed counsel or the relevant authority. INTERLIGENS risk indicators
      and attribution levels are intelligence signals, not judicial findings.
    </div>
  </section>`;
}

function renderReportingParty(data: NovaCasefileFixture): string {
  const rp = data.reportingParty;
  const proofRows = rp.walletControlProof.map((p) => `<div>${e(p)}</div>`).join("");
  return `
  <section class="section section--break">
    <div class="section__overline">&sect; 01 &mdash; Reporting party</div>
    <h2 class="section__title">Reporting Party</h2>

    <table class="kv">
      <thead><tr><th>Field</th><th>Value (synthetic)</th></tr></thead>
      <tbody>
        <tr><td>Profile</td><td>${e(rp.profile)}</td></tr>
        <tr><td>Internal identifier</td><td><span class="mono">${e(rp.internalId)}</span></td></tr>
        <tr><td>Declared wallet under control</td><td><span class="mono">${e(rp.declaredWallet)}</span></td></tr>
        <tr><td>Wallet control proof</td><td>${proofRows}</td></tr>
        <tr><td>Source of funds</td><td>${e(rp.sourceOfFunds)}</td></tr>
        <tr><td>Amount engaged</td><td>${e(rp.amountEngaged)}</td></tr>
      </tbody>
    </table>

    <div class="note-callout">
      <strong>PII handling note.</strong> PII is excluded from this demonstration
      file. In production, any PII handling requires separate privacy
      architecture, consent, retention and deletion controls.
    </div>
  </section>`;
}

function renderIncident(data: NovaCasefileFixture): string {
  const rows = data.incident.timeline
    .map((r) => `<tr><td class="mono">${e(r.date)}</td><td>${e(r.event)}</td></tr>`)
    .join("");
  return `
  <section class="section section--break">
    <div class="section__overline">&sect; 02 &mdash; Incident narrative</div>
    <h2 class="section__title">Incident Narrative</h2>

    <div class="subhead">Observed pattern</div>
    <p>${e(data.incident.pattern)}</p>

    <div class="subhead">Timeline (synthetic)</div>
    <table class="evtable">
      <thead><tr><th style="width: 25%">Date (UTC)</th><th>Event</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="subhead">Reported amount</div>
    <p>${e(data.incident.reportedAmount)}</p>
  </section>`;
}

function renderWalletFlowRow(s: NovaWalletStep): string {
  return `<tr>
    <td><strong>${e(s.step)}</strong></td>
    <td class="mono">${e(s.address)}</td>
    <td>${attribTag(s.attribution)}</td>
    <td>${e(s.observation)}</td>
  </tr>`;
}

function renderOnChain(data: NovaCasefileFixture): string {
  const flowRows = data.onChain.walletFlow.map(renderWalletFlowRow).join("");
  const txRows = data.onChain.txids
    .map(
      (t) => `<tr>
      <td class="mono">${e(t.txid)}</td>
      <td class="mono">${e(t.dateUtc)}</td>
      <td>${e(t.amount)}</td>
      <td>${e(t.fromTo)}</td>
    </tr>`,
    )
    .join("");
  return `
  <section class="section section--break">
    <div class="section__overline">&sect; 03 &mdash; On-chain evidence</div>
    <h2 class="section__title">On-chain Evidence</h2>

    <div class="section__intro">
      Compact demonstration format. Production casefiles split this section
      into Transaction Evidence, Wallet Flow, Exchange Touchpoints and Forensic
      Limitations.
    </div>

    <div class="subhead">Wallet flow (each address tagged)</div>
    <table class="evtable">
      <thead>
        <tr><th>Step</th><th>Address (synthetic)</th><th>Attribution</th><th>Observation</th></tr>
      </thead>
      <tbody>${flowRows}</tbody>
    </table>

    <div class="subhead">Transaction identifiers (synthetic)</div>
    <table class="evtable">
      <thead>
        <tr><th>TXID</th><th>Date UTC</th><th>Amount</th><th>From &rarr; To</th></tr>
      </thead>
      <tbody>${txRows}</tbody>
    </table>

    <div class="subhead">On-chain synthesis</div>
    <p>${e(data.onChain.synthesis)}</p>
  </section>`;
}

function renderOsint(data: NovaCasefileFixture): string {
  const rows = data.osint
    .map(
      (o) => `<tr>
      <td class="mono">${e(o.element)}</td>
      <td>${e(o.observation)}</td>
      <td>${attribTag(o.attribution)}</td>
    </tr>`,
    )
    .join("");
  return `
  <section class="section">
    <div class="section__overline">&sect; 04 &mdash; OSINT layer</div>
    <h2 class="section__title">OSINT Layer</h2>
    <table class="evtable">
      <thead><tr><th>Element</th><th>Observation</th><th>Attribution</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderClaim(c: NovaClaim): string {
  return `<tr>
    <td><strong>${e(c.id)}</strong></td>
    <td>${e(c.claim)}</td>
    <td>${attribTag(c.attribution)}</td>
    <td>${srTag(c.sourceReliability)}</td>
    <td>${confTag(c.confidence)}</td>
    <td>${e(c.basisLimitation)}</td>
  </tr>`;
}

function renderClaims(data: NovaCasefileFixture): string {
  const rows = data.claims.map(renderClaim).join("");
  return `
  <section class="section section--break">
    <div class="section__overline">&sect; 05 &mdash; Claims table</div>
    <h2 class="section__title">Claims Table</h2>

    <div class="section__intro">
      Each claim is tagged with Attribution Level (L0-L5) and Source Reliability
      (SR1-SR5), independently. Confidence is claim-by-claim.
    </div>

    <table class="evtable">
      <thead>
        <tr>
          <th>#</th><th>Claim</th><th>Attrib.</th><th>Source</th>
          <th>Confidence</th><th>Basis / Limitation</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="note-callout">
      <strong>Wording discipline.</strong> No natural person is named. No criminal
      qualification is asserted. The terms "scammer", "fraudster", "stolen by X"
      are absent by design.
    </div>
  </section>`;
}

function renderAssumptions(data: NovaCasefileFixture): string {
  const li = (items: string[]) =>
    items.map((s) => `<li>${e(s)}</li>`).join("");
  return `
  <section class="section section--break">
    <div class="section__overline">&sect; 06 &mdash; Assumptions &middot; Limitations &middot; Negative &middot; Contradictory evidence</div>
    <h2 class="section__title">Assumptions, Limitations &amp; Contradictory Evidence</h2>

    <div class="subhead">Assumptions</div>
    <ul class="bulletlist">${li(data.assumptions)}</ul>

    <div class="subhead">Limitations</div>
    <ul class="bulletlist">${li(data.limitations)}</ul>

    <div class="subhead">Negative evidence (what is not established)</div>
    <ul class="bulletlist">${li(data.negativeEvidence)}</ul>

    <div class="subhead">Contradictory evidence (active counter-points)</div>
    <ul class="bulletlist">${li(data.contradictoryEvidence)}</ul>
  </section>`;
}

function renderExhibits(data: NovaCasefileFixture): string {
  const rows = data.exhibits
    .map(
      (x) => `<tr>
      <td><strong>${e(x.id)}</strong></td>
      <td>${e(x.type)}</td>
      <td>${e(x.description)}</td>
      <td>${e(x.source)}</td>
      <td class="mono">${e(x.hashSha256)}</td>
      <td>${attribTag(x.attribution)}</td>
      <td>${srTag(x.sourceReliability)}</td>
      <td>${e(redactionLabel[x.redaction])}</td>
      <td>${riskTag(x.risk)}</td>
    </tr>`,
    )
    .join("");
  return `
  <section class="section section--break">
    <div class="section__overline">&sect; 07 &mdash; Exhibit register</div>
    <h2 class="section__title">Exhibit Register</h2>

    <table class="evtable">
      <thead>
        <tr>
          <th>ID</th><th>Type</th><th>Description</th><th>Source</th>
          <th>Hash SHA-256</th><th>Attrib.</th><th>Source Rel.</th>
          <th>Redaction</th><th>Risk</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="note-callout">
      <strong>Note.</strong> Each exhibit is hashed (SHA-256) at collection. Full
      register in production includes: original filename, storage URI,
      collection method, date collected (UTC), chain-of-custody notes.
      "contains-pii" redaction status is reserved for production; sandbox uses
      "synthetic-pii-placeholder".
    </div>
  </section>`;
}

function renderTriage(data: NovaCasefileFixture): string {
  const flags = data.jurisdictionalFlags
    .map(
      (f) => `<div class="jflag">
      <div class="jflag__label">${e(f.label)}</div>
      <div class="jflag__body">${e(f.body)}</div>
    </div>`,
    )
    .join("");
  const comp = data.completeness
    .map((c) => {
      const cls =
        c.status === "PARTIAL"
          ? " is-partial"
          : c.status === "EXCLUDED (demo)"
          ? " is-excluded"
          : "";
      return `<dt>${e(c.label)}</dt><dd class="${cls.trim()}">${e(c.status)}</dd>`;
    })
    .join("");
  return `
  <section class="section section--break">
    <div class="section__overline">&sect; 08 &mdash; Operational triage &middot; Jurisdictional flags</div>
    <h2 class="section__title">Operational Triage &amp; Jurisdictional Flags</h2>

    <div class="triage-banner">${e(data.triageLabel)}</div>

    <div class="section__intro">${e(data.triageNote)}</div>

    <div class="subhead">Jurisdictional flags (descriptive only)</div>
    ${flags}

    <div class="subhead">Evidence package completeness (product indicator, non-legal)</div>
    <dl class="completeness">${comp}</dl>

    <div class="final-mention">
      <strong>Final mention.</strong> Any action &mdash; complaint, disclosure,
      freezing, collective grouping &mdash; falls within external legal
      analysis. INTERLIGENS provides evidence structuring, not legal
      orientation. Risk indicators and attribution levels in this document are
      intelligence signals, not judicial findings.
    </div>
  </section>`;
}

export interface TemplateNovaInput {
  version: string;
  css: string;
  /** Optional override of the fixture, only used in tests. */
  data?: NovaCasefileFixture;
}

export function templateNova({ version, css, data }: TemplateNovaInput): string {
  const d = data ?? NOVA_CASEFILE_FIXTURE;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>INTERLIGENS Casefile $NOVA ${e(version)} - Synthetic Demo</title>
    <meta name="generator" content="INTERLIGENS Nova Casefile Generator" />
    <meta name="data-classification" content="SYNTHETIC DEMO - DO NOT PUBLISH" />
    <style>${css}</style>
  </head>
  <body>
    ${renderCover(d, version)}
    ${renderReportingParty(d)}
    ${renderIncident(d)}
    ${renderOnChain(d)}
    ${renderOsint(d)}
    ${renderClaims(d)}
    ${renderAssumptions(d)}
    ${renderExhibits(d)}
    ${renderTriage(d)}
  </body>
</html>`;
}
