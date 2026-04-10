'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { AnalysisSummary, Locale } from '@/lib/explanation/types'
import { classifyQuestion } from '@/lib/explanation/classifier'
import { getAnswer } from '@/lib/explanation/answerHandlers'
import { FALLBACK_RESPONSE, REFUSAL_RESPONSE } from '@/lib/explanation/localization'
import { IntelligenceModeBadge } from '@/components/intelligence/IntelligenceModeBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

type TopicKey =
  | 'score' | 'red_flags' | 'what_to_do' | 'deployer'
  | 'holder' | 'liquidity' | 'recidivism' | 'intel_vault'
  | 'already_bought' | 'influencer' | 'developer_unknown'
  | 'linked_projects' | 'general'

interface Props {
  summary: AnalysisSummary
  locale: Locale
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const C = {
  askMore:     { en: 'Ask about this scan',                      fr: 'Poser une question' },
  placeholder: { en: 'Ask a question…',                          fr: 'Pose une question…' },
  ask:         { en: 'Ask',                                      fr: 'Envoyer' },
  scope:       { en: '',                                         fr: '' },
  thinking:    { en: 'Analyzing…',                          fr: 'En cours…' },
  disclaimer:  { en: 'Not financial advice. Evidence-based.',    fr: 'Pas un conseil financier. Basé sur les données du scan.' },
  reset:       { en: 'Clear',                                    fr: 'Effacer' },
  resetTip:    { en: 'Clear this conversation',                  fr: 'Effacer cette conversation' },
  label:       { en: 'INTERLIGENS',                              fr: 'INTERLIGENS' },
  btnWhy:      { en: 'Why?',                                     fr: 'Pourquoi ?' },
  btnActions:  { en: 'What should I do?',                        fr: 'Que faire ?' },
  btnDetails:  { en: 'Details',                                  fr: 'Détails' },
  unavailable: { en: 'In-depth analysis temporarily unavailable. The scan result above is still complete.', fr: 'Analyse approfondie temporairement indisponible. Le résultat du scan ci-dessus reste complet.' },
}

const t = (key: keyof typeof C, locale: Locale): string => C[key][locale]

// ── Short confirmation detection ───────────────────────────────────────────────

function isShortConfirmation(input: string): boolean {
  return /^(ok|oui|ouais|vas-y|vas y|go|sure|yes|yeah|yep|d.accord|allez|montre|show me|continue|ok go|let.s go|tell me|dis moi|dis-moi)$/i.test(input.trim())
}

// ── Topic detection from user input ───────────────────────────────────────────

function detectTopic(input: string): TopicKey | null {
  const q = input.toLowerCase()
  if (/achet|buy|invest|purchase|safe|cool/.test(q)) return 'what_to_do'
  if (/déployeur|deployer|wallet.*lanc|launch.*wallet|créateur|creator/.test(q)) return 'deployer'
  if (/holders?|concentration|wallets?.*(contrô|hold)/.test(q)) return 'holder'
  if (/liquid/.test(q)) return 'liquidity'
  if (/récidiv|repeat|again|encore/.test(q)) return 'recidivism'
  if (/intel|vault|watchlist/.test(q)) return 'intel_vault'
  if (/déjà.*achet|already.*bought|already.*paid|j.ai.*achet|j.ai.*envoy/.test(q)) return 'already_bought'
  if (/influenceur|influencer|callé|called|tweet|posted/.test(q)) return 'influencer'
  if (/développeur|developer|team|équipe|fondateur|founder|qui.*derrière|who.*behind/.test(q)) return 'developer_unknown'
  if (/liés?|linked|connexe|related|associ/.test(q)) return 'linked_projects'
  if (/score|note|chiffre|number|100/.test(q)) return 'score'
  if (/flag|signal|rouge|red|problème|problem|risk|risque/.test(q)) return 'red_flags'
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AskInterligensChat({ summary, locale }: Props) {
  const [messages, setMessages]         = useState<ChatMsg[]>([])
  const [input, setInput]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [offeredBranch, setOfferedBranch] = useState<string | null>(null)
  const [activeTopic, setActiveTopic]   = useState<TopicKey | null>(null)
  const [failCount, setFailCount]       = useState(0)

  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Auto-scroll
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
    setOfferedBranch(null)
    setActiveTopic(null)
    setFailCount(0)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Extract the last invitation from an assistant message
  function extractOfferedBranch(content: string): string | null {
    if (/montrer pourquoi|show you why|explain why|t.expliquer/i.test(content)) return 'explain_why'
    if (/wallet.*lancement|launch wallet|déployeur|deployer/i.test(content) && /\?$/.test(content.trim())) return 'show_deployer'
    if (/liquidity|liquidit/i.test(content) && /\?/.test(content)) return 'show_liquidity'
    if (/détails|details/i.test(content) && /\?/.test(content)) return 'show_details'
    if (/vault|investigation/i.test(content) && /\?/.test(content)) return 'show_vault'
    if (/concentration|holders?/i.test(content) && /\?/.test(content)) return 'show_holders'
    return null
  }

  const handleSubmit = useCallback(async (questionOverride?: string) => {
    const trimmed = (questionOverride ?? input).trim()
    if (!trimmed || isLoading) return

    const userContent = trimmed
    addMsg({ role: 'user', content: userContent })
    setInput('')
    setIsLoading(true)

    // Detect topic from user input
    const detectedTopic = detectTopic(userContent)
    if (detectedTopic) setActiveTopic(detectedTopic)

    try {
      // 1. Deterministic chip handler first (fast, no LLM)
      const classification = classifyQuestion(userContent, summary)
      if (classification.class === 'refusal') {
        addMsg({ role: 'assistant', content: REFUSAL_RESPONSE[locale] })
        setOfferedBranch(null)
        setIsLoading(false)
        return
      }
      if (classification.class === 'deterministic' && classification.intent) {
        const result = getAnswer(classification.intent, summary, locale)
        addMsg({ role: 'assistant', content: result.body })
        setOfferedBranch(extractOfferedBranch(result.body))
        setIsLoading(false)
        return
      }

      // 2. Build rolling history — last 6 messages only
      const history = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content.slice(0, 400), // truncate each message
      }))

      // 3. LLM call with timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000) // 12s timeout

      const res = await fetch('/api/scan/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          summary,
          question: userContent,
          locale,
          history,
          offeredBranch: isShortConfirmation(userContent) ? offeredBranch : null,
          activeTopic,
        }),
      })
      clearTimeout(timeout)

      if (!res.ok) throw new Error('api_error')

      const data = await res.json()
      const answer = data.answer ?? FALLBACK_RESPONSE[locale]
      addMsg({ role: 'assistant', content: answer })
      setOfferedBranch(extractOfferedBranch(answer))
      setFailCount(0)

    } catch (err: unknown) {
      setFailCount(prev => prev + 1)
      // After 2 consecutive failures, show the unavailable message
      const msg = failCount >= 1
        ? t('unavailable', locale)
        : FALLBACK_RESPONSE[locale]
      addMsg({ role: 'assistant', content: msg })
      setOfferedBranch(null)
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, summary, locale, offeredBranch, activeTopic, failCount])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  const hasMessages = messages.length > 0
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')

  const ACTION_BUTTONS = [
    { label: t('btnWhy', locale),     q: t('btnWhy', locale) },
    { label: t('btnActions', locale), q: t('btnActions', locale) },
    { label: t('btnDetails', locale), q: t('btnDetails', locale) },
  ]

  return (
    <div className="mt-4 border-t border-zinc-800/60 pt-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="shrink-0 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 leading-none">
          {t('askMore', locale)}
        </span>
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <IntelligenceModeBadge
            mode="exploratory"
            locale={locale}
            variant="pill"
            className="!px-1.5 !py-[2px] !tracking-[0.12em]"
          />
          {hasMessages && (
            <button
              onClick={handleReset}
              title={t('resetTip', locale)}
              className="font-mono text-[9px] uppercase tracking-wider text-zinc-700 hover:text-[#F85B05]/60 transition-colors"
            >
              {t('reset', locale)}
            </button>
          )}
        </div>
      </div>

      {/* Thread */}
      {hasMessages && (
        <div
          ref={threadRef}
          className="mb-3 flex flex-col gap-2 max-h-80 overflow-y-auto pr-1"
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div className={[
                'rounded-xl px-3 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'max-w-[60%] bg-zinc-800 text-zinc-300'
                  : 'max-w-[80%] bg-zinc-900/60 border border-zinc-800 text-zinc-300 text-left',
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

      {/* Action buttons — always visible after first assistant message */}
      {lastAssistant && !isLoading && (
        <div className="flex flex-wrap gap-2 mb-3">
          {ACTION_BUTTONS.map(btn => (
            <button
              key={btn.label}
              onClick={() => handleSubmit(btn.q)}
              disabled={isLoading}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:border-[#F85B05]/40 hover:text-zinc-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.slice(0, 300))}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder', locale)}
          disabled={isLoading}
          className="flex-1 min-w-0 h-10 rounded-lg border border-[#F85B05]/30 bg-zinc-900/50 px-4 text-[12px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#F85B05]/60 focus:shadow-[0_0_12px_rgba(248,91,5,0.12)] transition-all disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={isLoading || !input.trim()}
          className="shrink-0 h-10 bg-white text-black font-black uppercase text-[10px] tracking-[0.15em] px-4 rounded-lg hover:bg-[#F85B05] hover:text-white transition-all active:scale-95 disabled:text-black/40"
        >
          {t('ask', locale)}
        </button>
      </div>

      {/* Disclaimer */}
      <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">
        {t('disclaimer', locale)}
      </p>
    </div>
  )
}
