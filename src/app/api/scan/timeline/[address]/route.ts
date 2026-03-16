import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { lookupAddresses } from '@/lib/labels/lookup'

export async function GET(req: NextRequest, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params
    const addr = address.toLowerCase()

    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: addr },
      include: { nodes: true, edges: true }
    })

    if (!graphCase) {
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
      icon: '🔨',
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
        icon: '💰',
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
        icon: '📣',
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
        icon: '💀',
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
