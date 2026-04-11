'use client'
import BetaNav from "@/components/beta/BetaNav"
import React, { useState, useEffect } from 'react'

/* ── types ─────────────────────────────────────────────── */

interface WatchEntry {
  handle: string
  displayName: string
  priority: 'high' | 'medium' | 'low'
  category: string
  source: string
  chainFocus: string
  followerCount: number
  notes: string | null
  hasProfile: boolean
  totalProceeds: number | null
  behaviorFlags: string[]
  behaviorFlagsCount: number
  rugCount: number | null
  evidenceCount: number
  walletsCount: number
  casesCount: number
  linkedTokensCount: number
  isPublished: boolean
  recentSignals: number
  lastSignalAt: string | null
}

/* ── vocabulaire retail FR ─────────────────────────────── */

const SURVEILLANCE_LINE: Record<string, string> = {
  paid_undisclosed: "Promo payée non déclarée. Vend pendant que ses abonnés achètent.",
  pump_fun_caller: "Pousse des tokens frais, vend avant le crash.",
  legendary_meme_caller: "Pousse des memecoins — sort avant la chute.",
  high_risk_memes: "Pousse des memes à haut risque. La sortie est pour lui, pas pour toi.",
  historic_calls: "Caller récidiviste sur plusieurs lancements ratés.",
  package_deal_caller: "Vend ses calls en package — payé par le projet.",
  tier2_caller: "Pousse des tokens, disclosures floues, dumps fréquents.",
  paid_multi_post: "Plusieurs posts payés sur la même coin en peu de temps.",
  interligens_case: "Documenté dans une enquête INTERLIGENS.",
  community_callout: "La communauté a flaggé un comportement nuisible récurrent.",
  memescope_monday: "Caller memescope récurrent. Surveille le timing.",
  video_promo_undisclosed: "Promo vidéo sans mention de sponsorisation.",
  zachxbt_leak: "Cité dans une enquête ZachXBT.",
  zachxbt_context: "Mentionné dans le contexte ZachXBT — pattern sous revue.",
  kolscan_caller: "Caller actif suivi sur KOLscan.",
  pump_fun_cofounder: "Lié aux wallets fondateurs de pump.fun.",
}
const DEFAULT_SURVEILLANCE_LINE = "Pousse des tokens et vend avant le crash."

const FLAG_LINE: Record<string, string> = {
  REPEATED_CASHOUT: "schéma de cashout répété",
  MULTI_HOP_TRANSFER: "transferts multi-sauts pour cacher la trace",
  CROSS_CASE_RECURRENCE: "réapparaît sur plusieurs affaires",
  MULTI_LAUNCH_LINKED: "lié à plusieurs lancements",
  LAUNDERING_INDICATORS: "indicateurs de blanchiment",
  KNOWN_LINKED_WALLETS: "wallets liés identifiés",
  COORDINATED_PROMOTION: "promotion coordonnée",
}

function surveillanceLine(e: WatchEntry): string {
  return SURVEILLANCE_LINE[e.category] ?? DEFAULT_SURVEILLANCE_LINE
}

/* ── helpers ───────────────────────────────────────────── */

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || n === 0) return null
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'K'
  return '$' + Math.round(n)
}
const fmtFollowers = (n: number) => {
  if (!n || n <= 0) return null
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'K'
  return String(n)
}
function timeAgo(d: string | null) {
  if (!d) return null
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const days = Math.floor(h / 24)
  if (days < 30) return `il y a ${days} j`
  return `il y a ${Math.floor(days / 30)} mois`
}

/* ── page ──────────────────────────────────────────────── */

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = entries.filter(e => {
    if (filter !== 'all' && e.priority !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        e.handle.toLowerCase().includes(q) ||
        e.displayName.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased pb-20">
      <BetaNav />
      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">

        {/* ═══ HERO ═══ */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F85B05] font-mono">
              SOUS SURVEILLANCE ACTIVE
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter uppercase leading-[0.95]">
            Watchlist<span className="text-[#F85B05]">.</span>
          </h1>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#F85B05] font-mono">
            Ils vendent. Vous achetez.
          </p>
          <p className="mt-5 text-base text-zinc-400 max-w-xl leading-relaxed">
            Les comptes que nous surveillons en ce moment. Langage clair.
            Tape sur une carte pour voir les détails.
          </p>
        </header>

        {/* ═══ FILTRES ═══ */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-md transition-colors font-mono ${
                filter === f
                  ? 'bg-[#F85B05] text-black'
                  : 'bg-zinc-900/60 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f === 'all' ? `Tous (${entries.length})` : f === 'high' ? 'Élevé' : f === 'medium' ? 'Moyen' : 'Faible'}
            </button>
          ))}
          <div className="flex-1" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher un handle…"
            className="bg-zinc-900/60 border border-zinc-800 rounded-md px-3 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 font-mono outline-none focus:border-[#F85B05]/50 w-44"
          />
        </div>

        {/* ═══ LISTE ═══ */}
        {loading ? (
          <div className="text-center py-20 text-zinc-700 font-mono text-xs uppercase tracking-widest">
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-700 font-mono text-xs uppercase tracking-widest">
            Aucun résultat.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map(e => (
              <WatchCard
                key={e.handle}
                entry={e}
                isOpen={expanded === e.handle}
                onToggle={() =>
                  setExpanded(expanded === e.handle ? null : e.handle)
                }
              />
            ))}
          </ul>
        )}

        {/* ═══ FOOTER ═══ */}
        <footer className="mt-16 pt-6 border-t border-zinc-900 text-center">
          <p className="text-[9px] font-mono tracking-wider text-zinc-700 uppercase">
            Patterns observés uniquement · INTERLIGENS Intelligence © 2026
          </p>
        </footer>
      </main>
    </div>
  )
}

