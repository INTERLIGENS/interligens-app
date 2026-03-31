'use client'

import { useState, useMemo, useRef } from 'react'
import type { AnalysisSummary, Chip, ChipIntent, Locale } from '@/lib/explanation/types'
import { generateChips } from '@/lib/explanation/chipGenerator'
import { buildAnalysisSummaryText } from '@/lib/explanation/summaryBuilder'
import { getAnswer } from '@/lib/explanation/answerHandlers'
import { classifyQuestion } from '@/lib/explanation/classifier'
import {
  EXPLANATION_SECTION_LABEL,
  EXPLANATION_DISCLAIMER,
  ASK_MORE_LABEL,
  INPUT_PLACEHOLDER,
  ASK_BUTTON,
  SCOPE_NOTICE,
  REFUSAL_RESPONSE,
  FALLBACK_RESPONSE,
  THINKING_LABEL,
} from '@/lib/explanation/localization'

interface Props {
  summary: AnalysisSummary
  locale: Locale
}

export function ExplanationLayer({ summary, locale }: Props) {
  // Phase 1A state
  const [activeChip, setActiveChip] = useState<ChipIntent | null>(null)

  // Phase 1B state
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Phase 1A — deterministic
  const chips = useMemo(() => generateChips(summary, locale), [summary, locale])
  const summaryText = useMemo(() => buildAnalysisSummaryText(summary, locale), [summary, locale])
  const chipAnswer = useMemo(
    () => (activeChip ? getAnswer(activeChip, summary, locale) : null),
    [activeChip, summary, locale]
  )

  function handleChipClick(intent: ChipIntent) {
    setActiveChip(prev => (prev === intent ? null : intent))
    setAnswer(null)
  }

  // Phase 1B — constrained ask
  async function handleAsk() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const classification = classifyQuestion(trimmed, summary)

    // Deterministic path — reuse handler, no LLM
    if (classification.class === 'deterministic' && classification.intent) {
      const result = getAnswer(classification.intent, summary, locale)
      setAnswer(result.body)
      setActiveChip(null)
      return
    }

    // Refusal path — no LLM
    if (classification.class === 'refusal') {
      setAnswer(REFUSAL_RESPONSE[locale])
      setActiveChip(null)
      return
    }

    // Constrained generation — LLM
    setIsLoading(true)
    setAnswer(null)
    setActiveChip(null)

    try {
      const res = await fetch('/api/scan/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, question: trimmed, locale }),
      })

      if (!res.ok) throw new Error('unavailable')

      const data = await res.json()
      setAnswer(data.answer ?? FALLBACK_RESPONSE[locale])
    } catch {
      setAnswer(FALLBACK_RESPONSE[locale])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAsk()
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-[#0A0A0A] p-5">

      {/* Section label */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#F85B05]/60">
          {EXPLANATION_SECTION_LABEL[locale]}
        </span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      {/* Deterministic summary */}
      <p className="mb-5 text-xs font-medium leading-relaxed text-zinc-400">
        {summaryText}
      </p>

      {/* Phase 1A — chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((chip: Chip) => (
          <button
            key={chip.intent}
            onClick={() => handleChipClick(chip.intent)}
            className={[
              'rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest',
              'border transition-all duration-150',
              activeChip === chip.intent
                ? 'border-[#F85B05] bg-[#F85B05]/10 text-[#F85B05]'
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
            ].join(' ')}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Phase 1A — chip answer */}
      {chipAnswer && !answer && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 mb-4">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#F85B05]/60">
            {chipAnswer.title}
          </p>
          <p className="whitespace-pre-line text-xs font-medium leading-relaxed text-zinc-400">
            {chipAnswer.body}
          </p>
        </div>
      )}

      {/* Phase 1B — ask more */}
      <div className="mt-4 border-t border-zinc-800/60 pt-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
            {ASK_MORE_LABEL[locale]}
          </span>
          <span className="text-[8px] text-zinc-700 uppercase tracking-wider">
            · {SCOPE_NOTICE[locale]}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 300))}
            onKeyDown={handleKeyDown}
            placeholder={INPUT_PLACEHOLDER[locale]}
            disabled={isLoading}
            className={[
              'flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2',
              'text-xs text-zinc-300 placeholder-zinc-600',
              'focus:outline-none focus:border-zinc-600 transition-colors',
              isLoading ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          />
          <button
            onClick={handleAsk}
            disabled={isLoading || !input.trim()}
            className={[
              'rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-widest',
              'transition-all duration-150',
              isLoading || !input.trim()
                ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                : 'border-[#F85B05]/40 text-[#F85B05] hover:bg-[#F85B05]/10',
            ].join(' ')}
          >
            {ASK_BUTTON[locale]}
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <p className="mt-3 text-[10px] text-zinc-600 uppercase tracking-wider animate-pulse">
            {THINKING_LABEL[locale]}
          </p>
        )}

        {/* Answer */}
        {answer && !isLoading && (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4">
            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#F85B05]/60">
              {EXPLANATION_SECTION_LABEL[locale]}
            </p>
            <p className="text-xs font-medium leading-relaxed text-zinc-400">
              {answer}
            </p>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">
        {EXPLANATION_DISCLAIMER[locale]}
      </p>

    </div>
  )
}
