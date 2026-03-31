'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnalysisSummary, Locale } from '@/lib/explanation/types'
import { classifyQuestion } from '@/lib/explanation/classifier'
import { getAnswer } from '@/lib/explanation/answerHandlers'
import { FALLBACK_RESPONSE, REFUSAL_RESPONSE } from '@/lib/explanation/localization'

type ChatMode = 'default' | 'explain' | 'actions' | 'details'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  mode?: ChatMode
}

interface Props {
  summary: AnalysisSummary
  locale: Locale
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const C = {
  askMore:      { en: 'Ask more about this scan',              fr: 'Poser une question sur ce scan' },
  placeholder:  { en: 'e.g. What does the deployer risk mean?', fr: 'ex. Que signifie le risque du wallet ?' },
  ask:          { en: 'Ask',                                   fr: 'Demander' },
  scope:        { en: 'Analysis of this scan only.',           fr: 'Analyse de ce scan uniquement.' },
  thinking:     { en: 'Analyzing…',                       fr: 'Analyse en cours…' },
  disclaimer:   { en: 'Not financial advice. Evidence-based only.', fr: 'Pas un conseil financier. Basé sur les données du scan.' },
  followupUsed: { en: 'Follow-up used. Run a new scan to ask more.', fr: 'Follow-up utilisé. Relance un nouveau scan pour poser d’autres questions.' },
  reset:        { en: 'Reset Q&A',                             fr: 'Réinitialiser la Q&A' },
  resetTip:     { en: 'Clears only this scan’s Q&A thread.', fr: 'Efface uniquement la discussion de ce scan.' },
  counter:      { en: 'Follow-up',                             fr: 'Follow-up' },
  label:        { en: 'INTERLIGENS',                           fr: 'INTERLIGENS' },
  // Button labels
  btnWhy:       { en: 'Why?',                                  fr: 'Pourquoi ?' },
  btnActions:   { en: 'What should I do now?',                 fr: 'Que faire maintenant ?' },
  btnDetails:   { en: 'See details',                           fr: 'Voir les détails' },
  // Mode titles
  titleWhy:     { en: 'Why?',                                  fr: 'Pourquoi ?' },
  titleActions: { en: 'What should I do now?',                 fr: 'Que faire maintenant ?' },
  titleDetails: { en: 'Details',                               fr: 'Détails' },
}

const t = (key: keyof typeof C, locale: Locale): string => C[key][locale]

// ── Retail answer builder ─────────────────────────────────────────────────────

function buildDefaultAnswer(summary: AnalysisSummary, locale: Locale): string {
  const isFr = locale === 'fr'

  // CRITICAL — exact required strings
  if (summary.verdict === 'CRITICAL') {
    return isFr
      ? "Je te conseille de ne pas acheter.\nCette adresse est déjà liée à un dossier d’enquête.\nSi tu veux, je peux te montrer pourquoi."
      : "I recommend you don’t buy.\nThis address is already linked to an investigation file.\nIf you want, I can show you why."
  }

  // HIGH
  if (summary.verdict === 'HIGH') {
    return isFr
      ? "Là, gros warning.\nPlusieurs signaux inquiétants ont été détectés sur cette adresse.\nTu veux que je t'explique ce qui ne va pas ?"
      : "Big warning here.\nSeveral concerning signals were detected on this address.\nWant me to explain what’s wrong?"
  }

  // MODERATE
  if (summary.verdict === 'MODERATE') {
    return isFr
      ? "Pas totalement propre.\nQuelques points méritent attention avant de faire quoi que ce soit.\nTu veux les voir ?"
      : "Not fully clean.\nA few points deserve attention before doing anything.\nWant to see them?"
  }

  // LOW
  return isFr
    ? "Plutôt propre pour l’instant.\nAucun signal critique détecté.\nTu veux quand même vérifier les détails ?"
    : "Relatively clean for now.\nNo critical signals detected.\nWant to check the details anyway?"
}

// ── Mode response builders ────────────────────────────────────────────────────

function buildExplainResponse(summary: AnalysisSummary, locale: Locale): string {
  const isFr = locale === 'fr'
  const title = t('titleWhy', locale)
  const bullets: string[] = []

  // Bullet 1 — case file / investigation / caseDB
  const hasCaseFile = summary.topReasons.some(r =>
    /case|dossier|detective|casedb|referenced|référencé|investigation/i.test(r)
  ) || (summary.intelVaultMatches && summary.intelVaultMatches > 0) || summary.recidivismFlag
  if (hasCaseFile) {
    bullets.push(isFr
      ? 'On a déjà vu cette adresse dans une enquête.'
      : 'This address already appears in an investigation.')
  }

  // Bullet 2 — off-chain / external check
  const hasOffChain = summary.topReasons.some(r =>
    /off.chain|hors.chaîne|external|externe|critical|critique/i.test(r)
  ) || summary.deployerRisk === 'HIGH'
  if (hasOffChain) {
    bullets.push(isFr
      ? 'Des vérifications externes confirment un risque élevé.'
      : 'External checks confirm a high risk.')
  }

  // Bullet 3 — exit / trap signals
  const hasExitSignal = (summary.exitSecurityFlags && summary.exitSecurityFlags.length > 0)
    || summary.topReasons.some(r => /exit|sortie|trap|piège|approv|statut|status/i.test(r))
  if (hasExitSignal) {
    bullets.push(isFr
      ? 'On voit des signaux typiques de pièges (approbations, sorties compliquées, etc.).'
      : 'We see patterns typical of traps (approvals, hard exits, etc.).')
  }

  // Fallback if no bullets matched
  if (bullets.length === 0 && summary.topReasons.length > 0) {
    bullets.push(isFr
      ? 'Plusieurs signaux de risque ont été détectés sur cette adresse.'
      : 'Several risk signals were detected on this address.')
  }

  if (bullets.length === 0) {
    return isFr ? 'Données insuffisantes pour détailler.' : 'Insufficient data to detail.'
  }

  return title + '\n' + bullets.slice(0, 3).map(b => '• ' + b).join('\n')
}

function buildActionsResponse(locale: Locale): string {
  const isFr = locale === 'fr'
  const title = t('titleActions', locale)
  const steps = isFr
    ? [
        'N’interagis pas : pas de swap, pas de signature, pas d’approbation.',
        'Si tu as déjà approuvé : révoque les autorisations.',
        'Si tu as déjà envoyé des fonds : sécurise le reste vers un nouveau wallet.',
      ]
    : [
        'Don’t interact: no swap, no signature, no approvals.',
        'If you already approved: revoke permissions.',
        'If you already sent funds: secure what’s left to a new wallet.',
      ]
  return title + '\n' + steps.map((s, i) => (i + 1) + '. ' + s).join('\n')
}

function buildDetailsResponse(summary: AnalysisSummary, locale: Locale): string {
  const isFr = locale === 'fr'
  const title = t('titleDetails', locale)
  const bullets: string[] = []

  // Internal labels ONLY in details mode
  const hasCaseDB = summary.topReasons.some(r => /case|detective|casedb|referenced|référencé/i.test(r))
    || (summary.intelVaultMatches && summary.intelVaultMatches > 0)
  if (hasCaseDB) {
    bullets.push(isFr
      ? 'Interne : correspondance CaseDB (dossier existant)'
      : 'Internal: CaseDB match (existing file)')
  }

  const hasOffChain = summary.topReasons.some(r => /off.chain|hors.chaîne|investigation/i.test(r))
    || summary.deployerRisk === 'HIGH'
  if (hasOffChain) {
    bullets.push(isFr
      ? 'Interne : investigation hors-chaîne = critique'
      : 'Internal: off-chain investigation = critical')
  }

  if (summary.exitSecurityFlags && summary.exitSecurityFlags.length > 0) {
    const flag = summary.exitSecurityFlags[0]
    bullets.push(isFr
      ? 'Interne : signal de sortie détecté (' + flag + ')'
      : 'Internal: exit signal detected (' + flag + ')')
  }

  if (summary.recidivismFlag) {
    bullets.push(isFr ? 'Interne : acteur récidiviste' : 'Internal: repeat actor')
  }

  if (bullets.length === 0) {
    summary.topReasons.slice(0, 3).forEach(r => bullets.push('• ' + r))
  }

  if (bullets.length === 0) {
    return isFr ? 'Données insuffisantes.' : 'Insufficient data.'
  }

  return title + '\n' + bullets.slice(0, 4).map(b => '• ' + b).join('\n')
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AskInterligensChat({ summary, locale }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [followupsUsed, setFollowupsUsed] = useState(0)
  const maxFollowups = 1
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const limitReached = followupsUsed >= maxFollowups

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, isLoading])

