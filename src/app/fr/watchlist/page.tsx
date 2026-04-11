'use client'
import BetaNav from "@/components/beta/BetaNav"
import React, { useState, useEffect } from 'react'

/* ── types ─────────────────────────────────────────────── */

interface Cashout {
  d1: number
  d7: number
  d30: number
  ytd: number
  total: number
}

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
  evidenceCount: number
  walletsCount: number
  casesCount: number
  linkedTokensCount: number
  isPublished: boolean
  recentSignals: number
  lastSignalAt: string | null
  tickers: string[]
  cashout: Cashout
}

/* ── wording retail FR ─────────────────────────────────── */

const WHY_LINE: Record<string, string> = {
  paid_undisclosed: "Promo payée. Le dit pas. Vend pendant que ses abonnés achètent.",
  pump_fun_caller: "Pousse des tokens frais. Vend avant le crash.",
  legendary_meme_caller: "Pousse des memecoins. Sort avant la chute.",
  high_risk_memes: "Pousse des memes à haut risque. La sortie est pour lui, pas pour toi.",
  historic_calls: "Caller récidiviste. Même script sur plusieurs lancements ratés.",
  package_deal_caller: "Vend ses calls en package — payé par le projet.",
  tier2_caller: "Pousse des tokens. Disclosures floues. Dumps fréquents.",
  paid_multi_post: "Plusieurs posts payés sur la même coin en peu de temps.",
  interligens_case: "Documenté dans une enquête INTERLIGENS.",
  community_callout: "La communauté a flaggé un comportement nuisible récurrent.",
  memescope_monday: "Caller memescope récurrent. Surveille le timing.",
  video_promo_undisclosed: "Promo vidéo. Aucune mention de sponsorisation.",
  zachxbt_leak: "Cité dans une enquête ZachXBT.",
  zachxbt_context: "Mentionné dans le contexte ZachXBT. Pattern sous revue.",
  kolscan_caller: "Caller actif sur plusieurs lancements.",
  pump_fun_cofounder: "Lié aux wallets fondateurs de pump.fun.",
}
const DEFAULT_WHY = "Pousse des tokens, vend avant la chute."

const FLAG_LINE: Record<string, string> = {
  REPEATED_CASHOUT: "Même schéma de cash-out, encore et encore",
  MULTI_HOP_TRANSFER: "Cache la trace de l'argent par transferts multi-sauts",
  CROSS_CASE_RECURRENCE: "Réapparaît sur plusieurs enquêtes",
  MULTI_LAUNCH_LINKED: "Lié à plusieurs lancements",
  LAUNDERING_INDICATORS: "Indicateurs de blanchiment au dossier",
  KNOWN_LINKED_WALLETS: "Wallets liés identifiés",
  COORDINATED_PROMOTION: "Promotion coordonnée",
}

