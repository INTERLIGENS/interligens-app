'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnalysisSummary, Locale } from '@/lib/explanation/types'
import { classifyQuestion } from '@/lib/explanation/classifier'
import { getAnswer } from '@/lib/explanation/answerHandlers'
import { FALLBACK_RESPONSE, REFUSAL_RESPONSE } from '@/lib/explanation/localization'

type ChatMode = 'default' | 'confirm' | 'why' | 'actions' | 'details' | 'chooser'
type Intent   = 'confirm' | 'why' | 'actions' | 'details' | 'agree' | 'default'

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

// ── Stable hash (djb2) ────────────────────────────────────────────────────────

function stableHash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return Math.abs(h)
}

function pickVariant(scanId: string, locale: Locale, intent: Intent, n: number): number {
  return stableHash(scanId + ':' + locale + ':' + intent) % n
}

// ── i18n ──────────────────────────────────────────────────────────────────────

const C = {
  askMore:      { en: 'Ask more about this scan',               fr: 'Poser une question sur ce scan' },
  placeholder:  { en: 'e.g. What does the deployer risk mean?', fr: 'ex. Que signifie le risque du wallet ?' },
  ask:          { en: 'Ask',                                    fr: 'Demander' },
  scope:        { en: 'Analysis of this scan only.',            fr: 'Analyse de ce scan uniquement.' },
  thinking:     { en: 'Analyzing…',                        fr: 'Analyse en cours…' },
  disclaimer:   { en: 'Not financial advice. Evidence-based only.', fr: 'Pas un conseil financier. Basé sur les données du scan.' },
  followupUsed: { en: 'Follow-up used. Run a new scan to ask more.', fr: 'Follow-up utilisé. Relance un nouveau scan pour poser d’autres questions.' },
  reset:        { en: 'Reset Q&A',                              fr: 'Réinitialiser la Q&A' },
  resetTip:     { en: 'Clears only this scan Q&A thread.',      fr: 'Efface uniquement la discussion de ce scan.' },
  counter:      { en: 'Follow-up',                              fr: 'Follow-up' },
  label:        { en: 'INTERLIGENS',                            fr: 'INTERLIGENS' },
  btnWhy:       { en: 'Why?',                                   fr: 'Pourquoi ?' },
  btnActions:   { en: 'What should I do now?',                  fr: 'Que faire maintenant ?' },
  btnDetails:   { en: 'See details',                            fr: 'Voir les détails' },
  chooser: {
    en: 'Choose what you want to know:',
    fr: 'Choisis ce que tu veux savoir :',
  },
}

const t = (key: keyof typeof C, locale: Locale): string => C[key][locale]

// ── Copy variants ─────────────────────────────────────────────────────────────

const CONFIRM_VARIANTS: Record<Locale, string[][]> = {
  fr: [
    ['Je te conseille de ne pas acheter.', 'Cette adresse est déjà liée à un dossier d’enquête.', 'Si tu veux, je peux te montrer pourquoi.'],
    ['Non — évite.', 'Cette adresse revient dans une enquête existante.', 'Tu veux que je t’explique pourquoi ?'],
    ['Je ne te recommande pas d’y toucher.', 'On a déjà des éléments d’enquête associés à cette adresse.', 'Je peux te dire pourquoi, si tu veux.'],
  ],
  en: [
    ['I recommend you don’t buy.', 'This address is already linked to an investigation file.', 'If you want, I can show you why.'],
    ['No — avoid it.', 'This address shows up in an existing investigation.', 'Want me to explain why?'],
    ['I wouldn’t touch this.', 'We already have investigation signals tied to this address.', 'I can tell you why, if you want.'],
  ],
}

