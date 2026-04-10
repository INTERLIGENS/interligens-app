/**
 * Admin — ASK INTERLIGENS audit trail viewer.
 *
 * Minimal server component: lists the 100 most recent AskLog rows.
 * Protected by /admin/* middleware (HTTP Basic + requireAdmin).
 */

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

type LogRow = {
  id: string
  createdAt: Date
  sessionId: string | null
  scanId: string | null
  locale: string
  source: string
  userQuestion: string
  assistantAnswer: string
  answerType: string
  mode: string
  confidenceTier: string
  sourceCount: number
  modelName: string | null
  latencyMs: number | null
  sourcesUsed: unknown
}

async function loadLogs(): Promise<LogRow[]> {
  try {
    const rows = await prisma.askLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return rows as unknown as LogRow[]
  } catch (err) {
    console.error("[admin/ask-logs] load failed:", err)
    return []
  }
}

const cellBase: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #1e293b",
  fontSize: 11,
  color: "#cbd5e1",
  verticalAlign: "top",
}

const headerCell: React.CSSProperties = {
  ...cellBase,
  color: "#64748b",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 10,
  background: "#0f172a",
  position: "sticky",
  top: 0,
}

function tierColor(tier: string): string {
  if (tier === "high") return "#22c55e"
  if (tier === "medium") return "#eab308"
  return "#94a3b8"
}

function typeColor(type: string): string {
  if (type === "deterministic") return "#4f46e5"
  if (type === "refusal") return "#ef4444"
  return "#0ea5e9"
}

function fmtDate(d: Date): string {
  return new Date(d).toISOString().replace("T", " ").slice(0, 19)
}

function truncate(s: string, n: number): string {
  if (!s) return ""
  return s.length > n ? s.slice(0, n) + "…" : s
}

export default async function AskLogsPage() {
  const rows = await loadLogs()

  return (
    <div style={{ padding: "24px 32px", color: "#e2e8f0", minHeight: "100vh", background: "#0a0f1a" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.2em" }}>
          ASK INTERLIGENS
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: "4px 0 2px", color: "#f1f5f9" }}>
          Audit Trail
        </h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
          {rows.length} most recent interactions · non-blocking log · DB-native
        </p>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: 40,
            border: "1px dashed #1e293b",
            borderRadius: 8,
            color: "#64748b",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          No AskLog entries yet. Either the ASK endpoint hasn&apos;t been called since the
          migration was applied, or the migration hasn&apos;t run. See <code>MIGRATION_ASKLOG.md</code>.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #1e293b",
            borderRadius: 8,
            overflow: "auto",
            maxHeight: "calc(100vh - 140px)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace" }}>
            <thead>
              <tr>
                <th style={headerCell}>Time</th>
                <th style={headerCell}>Scan</th>
                <th style={headerCell}>Question</th>
                <th style={headerCell}>Answer</th>
                <th style={headerCell}>Type</th>
                <th style={headerCell}>Mode</th>
                <th style={headerCell}>Conf.</th>
                <th style={headerCell}>Src</th>
                <th style={headerCell}>Lat</th>
                <th style={headerCell}>Loc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...cellBase, whiteSpace: "nowrap", color: "#94a3b8" }}>
                    {fmtDate(r.createdAt)}
                  </td>
                  <td style={{ ...cellBase, fontFamily: "monospace", color: "#64748b" }}>
                    {r.scanId ? truncate(r.scanId, 10) : "—"}
                  </td>
                  <td style={{ ...cellBase, maxWidth: 220 }}>
                    {truncate(r.userQuestion, 120)}
                  </td>
                  <td style={{ ...cellBase, maxWidth: 320, color: "#e2e8f0" }}>
                    {truncate(r.assistantAnswer, 200)}
                  </td>
                  <td style={{ ...cellBase }}>
                    <span
                      style={{
                        color: typeColor(r.answerType),
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {r.answerType.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ ...cellBase, color: "#94a3b8", fontSize: 10 }}>{r.mode}</td>
                  <td style={{ ...cellBase }}>
                    <span
                      style={{
                        color: tierColor(r.confidenceTier),
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {r.confidenceTier.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...cellBase, textAlign: "right", color: "#64748b" }}>
                    {r.sourceCount}
                  </td>
                  <td style={{ ...cellBase, textAlign: "right", color: "#64748b" }}>
                    {r.latencyMs != null ? r.latencyMs + "ms" : "—"}
                  </td>
                  <td style={{ ...cellBase, color: "#64748b" }}>{r.locale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
