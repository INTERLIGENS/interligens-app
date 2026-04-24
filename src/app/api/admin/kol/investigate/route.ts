import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminApi } from "@/lib/security/adminAuth"
import { computeProceedsForHandle } from "@/lib/kol/proceeds"

const HELIUS_KEY = process.env.HELIUS_API_KEY!
const BOTIFY_CA = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb"
const GHOST_CA  = "BBKPiLM9KjdJW7oQSKt99RVWcZdhF6sEHRKnwqeBGHST"
const USDC_CA   = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const TARGETS   = new Set([BOTIFY_CA, GHOST_CA])

async function helius(addr: string, limit = 100, before?: string) {
  const url = `https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${HELIUS_KEY}&limit=${limit}${before ? `&before=${before}` : ""}`
  const r = await fetch(url)
  return r.json()
}

function fmtUsd(n: number) {
  if (n >= 1000) return "$" + (n/1000).toFixed(0) + "K"
  return "$" + n.toFixed(0)
}

export async function POST(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth

  const { handle } = await req.json()
  if (!handle) return NextResponse.json({ error: "Missing handle" }, { status: 400 })

  const kol = await prisma.kolProfile.findUnique({
    where: { handle },
    include: { kolWallets: true }
  })
  if (!kol) return NextResponse.json({ error: "KOL not found" }, { status: 404 })

  const results: any[] = []
  const created: any[] = []

  for (const wallet of kol.kolWallets) {
    const addr = wallet.address
    if (addr.startsWith("0x")) continue // skip EVM pour l'instant

    try {
      const txs = await helius(addr)
      if (!Array.isArray(txs)) continue

      // ── PATTERN 1: Cashout BOTIFY/GHOST ──
      const cashoutTxs = txs.filter((tx: any) =>
        tx.tokenTransfers?.some((t: any) => TARGETS.has(t.mint))
      )

      if (cashoutTxs.length > 0) {
        let totalUsdc = 0, totalSol = 0, txCount = 0
        let dateFirst: Date | null = null, dateLast: Date | null = null
        let sampleTx = ""

        for (const tx of cashoutTxs) {
          const ts = new Date(tx.timestamp * 1000)
          if (!dateFirst || ts < dateFirst) dateFirst = ts
          if (!dateLast || ts > dateLast) dateLast = ts
          txCount++
          if (!sampleTx) sampleTx = tx.signature

          totalUsdc += tx.tokenTransfers
            ?.filter((t: any) => t.mint === USDC_CA && t.toUserAccount === addr)
            ?.reduce((s: number, t: any) => s + (t.tokenAmount || 0), 0) ?? 0

          totalSol += tx.nativeTransfers
            ?.filter((t: any) => t.toUserAccount === addr)
            ?.reduce((s: number, t: any) => s + (t.amount || 0) / 1e9, 0) ?? 0
        }

        const amountUsd = totalUsdc > 0 ? totalUsdc : Math.round(totalSol * 183)
        const token = cashoutTxs[0].tokenTransfers
          ?.find((t: any) => TARGETS.has(t.mint))?.mint === GHOST_CA ? "GHOST" : "BOTIFY"

        results.push({
          type: "onchain_cashout",
          wallet: addr,
          label: wallet.label?.substring(0, 60) ?? addr.substring(0, 20),
          txCount,
          amountUsd,
          token,
          dateFirst,
          dateLast,
          sampleTx
        })
      }

      // ── PATTERN 2: Bot 4h (swaps réguliers) ──
      const swapTxs = txs.filter((t: any) => t.type === "SWAP").slice(0, 20)
      if (swapTxs.length >= 5) {
        const intervals = swapTxs.slice(0, -1).map((t: any, i: number) =>
          Math.abs(t.timestamp - swapTxs[i+1].timestamp) / 3600
        )
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const isBot = intervals.every(iv => Math.abs(iv - avgInterval) < 0.3)

        if (isBot && avgInterval > 1 && avgInterval < 12) {
          results.push({
            type: "bot_pattern",
            wallet: addr,
            label: `Automated swap pattern — every ~${avgInterval.toFixed(1)}h`,
            txCount: swapTxs.length,
            avgIntervalHours: avgInterval
          })
        }
      }

    } catch (e) {
      console.error(`Error scanning ${addr}:`, e)
    }
  }


  // ── PATTERN 3: Corrélation post X → cashout ──
  const xCorrelations: any[] = []
  try {
    const nitterUrl = `https://nitter.net/${kol.handle}/rss`
    const rssRes = await fetch(nitterUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000)
    })
    
    if (rssRes.ok) {
      const rssText = await rssRes.text()
      // Parser les posts depuis le RSS
      const items = [...rssText.matchAll(/<item>(.*?)<\/item>/gs)]
      
      for (const item of items.slice(0, 20)) {
        const raw = item[1]
        const title = raw.match(/<title>(.*?)<\/title>/s)?.[1]?.replace(/<[^>]+>/g, '') ?? ''
        const pubDate = raw.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''
        const link = raw.match(/<link>(.*?)<\/link>/)?.[1] ?? ''
        
        if (!pubDate) continue
        const postTs = new Date(pubDate).getTime() / 1000
        if (isNaN(postTs)) continue
        
        // Chercher cashouts dans les 24h après ce post
        const window24h = 24 * 3600
        const relatedCashouts = results.filter(r => {
          if (!r.dateFirst) return false
          const cashoutTs = new Date(r.dateFirst).getTime() / 1000
          const delta = cashoutTs - postTs
          return delta >= 0 && delta <= window24h
        })
        
        if (relatedCashouts.length > 0) {
          const totalCashout = relatedCashouts.reduce((s, r) => s + (r.amountUsd ?? 0), 0)
          const deltaMin = Math.round((new Date(relatedCashouts[0].dateFirst).getTime()/1000 - postTs) / 60)
          
          xCorrelations.push({
            type: 'x_cashout_correlation',
            wallet: relatedCashouts[0].wallet,
            label: `Post X → cashout correlation: "${title.slice(0, 60)}"`,
            description: `Post publié ${new Date(postTs*1000).toISOString().slice(0,16)} UTC. Cashout détecté ${deltaMin} minutes plus tard.`,
            wallets: JSON.stringify(relatedCashouts.map(r => r.wallet)),
            amountUsd: totalCashout,
            txCount: relatedCashouts.reduce((s, r) => s + (r.txCount ?? 0), 0),
            dateFirst: new Date(postTs * 1000),
            dateLast: relatedCashouts[relatedCashouts.length-1]?.dateLast,
            token: 'USDC',
            sampleTx: relatedCashouts[0].sampleTx,
            sourceUrl: link,
            twitterPost: link,
            postTimestamp: new Date(postTs * 1000),
            deltaMinutes: deltaMin
          })
        }
      }
    }
  } catch (e) {
    console.log('X correlation skipped:', e)
  }
  
  results.push(...xCorrelations)

  // ── Filtrer les wallets déjà couverts par evidences manuelles ──
  const existingWallets = new Set(
    (await prisma.kolEvidence.findMany({ where: { kolHandle: handle } }))
      .flatMap((e: any) => { try { return JSON.parse(e.wallets) } catch { return [] } })
  )

  // ── Créer les KolEvidence automatiquement ──
  for (const r of results) {
    if (existingWallets.has(r.wallet)) continue
    const existing = await prisma.kolEvidence.findFirst({
      where: { kolHandle: handle, sampleTx: r.sampleTx ?? undefined }
    })
    if (existing) continue

    const ev = await prisma.kolEvidence.create({
      data: {
        kolHandle: handle,
        type: r.type,
        label: r.label.substring(0, 200),
        description: r.type === "bot_pattern"
          ? `Automated swap pattern detected — avg interval ${r.avgIntervalHours?.toFixed(1)}h across ${r.txCount} transactions`
          : `On-chain cashout — ${r.txCount} TX, ${fmtUsd(r.amountUsd)} documented`,
        wallets: JSON.stringify([r.wallet]),
        amountUsd: r.amountUsd ?? 0,
        txCount: r.txCount,
        dateFirst: r.dateFirst,
        dateLast: r.dateLast,
        token: r.token,
        sampleTx: r.sampleTx,
        sourceUrl: `https://solscan.io/account/${r.wallet}`,
      }
    })
    created.push(ev.label)
  }

  // ── Recalculate totalDocumented from KolProceedsEvent (authoritative source) ──
  const proceedsResult = await computeProceedsForHandle(handle)
  const totalDocumented = proceedsResult.totalProceedsUsd

  return NextResponse.json({
    handle,
    walletsScanned: kol.kolWallets.filter(w => !w.address.startsWith("0x")).length,
    patternsFound: results.length,
    evidenceCreated: created.length,
    totalDocumented,
    created,
    patterns: results.map(r => ({ type: r.type, label: r.label, amount: r.amountUsd }))
  })
}