const WHY_VARIANTS: Record<Locale, string[][]> = {
  fr: [
    ['On a déjà vu cette adresse dans une enquête.', 'Des vérifications externes confirment un risque élevé.', 'On voit des signaux typiques de pièges (approbations, sorties compliquées, etc.).'],
    ['Cette adresse est déjà associée à un dossier existant.', 'Des sources externes recoupent le risque.', 'Des patterns indiquent un risque de blocage / piège.'],
    ['Historique d’enquête sur cette adresse.', 'Risque confirmé par vérifs externes.', 'Signaux compatibles avec une interaction dangereuse.'],
  ],
  en: [
    ['This address already appears in an investigation.', 'External checks confirm a high risk.', 'We see patterns typical of traps (approvals, hard exits, etc.).'],
    ['This address is linked to an existing case.', 'External sources corroborate the risk.', 'Patterns suggest potential trapping behavior.'],
    ['Prior investigation history on this address.', 'High risk confirmed by external checks.', 'Signals indicate dangerous interaction patterns.'],
  ],
}

// ── Signal gating ─────────────────────────────────────────────────────────────

interface ScanSignals {
  hasCaseFile: boolean
  hasOffChain: boolean
  hasExitSignal: boolean
}

function detectSignals(summary: AnalysisSummary): ScanSignals {
  const reasons = summary.topReasons.join(' ').toLowerCase()
  return {
    hasCaseFile: /case|dossier|detective|casedb|referenced|référenc|investigation/i.test(reasons)
      || (summary.intelVaultMatches ?? 0) > 0
      || !!summary.recidivismFlag,
    hasOffChain: /off.chain|hors.cha|external|externe|critical|critique/i.test(reasons)
      || summary.deployerRisk === 'HIGH',
    hasExitSignal: (summary.exitSecurityFlags?.length ?? 0) > 0
      || /exit|sortie|trap|piège|approv|statut|status/i.test(reasons),
  }
}

function gateWhyBullets(bullets: string[], idx: number, signals: ScanSignals, isFr: boolean): string[] {
  // Each variant has 3 bullets: [caseFile, offChain, exitSignal]
  const allowed = [signals.hasCaseFile, signals.hasOffChain, signals.hasExitSignal]
  const gated = bullets.filter((_, i) => allowed[i] ?? true)
  // Always at least 1 bullet — if none pass, use first bullet unconditionally
  return gated.length > 0 ? gated : [bullets[0]]
}

// ── Intent classifier ─────────────────────────────────────────────────────────

function classifyIntent(input: string, locale: Locale, lastAssistant?: string): Intent {
  const q = input.trim().toLowerCase()

  if (locale === 'fr') {
    if (/pourquoi|explique|raison/.test(q) || q === 'pourquoi ?' || q === 'pourquoi ?') return 'why'
    if (/que faire|quoi faire|maintenant|help|aide/.test(q) || q === 'que faire maintenant ?' || q === 'que faire maintenant ?') return 'actions'
    if (/détails|details|preuves|evidence|proof/.test(q) || q === 'voir les détails') return 'details'
    if (/je peux acheter|acheter|c.est cool|safe|j.y vais|je peux y aller|j.interagis|j.achète/.test(q)) return 'confirm'
    if (/^(ok|oui|vas y|vas-y|go|d.accord|merci|allez)$/.test(q)) return 'agree'
  } else {
    if (/why|explain|reason/.test(q) || q === 'why?') return 'why'
    if (/what should i do|what do i do|help|now/.test(q) || q === 'what should i do now?') return 'actions'
    if (/details|evidence|proof/.test(q) || q === 'see details') return 'details'
    if (/can i buy|should i buy|is it safe|is it ok|can i interact|go ahead/.test(q)) return 'confirm'
    if (/^(ok|yes|go on|go|sure|thanks)$/.test(q)) return 'agree'
  }

  return 'default'
}

function resolveAgree(lastAssistant: string, locale: Locale): Intent {
  const la = lastAssistant.toLowerCase()
  if (/je peux te montrer pourquoi|i can show you why|want me to explain|te dire pourquoi|i can tell you why/.test(la)) return 'why'
  if (/voir les détails|see details/.test(la)) return 'details'
  if (/que faire maintenant|what should i do now/.test(la)) return 'actions'
  return 'default'
}

