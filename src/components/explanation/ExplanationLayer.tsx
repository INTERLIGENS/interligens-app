'use client'

import { useState, useMemo } from 'react'
import type { AnalysisSummary, Chip, ChipIntent, Locale } from '@/lib/explanation/types'
import { generateChips } from '@/lib/explanation/chipGenerator'
import { buildAnalysisSummaryText } from '@/lib/explanation/summaryBuilder'
import { getAnswer } from '@/lib/explanation/answerHandlers'
import { EXPLANATION_DISCLAIMER } from '@/lib/explanation/localization'
import { AskInterligensChat } from './AskInterligensChat'

interface Props {
  summary: AnalysisSummary
  locale: Locale
}

export function ExplanationLayer({ summary, locale }: Props) {
  const [activeChip, setActiveChip] = useState<ChipIntent | null>(null)

  const chips = useMemo(() => generateChips(summary, locale), [summary, locale])
  const summaryText = useMemo(() => buildAnalysisSummaryText(summary, locale), [summary, locale])
  const chipAnswer = useMemo(
    () => (activeChip ? getAnswer(activeChip, summary, locale) : null),
    [activeChip, summary, locale]
  )

  function handleChipClick(intent: ChipIntent) {
    setActiveChip(prev => (prev === intent ? null : intent))
  }

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-[#0A0A0A] p-5">

      {/* Deterministic summary */}
      <p className="mb-5 text-xs font-medium leading-relaxed text-zinc-400">
        {summaryText}
      </p>

      {/* Phase 1A chips — 2x2 grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {chips.map((chip: Chip) => (
          <button
            key={chip.intent}
            onClick={() => handleChipClick(chip.intent)}
            className={[
              'rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-center',
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

      {/* Phase 1A chip answer */}
      {chipAnswer && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 mb-4">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#F85B05]/60">
            {chipAnswer.title}
          </p>
          <p className="whitespace-pre-line text-xs font-medium leading-relaxed text-zinc-400">
            {chipAnswer.body}
          </p>
        </div>
      )}

      {/* Phase 1B — threaded chat */}
      <AskInterligensChat summary={summary} locale={locale} />

      {/* Disclaimer */}
      <p className="mt-4 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">
        {EXPLANATION_DISCLAIMER[locale]}
      </p>

    </div>
  )
}
