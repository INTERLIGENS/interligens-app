/**
 * REFLEX V1 — investigator detail page (shared RSC for EN + FR routes).
 *
 * Fetches via findById (returns null on missing). Manifest is rendered in
 * <pre> wrapped in <details> for native expand/collapse — zero JS. Cross-
 * references are resolved via lookupCrossReferences and linked to existing
 * KOL + casefile routes when matched.
 */
import { notFound } from "next/navigation";
import {
  copyFor,
  type InvestigatorLocale,
} from "@/lib/reflex/investigator-copy";
import { findById } from "@/lib/reflex/persistence";
import { lookupCrossReferences } from "@/lib/reflex/cross-references";

const COLOR = {
  bg: "#000000", fg: "#FFFFFF", muted: "#888", border: "#1E2028",
  accent: "#FF6B00", danger: "#FF3B5C", warning: "#FFB800", surface: "#0a0a12",
};

function verdictColor(v: string): string {
  switch (v) {
    case "STOP": return COLOR.danger;
    case "WAIT": return COLOR.warning;
    case "VERIFY": return COLOR.accent;
    case "NO_CRITICAL_SIGNAL": return COLOR.muted;
    default: return COLOR.fg;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: COLOR.surface, border: `1px solid ${COLOR.border}`,
      padding: 16, marginBottom: 16,
    }}>
      <h2 style={{
        fontSize: 11, color: COLOR.muted, textTransform: "uppercase",
        letterSpacing: 1, margin: "0 0 12px 0",
      }}>{title}</h2>
      {children}
    </section>
  );
}

function KV({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{
        fontSize: 13, fontFamily: "monospace", color: valueColor ?? COLOR.fg,
        marginTop: 2, wordBreak: "break-all",
      }}>{value}</div>
    </div>
  );
}

function ReasonsList({ items }: { items: string[] }) {
  if (items.length === 0) return <span style={{ color: COLOR.muted }}>—</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 20, color: COLOR.fg, fontSize: 13 }}>
      {items.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{it}</li>)}
    </ul>
  );
}

export interface DetailPageProps {
  locale: InvestigatorLocale;
  id: string;
}

