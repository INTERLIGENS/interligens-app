import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit"
import { prisma } from "@/lib/prisma"
import { buildKolCanonicalSnapshot } from "@/lib/kol/canonical"
import {
  PUBLISHABLE_WALLET_FILTER,
  selectPublishableWallets,
} from "@/lib/kol-memory/walletPublication"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.public)
  if (!rl.allowed) return rateLimitResponse(rl)
  const { handle } = await params
  const h = decodeURIComponent(handle).trim().toLowerCase().replace(/^@/, "")
  try {
    const snapshot = await buildKolCanonicalSnapshot(h)
    if (!snapshot) return NextResponse.json({ found: false }, { status: 404 })

    // Enforce publish gate (equivalent to PUBLIC_KOL_FILTER)
    const isPublic =
      snapshot.publishStatus !== "restricted" &&
      (snapshot.publishStatus === "published" ||
        (snapshot.publishable && snapshot.publishStatus === "draft"))
    if (!isPublic) return NextResponse.json({ found: false }, { status: 404 })

    // Fetch full relations for backward compat — evidences/wallets/cases
    //
    // ── BUILD 8 / P1 — les wallets passent par le gate de publiabilité ──────
    //
    // Cette lecture servait `kolWallets: true`, SANS aucun `where`. Mesuré sur
    // ep-square-band le 2026-09-07, sur les seuls profils publiés : 229 wallets
    // servis, dont 65 en `isPubliclyUsable = false`, touchant 21 des 32 profils.
    //
    // `isPubliclyUsable` est écrit par 5 seeders — qui posent délibérément
    // `false` sur tout ce qui n'est pas validé — et n'était lu que par un
    // compteur dans explorerItems.ts. Le drapeau portait la bonne décision et
    // rien ne s'en servait.
    //
    // Le filtre est fail-closed : une colonne non sélectionnée ne publie pas.
    // Voir src/lib/kol-memory/walletPublication.ts.
    const relations = await prisma.kolProfile.findFirst({
      where: { handle: { equals: h, mode: "insensitive" } },
      select: {
        handle: true,
        evidences: true,
        kolCases: true,
        kolWallets: { where: PUBLISHABLE_WALLET_FILTER },
      },
    })

    return NextResponse.json({
      found: true,
      kol: {
        ...snapshot,
        // `selectPublishableWallets` refiltre en mémoire — le WHERE Prisma et
        // le prédicat disent la même chose, et le second attrape le cas où une
        // requête future oublierait le premier. Il attache aussi la nature de
        // chaque ligne, `UNCLASSIFIED` compris et assumé.
        wallets: selectPublishableWallets(relations?.kolWallets ?? []),
        caseLinks: relations?.kolCases ?? [],
        evidences: relations?.evidences ?? [],
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
