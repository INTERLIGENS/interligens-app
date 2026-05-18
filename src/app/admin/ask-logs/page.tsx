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

function tierColorCls(tier: string): string {
  if (tier === "high") return "text-green-400"
  if (tier === "medium") return "text-orange-400"
  return "text-gray-400"
}

function typeBadgeCls(type: string): string {
  if (type === "constrained_generation")
    return "bg-orange-500/15 text-orange-400 border border-orange-500/40"
  if (type === "refusal")
    return "bg-red-500/15 text-red-400 border border-red-500/40"
  return "bg-white/5 text-white border border-white/20"
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
function fmtDate(d: Date): string {
  const dt = new Date(d)
  const day = dt.getDate()
  const mon = MONTHS[dt.getMonth()]
  const yr = dt.getFullYear()
  const hh = String(dt.getHours()).padStart(2, "0")
  const mm = String(dt.getMinutes()).padStart(2, "0")
  return `${day} ${mon} ${yr} · ${hh}:${mm}`
}

function truncate(s: string, n: number): string {
  if (!s) return ""
  return s.length > n ? s.slice(0, n) + "…" : s
}

export default async function AskLogsPage() {
  const rows = await loadLogs()

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-orange-400">Audit Trail</h1>
          <p className="text-gray-400 text-sm">
            {rows.length} most recent interactions · non-blocking log · DB-native
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
            No AskLog entries yet. Either the ASK endpoint hasn&apos;t been called since the
            migration was applied, or the migration hasn&apos;t run. See <code>MIGRATION_ASKLOG.md</code>.
          </div>
        ) : (
          <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 overflow-x-auto max-h-[calc(100vh-180px)]">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="text-left py-2 px-3 font-semibold whitespace-nowrap">Time</th>
                  <th className="text-left py-2 px-3 font-semibold">Scan</th>
                  <th className="text-left py-2 px-3 font-semibold">Question</th>
                  <th className="text-left py-2 px-3 font-semibold min-w-[300px]">Answer</th>
                  <th className="text-left py-2 px-3 font-semibold">Type</th>
                  <th className="text-left py-2 px-3 font-semibold">Mode</th>
                  <th className="text-left py-2 px-3 font-semibold">Conf.</th>
                  <th className="text-left py-2 px-3 font-semibold">Src</th>
                  <th className="text-left py-2 px-3 font-semibold">Lat</th>
                  <th className="text-left py-2 px-3 font-semibold">Loc</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-800 hover:bg-[#0a0a0a]/50 transition align-top">
                    <td className="py-2 px-3 whitespace-nowrap text-gray-400">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap" title={r.scanId ?? ""}>
                      {r.scanId ? truncate(r.scanId, 20) : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-300 whitespace-nowrap" title={r.userQuestion}>
                      {truncate(r.userQuestion, 20)}
                    </td>
                    <td className="py-2 px-3 text-gray-300">
                      <div
                        className="whitespace-normal break-words text-[12px] leading-relaxed min-w-[300px] max-w-[420px] max-h-[120px] overflow-y-auto pr-1"
                      >
                        {r.assistantAnswer}
                      </div>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${typeBadgeCls(r.answerType)}`}
                      >
                        {r.answerType.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-xs">{r.mode}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs font-semibold ${tierColorCls(r.confidenceTier)}`}>
                        {r.confidenceTier.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {r.sourceCount}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {r.latencyMs != null ? r.latencyMs + "ms" : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-500">{r.locale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
