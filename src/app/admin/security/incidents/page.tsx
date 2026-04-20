import Link from "next/link";
import { listIncidents } from "@/lib/security/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security incidents — INTERLIGENS admin" };

const BG = "#000000";
const SURFACE = "#0a0a0a";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.55)";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ff4040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "rgba(255,255,255,0.5)",
  info: "rgba(255,255,255,0.4)",
};

export default async function SecurityIncidentsPage() {
  const rows = await listIncidents({ limit: 100 });
  return (
    <main style={{ minHeight: "100vh", background: BG, color: "#FFF" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>
        <Link
          href="/admin/security"
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.1em",
            color: MUTED,
            textDecoration: "none",
          }}
        >
          &larr; Security Center
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>Incidents</h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
          {rows.length} incident{rows.length === 1 ? "" : "s"} sur le registre.
        </p>

        <div style={{ marginTop: 24, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
          {rows.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: MUTED, fontSize: 13, background: SURFACE }}>
              Registre vide.
            </div>
          )}
          {rows.map((r) => {
            const exposure = r.assessments[0]?.exposureLevel ?? null;
            const col = SEVERITY_COLOR[r.severity] ?? MUTED;
            return (
              <Link
                key={r.id}
                href={`/admin/security/incidents/${r.id}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  padding: "14px 16px",
                  borderTop: `1px solid ${BORDER}`,
                  background: SURFACE,
                  color: "#FFF",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      <span style={{ color: col, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {r.severity}
                      </span>{" "}
                      · {r.incidentType} · {r.status} ·{" "}
                      {new Date(r.detectedAt).toISOString().slice(0, 10)}
                      {r.vendor ? ` · ${r.vendor.name}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 6, lineHeight: 1.5 }}>
                      {r.summaryShort}
                    </div>
                  </div>
                  {exposure && (
                    <span style={{ fontSize: 10, color: MUTED, alignSelf: "center" }}>
                      exposure · <span style={{ color: "#FFF" }}>{exposure}</span>
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
