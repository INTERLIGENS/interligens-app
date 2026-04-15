// src/app/api/kol/[handle]/pedigree/route.ts
// BOTIFY full KOL pedigree — returns botifyDeal + wallets + cashoutLog + laundry trail
// Auth: ADMIN_TOKEN Bearer only.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function isAuthorized(req: NextRequest): boolean {
  if (!ADMIN_TOKEN) return false;
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1] ?? req.headers.get('x-admin-token') ?? '';
  if (!token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(ADMIN_TOKEN);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type Json = Record<string, unknown> | null;
type CashoutEntry = { date?: string; amount?: number; unit?: string; tx?: string; note?: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { handle } = await params;

  const profile = await prisma.kolProfile.findUnique({
    where: { handle },
    select: {
      handle: true,
      displayName: true,
      label: true,
      publishStatus: true,
      botifyDeal: true,
      kolWallets: {
        select: {
          address: true,
          chain: true,
          label: true,
          attributionSource: true,
          attributionStatus: true,
          attributionNote: true,
          confidence: true,
          claimType: true,
          status: true,
        },
      },
      laundryTrails: {
        select: {
          id: true,
          walletAddress: true,
          chain: true,
          trailType: true,
          laundryRisk: true,
          recoveryDifficulty: true,
          trailBreakHop: true,
          fundsUnresolved: true,
          narrativeText: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'not_found', handle }, { status: 404 });
  }

  const deal = (profile.botifyDeal as Json) ?? null;
  const cashoutLog: CashoutEntry[] =
    deal && Array.isArray((deal as Record<string, unknown>).cashoutLog)
      ? ((deal as Record<string, unknown>).cashoutLog as CashoutEntry[])
      : [];

  let totalCashoutSOL = 0;
  let totalCashoutUSD = 0;
  for (const e of cashoutLog) {
    if (typeof e.amount !== 'number') continue;
    if (e.unit === 'SOL') totalCashoutSOL += e.amount;
    else if (e.unit === 'USDT' || e.unit === 'USD' || e.unit === 'USDC') totalCashoutUSD += e.amount;
  }

  return NextResponse.json({
    handle: profile.handle,
    displayName: profile.displayName,
    label: profile.label,
    publishStatus: profile.publishStatus,
    botifyDeal: deal,
    wallets: profile.kolWallets,
    cashoutLog,
    totalCashoutSOL,
    totalCashoutUSD,
    laundryTrails: profile.laundryTrails,
    source: 'botify_leak_doc_confirmed',
  });
}
