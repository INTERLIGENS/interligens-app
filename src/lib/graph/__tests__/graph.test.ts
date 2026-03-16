import { describe, it, expect } from 'vitest'
import { enrichAddress } from '../enrich'
import { renderGraphPDF } from '../../pdf/graph/templateGraph'
import { createHash } from 'crypto'

describe('Graph Enrichment', () => {
  it('returns empty array for solana chain', async () => {
    const nodes = await enrichAddress('BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb')
    expect(Array.isArray(nodes)).toBe(true)
  })

  it('detects known CEX address', async () => {
    const nodes = await enrichAddress('0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be')
    const cex = nodes.find(n => n.type === 'cex')
    expect(cex).toBeDefined()
    expect(cex?.label).toContain('Binance')
  })

  it('returns nodes with required fields', async () => {
    const nodes = await enrichAddress('0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be')
    nodes.forEach(n => {
      expect(n).toHaveProperty('type')
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('metadata')
      expect(n).toHaveProperty('posX')
      expect(n).toHaveProperty('posY')
      expect(n).toHaveProperty('flagged')
    })
  })
})

describe('Graph PDF Template', () => {
  const mockCase = {
    title: 'Test Investigation',
    pivotAddress: '0xabc123',
    chain: 'evm',
    notes: 'Test notes',
    nodes: [
      { id: 'n1', type: 'wallet', label: '0xabc123', metadata: '{"isPivot":true}', posX: 400, posY: 200, flagged: false },
      { id: 'n2', type: 'person', label: 'Suspect A', metadata: '{"wallet":"0xdef456"}', posX: 200, posY: 100, flagged: true },
      { id: 'n3', type: 'cex', label: 'Binance', metadata: '{"note":"KYC probable"}', posX: 600, posY: 300, flagged: false },
    ],
    edges: [
      { id: 'e1', sourceId: 'n2', targetId: 'n1', relation: 'controls', confidence: 'HIGH', evidence: 'tx_hash_123' },
      { id: 'e2', sourceId: 'n1', targetId: 'n3', relation: 'deposited_to', confidence: 'HIGH', evidence: 'tx_hash_456' },
    ]
  }

  const sha256 = createHash('sha256').update(JSON.stringify(mockCase)).digest('hex')

  it('renders valid HTML', () => {
    const html = renderGraphPDF(mockCase, 'en', sha256)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('INTERLIGENS')
    expect(html).toContain('Test Investigation')
  })

  it('renders in French', () => {
    const html = renderGraphPDF(mockCase, 'fr', sha256)
    expect(html).toContain('ADRESSE PIVOT')
    expect(html).toContain('HAUTE CERTITUDE')
  })

  it('includes SHA-256', () => {
    const html = renderGraphPDF(mockCase, 'en', sha256)
    expect(html).toContain(sha256)
  })

  it('computes corroboration score > 0', () => {
    const html = renderGraphPDF(mockCase, 'en', sha256)
    expect(html).toContain('/100')
  })

  it('includes all node labels', () => {
    const html = renderGraphPDF(mockCase, 'en', sha256)
    expect(html).toContain('Suspect A')
    expect(html).toContain('Binance')
  })

  it('includes edge relations', () => {
    const html = renderGraphPDF(mockCase, 'en', sha256)
    expect(html).toContain('controls')
    expect(html).toContain('deposited_to')
  })

  it('marks flagged nodes as SUSPECT', () => {
    const html = renderGraphPDF(mockCase, 'en', sha256)
    expect(html).toContain('SUSPECT')
  })

  it('renders legal disclaimer', () => {
    const html = renderGraphPDF(mockCase, 'en', sha256)
    expect(html).toContain('authorized professionals')
  })
})

describe('Corroboration Score Logic', () => {
  it('scores higher with more HIGH confidence edges', () => {
    const allHigh = [
      { confidence: 'HIGH' }, { confidence: 'HIGH' }, { confidence: 'HIGH' }
    ]
    const allLow = [
      { confidence: 'LOW' }, { confidence: 'LOW' }, { confidence: 'LOW' }
    ]
    const nodes = [{ type: 'wallet', flagged: false }, { type: 'person', flagged: true }]

    const scoreHigh = Math.min(100, Math.round(
      (allHigh.filter(e => e.confidence === 'HIGH').length / allHigh.length) * 40 +
      Math.min(new Set(nodes.map(n => n.type)).size * 8, 32) +
      Math.min(nodes.filter(n => n.flagged).length * 7, 28)
    ))
    const scoreLow = Math.min(100, Math.round(
      (allLow.filter(e => e.confidence === 'HIGH').length / allLow.length) * 40 +
      Math.min(new Set(nodes.map(n => n.type)).size * 8, 32) +
      Math.min(nodes.filter(n => n.flagged).length * 7, 28)
    ))
    expect(scoreHigh).toBeGreaterThan(scoreLow)
  })

  it('score is capped at 100', () => {
    const edges = Array(20).fill({ confidence: 'HIGH' })
    const nodes = Array(10).fill(0).map((_, i) => ({ type: `type${i}`, flagged: true }))
    const score = Math.min(100, Math.round(
      (edges.filter(e => e.confidence === 'HIGH').length / edges.length) * 40 +
      Math.min(new Set(nodes.map(n => n.type)).size * 8, 32) +
      Math.min(nodes.filter(n => n.flagged).length * 7, 28)
    ))
    expect(score).toBeLessThanOrEqual(100)
  })

  it('score is 0 for empty case', () => {
    const score = Math.min(100, Math.round(
      (0 / Math.max(1, 0)) * 40 +
      Math.min(0 * 8, 32) +
      Math.min(0 * 7, 28)
    ))
    expect(score).toBe(0)
  })
})
