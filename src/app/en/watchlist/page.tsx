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

/* ── retail wording (EN) ───────────────────────────────── */

const WHY_LINE: Record<string, string> = {
  paid_undisclosed: "Paid promo. Doesn't say it. Sells while followers buy.",
  pump_fun_caller: "Pumps fresh tokens. Sells before the dump.",
  legendary_meme_caller: "Pushes meme tokens. Exits before the crash.",
  high_risk_memes: "Pushes high-risk memes. The exit is for him, not you.",
  historic_calls: "Repeat caller. Same script across failed launches.",
  package_deal_caller: "Sells calls as a package — paid by the project.",
  tier2_caller: "Pushes tokens. Vague disclosures. Common dumps.",
  paid_multi_post: "Multiple paid posts on the same coin in a short window.",
  interligens_case: "INTERLIGENS investigators have a case open on this one.",
  community_callout: "Community has flagged repeated harmful behavior.",
  memescope_monday: "Recurring memescope caller. Watch the timing.",
  video_promo_undisclosed: "Video promotion. No sponsorship disclosed.",
  zachxbt_leak: "Named in a ZachXBT investigation.",
  zachxbt_context: "Mentioned in ZachXBT context. Pattern under review.",
  kolscan_caller: "Active caller across multiple launches.",
  pump_fun_cofounder: "Tied to pump.fun founding wallets.",
}
const DEFAULT_WHY = "Pushes tokens, sells before the crash."