// ── Response builder ──────────────────────────────────────────────────────────

function buildResponse(
  intent: Intent,
  summary: AnalysisSummary,
  locale: Locale
): { content: string; mode: ChatMode } {
  const isFr = locale === 'fr'
  const scanId = summary.address
  const signals = detectSignals(summary)

  switch (intent) {

    case 'confirm': {
      if (summary.verdict === 'CRITICAL') {
        const vi = pickVariant(scanId, locale, 'confirm', 3)
        const lines = CONFIRM_VARIANTS[locale][vi]
        return { content: lines.join('\n'), mode: 'confirm' }
      }
      // Non-critical confirm
      const line1 = isFr
        ? ({ HIGH: 'Là, gros warning.', MODERATE: 'Pas totalement propre.', LOW: 'Plutôt propre pour l’instant.' } as Record<string,string>)[summary.verdict] ?? ''
        : ({ HIGH: 'Big warning here.', MODERATE: 'Not fully clean.', LOW: 'Relatively clean for now.' } as Record<string,string>)[summary.verdict] ?? ''
      const signal = summary.topReasons[0] ?? ''
      const line2 = signal ? (isFr ? 'Signal principal : ' + signal + '.' : 'Main signal: ' + signal + '.') : ''
      const line3 = isFr
        ? 'Choisis : ' + t('btnWhy', locale) + ' • ' + t('btnActions', locale) + ' • ' + t('btnDetails', locale)
        : 'Choose: ' + t('btnWhy', locale) + ' • ' + t('btnActions', locale) + ' • ' + t('btnDetails', locale)
      return { content: [line1, line2, line3].filter(Boolean).join('\n'), mode: 'confirm' }
    }

    case 'why': {
      const vi = pickVariant(scanId, locale, 'why', 3)
      const allBullets = WHY_VARIANTS[locale][vi]
      const bullets = gateWhyBullets(allBullets, vi, signals, isFr)
      const title = isFr ? 'Pourquoi ?' : 'Why?'
      return { content: title + '\n' + bullets.map(b => '• ' + b).join('\n'), mode: 'why' }
    }

    case 'actions': {
      const title = isFr ? 'Que faire maintenant ?' : 'What should I do now?'
      const steps = isFr
        ? ['N’interagis pas : pas de swap, pas de signature, pas d’approbation.', 'Si tu as déjà approuvé : révoque les autorisations.', 'Si tu as déjà envoyé des fonds : sécurise le reste vers un nouveau wallet.']
        : ['Don’t interact: no swap, no signature, no approvals.', 'If you already approved: revoke permissions.', 'If you already sent funds: secure what’s left to a new wallet.']
      return { content: title + '\n' + steps.map((s, i) => (i + 1) + '. ' + s).join('\n'), mode: 'actions' }
    }

    case 'details': {
      const title = isFr ? 'Détails' : 'Details'
      const bullets: string[] = []
      if (signals.hasCaseFile) bullets.push(isFr ? 'Signal interne : CaseDB match (dossier existant)' : 'Internal: CaseDB match (existing file)')
      if (signals.hasOffChain)  bullets.push(isFr ? 'Signal interne : investigation hors-chaîne = critique' : 'Internal: Off-chain investigation = critical')
      if (signals.hasExitSignal && summary.exitSecurityFlags?.[0]) {
        bullets.push(isFr
          ? 'Signal interne : exit/statut = ' + summary.exitSecurityFlags[0]
          : 'Internal: exit/status = ' + summary.exitSecurityFlags[0])
      }
      if (summary.chain) {
        bullets.push(isFr ? 'Scope : ' + summary.chain : 'Scan scope: ' + summary.chain)
      }
      if (bullets.length === 0) {
        summary.topReasons.slice(0, 3).forEach(r => bullets.push('• ' + r))
      }
      const content = bullets.length > 0
        ? title + '\n' + bullets.slice(0, 4).map(b => '• ' + b).join('\n')
        : (isFr ? 'Données insuffisantes.' : 'Insufficient data.')
      return { content, mode: 'details' }
    }

    default: {
      // Chooser — no new claims
      const msg = isFr
        ? 'Choisis ce que tu veux savoir :\n• ' + t('btnWhy', locale) + '\n• ' + t('btnActions', locale) + '\n• ' + t('btnDetails', locale)
        : 'Choose what you want to know:\n• ' + t('btnWhy', locale) + '\n• ' + t('btnActions', locale) + '\n• ' + t('btnDetails', locale)
      return { content: msg, mode: 'chooser' }
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AskInterligensChat({ summary, locale }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [followupsUsed, setFollowupsUsed] = useState(0)
  const maxFollowups = 1
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const limitReached = followupsUsed >= maxFollowups

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages, isLoading])

  function addMsg(msg: Omit<ChatMsg, 'id' | 'createdAt'>) {
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).slice(2), createdAt: Date.now() }])
  }

  function handleReset() {
    setMessages([])
    setFollowupsUsed(0)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSubmit(questionOverride?: string, intentOverride?: Intent) {
    const trimmed = (questionOverride ?? input).trim()
    if (!trimmed || isLoading || limitReached) return

    addMsg({ role: 'user', content: trimmed })
    setInput('')
    setIsLoading(true)

    const isFollowUp = messages.length > 0
    if (isFollowUp) setFollowupsUsed(prev => prev + 1)

    await new Promise(r => setTimeout(r, 150))

    try {
      // Existing deterministic chip handler (Phase 1A)
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

      // Intent routing
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.content ?? ''
      let intent: Intent = intentOverride ?? classifyIntent(trimmed, locale, lastAssistant)

      // Resolve "agree" based on context
      if (intent === 'agree') {
        intent = resolveAgree(lastAssistant, locale)
      }

      // First message default — retail confirm
      if (!isFollowUp && intent === 'default') {
        intent = 'confirm'
      }

      const { content, mode } = buildResponse(intent, summary, locale)
      addMsg({ role: 'assistant', content, mode })

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

  const ACTION_BUTTONS: { label: string; intent: Intent }[] = [
    { label: t('btnWhy', locale),     intent: 'why' },
    { label: t('btnActions', locale), intent: 'actions' },
    { label: t('btnDetails', locale), intent: 'details' },
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
            <button onClick={handleReset} title={t('resetTip', locale)}
              className="font-mono text-[9px] uppercase tracking-wider text-zinc-600 hover:text-[#F85B05]/60 transition-colors">
              {t('reset', locale)}
            </button>
          )}
        </div>
      </div>

      {/* Thread */}
      {messages.length > 0 && (
        <div ref={threadRef} className="mb-3 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 scroll-smooth">
          {messages.map(msg => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
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

      {/* Quick actions */}
      {showButtons && (
        <div className="flex flex-wrap gap-2 mb-3">
          {ACTION_BUTTONS.map(btn => (
            <button key={btn.intent}
              onClick={() => handleSubmit(btn.label, btn.intent)}
              disabled={isLoading}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:border-[#F85B05]/40 hover:text-zinc-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Input or lock */}
      {limitReached ? (
        <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/20 px-4 py-2.5 text-[10px] text-zinc-600 text-center">
          {t('followupUsed', locale)}
        </div>
      ) : (
        <div className="flex gap-2">
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value.slice(0, 300))}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder', locale)}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
          <button onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
            className="rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-150 border-[#F85B05]/40 text-[#F85B05] hover:bg-[#F85B05]/10 disabled:border-zinc-800 disabled:text-zinc-700 disabled:cursor-not-allowed">
            {t('ask', locale)}
          </button>
        </div>
      )}

      <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">
        {t('disclaimer', locale)}
      </p>
    </div>
  )
}
