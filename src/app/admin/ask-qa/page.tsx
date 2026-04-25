'use client'

import { useState, useRef } from 'react'
import { QA_FIXTURES, type QAFixture } from '@/lib/qa/fixtures'
import type { AnalysisSummary } from '@/lib/explanation/types'

interface TurnResult {
  user: string
  assistant: string
  expectedTone?: string
  ms: number
  flags: string[]
}

interface RunResult {
  fixture: QAFixture
  turns: TurnResult[]
  status: 'idle' | 'running' | 'done' | 'error'
}

function detectFlags(text: string): string[] {
  const flags: string[] = []
  const t = text.toLowerCase()
  if (t.length > 400) flags.push('TOO_LONG')
  if (/according to|based on|this asset|the scan indicates/i.test(text)) flags.push('CORPORATE')
  if (/le verdict .* signifie|the .* verdict means|verdict critique signifie/i.test(text)) flags.push('REPORT_STYLE')
  if (/je ne peux pas|i cannot|i am unable|i can't provide/i.test(text)) flags.push('BLOCKED')
  if (/financial advice|conseil financier|investment advice/i.test(text)) flags.push('REPEATED_DISCLAIMER')
  if (/sur ce scan, je vois|on this scan, i see/i.test(text)) flags.push('REPORT_OPENER')
  if (text.split('?').length > 3) flags.push('TOO_MANY_QUESTIONS')
  if (/```|`[A-Z0-9]{20,}/i.test(text)) flags.push('RAW_DATA')
  if (/new scan|nouveau scan|relance un scan/i.test(text)) flags.push('DEAD_END')
  return flags
}

async function callAsk(
  summary: AnalysisSummary,
  question: string,
  locale: string,
  history: Array<{ role: string; content: string }>,
  offeredBranch: string | null
): Promise<{ answer: string; ms: number }> {
  const start = Date.now()
  const res = await fetch('/api/scan/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary, question, locale, history: history.slice(-6), offeredBranch }),
  })
  const ms = Date.now() - start
  if (!res.ok) throw new Error('API error ' + res.status)
  const data = await res.json()
  return { answer: data.answer ?? '[no answer]', ms }
}

function extractBranch(text: string): string | null {
  if (/montrer pourquoi|show you why|explain why|te dire pourquoi/i.test(text)) return 'explain_why'
  if (/wallet.*lancement|launch wallet|déployeur|deployer/i.test(text) && /\?/.test(text)) return 'show_deployer'
  if (/liquidity|liquidit/i.test(text) && /\?/.test(text)) return 'show_liquidity'
  if (/détails|details/i.test(text) && /\?/.test(text)) return 'show_details'
  return null
}

function FlagBadge({ flag }: { flag: string }) {
  const colors: Record<string, string> = {
    TOO_LONG: 'bg-orange-900/40 text-orange-400',
    CORPORATE: 'bg-red-900/40 text-red-400',
    REPORT_STYLE: 'bg-red-900/40 text-red-400',
    BLOCKED: 'bg-red-900/40 text-red-400',
    REPEATED_DISCLAIMER: 'bg-yellow-900/40 text-yellow-400',
    REPORT_OPENER: 'bg-red-900/40 text-red-400',
    TOO_MANY_QUESTIONS: 'bg-orange-900/40 text-orange-400',
    RAW_DATA: 'bg-red-900/60 text-red-300',
    DEAD_END: 'bg-red-900/60 text-red-300',
  }
  return (
    <span className={['font-mono text-[9px] px-1.5 py-0.5 rounded', colors[flag] ?? 'bg-zinc-800 text-zinc-400'].join(' ')}>
      {flag}
    </span>
  )
}

