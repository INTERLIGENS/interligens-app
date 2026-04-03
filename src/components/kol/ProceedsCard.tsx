'use client'

import { useEffect, useState } from "react"

interface ProceedsSummary {
  found: boolean
  totalProceedsUsd: number
  proceedsByYear: Record<string, number>
  largestEventUsd: number | null
  largestEventDate: string | null
  walletCount: number
  caseCount: number
  eventCount: number
  confidence: string
  coverageStatus: string | null
  coverageNote: string | null
  topWalletLabel: string | null
  topTokenSymbol: string | null
  topTokenProceedsUsd: number | null
  computedAt: string
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   "text-green-400 border-green-400",
  medium: "text-amber-400 border-amber-400",
  low:    "text-red-400 border-red-400",
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function translateCoverageNote(note: string): string {
  return note
    .replace("Coverage limited to", "Couverture limitée à")
    .replace("identified SOL associated wallets", "portefeuilles SOL associés identifiés")
    .replace("identified SOL network wallets", "portefeuilles SOL réseau identifiés")
    .replace("identified SOL family wallets", "portefeuilles SOL familiaux identifiés")
    .replace("Direct personal wallets unconfirmed", "Portefeuilles personnels directs non confirmés")
    .replace("Direct wallets not yet confirmed", "Portefeuilles directs non encore confirmés")
    .replace("Direct wallets and EVM activity not yet captured", "Portefeuilles directs et activité EVM non encore capturés")
    .replace("GHOST token excluded — accounts closed", "Token GHOST exclu — comptes clôturés")
    .replace("Minimum observed under current methodology", "Minimum observé selon la méthodologie actuelle")
}

export default function ProceedsCard({ handle, lang = "en" }: { handle: string; lang?: string }) {
  const [data, setData] = useState<ProceedsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const t = {
    title:       lang === "fr" ? "Produits observés on-chain" : "Observed On-Chain Proceeds",
    subtitle:    lang === "fr" ? "Estimation basée sur les événements de cashout identifiés. Pas une déclaration de revenus." : "Estimated from identified cashout events. Not a claim of income or net worth.",
    largest:     lang === "fr" ? "Plus grand cashout" : "Largest cashout event",
    wallets:     lang === "fr" ? "Wallets liés" : "Linked wallets",
    events:      lang === "fr" ? "Événements" : "Events",
    cases:       lang === "fr" ? "Cas liés" : "Linked cases",
    yearly:      lang === "fr" ? "Par année" : "By year",
    confidence:  lang === "fr" ? "Confiance" : "Confidence",
    topToken:    lang === "fr" ? "Token principal" : "Top token",
    methodology: lang === "fr" ? "Méthodologie v1 — produits SOL on-chain uniquement" : "Methodology v1 — SOL on-chain proceeds only",
    partial:     lang === "fr" ? "COUVERTURE PARTIELLE" : "PARTIAL COVERAGE",
  }

  useEffect(() => {
    fetch(`/api/kol/${handle}/proceeds`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [handle])

  if (loading) return (
    <div className="rounded-xl border border-[#1E2330] bg-[#111318] p-6 mt-6">
      <div className="h-4 w-48 bg-[#1E2330] rounded animate-pulse mb-2" />
      <div className="h-8 w-32 bg-[#1E2330] rounded animate-pulse" />
    </div>
  )

  if (!data?.found || !data.totalProceedsUsd) return null

  const years = Object.entries(data.proceedsByYear)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))

  const confClass = CONFIDENCE_COLOR[data.confidence] ?? "text-gray-400 border-gray-400"
  const isPartial = data.coverageStatus === 'partial'

  return (
    <div className="rounded-xl border border-[#1E2330] bg-[#111318] p-6 mt-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#7A8599] uppercase tracking-widest mb-1">{t.title}</p>
          <p className="text-3xl font-black text-[#FFB800] tracking-tight">{fmt(data.totalProceedsUsd)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs border rounded px-2 py-0.5 uppercase font-bold ${confClass}`}>
            {t.confidence}: {data.confidence}
          </span>
          {isPartial && (
            <span className="text-xs border border-[#7A8599] text-[#7A8599] rounded px-2 py-0.5 uppercase font-bold">
              {t.partial}
            </span>
          )}
        </div>
      </div>

      {/* Coverage note */}
      {isPartial && data.coverageNote && (
        <div className="bg-[#0A0C10] border border-[#1E2330] rounded-lg px-4 py-3">
          <p className="text-xs text-[#7A8599]">{lang === "fr" ? translateCoverageNote(data.coverageNote) : data.coverageNote}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0A0C10] rounded-lg p-3">
          <p className="text-xs text-[#7A8599] mb-1">{t.largest}</p>
          <p className="text-sm font-bold text-white">{data.largestEventUsd ? fmt(data.largestEventUsd) : '—'}</p>
          {data.largestEventDate && (
            <p className="text-xs text-[#7A8599]">{data.largestEventDate.slice(0, 10)}</p>
          )}
        </div>
        <div className="bg-[#0A0C10] rounded-lg p-3">
          <p className="text-xs text-[#7A8599] mb-1">{t.wallets}</p>
          <p className="text-sm font-bold text-white">{data.walletCount}</p>
          <p className="text-xs text-[#7A8599]">{data.eventCount} {t.events}</p>
        </div>
        <div className="bg-[#0A0C10] rounded-lg p-3">
          <p className="text-xs text-[#7A8599] mb-1">{t.topToken}</p>
          <p className="text-sm font-bold text-white">{data.topTokenSymbol ?? '—'}</p>
          {data.topTokenProceedsUsd && (
            <p className="text-xs text-[#7A8599]">{fmt(data.topTokenProceedsUsd)}</p>
          )}
        </div>
      </div>

      {/* Yearly breakdown */}
      {years.length > 0 && (
        <div>
          <p className="text-xs text-[#7A8599] uppercase tracking-widest mb-2">{t.yearly}</p>
          <div className="space-y-1">
            {years.map(([year, amount]) => (
              <div key={year} className="flex items-center gap-3">
                <span className="text-xs text-[#7A8599] w-10">{year}</span>
                <div className="flex-1 bg-[#0A0C10] rounded-full h-1.5">
                  <div
                    className="bg-[#FFB800] h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (amount / data.totalProceedsUsd) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-white w-24 text-right">{fmt(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-[#1E2330] pt-3">
        <p className="text-xs text-[#7A8599]">{t.subtitle}</p>
        <p className="text-xs text-[#7A8599] mt-1">{t.methodology}</p>
      </div>
    </div>
  )
}
