import { NextRequest, NextResponse } from 'next/server'
import { lookupRwaRegistry } from '@/lib/rwa-registry/lookup'

// ─── RATE LIMIT SIMPLE (in-memory, par IP) ────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30       // requêtes
const RATE_LIMIT_WINDOW = 60_000 // 1 minute en ms

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) return true

  entry.count++
  return false
}

// ─── ROUTE ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // IP pour rate limiting
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 }
      )
    }

    // Parse body
    const body = await req.json() as unknown
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { address, chainKey } = body as Record<string, unknown>

    // Validation inputs
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid address' }, { status: 400 })
    }

    if (!chainKey || typeof chainKey !== 'string' || chainKey.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid chainKey' }, { status: 400 })
    }

    // Lookup
    const result = await lookupRwaRegistry(address.trim(), chainKey.trim())

    return NextResponse.json(result, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    // Erreurs de validation connues → 400
    if (
      message.includes('Invalid EVM address') ||
      message.includes('Invalid Solana address') ||
      message.includes('Unsupported chainKey') ||
      message.includes('Unknown chainKey')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    console.error('[RWA Registry Lookup] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Bloquer les autres méthodes
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
