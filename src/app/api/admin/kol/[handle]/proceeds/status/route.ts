// Route admin — publication de données forensiques (Observed Proceeds).
// `src/proxy.ts` garde déjà /api/admin/* (cookie de session ou Basic auth),
// mais cette route refait sa propre vérification Basic. C'est une bonne chose ;
// encore faut-il qu'elle soit fail-closed.
//
// LE DÉFAUT CORRIGÉ
// Le secret attendu était construit ainsi :
//
//     const expectedUser = process.env.ADMIN_BASIC_USER ?? "";
//     const expectedPass = process.env.ADMIN_BASIC_PASS ?? "";
//     const expected = "Basic " + base64(`${expectedUser}:${expectedPass}`);
//
// Les deux variables absentes, `expected` vaut `"Basic Og=="` — le base64 de
// `":"`. Un appelant qui envoie exactement cet en-tête passe. Le repli `?? ""`
// ne protège rien : il fabrique un secret devinable. Quatrième apparition de
// cette famille de bug dans ce repo.
//
// Non exploitable aujourd'hui (proxy.ts garde la route et les deux variables
// sont posées en Production), mais une route qui publie des données
// forensiques ne doit pas dépendre d'une configuration extérieure pour être
// fermée. Absence ou vacuité d'une des deux variables ⇒ 500, jamais un
// laissez-passer. Comparaison en temps constant, alignée sur les autres gates
// du repo.
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { timingSafeEqual } from "crypto";

const prisma = new PrismaClient();

type AuthOutcome = { ok: true } | { ok: false; response: NextResponse };

function requireAdminBasic(req: NextRequest): AuthOutcome {
  const user = process.env.ADMIN_BASIC_USER;
  const pass = process.env.ADMIN_BASIC_PASS;

  // FAIL-CLOSED. `!user` couvre l'absence ET la chaîne vide : une variable
  // posée à "" ne doit pas devenir la moitié d'un secret valide.
  if (!user || !pass) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server misconfigured: admin basic credentials not set" },
        { status: 500 },
      ),
    };
  }

  const provided = req.headers.get("authorization") ?? "";
  const expected = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Comparaison factice de même coût, pour ne pas révéler la longueur.
    timingSafeEqual(a, Buffer.alloc(a.length));
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!timingSafeEqual(a, b)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:    ["reviewed"],
  reviewed: ["published", "draft"],
  published:["draft"],
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const auth = requireAdminBasic(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { status, reviewNote } = body;

  if (!["draft", "reviewed", "published"].includes(status)) {
    return NextResponse.json({ error: "Invalid status. Must be draft | reviewed | published" }, { status: 400 });
  }

  const existing = await prisma.$queryRaw`
    SELECT "reviewStatus" FROM "KolProceedsSummary" WHERE "kolHandle" = ${handle} LIMIT 1
  ` as any[];

  if (!existing.length) {
    return NextResponse.json({ error: "No proceeds summary found for this handle" }, { status: 404 });
  }

  const current = existing[0].reviewStatus;
  const allowed = VALID_TRANSITIONS[current] ?? [];

  if (!allowed.includes(status)) {
    return NextResponse.json({
      error: `Invalid transition: ${current} → ${status}. Allowed: ${allowed.join(", ") || "none"}`,
    }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(`
    UPDATE "KolProceedsSummary"
    SET "reviewStatus" = $1, "reviewNote" = $2, "updatedAt" = now()
    WHERE "kolHandle" = $3
  `, status, reviewNote ?? null, handle);

  return NextResponse.json({
    success: true,
    handle,
    previousStatus: current,
    newStatus: status,
    reviewNote: reviewNote ?? null,
    updatedAt: new Date().toISOString(),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const auth = requireAdminBasic(req);
  if (!auth.ok) return auth.response;

  const rows = await prisma.$queryRaw`
    SELECT
      "kolHandle", "reviewStatus", "reviewNote", "computedAt", "updatedAt",
      "totalProceedsUsd", "eventCount", "walletCount", "confidence",
      "methodologyVersion", "coverageStatus", "coverageNote", "pricingQuality"
    FROM "KolProceedsSummary"
    WHERE "kolHandle" = ${handle}
    LIMIT 1
  ` as any[];

  const pricingStats = await prisma.$queryRaw`
    SELECT
      "pricingSource",
      COUNT(*) as count
    FROM "KolProceedsEvent"
    WHERE "kolHandle" = ${handle}
    GROUP BY "pricingSource"
  ` as any[];

  if (!rows.length) {
    return NextResponse.json({ found: false, handle });
  }

  const s = rows[0];
  const staleDays = s.computedAt
    ? Math.floor((Date.now() - new Date(s.computedAt).getTime()) / 86400000)
    : null;

  return NextResponse.json({
    found: true,
    handle,
    reviewStatus: s.reviewStatus,
    reviewNote: s.reviewNote,
    computedAt: s.computedAt,
    updatedAt: s.updatedAt,
    staleDays,
    stale: staleDays !== null && staleDays > 7,
    totalProceedsUsd: s.totalProceedsUsd,
    eventCount: Number(s.eventCount),
    walletCount: Number(s.walletCount),
    confidence: s.confidence,
    methodologyVersion: s.methodologyVersion,
    coverageStatus: s.coverageStatus,
    coverageNote: s.coverageNote,
    pricingQuality: s.pricingQuality,
    pricingSourceBreakdown: pricingStats.map((r: any) => ({
      source: r.pricingSource,
      count: Number(r.count),
    })),
    allowedTransitions: VALID_TRANSITIONS[s.reviewStatus] ?? [],
  });
}
