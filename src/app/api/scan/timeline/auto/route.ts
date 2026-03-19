import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Auto-generate a Point A→Z timeline for any token
// Uses WalletLabel DB + RPC data to build the narrative

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  if (!address) return NextResponse.json({ found: false })

  try {
    const addr = address.toLowerCase().trim()

    // 1. Check if we have a manual GraphCase first (best quality)
    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: addr },
      include: { nodes: true, edges: true }
    })
    if (graphCase) {
      return NextResponse.json({ found: true, source: 'graph_db', redirect: `/api/scan/timeline/${address}` })
    }

    // 2. Auto-generate from WalletLabel DB
    const chapters: any[] = []

    // Check if the address itself is known
    const selfLabel = await prisma.walletLabel.findFirst({
      where: { address: addr, verified: true }
    })

    // Chapter 1 — Token/Wallet Identity
    chapters.push({
      id: 'identity',
      order: 1,
      icon: '01',
      titleEn: selfLabel ? `Known ${selfLabel.category.toUpperCase()}` : 'Address Scanned',
      titleFr: selfLabel ? `${selfLabel.category.toUpperCase()} Identifié` : 'Adresse Scannée',
      risk: selfLabel?.category === 'scammer' ? 'critical' : selfLabel?.category === 'mixer' ? 'high' : 'medium',
      descEn: selfLabel
        ? `This address is identified as ${selfLabel.label} (${selfLabel.category}) — source: ${selfLabel.source}`
        : 'This address has no known identity in our database yet.',
      descFr: selfLabel
        ? `Cette adresse est identifiée comme ${selfLabel.label} (${selfLabel.category}) — source: ${selfLabel.source}`
        : 'Cette adresse n\'a pas d\'identité connue dans notre base de données.',
      actors: selfLabel ? [{ label: selfLabel.label, type: selfLabel.category, flagged: selfLabel.category === 'scammer', wallet: addr }] : [],
      evidence: selfLabel?.sourceUrl ?? selfLabel?.source ?? null,
      flagCount: selfLabel?.category === 'scammer' ? 1 : 0,
      redFlag: selfLabel?.category === 'scammer' || selfLabel?.category === 'mixer',
    })

    // Check for CEX — cashout detection
    const cexLabel = await prisma.walletLabel.findFirst({
      where: { address: addr, category: 'cex', verified: true }
    })

    if (cexLabel) {
      chapters.push({
        id: 'cashout',
        order: 4,
        icon: '04',
        titleEn: 'Cashout Detected',
        titleFr: 'Cashout Détecté',
        risk: 'critical',
        descEn: `Funds sent to ${cexLabel.label} — KYC required. Platform knows the identity of the recipient.`,
        descFr: `Fonds envoyés vers ${cexLabel.label} — KYC requis. La plateforme connaît l'identité du destinataire.`,
        actors: [{ label: cexLabel.label, type: 'cex', flagged: false, wallet: addr }],
        evidence: `Destination: ${cexLabel.label} (${cexLabel.source})`,
        flagCount: 1,
        redFlag: true,
      })
    }

    // Check for mixer
    const mixerLabel = await prisma.walletLabel.findFirst({
      where: { address: addr, category: 'mixer', verified: true }
    })

    if (mixerLabel) {
      chapters.push({
        id: 'mixing',
        order: 3,
        icon: '03',
        titleEn: 'Mixer Detected',
        titleFr: 'Mixer Détecté',
        risk: 'critical',
        descEn: `Funds passed through ${mixerLabel.label} — this is a strong signal of intentional anonymization.`,
        descFr: `Les fonds ont transité par ${mixerLabel.label} — signal fort d'anonymisation intentionnelle.`,
        actors: [{ label: mixerLabel.label, type: 'mixer', flagged: true, wallet: addr }],
        evidence: mixerLabel.source,
        flagCount: 1,
        redFlag: true,
      })
    }

    if (chapters.length === 0) {
      return NextResponse.json({ found: false, reason: 'no_data' })
    }

    const redFlags = chapters.filter(c => c.redFlag).length

    return NextResponse.json({
      found: true,
      source: 'auto_wallet_label',
      address: addr,
      chapters: chapters.sort((a, b) => a.order - b.order),
      stats: {
        totalChapters: chapters.length,
        redFlags,
        hasManualCase: false,
      },
      label: selfLabel ?? null,
    })

  } catch (e: any) {
    console.error('[TIMELINE AUTO]', e)
    return NextResponse.json({ found: false, error: e.message })
  }
}
