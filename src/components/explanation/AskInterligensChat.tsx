'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnalysisSummary, Locale } from '@/lib/explanation/types'
import { classifyQuestion } from '@/lib/explanation/classifier'
import { getAnswer } from '@/lib/explanation/answerHandlers'
import { FALLBACK_RESPONSE, REFUSAL_RESPONSE } from '@/lib/explanation/localization'

// ── Types ──────────────────────────────────────────────────────────────────────

type ChatMode = 'default' | 'evidence' | 'actions' | 'explain'

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

// ── Copy ───────────────────────────────────────────────────────────────────────

const COPY = {
  askMore:      { en: 'Ask more about this scan', fr: 'Poser une question sur ce scan' },
  placeholder:  { en: 'e.g. What does the deployer risk mean?', fr: 'ex. Que signifie le risque du wallet ?' },
  ask:          { en: 'Ask', fr: 'Demander' },
  scope:        { en: 'Analysis of this scan only.', fr: 'Analyse de ce scan uniquement.' },
  thinking:     { en: 'Analyzing evidence…', fr: 'Analyse en cours…' },
  disclaimer:   { en: 'Not financial advice. Evidence-based analysis only.', fr: 'Pas un conseil financier. Analyse basée sur les données du scan.' },
  followupUsed: { en: 'Follow-up used. Run a new scan to ask more.', fr: 'Follow-up utilisé. Relance un nouveau scan pour poser d’autres questions.' },
  reset:        { en: 'Reset Q&A', fr: 'Réinitialiser' },
  counter:      { en: 'Follow-up', fr: 'Follow-up' },
  btnEvidence:  { en: 'Show evidence', fr: 'Voir les preuves' },
  btnActions:   { en: 'What should I do now', fr: 'Que faire maintenant ?' },
  btnExplain:   { en: 'Why is this critical?', fr: 'Pourquoi c’est critique ?' },
  evidenceTitle: { en: 'Evidence (excerpt)', fr: 'Preuves (extrait)' },
  actionsTitle:  { en: 'What to do now', fr: 'Que faire maintenant' },
  explainTitle:  { en: 'Why this is critical', fr: 'Pourquoi c’est critique' },
}

const t = (key: keyof typeof COPY, locale: Locale): string => COPY[key][locale]

// ── Mode detection ─────────────────────────────────────────────────────────────

const EVIDENCE_TRIGGERS = /yes|yeah|yep|go|sure|show|ok|oui|ouais|vas-y|montre|allez|continue|preuves|evidence/i
const ACTIONS_TRIGGERS  = /do now|should i do|que faire|quoi faire|maintenant|actions|steps/i
const EXPLAIN_TRIGGERS  = /why|critical|pourquoi|critique|explain|explique/i

function detectMode(input: string): ChatMode {
  if (EVIDENCE_TRIGGERS.test(input)) return 'evidence'
  if (ACTIONS_TRIGGERS.test(input))  return 'actions'
  if (EXPLAIN_TRIGGERS.test(input))  return 'explain'
  return 'default'
}

// ── Deterministic mode responses ───────────────────────────────────────────────

function buildEvidenceResponse(summary: AnalysisSummary, locale: Locale): string {
  const isFr = locale === 'fr'
  const title = t('evidenceTitle', locale)
  const bullets: string[] = []

  if (summary.topReasons.length > 0) {
    summary.topReasons.slice(0, 3).forEach(r => bullets.push(r))
  }
  if (summary.exitSecurityFlags && summary.exitSecurityFlags.length > 0) {
    summary.exitSecurityFlags.slice(0, 2).forEach(f => bullets.push(f))
  }
  if (summary.intelVaultMatches && summary.intelVaultMatches > 0) {
    bullets.push(isFr
      ? summary.intelVaultMatches + ' correspondance(s) dans l’Intel Vault'
      : summary.intelVaultMatches + ' match(es) in Intel Vault')
  }
  if (bullets.length === 0) {
    return isFr ? 'Données insuffisantes pour afficher les preuves.' : 'Insufficient data to show evidence.'
  }
  return [title, ...bullets.map(b => "• " + b)].join("\n")
}

function buildActionsResponse(summary: AnalysisSummary, locale: Locale): string {
  const isFr = locale === 'fr'
  const title = t('actionsTitle', locale)
  if (summary.whatToDoNow) return title + "\n" + summary.whatToDoNow

  const steps: Record<string, Record<Locale, string[]>> = {
    LOW:      { en: ["No urgent action needed.", "Monitor if situation changes."], fr: ["Pas d\u2019action urgente.", "Surveille si \u00e7a \u00e9volue."] },
    MODERATE: { en: ["Do not rush.", "Review the flagged signals.", "Verify independently before any decision."], fr: ["Ne te pr\u00e9cipite pas.", "Regarde les signaux signal\u00e9s.", "V\u00e9rifie ind\u00e9pendamment avant toute d\u00e9cision."] },
    HIGH:     { en: ["Avoid interacting until signals are resolved.", "Do not sign or approve anything.", "Revoke existing approvals if already exposed."], fr: ["\u00c9vite d\u2019interagir tant que les signaux ne sont pas r\u00e9solus.", "Ne signe ni n\u2019approuve rien.", "R\u00e9voque les approbations existantes si tu es d\u00e9j\u00e0 expos\u00e9."] },
    CRITICAL: { en: ["Do not interact. No swap, no signing, no approval.", "If already exposed, revoke approvals immediately.", "Move funds to a clean wallet."], fr: ["N\u2019interagis pas. Ni swap, ni signature, ni approbation.", "Si tu es d\u00e9j\u00e0 expos\u00e9, r\u00e9voque les approbations imm\u00e9diatement.", "D\u00e9place tes fonds vers un wallet propre."] },
  }
  const list = steps[summary.verdict]?.[locale] ?? []
  if (list.length === 0) return isFr ? "Donn\u00e9es insuffisantes." : "Insufficient data."
  return title + "\n" + list.map((s, i) => (i + 1) + ". " + s).join("\n")
}

