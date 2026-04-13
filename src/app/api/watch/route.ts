import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  validateSession,
} from "@/lib/security/investigatorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChainKey = "solana" | "ethereum" | "base" | "arbitrum";

const VALID_CHAINS: ChainKey[] = ["solana", "ethereum", "base", "arbitrum"];

function isSolAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function isEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function validAddressForChain(addr: string, chain: ChainKey): boolean {
  if (chain === "solana") return isSolAddress(addr);
  return isEvmAddress(addr);
}

async function requireAccessId(
  req: NextRequest
): Promise<
  | { ok: true; accessId: string; label: string }
  | { ok: false; response: NextResponse }
> {
  const token = getSessionTokenFromReq(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const session = await validateSession(token);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, accessId: session.accessId, label: session.label };
}

// ── GET /api/watch ─────────────────────────────────────────────────────────
// Returns the caller's active watched addresses with their latest score,
// tier, governed status, last scan time, and unread alert count.
export async function GET(req: NextRequest) {
  const auth = await requireAccessId(req);
  if (!auth.ok) return auth.response;

  try {
    const rows = await prisma.watchedAddress.findMany({
      where: { ownerAccessId: auth.accessId, active: true },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        alerts: {
          where: { notifiedAt: null },
          select: { id: true },
        },
      },
    });

    return NextResponse.json({
      watches: rows.map((r) => ({
        id: r.id,
        address: r.address,
        chain: r.chain,
        label: r.label,
        lastScore: r.lastScore,
        lastTier: r.lastTier,
        lastGovernedStatus: r.lastGovernedStatus,
        lastScannedAt: r.lastScannedAt,
        alertCount: r.alerts.length,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("[watch GET] failed", err);
    return NextResponse.json({ watches: [] });
  }
}

// ── POST /api/watch ────────────────────────────────────────────────────────
// Body: { address, chain, label? }
// Creates or reactivates a watched address row for the caller. Does NOT
// trigger an immediate scan — that happens on the next cron tick or when
// the user clicks "Scan now" from the /watchlist page. (See decision #3.)
export async function POST(req: NextRequest) {
  const auth = await requireAccessId(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const address =
    typeof body.address === "string" ? body.address.trim() : "";
  const chainRaw =
    typeof body.chain === "string" ? body.chain.toLowerCase().trim() : "";
  const label =
    typeof body.label === "string"
      ? body.label.slice(0, 80).trim() || null
      : null;

  if (!address || !chainRaw) {
    return NextResponse.json({ error: "address_and_chain_required" }, { status: 400 });
  }
  if (!VALID_CHAINS.includes(chainRaw as ChainKey)) {
    return NextResponse.json({ error: "invalid_chain" }, { status: 400 });
  }
  const chain = chainRaw as ChainKey;

  if (!validAddressForChain(address, chain)) {
    return NextResponse.json(
      { error: "invalid_address_for_chain" },
      { status: 400 }
    );
  }

  // Normalize: EVM addresses lowercase, Solana preserve case.
  const normalized = chain === "solana" ? address : address.toLowerCase();

  try {
    const existing = await prisma.watchedAddress.findUnique({
      where: {
        address_chain_ownerAccessId: {
          address: normalized,
          chain,
          ownerAccessId: auth.accessId,
        },
      },
    });

    let row;
    if (existing) {
      row = await prisma.watchedAddress.update({
        where: { id: existing.id },
        data: { active: true, label: label ?? existing.label },
      });
    } else {
      row = await prisma.watchedAddress.create({
        data: {
          address: normalized,
          chain,
          ownerAccessId: auth.accessId,
          label,
        },
      });
    }

    return NextResponse.json({
      success: true,
      watchId: row.id,
      currentScore: row.lastScore ?? null,
      currentTier: row.lastTier ?? null,
    });
  } catch (err) {
    console.error("[watch POST] failed", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