export async function InvestigatorDetailPage({ locale, id }: DetailPageProps) {
  const copy = copyFor(locale);
  const analysis = await findById(id);
  if (!analysis) {
    notFound();
  }

  const refs = await lookupCrossReferences(
    {
      handle: analysis.input.handle ?? null,
      address: analysis.input.address ?? null,
    },
    locale,
  );

  const basePath = `/${locale}/investigator/reflex`;
  const manifestJson = JSON.stringify(analysis.signalsManifest, null, 2);

  return (
    <div style={{
      padding: 24, background: COLOR.bg, color: COLOR.fg, minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <a href={basePath} style={{
        color: COLOR.muted, fontSize: 12, fontFamily: "monospace",
        textDecoration: "underline", marginBottom: 16, display: "inline-block",
      }}>← {copy.backLink}</a>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, textTransform: "uppercase", letterSpacing: 1 }}>
          {copy.detail.heading}
        </h1>
        <p style={{ color: COLOR.muted, fontSize: 12, fontFamily: "monospace", marginTop: 4 }}>
          {analysis.id} · {analysis.createdAt.toISOString()}
        </p>
      </header>

      {/* Verdict + confidence */}
      <Card title={copy.detail.verdict}>
        <div style={{
          fontSize: 32, fontFamily: "monospace", fontWeight: 700,
          color: verdictColor(analysis.verdict), letterSpacing: 1,
        }}>{analysis.verdict}</div>
        <div style={{
          fontSize: 13, color: COLOR.muted, marginTop: 8,
          display: "flex", gap: 24,
        }}>
          <span>{copy.detail.confidence}: <span style={{ color: COLOR.fg }}>{analysis.confidence}</span> ({analysis.confidenceScore.toFixed(3)})</span>
          <span>{copy.detail.mode}: <span style={{ color: analysis.mode === "PUBLIC" ? COLOR.accent : COLOR.fg }}>{analysis.mode}</span></span>
          <span>{copy.detail.latencyMs}: <span style={{ color: COLOR.fg }}>{analysis.latencyMs} ms</span></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{copy.detail.reasonsEn}</div>
            <ReasonsList items={analysis.verdictReasonEn} />
            <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 12, textTransform: "uppercase", letterSpacing: 1 }}>{copy.detail.actionEn}</div>
            <div style={{ fontSize: 13, color: COLOR.fg, marginTop: 4 }}>{analysis.actionEn || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{copy.detail.reasonsFr}</div>
            <ReasonsList items={analysis.verdictReasonFr} />
            <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 12, textTransform: "uppercase", letterSpacing: 1 }}>{copy.detail.actionFr}</div>
            <div style={{ fontSize: 13, color: COLOR.fg, marginTop: 4 }}>{analysis.actionFr || "—"}</div>
          </div>
        </div>
      </Card>

      {/* Input */}
      <Card title={copy.detail.input}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <KV label="type" value={analysis.input.type} />
          <KV label="chain" value={analysis.input.chain ?? "—"} />
          <KV label="address" value={analysis.input.address ?? "—"} />
          <KV label="handle" value={analysis.input.handle ? `@${analysis.input.handle}` : "—"} />
          <KV label="url" value={analysis.input.url ?? "—"} />
          <KV label="raw" value={analysis.input.raw} />
        </div>
      </Card>

      {/* Cross-references */}
      <Card title={copy.detail.crossReferences}>
        {!refs.kolProfile && refs.casefiles.length === 0 ? (
          <div style={{ color: COLOR.muted, fontSize: 13 }}>{copy.empty.noCrossRefs}</div>
        ) : (
          <div>
            {refs.kolProfile && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>{copy.detail.kolProfile}: </span>
                <a href={refs.kolProfile.url} style={{
                  color: COLOR.accent, fontFamily: "monospace", textDecoration: "underline",
                }}>@{refs.kolProfile.handle}{refs.kolProfile.displayName ? ` (${refs.kolProfile.displayName})` : ""}</a>
              </div>
            )}
            {refs.casefiles.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>{copy.detail.caseFiles}: </span>
                {refs.casefiles.map((cf, i) => (
                  <span key={cf.caseId}>
                    {i > 0 && <span style={{ color: COLOR.muted }}>, </span>}
                    <a href={cf.url} style={{
                      color: COLOR.accent, fontFamily: "monospace", textDecoration: "underline",
                    }}>{cf.caseId}</a>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Manifest */}
      <Card title={copy.detail.manifest}>
        <details>
          <summary style={{ cursor: "pointer", color: COLOR.muted, fontSize: 12 }}>
            {copy.detail.manifestHint}
          </summary>
          <pre style={{
            background: COLOR.bg, color: COLOR.fg, padding: 12, marginTop: 8,
            border: `1px solid ${COLOR.border}`, fontSize: 11,
            fontFamily: "monospace", overflowX: "auto", whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>{manifestJson}</pre>
        </details>
      </Card>

      {/* Audit */}
      <Card title={copy.detail.audit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <KV label={copy.detail.signalsHash} value={analysis.signalsHash} />
          <KV label={copy.detail.enginesVersion} value={analysis.enginesVersion} />
          <KV label={copy.detail.fpStatus}
            value={"falsePositiveFlag" in analysis && (analysis as { falsePositiveFlag?: boolean }).falsePositiveFlag
              ? copy.detail.fpFlagged
              : copy.detail.fpUnflagged}
            valueColor={(analysis as { falsePositiveFlag?: boolean }).falsePositiveFlag
              ? COLOR.danger
              : COLOR.muted}
          />
        </div>
      </Card>
    </div>
  );
}
