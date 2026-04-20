import Link from "next/link";
import { notFound } from "next/navigation";
import { getIncidentDetail } from "@/lib/security/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Incident — INTERLIGENS admin" };

const SURFACE = "#0a0a0a";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.55)";
const ACCENT = "#FF6B00";
const CRITICAL = "#ff4040";

const SEVERITY_COLOR: Record<string, string> = {
  critical: CRITICAL,
  high: ACCENT,
  medium: "#FFB800",
  low: MUTED,
  info: "rgba(255,255,255,0.4)",
};

type Params = Promise<{ id: string }>;

export default async function IncidentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const inc = await getIncidentDetail(id);
  if (!inc) return notFound();

  const assessment = inc.assessments[0] ?? null;
  const surface = (assessment?.affectedSurface as {
    summary?: string;
    assetTypes?: string[];
    enumeratedSecrets?: string[];
  } | null) ?? null;

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#FFF" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
        <Link
          href="/admin/security/incidents"
          style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: "0.1em", color: MUTED, textDecoration: "none" }}
        >
          &larr; Incidents
        </Link>

        <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginTop: 16 }}>
          {inc.vendor?.name ?? "Unmapped vendor"}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{inc.title}</h1>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
          <span style={{ color: SEVERITY_COLOR[inc.severity] ?? MUTED, fontWeight: 700, textTransform: "uppercase" }}>
            {inc.severity}
          </span>{" "}
          · {inc.incidentType} · <span style={{ color: "#FFF" }}>{inc.status}</span> · detected{" "}
          {new Date(inc.detectedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
        </div>

        <section style={{ marginTop: 24, padding: 16, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
          <div style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em", color: MUTED, marginBottom: 8 }}>
            Summary
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {inc.summaryLong ?? inc.summaryShort}
          </p>
          {inc.sourceUrl && (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 10 }}>
              Source:{" "}
              <a href={inc.sourceUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>
                {inc.sourceUrl}
              </a>
            </div>
          )}
        </section>

        {assessment && (
          <section style={{ marginTop: 20, padding: 16, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
            <div style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em", color: MUTED, marginBottom: 8 }}>
              INTERLIGENS exposure — {assessment.exposureLevel}
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.55 }}>
              {surface?.summary ?? "Surface not enumerated."}
            </p>
            {surface?.enumeratedSecrets && surface.enumeratedSecrets.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>
                  Secrets potentially exposed
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {surface.enumeratedSecrets.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: 11,
                        fontFamily: "ui-monospace, monospace",
                        padding: "2px 8px",
                        background: "rgba(255,107,0,0.1)",
                        border: "1px solid rgba(255,107,0,0.3)",
                        borderRadius: 3,
                        color: ACCENT,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11 }}>
              <Flag on={assessment.requiresKeyRotation}>rotate keys</Flag>
              <Flag on={assessment.requiresAccessReview}>access review</Flag>
              <Flag on={assessment.requiresInfraLogReview}>log review</Flag>
              <Flag on={assessment.requiresPublicStatement}>public statement</Flag>
            </div>
            {assessment.analystNote && (
              <p style={{ fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.55, fontStyle: "italic" }}>
                Note analyst: {assessment.analystNote}
              </p>
            )}
          </section>
        )}

        {inc.actionItems.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <div style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: "0.14em", color: ACCENT, marginBottom: 10 }}>
              Actions ({inc.actionItems.length})
            </div>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              {inc.actionItems.map((a) => (
                <div key={a.id} style={{ padding: "12px 14px", borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#FFF" }}>
                        <span style={{ color: ACCENT, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10, marginRight: 8 }}>
                          {a.priority}
                        </span>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
                        {a.description}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: a.status === "done" ? "#00c46c" : MUTED,
                        alignSelf: "flex-start",
                        padding: "2px 8px",
                        background: `${a.status === "done" ? "rgba(0,196,108,0.1)" : "rgba(255,255,255,0.05)"}`,
                        border: `1px solid ${a.status === "done" ? "rgba(0,196,108,0.3)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 3,
                      }}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {inc.comms.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <div style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: "0.14em", color: ACCENT, marginBottom: 10 }}>
              Comms drafts
            </div>
            {inc.comms.map((c) => (
              <div
                key={c.id}
                style={{
                  marginBottom: 10,
                  padding: 14,
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, marginBottom: 6 }}>
                  channel · {c.channel} · tone · {c.tone} · status · {c.status}
                </div>
                {c.title && <div style={{ fontSize: 13, color: "#FFF", fontWeight: 600, marginBottom: 6 }}>{c.title}</div>}
                <pre
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    margin: 0,
                  }}
                >
                  {c.body}
                </pre>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function Flag({ on, children }: { on: boolean; children: React.ReactNode }) {
  const tint = on ? ACCENT : "rgba(255,255,255,0.2)";
  return (
    <span
      style={{
        color: on ? "#FFF" : "rgba(255,255,255,0.4)",
        padding: "3px 10px",
        background: on ? "rgba(255,107,0,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${tint}`,
        borderRadius: 3,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 10,
      }}
    >
      {on ? "✓ " : "· "}
      {children}
    </span>
  );
}