  function addMsg(msg: Omit<ChatMsg, 'id' | 'createdAt'>) {
    setMessages(prev => [...prev, {
      ...msg,
      id: Math.random().toString(36).slice(2),
      createdAt: Date.now(),
    }])
  }

  function handleReset() {
    setMessages([])
    setFollowupsUsed(0)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSubmit(questionOverride?: string, modeOverride?: ChatMode) {
    const trimmed = (questionOverride ?? input).trim()
    if (!trimmed || isLoading || limitReached) return

    addMsg({ role: 'user', content: trimmed })
    setInput('')
    setIsLoading(true)

    const isFollowUp = messages.length > 0
    if (isFollowUp) setFollowupsUsed(prev => prev + 1)

    // Small delay for UX feel
    await new Promise(r => setTimeout(r, 180))

    try {
      // Refusal check
      const classification = classifyQuestion(trimmed, summary)
      if (classification.class === 'refusal') {
        addMsg({ role: 'assistant', content: REFUSAL_RESPONSE[locale], mode: 'default' })
        setIsLoading(false)
        return
      }

      // Deterministic chip handler
      if (classification.class === 'deterministic' && classification.intent) {
        const result = getAnswer(classification.intent, summary, locale)
        addMsg({ role: 'assistant', content: result.body, mode: 'default' })
        setIsLoading(false)
        return
      }

      // Explicit mode from button click
      if (modeOverride === 'explain') {
        addMsg({ role: 'assistant', content: buildExplainResponse(summary, locale), mode: 'explain' })
        setIsLoading(false)
        return
      }
      if (modeOverride === 'actions') {
        addMsg({ role: 'assistant', content: buildActionsResponse(locale), mode: 'actions' })
        setIsLoading(false)
        return
      }
      if (modeOverride === 'details') {
        addMsg({ role: 'assistant', content: buildDetailsResponse(summary, locale), mode: 'details' })
        setIsLoading(false)
        return
      }

      // First message — retail default answer
      if (!isFollowUp) {
        addMsg({ role: 'assistant', content: buildDefaultAnswer(summary, locale), mode: 'default' })
        setIsLoading(false)
        return
      }

      // Follow-up free text — LLM
      const res = await fetch('/api/scan/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, question: trimmed, locale }),
      })
      if (!res.ok) throw new Error('unavailable')
      const data = await res.json()
      addMsg({ role: 'assistant', content: data.answer ?? FALLBACK_RESPONSE[locale], mode: 'default' })
    } catch {
      addMsg({ role: 'assistant', content: FALLBACK_RESPONSE[locale], mode: 'default' })
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const showButtons = !!lastAssistantMsg && !limitReached

  const ACTION_BUTTONS: { label: string; mode: ChatMode }[] = [
    { label: t('btnWhy', locale),     mode: 'explain' },
    { label: t('btnActions', locale), mode: 'actions' },
    { label: t('btnDetails', locale), mode: 'details' },
  ]

  return (
    <div className="mt-4 border-t border-zinc-800/60 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
            {t('askMore', locale)}
          </span>
          <span className="text-[8px] text-zinc-700 uppercase tracking-wider">
            · {t('scope', locale)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-zinc-700">
            {t('counter', locale)}: {followupsUsed}/{maxFollowups}
          </span>
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              title={t('resetTip', locale)}
              className="font-mono text-[9px] uppercase tracking-wider text-zinc-600 hover:text-[#F85B05]/60 transition-colors"
            >
              {t('reset', locale)}
            </button>
          )}
        </div>
      </div>

      {/* Message thread */}
      {messages.length > 0 && (
        <div
          ref={threadRef}
          className="mb-3 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 scroll-smooth"
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div className={[
                'rounded-xl px-3 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'max-w-[60%] bg-zinc-800 text-zinc-300 text-right'
                  : 'max-w-[78%] bg-zinc-900/60 border border-zinc-800 text-zinc-300 text-left',
              ].join(' ')}>
                {msg.role === 'assistant' && (
                  <span className="block text-[8px] font-black uppercase tracking-[0.15em] text-[#F85B05]/60 mb-1">
                    {t('label', locale)}
                  </span>
                )}
                <span className="whitespace-pre-line block">{msg.content}</span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-3 py-2">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 animate-pulse">
                  {t('thinking', locale)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick action buttons */}
      {showButtons && (
        <div className="flex flex-wrap gap-2 mb-3">
          {ACTION_BUTTONS.map(btn => (
            <button
              key={btn.mode}
              onClick={() => handleSubmit(btn.label, btn.mode)}
              disabled={isLoading}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:border-[#F85B05]/40 hover:text-zinc-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Input or lock banner */}
      {limitReached ? (
        <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/20 px-4 py-2.5 text-[10px] text-zinc-600 text-center">
          {t('followupUsed', locale)}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 300))}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder', locale)}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
            className="rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-150 border-[#F85B05]/40 text-[#F85B05] hover:bg-[#F85B05]/10 disabled:border-zinc-800 disabled:text-zinc-700 disabled:cursor-not-allowed"
          >
            {t('ask', locale)}
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">
        {t('disclaimer', locale)}
      </p>
    </div>
  )
}
