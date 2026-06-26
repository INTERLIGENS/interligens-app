'use client'
import React from 'react'

export type TokenPickerSource = 'curated' | 'mentions' | 'dexscreener' | 'coingecko'
export type TokenPickerChain =
  | 'SOL'
  | 'ETH'
  | 'BSC'
  | 'TRON'
  | 'HYPER'
  | 'BASE'
  | 'ARBITRUM'
  | 'OTHER'
export type TokenPickerMatchType =
  | 'exact'
  | 'query_starts_with_symbol'
  | 'symbol_starts_with_query'

// Stable candidate contract. `ticker`/`mint` are canonical; `symbol`/`address`
// are legacy aliases kept so the demo pages' formatAddressForChain/handleTickerPick
// keep working untouched.
export interface TokenCandidate {
  ticker: string
  name?: string | null
  mint: string
  chain: TokenPickerChain
  source: TokenPickerSource
  matchType: TokenPickerMatchType
  liquidityUsd: number | null
  volume24hUsd: number | null
  pairCreatedAt: number | null
  lowLiquidity: boolean
  kolCount?: number
  // legacy aliases
  symbol: string
  address: string
}

interface Props {
  query: string
  candidates: TokenCandidate[]
  locale: 'en' | 'fr'
  loading?: boolean
  onPick: (c: TokenCandidate) => void
  onClose?: () => void
}

const T = {
  en: {
    title: 'Several tokens match',
    titleNone: 'No token found',
    subtitle: (q: string) =>
      `More than one token matches "$${q}". Pick the one your friend sent you, or the one you saw on X.`,
    subtitleNone: (q: string) =>
      `Nothing tied to "$${q}" yet — not in INTERLIGENS files, not on DexScreener, not on CoinGecko.`,
    helpNone: 'If you have a contract address, paste it directly in the scan field.',
    sources: {
      curated: 'INTERLIGENS curated',
      mentions: 'Seen in posts',
      dexscreener: 'Live (DexScreener)',
      coingecko: 'External (CoinGecko)',
    },
    lowLiq: 'LOW LIQ',
    noLiq: 'liq n/a',
    kol: (n: number) =>
      n === 0 ? 'No KOL on file' : n === 1 ? '1 KOL linked' : `${n} KOLs linked`,
    pick: 'Scan this',
    close: 'Cancel',
  },
  fr: {
    title: 'Plusieurs tokens correspondent',
    titleNone: 'Aucun token trouvé',
    subtitle: (q: string) =>
      `Plusieurs tokens correspondent à "$${q}". Choisis celui que ton ami t'a envoyé, ou celui que tu as vu sur X.`,
    subtitleNone: (q: string) =>
      `Rien lié à "$${q}" pour l'instant — ni dans les dossiers INTERLIGENS, ni sur DexScreener, ni sur CoinGecko.`,
    helpNone: "Si tu as l'adresse du contrat, colle-la directement dans le champ scan.",
    sources: {
      curated: 'INTERLIGENS curated',
      mentions: 'Vu dans les posts',
      dexscreener: 'Live (DexScreener)',
      coingecko: 'Externe (CoinGecko)',
    },
    lowLiq: 'LIQ FAIBLE',
    noLiq: 'liq n/d',
    kol: (n: number) =>
      n === 0 ? 'Aucun KOL au dossier' : n === 1 ? '1 KOL lié' : `${n} KOLs liés`,
    pick: 'Scanner celui-ci',
    close: 'Annuler',
  },
} as const

const CHAIN_LABEL: Record<TokenPickerChain, string> = {
  SOL: 'Solana',
  ETH: 'Ethereum',
  BSC: 'BNB Chain',
  TRON: 'TRON',
  HYPER: 'Hyperliquid',
  BASE: 'Base',
  ARBITRUM: 'Arbitrum',
  OTHER: 'Other chain',
}

// Brand palette only: orange accent / amber / neutral grays. No cyan.
const SOURCE_COLOR: Record<TokenPickerSource, string> = {
  curated: '#FF6B00',
  mentions: '#FFB800',
  dexscreener: '#FF6B00',
  coingecko: '#71717a',
}

function shortAddr(addr: string): string {
  if (!addr) return ''
  if (addr.length <= 14) return addr
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function formatUsd(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + Math.round(n).toString()
}

export default function TokenPicker({
  query,
  candidates,
  locale,
  loading = false,
  onPick,
  onClose,
}: Props) {
  const t = T[locale] ?? T.en
  const empty = !loading && candidates.length === 0

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-[#000000] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF6B00] font-mono mb-1">
            {empty ? t.titleNone : t.title}
          </div>
          <p className="text-sm text-zinc-400 leading-snug">
            {empty ? t.subtitleNone(query) : t.subtitle(query)}
          </p>
          {empty && <p className="text-[12px] text-zinc-600 mt-2 italic">{t.helpNone}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600 hover:text-zinc-300 font-mono"
          >
            {t.close}
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="px-5 pb-5 text-[11px] font-mono text-zinc-600">…</div>
      ) : candidates.length > 0 ? (
        <ul className="divide-y divide-zinc-800/60">
          {candidates.map((c, i) => {
            const isTop = i === 0
            const liq = formatUsd(c.liquidityUsd)
            const vol = formatUsd(c.volume24hUsd)
            return (
              <li key={`${c.chain}:${c.mint}:${i}`}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className={
                    'w-full text-left px-5 py-4 flex items-center gap-4 transition-colors ' +
                    (isTop ? 'bg-[#FF6B00]/10 hover:bg-[#FF6B00]/15' : 'hover:bg-zinc-900/40')
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                      <span className="text-[13px] font-black font-mono text-[#FFFFFF]">
                        ${c.ticker}
                      </span>
                      {c.name && <span className="text-[12px] text-zinc-300">{c.name}</span>}
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] font-mono px-1.5 py-0.5 rounded bg-zinc-800/70 text-zinc-300">
                        {CHAIN_LABEL[c.chain]}
                      </span>
                      {c.lowLiquidity && (
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] font-mono px-1.5 py-0.5 rounded bg-[#FFB800]/15 text-[#FFB800]">
                          {t.lowLiq}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-mono text-zinc-500">
                        {shortAddr(c.mint)}
                      </span>
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.12em] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          color: SOURCE_COLOR[c.source],
                          background: SOURCE_COLOR[c.source] + '15',
                        }}
                      >
                        {t.sources[c.source]}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        liq {liq ?? t.noLiq}
                      </span>
                      {vol && (
                        <span className="text-[10px] font-mono text-zinc-500">vol24h {vol}</span>
                      )}
                      {(c.kolCount ?? 0) > 0 && (
                        <span className="text-[10px] font-mono text-zinc-500">
                          · {t.kol(c.kolCount ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.15em] text-[#FF6B00] font-mono whitespace-nowrap">
                    {t.pick} →
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
