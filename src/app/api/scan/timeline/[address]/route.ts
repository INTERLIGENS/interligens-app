import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { lookupAddresses } from '@/lib/labels/lookup'
import { loadCaseByMint } from '../../../../../../lib/caseDb'

const SEVERITY_TO_RISK: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

function buildTimelineFromCasefile(address: string) {
  // Solana base58 mints are case-sensitive — loadCaseByMint keys on the
  // original-case form, so pass `address` (NOT the lowercased addr).
  const cf = loadCaseByMint(address)
  if (!cf) return null

  const chapters = cf.claims.map((c, idx) => ({
    id: c.claim_id.toLowerCase(),
    order: idx + 1,
    icon: c.claim_id,
    titleEn: c.title,
    titleFr: (c as any).title_fr || c.title,
    risk: SEVERITY_TO_RISK[c.severity] ?? 'medium',
    descEn: c.description,
    descFr: (c as any).description_fr || c.description,
    actors: [] as { label: string; type: string; flagged: boolean; wallet: string }[],
    evidence: c.thread_url || (c.evidence_refs?.[0] ?? null),
    flagCount: c.status === 'CONFIRMED' ? 1 : 0,
    redFlag: c.severity === 'CRITICAL',
  }))

  const confirmed = cf.claims.filter(c => c.status === 'CONFIRMED').length
  const corrobScore = Math.min(
    100,
    Math.round((confirmed / Math.max(1, cf.claims.length)) * 100)
  )

  return {
    found: true,
    caseId: cf.case_meta.case_id,
    title: `${cf.case_meta.token_name} — ${cf.case_meta.severity}`,
    pivotAddress: cf.case_meta.mint,
    chain: cf.case_meta.chain,
    chapters,
    stats: {
      totalNodes: cf.sources.length,
      totalEdges: cf.claims.length,
      flaggedNodes: confirmed,
      corrobScore,
      chain: cf.case_meta.chain,
    },
    source: 'casefile' as const,
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params
    const addr = address.toLowerCase()

    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: addr },
      include: { nodes: true, edges: true }
    })

    if (!graphCase) {
      // Fall back to the static casefile JSON store (case-sensitive mint).
      // BOTIFY and other confirmed casefiles live in data/cases/*.json
      // even when no GraphCase has been seeded for them yet.
      const fromCasefile = buildTimelineFromCasefile(address)
      if (fromCasefile) return NextResponse.json(fromCasefile)
      return NextResponse.json({ found: false, address: addr })
    }

    const nodes = graphCase.nodes
    const edges = graphCase.edges

    // Enrich nodes with WalletLabel data
    const walletAddresses = nodes.map(n => {
      try { return JSON.parse(n.metadata)?.wallet || n.label } catch { return n.label }
    })
    const labelMap = await lookupAddresses(walletAddresses)

    const getNode = (id: string) => nodes.find(n => n.id === id)
    const getMeta = (n: any) => { try { return JSON.parse(n.metadata) } catch { return {} } }

    // Build timeline chapters from edges
    const chapters: any[] = []

    // Chapter 1: Token Deployed
    const deployEdges = edges.filter(e => e.relation === 'deployed')
    const deployers = deployEdges.map(e => getNode(e.sourceId)).filter(Boolean)
    chapters.push({
      id: 'deploy',
      order: 1,
      icon: '01',
      titleEn: 'Token Deployed',
      titleFr: 'Token Déployé',
      risk: 'medium',
      descEn: `The BOTIFY token was deployed on ${graphCase.chain.toUpperCase()} by ${deployers.length} identified wallet${deployers.length > 1 ? 's' : ''}.`,
      descFr: `Le token BOTIFY a été déployé sur ${graphCase.chain.toUpperCase()} par ${deployers.length} wallet${deployers.length > 1 ? 's' : ''} identifié${deployers.length > 1 ? 's' : ''}.`,
      actors: deployers.map(n => ({ label: n!.label, type: n!.type, flagged: n!.flagged, wallet: getMeta(n).wallet || n!.label })),
      evidence: deployEdges[0]?.evidence ?? null,
      flagCount: deployers.filter(n => n!.flagged).length,
    })

    // Chapter 2: Insiders & Family Funded
    const fundEdges = edges.filter(e => e.relation === 'funded_by')
    const funders = [...new Set(fundEdges.map(e => e.sourceId))].map(id => getNode(id)).filter(Boolean)
    const funded = fundEdges.map(e => getNode(e.targetId)).filter(Boolean)
    if (fundEdges.length > 0) {
      chapters.push({
        id: 'insiders',
        order: 2,
        icon: '02',
        titleEn: 'Insiders & Family Funded',
        titleFr: 'Initiés & Famille Financés',
        risk: 'high',
        descEn: `${funders.length} team member${funders.length > 1 ? 's' : ''} pre-allocated tokens to ${funded.length} connected wallet${funded.length > 1 ? 's' : ''} — including family members — before public launch.`,
        descFr: `${funders.length} membre${funders.length > 1 ? 's' : ''} de l'équipe ont pré-alloué des tokens à ${funded.length} wallet${funded.length > 1 ? 's' : ''} connectés — dont des membres de la famille — avant le lancement public.`,
        actors: funded.map(n => {
          const wallet = getMeta(n).wallet || n!.label
          const knownLabel = labelMap[wallet.toLowerCase()]
          return { label: knownLabel ? knownLabel.label : n!.label, type: n!.type, flagged: n!.flagged, wallet, knownLabel }
        }),
        evidence: fundEdges[0]?.evidence ?? null,
        flagCount: funded.filter(n => n!.flagged).length,
        redFlag: true,
      })
    }

    // Chapter 3: KOLs & Promoters Paid
    const promoEdges = edges.filter(e => e.relation === 'promoted')
    const promoters = promoEdges.map(e => getNode(e.sourceId)).filter(Boolean)
    if (promoEdges.length > 0) {
      chapters.push({
        id: 'kols',
        order: 3,
        icon: '03',
        titleEn: 'KOLs & Promoters Paid',
        titleFr: 'KOLs & Promoteurs Payés',
        risk: 'high',
        descEn: `${promoters.length} influencer${promoters.length > 1 ? 's' : ''} and platform${promoters.length > 1 ? 's' : ''} were paid to promote the token. This is undisclosed paid promotion.`,
        descFr: `${promoters.length} influenceur${promoters.length > 1 ? 's' : ''} et plateforme${promoters.length > 1 ? 's' : ''} ont été payés pour promouvoir le token. Il s'agit de promotion payante non divulguée.`,
        actors: promoters.map(n => {
          const wallet = getMeta(n).wallet || n!.label
          const knownLabel = labelMap[wallet.toLowerCase()]
          return { label: knownLabel ? knownLabel.label : n!.label, type: n!.type, flagged: n!.flagged, wallet, knownLabel }
        }),
        evidence: promoEdges[0]?.evidence ?? null,
        flagCount: promoters.length,
        redFlag: true,
      })
    }

    // Chapter 4: Cashout
    const cashoutEdges = edges.filter(e => e.relation === 'deposited_to' || e.relation === 'withdrew_from')
    const cexNodes = nodes.filter(n => n.type === 'cex')
    if (cashoutEdges.length > 0 || cexNodes.length > 0) {
      chapters.push({
        id: 'cashout',
        order: 4,
        icon: '04',
        titleEn: 'Cashout Detected',
        titleFr: 'Cashout Détecté',
        risk: 'critical',
        descEn: `Funds were moved to ${cexNodes.length} known exchange${cexNodes.length > 1 ? 's' : ''} (KYC required). This is the classic final step before a rug pull.`,
        descFr: `Les fonds ont été transférés vers ${cexNodes.length} exchange${cexNodes.length > 1 ? 's' : ''} connu${cexNodes.length > 1 ? 's' : ''} (KYC requis). C'est l'étape finale classique avant un rug pull.`,
        actors: cexNodes.map(n => ({ label: n.label, type: n.type, flagged: false, wallet: getMeta(n).address || '' })),
        evidence: cashoutEdges[0]?.evidence ?? null,
        flagCount: cexNodes.length,
        redFlag: true,
      })
    }

    // Summary stats
    const totalFlagged = nodes.filter(n => n.flagged).length
    const highEdges = edges.filter(e => e.confidence === 'HIGH').length
    const corrobScore = Math.min(100, Math.round(
      (highEdges / Math.max(1, edges.length)) * 40 +
      Math.min(new Set(nodes.map(n => n.type)).size * 8, 32) +
      Math.min(totalFlagged * 7, 28)
    ))

    return NextResponse.json({
      found: true,
      caseId: graphCase.id,
      title: graphCase.title,
      pivotAddress: graphCase.pivotAddress,
      chain: graphCase.chain,
      chapters: chapters.sort((a, b) => a.order - b.order),
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        flaggedNodes: totalFlagged,
        corrobScore,
        chain: graphCase.chain,
      }
    })

  } catch (e: any) {
    console.error('[TIMELINE]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