function buildExplainResponse(summary: AnalysisSummary, locale: Locale): string {
  const isFr = locale === 'fr'
  const title = t('explainTitle', locale)
  const bullets: string[] = []

  if (summary.topReasons.length > 0) {
    bullets.push(...summary.topReasons.slice(0, 3))
  }
  if (summary.recidivismFlag) {
    bullets.push(isFr ? "Acteur r\u00e9cidiviste d\u00e9tect\u00e9" : "Repeat actor detected")
  }
  if (summary.deployerRisk === 'HIGH') {
    bullets.push(isFr ? "Wallet d\u00e9ployeur \u00e0 risque \u00e9lev\u00e9" : "High-risk deployer wallet")
  }
  if (bullets.length === 0) {
    return isFr ? "Donn\u00e9es insuffisantes pour expliquer le verdict." : "Insufficient data to explain the verdict."
  }
  return [title, ...bullets.map(b => "\u2022 " + b)].join("\n")
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages])

  function addMsg(msg: Omit<ChatMsg, 'id' | 'createdAt'>) {
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).slice(2), createdAt: Date.now() }])
  }

  function handleReset() {
    setMessages([])
    setFollowupsUsed(0)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSubmit(questionOverride?: string) {
    const trimmed = (questionOverride ?? input).trim()
    if (!trimmed || isLoading || limitReached) return

    // Append user message
    addMsg({ role: 'user', content: trimmed })
    setInput('')
    setIsLoading(true)

    // Count follow-up if this is not the first message
    if (messages.length > 0) {
      setFollowupsUsed(prev => prev + 1)
    }

    try {
      // 1. Deterministic check first
      const classification = classifyQuestion(trimmed, summary)
      if (classification.class === 'refusal') {
        addMsg({ role: 'assistant', content: REFUSAL_RESPONSE[locale], mode: 'default' })
        setIsLoading(false)
        return
      }
      if (classification.class === 'deterministic' && classification.intent) {
        const result = getAnswer(classification.intent, summary, locale)
        addMsg({ role: 'assistant', content: result.body, mode: 'default' })
        setIsLoading(false)
        return
      }

      // 2. Mode detection for follow-up routing
      const mode = detectMode(trimmed)

      // 3. Deterministic mode responses (no LLM needed)
      if (mode === 'evidence') {
        addMsg({ role: 'assistant', content: buildEvidenceResponse(summary, locale), mode: 'evidence' })
        setIsLoading(false)
        return
      }
      if (mode === 'actions') {
        addMsg({ role: 'assistant', content: buildActionsResponse(summary, locale), mode: 'actions' })
        setIsLoading(false)
        return
      }
      if (mode === 'explain') {
        addMsg({ role: 'assistant', content: buildExplainResponse(summary, locale), mode: 'explain' })
        setIsLoading(false)
        return
      }

      // 4. LLM for interpretive questions
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

  // Last assistant message for showing action buttons
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const showActionButtons = lastAssistantMsg && !limitReached

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
              className="font-mono text-[9px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {t('reset', locale)}
            </button>
          )}
        </div>
      </div>

      {/* Thread */}
      {messages.length > 0 && (
        <div
          ref={threadRef}
          className="mb-3 max-h-64 overflow-y-auto flex flex-col gap-2 pr-1"
        >
          {messages.map(msg => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={[
                'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-300'
                  : 'bg-zinc-900/60 border border-zinc-800 text-zinc-300',
              ].join(' ')}>
                {msg.role === 'assistant' && (
                  <span className="block text-[8px] font-black uppercase tracking-[0.15em] text-[#F85B05]/60 mb-1">
                    INTERLIGENS
                  </span>
                )}
                <span className="whitespace-pre-line">{msg.content}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600 animate-pulse">
                  {t('thinking', locale)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {showActionButtons && (
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { label: t('btnEvidence', locale), q: t('btnEvidence', locale) },
            { label: t('btnActions', locale),  q: t('btnActions', locale) },
            { label: t('btnExplain', locale),  q: t('btnExplain', locale) },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={() => handleSubmit(btn.q)}
              disabled={isLoading}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Input or locked state */}
      {limitReached ? (
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-4 py-3 text-[10px] text-zinc-600 text-center">
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
