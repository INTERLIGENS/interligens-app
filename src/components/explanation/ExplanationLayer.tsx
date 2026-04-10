'use client'

import { useState, useMemo } from 'react'
import type { AnalysisSummary, Chip, ChipIntent, Locale } from '@/lib/explanation/types'
import { generateChips } from '@/lib/explanation/chipGenerator'
import { buildAnalysisSummaryText } from '@/lib/explanation/summaryBuilder'
import { getAnswer } from '@/lib/explanation/answerHandlers'
import { EXPLANATION_SECTION_LABEL, EXPLANATION_DISCLAIMER } from '@/lib/explanation/localization'
import { AskInterligensChat } from './AskInterligensChat'

interface Props {
  summary: AnalysisSummary
  locale: Locale
}

const SEE_MORE = { en: 'See more', fr: 'Voir plus' }
const SEE_LESS = { en: 'See less', fr: 'Voir moins' }

export function ExplanationLayer({ summary, locale }: Props) {
  const [activeChip, setActiveChip] = useState<ChipIntent | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  const chips = useMemo(() => generateChips(summary, locale), [summary, locale])
  const summaryText = useMemo(() => buildAnalysisSummaryText(summary, locale), [summary, locale])
  const chipAnswer = useMemo(
    () => (activeChip ? getAnswer(activeChip, summary, locale) : null),
    [activeChip, summary, locale]
  )

  // Truncate summary if it's long enough to warrant a "see more"
  const isSummaryLong = summaryText.length > 140
  const showFullSummary = summaryExpanded || !isSummaryLong

  function handleChipClick(intent: ChipIntent) {
    setActiveChip(prev => (prev === intent ? null : intent))
  }

  // Primary action = first chip; secondary = the rest
  const [primaryChip, ...secondaryChips] = chips

  return (
    <div className="w-full rounded-2xl border border-zinc-800/80 bg-[#0A0A0A] px-5 py-6 sm:px-6 sm:py-7">

      {/* ── Editorial title ── */}
      <h3 className="text-[13px] sm:text-sm font-black uppercase tracking-[0.18em] text-white">
        {EXPLANATION_SECTION_LABEL[locale]}
        <span className="text-[#F85B05]">.</span>
      </h3>

      {/* ── Summary — light, max 2 lines on mobile, see more if long ── */}
      <div className="mt-4">
        <p
          className={[
            'text-[13px] leading-relaxed text-zinc-400',
            showFullSummary ? '' : 'line-clamp-2',
          ].join(' ')}
        >
          {summaryText}
        </p>
        {isSummaryLong && (
          <button
            onClick={() => setSummaryExpanded(v => !v)}
            className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-[#F85B05] transition-colors"
          >
            {summaryExpanded ? SEE_LESS[locale] : SEE_MORE[locale]}
          </button>
        )}
      </div>

      {/* ── Quick actions — 1 primary + secondary chips ── */}
      <div className="mt-6 space-y-3">
        {primaryChip && (
          <button
            onClick={() => handleChipClick(primaryChip.intent)}
            className={[
              'w-full rounded-xl px-4 py-3 text-left',
              'flex items-center justify-between gap-3',
              'border transition-all duration-150',
              activeChip === primaryChip.intent
                ? 'border-[#F85B05] bg-[#F85B05]/10'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-[#F85B05]/40 hover:bg-[#F85B05]/5',
            ].join(' ')}
          >
            <span
              className={[
                'text-[12px] font-black uppercase tracking-[0.15em]',
                activeChip === primaryChip.intent ? 'text-[#F85B05]' : 'text-zinc-200',
              ].join(' ')}
            >
              {primaryChip.label}
            </span>
            <span
              className={[
                'text-base shrink-0',
                activeChip === primaryChip.intent ? 'text-[#F85B05]' : 'text-zinc-600',
              ].join(' ')}
            >
              →
            </span>
          </button>
        )}

        {secondaryChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {secondaryChips.map((chip: Chip) => (
              <button
                key={chip.intent}
                onClick={() => handleChipClick(chip.intent)}
                className={[
                  'rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider',
                  'border transition-all duration-150',
                  activeChip === chip.intent
                    ? 'border-[#F85B05] bg-[#F85B05]/10 text-[#F85B05]'
                    : 'border-zinc-800/80 bg-transparent text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
                ].join(' ')}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Chip answer — lighter, no heavy box ── */}
      {chipAnswer && (
        <div className="mt-4 px-4 py-3 border-l-2 border-[#F85B05]/40">
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#F85B05]/70">
            {chipAnswer.title}
          </p>
          <p className="whitespace-pre-line text-[12px] leading-relaxed text-zinc-400">
            {chipAnswer.body}
          </p>
        </div>
      )}

      {/* ── Transition by space, not by line — chat input is the hero ── */}
      <div className="mt-7">
        <AskInterligensChat summary={summary} locale={locale} />
      </div>

      {/* ── Single discreet disclaimer ── */}
      <p className="mt-5 text-[9px] font-medium tracking-wide text-zinc-700 text-center">
        {EXPLANATION_DISCLAIMER[locale]}
      </p>

    </div>
  )
}