function whyLine(e: WatchEntry): string {
  return WHY_LINE[e.category] ?? DEFAULT_WHY
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
      const q = search.toLowerCase().replace(/^\$+/, '')
      return (
        e.handle.toLowerCase().includes(q) ||
        e.displayName.toLowerCase().includes(q) ||
        e.tickers.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased pb-20">
      <BetaNav />
      <main className="max-w-5xl xl:max-w-6xl mx-auto px-6 py-12 sm:py-16">

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
          <p className="mt-5 text-base text-zinc-400 max-w-2xl leading-relaxed">
            Les comptes que INTERLIGENS surveille. Qui ils sont, pourquoi ils sont là,
            combien ils ont pris, et sur quels tickers ils poussent en ce moment.
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
            placeholder="Chercher un handle ou $TICKER…"
            className="bg-zinc-900/60 border border-zinc-800 rounded-md px-3 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 font-mono outline-none focus:border-[#F85B05]/50 w-64"
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
            INTERLIGENS Intelligence © 2026
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
  const headlineMin = fmtUsd(e.cashout.total) ?? fmtUsd(e.totalProceeds)
  const followers = fmtFollowers(e.followerCount)
  const lastSig = timeAgo(e.lastSignalAt)
  const initial = (e.displayName || e.handle).slice(0, 1).toUpperCase()
  const priorityColor =
    e.priority === 'high' ? '#ef4444' : e.priority === 'medium' ? '#f59e0b' : '#52525b'

  return (
    <li
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden transition-colors hover:border-[#F85B05]/40"
      style={{ borderLeft: `3px solid ${priorityColor}` }}
    >
      {/* ─── NIVEAU 1 ──────────────────────────── */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[#F85B05] font-black text-base">
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            {/* Handle row */}
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <span className="text-base sm:text-lg font-black text-white">@{e.handle}</span>
              {followers && (
                <span className="text-[10px] font-mono text-zinc-600">{followers} followers</span>
              )}
              <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">
                · Sous surveillance INTERLIGENS
              </span>
            </div>

            {/* Phrase de surveillance */}
            <p className="text-sm text-zinc-300 leading-snug mb-2.5">{whyLine(e)}</p>

            {/* Métriques */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-zinc-500">
              {headlineMin ? (
                <span>
                  <span className="text-zinc-600">Au moins </span>
                  <span className="text-red-400 font-black font-mono">{headlineMin}</span>
                  <span className="text-zinc-600"> sortis</span>
                </span>
              ) : null}
              {lastSig && (
                <span>
                  <span className="text-zinc-600">Dernier signal · </span>
                  <span className="text-zinc-300 font-medium">{lastSig}</span>
                </span>
              )}
              {!headlineMin && !lastSig && (
                <span className="text-zinc-700">Sous surveillance, pas de signal récent</span>
              )}
            </div>

            {/* Tickers row */}
            {e.tickers.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600 font-mono">
                  Tickers poussés
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {e.tickers.slice(0, 5).map(t => (
                    <span
                      key={t}
                      className="text-[11px] font-black font-mono px-2 py-0.5 rounded"
                      style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.10)' }}
                    >
                      ${t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA droite */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={onToggle}
              className="text-[10px] font-black uppercase tracking-[0.15em] text-[#F85B05] font-mono whitespace-nowrap hover:underline"
            >
              {isOpen ? 'Fermer ▲' : 'Détails ▾'}
            </button>
            <a
              href={`https://x.com/${e.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-zinc-600 hover:text-zinc-300 font-mono no-underline"
            >
              Voir sur X →
            </a>
          </div>
        </div>
      </div>

      {/* ─── NIVEAU 2 ──────────────────────────── */}
      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-zinc-800/60 bg-black/30">
          {/* Compteur cash-out */}
          <div className="mb-5">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 font-mono mb-2">
              Argent sorti
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Bucket label="24 dernières h" value={fmtUsd(e.cashout.d1)} />
              <Bucket label="7 jours" value={fmtUsd(e.cashout.d7)} />
              <Bucket label="30 jours" value={fmtUsd(e.cashout.d30)} />
              <Bucket label="Cette année" value={fmtUsd(e.cashout.ytd)} />
              <Bucket
                label="Total"
                value={fmtUsd(e.cashout.total) ?? fmtUsd(e.totalProceeds)}
                strong
              />
            </div>
          </div>

          {/* Pattern */}
          <div className="mb-5">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 font-mono mb-1.5">
              Même schéma
            </div>
            <p className="text-[13px] text-zinc-300 leading-relaxed">
              {whyLine(e)}
              {e.behaviorFlagsCount > 0 && (
                <>
                  {' '}
                  {e.behaviorFlags
                    .map(f => FLAG_LINE[f] ?? f.replace(/_/g, ' ').toLowerCase())
                    .join('. ')}
                  .
                </>
              )}
            </p>
          </div>

          {/* Tickers liste complète */}
          {e.tickers.length > 0 && (
            <div className="mb-5">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 font-mono mb-1.5">
                Tickers liés
              </div>
              <div className="flex flex-wrap gap-1.5">
                {e.tickers.map(t => (
                  <span
                    key={t}
                    className="text-[11px] font-black font-mono px-2 py-0.5 rounded"
                    style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.10)' }}
                  >
                    ${t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Liens */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            {e.isPublished ? (
              <a
                href={`/fr/kol/${e.handle}`}
                className="px-3 py-1.5 rounded-md border border-[#F85B05]/40 bg-[#F85B05]/10 text-[#F85B05] font-black uppercase tracking-[0.12em] hover:bg-[#F85B05]/20 transition-colors no-underline"
              >
                Ouvrir le dossier →
              </a>
            ) : (
              <span className="px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-600 font-black uppercase tracking-[0.12em]">
                Dossier sous revue
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
            {e.walletsCount > 0 && (
              <span className="text-zinc-600">
                {e.walletsCount} wallet{e.walletsCount > 1 ? 's' : ''} lié{e.walletsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function Bucket({ label, value, strong = false }: { label: string; value: string | null; strong?: boolean }) {
  const empty = !value
  return (
    <div className="rounded-md border border-zinc-800/60 bg-black/40 px-3 py-2">
      <div className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-600 font-mono mb-0.5">
        {label}
      </div>
      <div
        className="text-sm font-black font-mono"
        style={{ color: empty ? '#3f3f46' : strong ? '#ef4444' : '#f4f4f5' }}
      >
        {value ?? '—'}
      </div>
    </div>
  )
}
