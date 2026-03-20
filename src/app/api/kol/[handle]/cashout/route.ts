import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const HELIUS = process.env.HELIUS_API_KEY ?? ''
const BOTIFY_CA = 'BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb'
const DIONE_CA  = 'De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump'

async function fetchWalletTx(address: string, ca: string, before?: string): Promise<any[]> {
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS}&limit=100${before ? '&before=' + before : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!res.ok) return []
  const txs = await res.json()
  if (!Array.isArray(txs)) return []
  const found: any[] = []
  for (const t of txs) {
    for (const tr of (t.tokenTransfers ?? [])) {
      if (tr.mint === ca) {
        found.push({
          sig: t.signature,
          type: t.type,
          timestamp: t.timestamp,
          date: new Date(t.timestamp * 1000).toISOString().slice(0,10),
          tokenAmount: tr.tokenAmount,
          from: tr.fromUserAccount,
          to: tr.toUserAccount,
          mint: ca,
          solscanUrl: 'https://solscan.io/tx/' + t.signature,
        })
      }
    }
  }
  return found
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, '')
  const caFilter = req.nextUrl.searchParams.get('ca')

  try {
    const wallets: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "public"."KolWallet" WHERE "kolHandle" = $1`, h
    )
    if (!wallets.length) return NextResponse.json({ found: false, txs: [] })

    const CAS = caFilter ? [caFilter] : [BOTIFY_CA, DIONE_CA]
    const allTxs: any[] = []

    for (const w of wallets) {
      for (const ca of CAS) {
        // Page 1
        const p1 = await fetchWalletTx(w.address, ca)
        allTxs.push(...p1.map(t => ({ ...t, walletLabel: w.label, walletAddress: w.address })))

        // Page 2 if needed
        if (p1.length === 100) {
          const last = p1[p1.length - 1]
          const p2 = await fetchWalletTx(w.address, ca, last.sig)
          allTxs.push(...p2.map(t => ({ ...t, walletLabel: w.label, walletAddress: w.address })))
        }
      }
    }

    // Sort by timestamp desc
    allTxs.sort((a, b) => b.timestamp - a.timestamp)

    // Separate receives vs sells
    const receives = allTxs.filter(t => t.type === 'TRANSFER' && wallets.some(w => w.address === t.to))
    const sells    = allTxs.filter(t => t.type === 'SWAP' || (t.type === 'TRANSFER' && wallets.some(w => w.address === t.from)))

    return NextResponse.json({ found: true, total: allTxs.length, receives, sells, all: allTxs.slice(0, 50) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
