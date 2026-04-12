'use client'
import React from 'react'

export type TokenPickerSource = 'curated' | 'mentions' | 'coingecko'
export type TokenPickerChain = 'SOL' | 'ETH' | 'BSC' | 'TRON' | 'HYPER' | 'BASE' | 'ARBITRUM'

export interface TokenCandidate {
  symbol: string
  address: string
  chain: TokenPickerChain
  source: TokenPickerSource
  kolCount: number
  name?: string
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
      `We found more than one token using "$${q}". Pick the one your friend sent you, or the one you saw on X.`,
    subtitleNone: (q: string) =>
      `Nothing tied to "$${q}" yet — not in INTERLIGENS files, not on CoinGecko.`,
    helpNone:
      'If you have a contract address, paste it directly in the scan field.',
    sources: {
      curated: 'INTERLIGENS curated',
      mentions: 'Seen in posts',
      coingecko: 'External (CoinGecko)',
    },
    kol: (n: number) =>
      n === 0 ? 'No KOL on file' : n === 1 ? '1 KOL linked' : `${n} KOLs linked`,
    pick: 'Scan this',
    close: 'Cancel',
  },
  fr: {
    title: 'Plusieurs tokens correspondent',
    titleNone: 'Aucun token trouvé',
    subtitle: (q: string) =>
      `On a trouvé plusieurs tokens qui utilisent "$${q}". Choisis celui que ton ami t'a envoyé, ou celui que tu as vu sur X.`,
    subtitleNone: (q: string) =>
      `Rien lié à "$${q}" pour l'instant — ni dans les dossiers INTERLIGENS, ni sur CoinGecko.`,
    helpNone:
      "Si tu as l'adresse du contrat, colle-la directement dans le champ scan.",
    sources: {
      curated: 'INTERLIGENS curated',
      mentions: 'Vu dans les posts',
      coingecko: 'Externe (CoinGecko)',
    },
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
}

const SOURCE_COLOR: Record<TokenPickerSource, string> = {
  curated: '#F85B05',
  mentions: '#3b82f6',
  coingecko: '#71717a',
}

function shortAddr(addr: string): string {
  if (addr.length <= 14) return addr
  return addr.slice(0, 6) + '…' + addr.slice(-4)
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
    <div className="mt-4 rounded-xl border border-zinc-800 bg-[#0A0A0A] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F85B05] font-mono mb-1">
            {empty ? t.titleNone : t.title}
          </div>
          <p className="text-sm text-zinc-400 leading-snug">
            {empty ? t.subtitleNone(query) : t.subtitle(query)}
          </p>
          {empty && (
            <p className="text-[12px] text-zinc-600 mt-2 italic">{t.helpNone}</p>
          )}
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
          {candidates.map((c, i) => (
            <li key={`${c.chain}:${c.address}:${i}`}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span
                      className="text-[13px] font-black font-mono"
                      style={{ color: '#3b82f6' }}
                    >
                      ${c.symbol}
                    </span>
                    {c.name && (
                      <span className="text-[12px] text-zinc-300">{c.name}</span>
                    )}
                    <span className="text-[10px] font-mono text-zinc-600">
                      · {CHAIN_LABEL[c.chain]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {shortAddr(c.address)}
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
                    {c.kolCount > 0 && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        · {t.kol(c.kolCount)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.15em] text-[#F85B05] font-mono whitespace-nowrap">
                  {t.pick} →
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
