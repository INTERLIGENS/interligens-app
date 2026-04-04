import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const LIMIT = 3
const WINDOW = 86_400_000 // 24h

function checkRate(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) { rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW }); return true }
  if (entry.count >= LIMIT) return false
  entry.count++
  return true
}

const VALID_CHAINS = ['SOL', 'ETH', 'BSC', 'TRON']

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRate(ip)) return NextResponse.json({ error: 'Rate limited. Max 3 submissions per day.' }, { status: 429 })

  const body = await req.json()
  const { handle, contact, platform, wallets, notes } = body as {
    handle?: string; contact?: string; platform?: string
    wallets?: { chain: string; address: string; label?: string }[]
    notes?: string
  }

  if (!handle?.trim()) return NextResponse.json({ error: 'Handle or project name is required.' }, { status: 400 })
  if (!wallets || wallets.length === 0) return NextResponse.json({ error: 'At least one wallet is required.' }, { status: 400 })
  if (wallets.length > 20) return NextResponse.json({ error: 'Maximum 20 wallets per submission.' }, { status: 400 })

  for (const w of wallets) {
    if (!VALID_CHAINS.includes(w.chain)) return NextResponse.json({ error: `Invalid chain: ${w.chain}` }, { status: 400 })
    if (!w.address || w.address.length < 20) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 })
  }

  const submission = await prisma.transparencySubmission.create({
    data: {
      submittedHandle: handle.trim().replace(/^@/, ''),
      projectName: handle.trim(),
      platform: platform ?? 'X',
      submitterContact: contact?.trim() || null,
      notes: notes?.trim() || null,
      status: 'submitted',
      reviewStatus: 'pending',
      publicVisibility: 'internal_only',
      wallets: {
        create: wallets.map(w => ({
          chain: w.chain,
          address: w.address.trim(),
          label: w.label?.trim() || null,
          ownershipClaim: 'self_submitted',
          isPublic: false,
        })),
      },
    },
  })

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    message: 'Submission received. We will review within 5 business days.',
  })
}
