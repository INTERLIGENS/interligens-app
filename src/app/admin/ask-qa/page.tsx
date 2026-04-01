'use client'

import { useState, useRef, useEffect } from 'react'
import { QA_FIXTURES, type QAFixture, type QATurn } from '@/lib/qa/fixtures'
import type { AnalysisSummary } from '@/lib/explanation/types'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Tone flag detection ───────────────────────────────────────────────────────

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

// ── API caller ────────────────────────────────────────────────────────────────

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
    body: JSON.stringify({
      summary,
      question,
      locale,
      history: history.slice(-6),
      offeredBranch,
    }),
  })
  const ms = Date.now() - start
  if (!res.ok) throw new Error('API error ' + res.status)
  const data = await res.json()
  return { answer: data.answer ?? '[no answer]', ms }
}

// ── Extract offered branch ────────────────────────────────────────────────────

function extractBranch(text: string): string | null {
  if (/montrer pourquoi|show you why|explain why|te dire pourquoi/i.test(text)) return 'explain_why'
  if (/wallet.*lancement|launch wallet|déployeur|deployer/i.test(text) && /\?/.test(text)) return 'show_deployer'
  if (/liquidity|liquidit/i.test(text) && /\?/.test(text)) return 'show_liquidity'
  if (/détails|details/i.test(text) && /\?/.test(text)) return 'show_details'
  return null
}