const FLAG_LINE: Record<string, string> = {
  REPEATED_CASHOUT: "Cashes out the same way every cycle",
  MULTI_HOP_TRANSFER: "Hides the money trail through multi-hop transfers",
  CROSS_CASE_RECURRENCE: "Reappears across several investigations",
  MULTI_LAUNCH_LINKED: "Linked to several token launches",
  LAUNDERING_INDICATORS: "Laundering indicators on file",
  KNOWN_LINKED_WALLETS: "Known linked wallets identified",
  COORDINATED_PROMOTION: "Coordinated promotion activity",
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
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
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
              UNDER ACTIVE SURVEILLANCE
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter uppercase leading-[0.95]">
            Watchlist<span className="text-[#F85B05]">.</span>
          </h1>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#F85B05] font-mono">
            They&apos;re selling. You&apos;re buying.
          </p>
          <p className="mt-5 text-base text-zinc-400 max-w-2xl leading-relaxed">
            The accounts INTERLIGENS is watching. Who they are, why they&apos;re here,
            how much they&apos;ve taken, and which tickers they&apos;re pushing right now.
          </p>
        </header>

        {/* ═══ FILTER BAR ═══ */}
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
              {f === 'all' ? `All (${entries.length})` : f}
            </button>
          ))}
          <div className="flex-1" />
          <div className="relative w-64">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search handle or $TICKER…"
              className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-md pl-8 pr-3 py-2 text-[12px] text-zinc-100 placeholder:text-zinc-500 font-mono outline-none focus:border-[#F85B05]/60 focus:bg-zinc-900 transition-colors"
            />
          </div>
        </div>

        {/* ═══ LIST ═══ */}
        {loading ? (
          <div className="text-center py-20 text-zinc-700 font-mono text-xs uppercase tracking-widest">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-700 font-mono text-xs uppercase tracking-widest">
            No results.
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

/* ── card ──────────────────────────────────────────────── */

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
  const headlineMin = fmtUsd(e.totalProceeds) ?? fmtUsd(e.cashout.total)
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
      {/* ─── LEVEL 1 ───────────────────────────── */}
      <div
        className={`p-4 sm:p-5 ${!isOpen ? 'cursor-pointer' : ''}`}
        onClick={!isOpen ? onToggle : undefined}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[#F85B05] font-black text-base">
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            {/* Handle row */}
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <span className="text-base sm:text-lg font-black text-white">@{e.handle}</span>
              {followers && (
                <span className="text-[10px] font-mono text-zinc-600">
                  {followers} followers
                </span>
              )}
              <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">
                · INTERLIGENS is watching
              </span>
            </div>

            {/* Why line */}
            <p className="text-sm text-zinc-300 leading-snug mb-2.5">{whyLine(e)}</p>

            {/* Metrics row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-zinc-500">
              {headlineMin ? (
                <span>
                  <span className="text-zinc-600">At least </span>
                  <span className="text-red-400 font-black font-mono">{headlineMin}</span>
                  <span className="text-zinc-600"> taken</span>
                </span>
              ) : null}
              {lastSig && (
                <span>
                  <span className="text-zinc-600">Last signal · </span>
                  <span className="text-zinc-300 font-medium">{lastSig}</span>
                </span>
              )}
              {!headlineMin && !lastSig && (
                <span className="text-zinc-700">Under surveillance, no recent signal</span>
              )}
            </div>

            {/* Tickers row */}
            {e.tickers.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600 font-mono">
                  Tickers pushed
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

          {/* Right CTA */}
          <div className="shrink-0 flex flex-col items-end gap-2 self-center">
            <button
              type="button"
              onClick={onToggle}
              className={`text-[10px] font-black uppercase tracking-[0.15em] font-mono whitespace-nowrap px-2.5 py-1.5 rounded-md border transition-colors ${
                isOpen
                  ? 'border-[#F85B05]/60 bg-[#F85B05]/10 text-[#F85B05]'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-[#F85B05]/50 hover:text-[#F85B05]'
              }`}
            >
              {isOpen ? 'Close ▴' : 'Details ▾'}
            </button>
            <a
              href={`https://x.com/${e.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(ev) => ev.stopPropagation()}
              className="text-[10px] text-zinc-600 hover:text-zinc-300 font-mono no-underline px-2.5"
            >
              Open on X →
            </a>
          </div>
        </div>
      </div>

      {/* ─── LEVEL 2 ───────────────────────────── */}
      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-zinc-800/60 bg-black/30">
          {/* Cash-out grid */}
          <div className="mb-5">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 font-mono mb-2">
              Money taken
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Bucket label="Last 24h" value={fmtUsd(e.cashout.d1)} />
              <Bucket label="7 days" value={fmtUsd(e.cashout.d7)} />
              <Bucket label="30 days" value={fmtUsd(e.cashout.d30)} />
              <Bucket label="This year" value={fmtUsd(e.cashout.ytd)} />
              <Bucket
                label="Total"
                value={fmtUsd(e.totalProceeds) ?? fmtUsd(e.cashout.total)}
                strong
              />
            </div>
          </div>

          {/* Pattern */}
          <div className="mb-5">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 font-mono mb-1.5">
              Same pattern
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

          {/* Tickers full list */}
          {e.tickers.length > 0 && (
            <div className="mb-5">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600 font-mono mb-1.5">
                Tickers linked
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

          {/* Wallet history */}
          <WalletHistorySection handle={e.handle} isOpen={isOpen} labelText="All tokens touched" emptyText="No on-chain history available" />


          {/* Links row */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            {e.isPublished ? (
              <a
                href={`/en/kol/${e.handle}`}
                className="px-3 py-1.5 rounded-md border border-[#F85B05]/40 bg-[#F85B05]/10 text-[#F85B05] font-black uppercase tracking-[0.12em] hover:bg-[#F85B05]/20 transition-colors no-underline"
              >
                Open case file →
              </a>
            ) : (
              <span className="px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/40 text-zinc-600 font-black uppercase tracking-[0.12em]">
                Case file under review
              </span>
            )}
            <a
              href={`https://x.com/${e.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-200 no-underline"
            >
              Open on X →
            </a>
            {e.casesCount > 0 && (
              <span className="text-zinc-600">
                {e.casesCount} linked case{e.casesCount > 1 ? 's' : ''}
              </span>
            )}
            {e.walletsCount > 0 && (
              <span className="text-zinc-600">
                {e.walletsCount} linked wallet{e.walletsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/* ── wallet history ────────────────────────────────────── */

interface WalletToken {
  mint: string
  symbol: string | null
  name: string | null
  lastSeen: number
  txCount: number
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(mo / 12)}y`
}

function WalletHistorySection({
  handle,
  isOpen,
  labelText,
  emptyText,
}: {
  handle: string
  isOpen: boolean
  labelText: string
  emptyText: string
}) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [tokens, setTokens] = useState<WalletToken[]>([])
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    if (!isOpen || loaded || loading) return
    setLoading(true)
    fetch(`/api/kol/${encodeURIComponent(handle)}/wallet-history`)
      .then(r => r.json())
      .then(d => {
        if (d?.error) setErrored(true)
        setTokens(Array.isArray(d?.tokens) ? d.tokens : [])
      })
      .catch(() => setErrored(true))
      .finally(() => {
        setLoading(false)
        setLoaded(true)
      })
  }, [isOpen, loaded, loading, handle])

  return (
    <div className="mb-5">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#666] font-mono mb-2">
        {labelText}
      </div>
      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-4 rounded bg-[#1A1A1A] animate-pulse" />
          ))}
        </div>
      ) : tokens.length === 0 || errored ? (
        <div className="text-[11px] font-mono text-[#555]">{emptyText}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tokens.slice(0, 20).map(t => (
            <span
              key={t.mint}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded"
              style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.10)' }}
              title={t.name ?? t.mint}
            >
              <span className="font-black">${t.symbol ?? t.mint.slice(0, 4)}</span>
              <span className="text-[9px] text-zinc-500">{relTime(t.lastSeen)}</span>
              <span className="text-[9px] text-zinc-600">·{t.txCount}</span>
            </span>
          ))}
        </div>
      )}
    </div>
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
        className={`text-sm font-black font-mono ${strong ? '' : ''}`}
        style={{ color: empty ? '#3f3f46' : strong ? '#ef4444' : '#f4f4f5' }}
      >
        {value ?? '—'}
      </div>
    </div>
  )
}