/* ── carte ─────────────────────────────────────────────── */

function WatchCard({
  entry,
  isOpen,
  onToggle,
}: {
  entry: WatchEntry
  isOpen: boolean
  onToggle: () => void
}) {
  const e = entry
  const proceeds = fmtUsd(e.totalProceeds)
  const followers = fmtFollowers(e.followerCount)
  const lastSig = timeAgo(e.lastSignalAt)
  const initial = (e.displayName || e.handle).slice(0, 1).toUpperCase()
  const priorityColor =
    e.priority === 'high' ? '#ef4444' : e.priority === 'medium' ? '#f59e0b' : '#6b7280'

  return (
    <li
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden transition-colors hover:border-[#F85B05]/40"
      style={{ borderLeft: `3px solid ${priorityColor}` }}
    >
      {/* ─── NIVEAU 1 ──────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 sm:p-5 flex items-start gap-4"
      >
        <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[#F85B05] font-black text-base">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="text-sm sm:text-base font-black text-white">@{e.handle}</span>
            {followers && (
              <span className="text-[10px] font-mono text-zinc-600">{followers} followers</span>
            )}
          </div>
          <p className="text-sm text-zinc-300 leading-snug mb-2">
            {surveillanceLine(e)}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500">
            {proceeds && (
              <span>
                <span className="text-zinc-600">Min. </span>
                <span className="text-red-400 font-black">{proceeds}</span>
                <span className="text-zinc-600"> observés</span>
              </span>
            )}
            {lastSig && (
              <span>
                <span className="text-zinc-600">Dernier signal · </span>
                <span className="text-emerald-400">{lastSig}</span>
              </span>
            )}
            {!proceeds && !lastSig && (
              <span className="text-zinc-700">Suivi, pas encore de signal public</span>
            )}
          </div>
        </div>
        <div className="shrink-0 self-center">
          {e.isPublished ? (
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#F85B05] font-mono whitespace-nowrap">
              {isOpen ? 'FERMER ▲' : 'DÉTAILS ▾'}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600 font-mono whitespace-nowrap">
              {isOpen ? 'FERMER ▲' : 'DÉTAILS ▾'}
            </span>
          )}
        </div>
      </button>

      {/* ─── NIVEAU 2 ──────────────────────────── */}
      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-zinc-800/60">
          {/* Compteur cash-out */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label="Total observé" value={proceeds ?? '—'} accent="#ef4444" />
            <Stat label="Signaux 30j" value={e.recentSignals > 0 ? String(e.recentSignals) : '—'} accent="#10b981" />
            <Stat label="Wallets" value={e.walletsCount > 0 ? String(e.walletsCount) : '—'} accent="#f59e0b" />
            <Stat label="Tokens liés" value={e.linkedTokensCount > 0 ? String(e.linkedTokensCount) : '—'} accent="#8b5cf6" />
          </div>

          {/* Pattern en une phrase */}
          <div className="mb-4">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 font-mono mb-1">
              Pattern
            </div>
            <p className="text-[13px] text-zinc-300 leading-relaxed">
              {surveillanceLine(e)}
              {e.behaviorFlagsCount > 0 && (
                <>
                  {' '}
                  {e.behaviorFlags
                    .map(f => FLAG_LINE[f] ?? f.replace(/_/g, ' ').toLowerCase())
                    .join(' · ')}
                  .
                </>
              )}
            </p>
          </div>

          {/* Liens */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            {e.isPublished ? (
              <a
                href={`/fr/kol/${e.handle}`}
                className="px-3 py-1.5 rounded-md border border-[#F85B05]/40 bg-[#F85B05]/10 text-[#F85B05] font-black uppercase tracking-[0.12em] hover:bg-[#F85B05]/20 transition-colors no-underline"
              >
                Voir le dossier →
              </a>
            ) : (
              <span className="px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-600 font-black uppercase tracking-[0.12em]">
                Sous revue
              </span>
            )}
            <a
              href={`https://x.com/${e.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-200 no-underline"
            >
              Voir sur X →
            </a>
            {e.casesCount > 0 && (
              <span className="text-zinc-600">
                {e.casesCount} dossier{e.casesCount > 1 ? 's' : ''} lié{e.casesCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md border border-zinc-800/60 bg-black/40 px-3 py-2">
      <div className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-600 font-mono mb-0.5">
        {label}
      </div>
      <div className="text-sm font-black font-mono" style={{ color: value === '—' ? '#3f3f46' : accent }}>
        {value}
      </div>
    </div>
  )
}
