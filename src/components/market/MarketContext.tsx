'use client'
import React, { useEffect, useState } from 'react'

type Locale = 'en' | 'fr'

interface PriceEntry {
  symbol: 'BTC' | 'ETH' | 'SOL'
  usd: number | null
  change24h: number | null
}

interface FngEntry {
  value: number | null
  classification: string | null
}

interface MarketResponse {
  prices: PriceEntry[] | null
  fng: FngEntry | null
}

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
  const [data, setData] = useState<MarketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/market', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((json: MarketResponse | null) => {
        if (cancelled) return
        if (!json || (!json.prices && !json.fng)) {
          setErrored(true)
        } else {
          setData(json)
        }
      })
      .catch(() => {
        if (!cancelled) setErrored(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const prices = data?.prices ?? []
  const fng = data?.fng ?? null
  const fngBucketKey = fng?.value != null ? fngBucket(fng.value) : null
  const fngColorHex = fng?.value != null ? fngColor(fng.value) : '#6b7280'
  const fngLevelLabel = fngBucketKey ? t.fngLevels[fngBucketKey] : null
  const contextualMessage = fngBucketKey ? t.contextual[fngBucketKey] : null
  const fngPct = fng?.value != null ? Math.max(0, Math.min(100, fng.value)) : 0

  const noData = errored || (!loading && prices.length === 0 && fng == null)

  return (
    <div
      className="w-full rounded-xl overflow-hidden p-5"
      style={{ background: '#111111', border: '1px solid #1A1A1A' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F85B05] font-mono">
          {t.title}
        </span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] animate-pulse" />
      </div>

      {/* Body */}
      {loading ? (
        <div className="text-[11px] font-mono text-zinc-600">{t.loading}</div>
      ) : noData ? (
        <div className="text-[11px] font-mono text-zinc-600">{t.unavailable}</div>
      ) : (
        <>
          {/* Prices row */}
          {prices.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-4 font-mono">
              {prices.map(p => {
                const up = (p.change24h ?? 0) >= 0
                const changeColor =
                  p.change24h == null ? '#6b7280' : up ? '#22c55e' : '#ef4444'
                return (
                  <span key={p.symbol} className="inline-flex items-baseline gap-1.5">
                    <span className="text-[12px] font-black text-white">{p.symbol}</span>
                    <span className="text-[13px] font-black text-white">
                      {fmtUsd(p.usd)}
                    </span>
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: changeColor }}
                    >
                      {fmtChange(p.change24h)}
                    </span>
                  </span>
                )
              })}
            </div>
          )}

          {/* Fear & Greed */}
          {fng?.value != null && (
            <div className="pt-4 border-t border-zinc-800/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 font-mono">
                  {t.fngLabel}
                </span>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-base font-black font-mono"
                    style={{ color: fngColorHex }}
                  >
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
  )
}