function TurnCard({ turn, index }: { turn: TurnResult; index: number }) {
  const hasFlags = turn.flags.length > 0
  return (
    <div className={['rounded-xl border p-5 mb-2', hasFlags ? 'border-red-700 bg-red-900/30' : 'border-zinc-800 bg-zinc-900'].join(' ')}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs text-[#FF6B00] uppercase mt-0.5 w-16 flex-shrink-0">Turn {index + 1} / User</span>
        <span className="text-xs text-zinc-400 italic">"{turn.user}"</span>
      </div>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs text-orange-400/70 uppercase mt-0.5 w-16 flex-shrink-0">ASK</span>
        <span className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{turn.assistant}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        <span className="text-xs text-zinc-500">{turn.ms}ms</span>
        {turn.expectedTone && <span className="text-xs text-zinc-500">expect: {turn.expectedTone}</span>}
        {turn.flags.map(f => <FlagBadge key={f} flag={f} />)}
        {!hasFlags && <span className="text-xs text-green-400">clean</span>}
      </div>
    </div>
  )
}

export default function AskQAPage() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, RunResult>>({})
  const [runningAll, setRunningAll] = useState(false)
  const abortRef = useRef(false)

  function auth() {
    if (token.trim()) setAuthed(true)
  }

  async function runFixture(fixture: QAFixture) {
    setResults(prev => ({ ...prev, [fixture.id]: { fixture, turns: [], status: 'running' } }))
    const history: Array<{ role: string; content: string }> = []
    const turns: TurnResult[] = []
    let offeredBranch: string | null = null
    try {
      for (const turn of fixture.turns) {
        if (abortRef.current) break
        const { answer, ms } = await callAsk(fixture.summary, turn.user, fixture.locale, history, offeredBranch)
        const flags = detectFlags(answer)
        turns.push({ user: turn.user, assistant: answer, expectedTone: turn.expectedTone, ms, flags })
        history.push({ role: 'user', content: turn.user })
        history.push({ role: 'assistant', content: answer })
        offeredBranch = extractBranch(answer)
        await new Promise(r => setTimeout(r, 600))
      }
      setResults(prev => ({ ...prev, [fixture.id]: { fixture, turns, status: 'done' } }))
    } catch {
      setResults(prev => ({ ...prev, [fixture.id]: { fixture, turns, status: 'error' } }))
    }
  }

  async function runAll() {
    setRunningAll(true)
    abortRef.current = false
    for (const fixture of QA_FIXTURES) {
      if (abortRef.current) break
      await runFixture(fixture)
      await new Promise(r => setTimeout(r, 800))
    }
    setRunningAll(false)
  }

  function stopAll() { abortRef.current = true; setRunningAll(false) }
  function totalFlags(id: string) { return results[id]?.turns.flatMap(t => t.flags).length ?? 0 }

  if (!authed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4 w-80">
          <h2 className="text-xs font-black uppercase tracking-widest text-[#FF6B00]">ASK Interligens · QA</h2>
          <input
            type="password" placeholder="Admin token" value={token}
            onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && auth()}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B00]"
          />
          <button onClick={auth} className="w-full bg-[#FF6B00] hover:bg-orange-400 text-black font-bold py-3 rounded-xl transition text-sm">
            Enter
          </button>
        </div>
      </div>
    )
  }

  const selectedFixture = QA_FIXTURES.find(f => f.id === selected)
  const selectedResult = selected ? results[selected] : null

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black uppercase tracking-widest text-[#FF6B00]">ASK QA</h1>
          <span className="text-sm text-zinc-400">Internal only · {QA_FIXTURES.length} fixtures</span>
        </div>
        <div className="flex items-center gap-2">
          {runningAll ? (
            <button onClick={stopAll} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-zinc-800 text-red-400 hover:bg-zinc-700 transition">Stop</button>
          ) : (
            <button onClick={runAll} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#FF6B00] hover:bg-orange-400 text-black transition">Run All</button>
          )}
        </div>
      </div>

      <div className="flex h-[calc(100vh-49px)]">
        {/* Sidebar */}
        <div className="w-72 border-r border-zinc-800 overflow-y-auto flex-shrink-0 bg-zinc-900">
          {QA_FIXTURES.map(fixture => {
            const result = results[fixture.id]
            const flags = totalFlags(fixture.id)
            const status = result?.status
            return (
              <button key={fixture.id} onClick={() => setSelected(fixture.id)}
                className={['w-full text-left px-4 py-3 border-b border-zinc-800 transition',
                  selected === fixture.id ? 'bg-zinc-800 border-l-2 border-l-[#FF6B00]' : 'hover:bg-white/5',
                ].join(' ')}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">{fixture.locale.toUpperCase()}</span>
                  <div className="flex items-center gap-1">
                    {status === 'running' && <span className="text-xs text-[#FF6B00] animate-pulse">running</span>}
                    {status === 'done' && flags === 0 && <span className="text-xs text-green-400">ok</span>}
                    {status === 'done' && flags > 0 && <span className="text-xs text-red-400">{flags} flags</span>}
                    {status === 'error' && <span className="text-xs text-red-400">error</span>}
                    {!status && (
                      <button onClick={e => { e.stopPropagation(); runFixture(fixture) }}
                        className="text-xs text-zinc-400 hover:text-[#FF6B00] transition">run</button>
                    )}
                  </div>
                </div>
                <span className="text-sm text-zinc-300 leading-snug block">{fixture.label}</span>
              </button>
            )
          })}
        </div>

        {/* Main panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">Select a fixture or Run All</p>
            </div>
          )}
          {selected && selectedFixture && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-[#FF6B00]">{selectedFixture.label}</h2>
                <div className="flex gap-6 text-xs text-zinc-500 flex-wrap">
                  <span>Verdict: <strong className="text-zinc-300">{selectedFixture.summary.verdict}</strong></span>
                  <span>Score: <strong className="text-zinc-300">{selectedFixture.summary.tigerScore}/100</strong></span>
                  <span>Chain: <strong className="text-zinc-300">{selectedFixture.summary.chain}</strong></span>
                  <span>Locale: <strong className="text-zinc-300">{selectedFixture.locale}</strong></span>
                </div>
                <div className="text-xs text-green-400">{selectedFixture.toneExpected}</div>
                <div className="text-xs text-red-400/70">Watch: {selectedFixture.toneRed}</div>
              </div>

              {selectedResult?.status !== 'running' && (
                <button onClick={() => runFixture(selectedFixture)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#FF6B00] hover:bg-orange-400 text-black transition">
                  {selectedResult ? 'Re-run' : 'Run'}
                </button>
              )}
              {selectedResult?.status === 'running' && (
                <p className="text-sm text-[#FF6B00] animate-pulse uppercase tracking-wider">Running...</p>
              )}

              {selectedResult?.turns.map((turn, i) => <TurnCard key={i} turn={turn} index={i} />)}

              {selectedResult?.status === 'done' && (
                <div className={['mt-4 rounded border px-4 py-3 font-mono text-xs',
                  totalFlags(selected) === 0 ? 'border-green-900/40 bg-green-950/10 text-green-400' : 'border-red-900/40 bg-red-950/10 text-red-400',
                ].join(' ')}>
                  {totalFlags(selected) === 0
                    ? `All ${selectedResult.turns.length} turns clean`
                    : `${totalFlags(selected)} flag(s) across ${selectedResult.turns.length} turns`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
