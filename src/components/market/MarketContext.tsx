'use client'
import React, { useEffect, useState } from 'react'

type Locale = 'en' | 'fr'

interface CoinPrice {
  symbol: string
  usd: number | null
  change24h: number | null
}

interface FngState {
  value: number | null
  label: string | null
}

const COINS: { id: string; symbol: string }[] = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
]

const T = {
  en: {
    title: 'MARKET CONTEXT',
    fngLabel: 'Fear & Greed Index',
    loading: 'Loading market data…',
    unavailable: 'Market data temporarily unavailable.',
    fngLevels: {
      extremeFear: 'Extreme Fear',
      fear: 'Fear',
      neutral: 'Neutral',
      greed: 'Greed',
      extremeGreed: 'Extreme Greed',
    },
    contextual: {
      extremeFear:
        'Market in panic. Some projects use the chaos to disappear quietly.',
      fear: 'Cautious market. Good time to verify everything before acting.',
      neutral: 'Stable market. The warning signals still apply.',
      greed:
        'Euphoric market. Callers are more active. Double-check everything.',
      extremeGreed:
        'Extreme greed. This is when scams work best. Be careful.',
    },
  },
  fr: {
    title: 'CONTEXTE MARCHÉ',
    fngLabel: 'Indice Fear & Greed',
    loading: 'Chargement des données marché…',
    unavailable: 'Données marché momentanément indisponibles.',
    fngLevels: {
      extremeFear: 'Peur extrême',
      fear: 'Peur',
      neutral: 'Neutre',
      greed: 'Avidité',
      extremeGreed: 'Avidité extrême',
    },
    contextual: {
      extremeFear:
        "Marché en panique. Certains projets profitent du chaos pour disparaître.",
      fear: "Marché prudent. Bonne période pour vérifier avant d'agir.",
      neutral: "Marché stable. Les signaux d'alerte restent valides.",
      greed:
        "Marché euphorique. Les callers sont plus actifs. Vérifiez deux fois.",
      extremeGreed:
        "Greed extrême. C'est le moment où les scams fonctionnent le mieux. Soyez prudents.",
    },
  },
} as const

function fngBucket(v: number): keyof typeof T.en.fngLevels {
  if (v <= 25) return 'extremeFear'
  if (v <= 45) return 'fear'
  if (v <= 55) return 'neutral'
  if (v <= 75) return 'greed'
  return 'extremeGreed'
}

function fngColor(v: number): string {
  if (v <= 25) return '#ef4444'
  if (v <= 45) return '#f97316'
  if (v <= 55) return '#a3a3a3'
  if (v <= 75) return '#f59e0b'
  return '#10b981'
}

function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1) return '$' + n.toFixed(2)
  return '$' + n.toFixed(4)
}

function fmtChange(n: number | null): string {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return sign + n.toFixed(2) + '%'
}

export default function MarketContext({ locale }: { locale: Locale }) {
  const t = T[locale] ?? T.en
  const [prices, setPrices] = useState<CoinPrice[]>([])
  const [fng, setFng] = useState<FngState>({ value: null, label: null })
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const ids = COINS.map(c => c.id).join(',')
        const [pricesRes, fngRes] = await Promise.allSettled([
          fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
            { cache: 'no-store' },
          ).then(r => (r.ok ? r.json() : null)),
          fetch('https://api.alternative.me/fng/?limit=1', { cache: 'no-store' }).then(r =>
            r.ok ? r.json() : null,
          ),
        ])

        if (cancelled) return

        let anySuccess = false

        if (pricesRes.status === 'fulfilled' && pricesRes.value) {
          const data = pricesRes.value as Record<
            string,
            { usd?: number; usd_24h_change?: number }
          >
          const next: CoinPrice[] = COINS.map(c => ({
            symbol: c.symbol,
            usd: data[c.id]?.usd ?? null,
            change24h: data[c.id]?.usd_24h_change ?? null,
          }))
          setPrices(next)
          if (next.some(p => p.usd != null)) anySuccess = true
        }

        if (fngRes.status === 'fulfilled' && fngRes.value) {
          const raw = fngRes.value as { data?: { value?: string; value_classification?: string }[] }
          const entry = raw?.data?.[0]
          const v = entry?.value != null ? parseInt(entry.value, 10) : NaN
          if (!Number.isNaN(v)) {
            setFng({ value: v, label: entry?.value_classification ?? null })
            anySuccess = true
          }
        }

        if (!anySuccess) setErrored(true)
      } catch {
        if (!cancelled) setErrored(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const fngBucketKey = fng.value != null ? fngBucket(fng.value) : null
  const fngColorHex = fng.value != null ? fngColor(fng.value) : '#6b7280'
  const fngLevelLabel = fngBucketKey ? t.fngLevels[fngBucketKey] : null
  const contextualMessage = fngBucketKey ? t.contextual[fngBucketKey] : null
  const fngPct = fng.value != null ? Math.max(0, Math.min(100, fng.value)) : 0

  return (
    <div
      className="w-full rounded-xl"
      style={{ background: '#111111', border: '1px solid #1A1A1A' }}
    >
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F85B05] font-mono">
          {t.title}
        </span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] animate-pulse" />
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="text-[11px] font-mono text-zinc-600 py-2">{t.loading}</div>
        ) : errored && prices.length === 0 && fng.value == null ? (
          <div className="text-[11px] font-mono text-zinc-600 py-2">{t.unavailable}</div>
        ) : (
          <>
            {/* Prices row */}
            {prices.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
                {prices.map(p => {
                  const up = (p.change24h ?? 0) >= 0
                  const changeColor = p.change24h == null ? '#6b7280' : up ? '#10b981' : '#ef4444'
                  return (
                    <div key={p.symbol} className="flex items-baseline gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 font-mono">
                        {p.symbol}
                      </span>
                      <span className="text-sm font-black text-white font-mono">
                        {fmtUsd(p.usd)}
                      </span>
                      <span
                        className="text-[11px] font-bold font-mono"
                        style={{ color: changeColor }}
                      >
                        {fmtChange(p.change24h)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Fear & Greed */}
            {fng.value != null && (
              <div className="pt-3 border-t border-zinc-800/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 font-mono">
                    {t.fngLabel}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-black font-mono" style={{ color: fngColorHex }}>
                      {fng.value}
                    </span>
                    <span
                      className="text-[10px] font-black uppercase tracking-[0.12em] font-mono"
                      style={{ color: fngColorHex }}
                    >
                      {fngLevelLabel}
                    </span>
                  </div>
                </div>

                {/* Gauge */}
                <div className="relative h-1.5 rounded-full bg-zinc-900 overflow-hidden mb-3">
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-700"
                    style={{ width: `${fngPct}%`, background: fngColorHex }}
                  />
                </div>

                {/* Contextual reading */}
                {contextualMessage && (
                  <p className="text-[12px] italic text-zinc-500 leading-relaxed">
                    {contextualMessage}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