// ── Components ────────────────────────────────────────────────────────────────

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
    <div className={['rounded border p-3 mb-2', hasFlags ? 'border-red-900/40 bg-red-950/10' : 'border-zinc-800 bg-zinc-900/30'].join(' ')}>
      {/* User */}
      <div className="flex items-start gap-2 mb-2">
        <span className="font-mono text-[9px] text-cyan-500 uppercase mt-0.5 w-16 flex-shrink-0">Turn {index + 1} / User</span>
        <span className="text-xs text-zinc-400 italic">"{turn.user}"</span>
      </div>
      {/* Assistant */}
      <div className="flex items-start gap-2 mb-2">
        <span className="font-mono text-[9px] text-[#F85B05]/70 uppercase mt-0.5 w-16 flex-shrink-0">ASK</span>
        <span className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{turn.assistant}</span>
      </div>
      {/* Meta */}
      <div className="flex items-center gap-2 flex-wrap mt-1">
        <span className="font-mono text-[9px] text-zinc-600">{turn.ms}ms</span>
        {turn.expectedTone && (
          <span className="font-mono text-[9px] text-zinc-600">expect: {turn.expectedTone}</span>
        )}
        {turn.flags.map(f => <FlagBadge key={f} flag={f} />)}
        {!hasFlags && <span className="font-mono text-[9px] text-green-600">✓ clean</span>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

        const { answer, ms } = await callAsk(
          fixture.summary,
          turn.user,
          fixture.locale,
          history,
          offeredBranch
        )

        const flags = detectFlags(answer)
        turns.push({ user: turn.user, assistant: answer, expectedTone: turn.expectedTone, ms, flags })

        history.push({ role: 'user', content: turn.user })
        history.push({ role: 'assistant', content: answer })
        offeredBranch = extractBranch(answer)

        // Small delay between turns
        await new Promise(r => setTimeout(r, 600))
      }

      setResults(prev => ({ ...prev, [fixture.id]: { fixture, turns, status: 'done' } }))
    } catch (e) {
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

  function stopAll() {
    abortRef.current = true
    setRunningAll(false)
  }

  function totalFlags(id: string) {
    return results[id]?.turns.flatMap(t => t.flags).length ?? 0
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center">
        <div className="bg-[#111318] border border-[#1E2330] rounded-xl p-8 w-80">
          <p className="font-mono text-[10px] text-[#FFB800] uppercase tracking-widest mb-4">ASK INTERLIGENS · QA</p>
          <input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && auth()}
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 mb-3"
          />
          <button
            onClick={auth}
            className="w-full bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] font-mono text-xs uppercase tracking-widest py-2 rounded hover:bg-[#FFB800]/20 transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  const selectedFixture = QA_FIXTURES.find(f => f.id === selected)
  const selectedResult = selected ? results[selected] : null

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E8EAF0]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div className="border-b border-[#1E2330] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#FFB800] uppercase tracking-widest">INTERLIGENS · ASK QA</span>
          <span className="font-mono text-[9px] text-[#7A8599]">Internal only · {QA_FIXTURES.length} fixtures</span>
        </div>
        <div className="flex items-center gap-2">
          {runningAll ? (
            <button onClick={stopAll} className="font-mono text-[10px] uppercase tracking-wider text-red-400 border border-red-900/40 px-3 py-1.5 rounded hover:bg-red-900/20 transition-colors">
              Stop
            </button>
          ) : (
            <button onClick={runAll} className="font-mono text-[10px] uppercase tracking-wider text-[#FFB800] border border-[#FFB800]/30 px-3 py-1.5 rounded hover:bg-[#FFB800]/10 transition-colors">
              Run All
            </button>
          )}
        </div>
      </div>

      <div className="flex h-[calc(100vh-49px)]">

        {/* Sidebar — fixture list */}
        <div className="w-72 border-r border-[#1E2330] overflow-y-auto flex-shrink-0">
          {QA_FIXTURES.map(fixture => {
            const result = results[fixture.id]
            const flags = totalFlags(fixture.id)
            const status = result?.status
            return (
              <button
                key={fixture.id}
                onClick={() => setSelected(fixture.id)}
                className={[
                  'w-full text-left px-4 py-3 border-b border-[#1E2330] transition-colors',
                  selected === fixture.id ? 'bg-[#FFB800]/5 border-l-2 border-l-[#FFB800]' : 'hover:bg-zinc-900/40',
                ].join(' ')}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] text-[#7A8599] uppercase">
                    {fixture.locale.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1">
                    {status === 'running' && <span className="font-mono text-[9px] text-[#FFB800] animate-pulse">running</span>}
                    {status === 'done' && flags === 0 && <span className="font-mono text-[9px] text-green-500">✓</span>}
                    {status === 'done' && flags > 0 && <span className="font-mono text-[9px] text-red-400">{flags} flags</span>}
                    {status === 'error' && <span className="font-mono text-[9px] text-red-500">error</span>}
                    {!status && (
                      <button
                        onClick={e => { e.stopPropagation(); runFixture(fixture) }}
                        className="font-mono text-[9px] text-[#7A8599] hover:text-[#FFB800] transition-colors"
                      >
                        run ▶
                      </button>
                    )}
                  </div>
                </div>
                <span className="text-xs text-zinc-300 leading-snug block">{fixture.label}</span>
              </button>
            )
          })}
        </div>

        {/* Main panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected && (
            <div className="flex items-center justify-center h-full">
              <p className="font-mono text-[11px] text-[#7A8599] uppercase tracking-widest">Select a fixture or Run All</p>
            </div>
          )}

          {selected && selectedFixture && (
            <div>
              {/* Fixture header */}
              <div className="mb-4 pb-4 border-b border-[#1E2330]">
                <h2 className="font-mono text-sm text-[#FFB800] mb-1">{selectedFixture.label}</h2>
                <div className="flex gap-6 text-[11px] text-[#7A8599]">
                  <span>Verdict: <strong className="text-zinc-300">{selectedFixture.summary.verdict}</strong></span>
                  <span>Score: <strong className="text-zinc-300">{selectedFixture.summary.tigerScore}/100</strong></span>
                  <span>Chain: <strong className="text-zinc-300">{selectedFixture.summary.chain}</strong></span>
                  <span>Locale: <strong className="text-zinc-300">{selectedFixture.locale}</strong></span>
                </div>
                <div className="mt-2 flex gap-4 text-[11px]">
                  <span className="text-green-600">✓ {selectedFixture.toneExpected}</span>
                </div>
                <div className="mt-1 text-[11px] text-red-500/70">
                  ⚠ Watch: {selectedFixture.toneRed}
                </div>
              </div>

              {/* Run button */}
              {selectedResult?.status !== 'running' && (
                <button
                  onClick={() => runFixture(selectedFixture)}
                  className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[#FFB800] border border-[#FFB800]/30 px-4 py-1.5 rounded hover:bg-[#FFB800]/10 transition-colors"
                >
                  {selectedResult ? 'Re-run ▶' : 'Run ▶'}
                </button>
              )}
              {selectedResult?.status === 'running' && (
                <p className="mb-4 font-mono text-[10px] text-[#FFB800] animate-pulse uppercase tracking-wider">Running…</p>
              )}

              {/* Results */}
              {selectedResult?.turns.map((turn, i) => (
                <TurnCard key={i} turn={turn} index={i} />
              ))}

              {/* Summary */}
              {selectedResult?.status === 'done' && (
                <div className={[
                  'mt-4 rounded border px-4 py-3 font-mono text-xs',
                  totalFlags(selected) === 0
                    ? 'border-green-900/40 bg-green-950/10 text-green-400'
                    : 'border-red-900/40 bg-red-950/10 text-red-400',
                ].join(' ')}>
                  {totalFlags(selected) === 0
                    ? `✓ All ${selectedResult.turns.length} turns clean`
                    : `⚠ ${totalFlags(selected)} flag(s) across ${selectedResult.turns.length} turns`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
