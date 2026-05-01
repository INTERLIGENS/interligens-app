import { describe, it, expect } from 'vitest'

type Verdict = 'GREEN' | 'ORANGE' | 'RED' | 'BLACK'

function scoreToVerdict(score: number, tier: string): Verdict {
  if (tier === 'OFAC' || score >= 90) return 'BLACK'
  if (score >= 70) return 'RED'
  if (score >= 40) return 'ORANGE'
  return 'GREEN'
}

describe('scoreToVerdict', () => {
  it('GREEN for score < 40', () => {
    expect(scoreToVerdict(0, 'CLEAN')).toBe('GREEN')
    expect(scoreToVerdict(39, 'LOW')).toBe('GREEN')
  })

  it('ORANGE for score 40-69', () => {
    expect(scoreToVerdict(40, 'MEDIUM')).toBe('ORANGE')
    expect(scoreToVerdict(69, 'MEDIUM')).toBe('ORANGE')
  })

  it('RED for score 70-89', () => {
    expect(scoreToVerdict(70, 'HIGH')).toBe('RED')
    expect(scoreToVerdict(89, 'HIGH')).toBe('RED')
  })

  it('BLACK for score >= 90', () => {
    expect(scoreToVerdict(90, 'CRITICAL')).toBe('BLACK')
    expect(scoreToVerdict(100, 'CRITICAL')).toBe('BLACK')
  })

  it('BLACK for OFAC tier regardless of score', () => {
    expect(scoreToVerdict(0, 'OFAC')).toBe('BLACK')
    expect(scoreToVerdict(15, 'OFAC')).toBe('BLACK')
  })
})
