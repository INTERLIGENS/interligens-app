import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isKolPublic } from "@/lib/kol/publishGate";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

type EntityEnrichment = {
  inWatchlist: boolean;
  isKnownBad: boolean;
  knownBadScore: number | null;
  inKolRegistry: boolean;
  kolName: string | null;
  kolScore: number | null;
  inIntelVault: boolean;
  proceedsTotalUSD: number | null;
};

function emptyEnrichment(): EntityEnrichment {
  return {
    inWatchlist: false,
    isKnownBad: false,
    knownBadScore: null,
    inKolRegistry: false,
    kolName: null,
    kolScore: null,
    inIntelVault: false,
    proceedsTotalUSD: null,
  };
}

function normalizeHandle(value: string): string {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const result: Record<string, EntityEnrichment> = {};

  try {
    const entities = await prisma.vaultCaseEntity.findMany({
      where: { caseId },
      select: { id: true, type: true, value: true },
      take: 2000,
    });

    for (const e of entities) {
      result[e.id] = emptyEnrichment();
    }

    const walletValues = entities
      .filter((e) => e.type === "WALLET" || e.type === "CONTRACT")
      .map((e) => e.value);

    const handleValues = entities
      .filter((e) => e.type === "HANDLE")
      .map((e) => e.value);

    // WALLET / CONTRACT — cross-check against KolWallet (known bad attribution).
    if (walletValues.length > 0) {
      try {
        const lowered = walletValues.map((v) => v.toLowerCase());
        const matches = await prisma.kolWallet.findMany({
          where: {
            OR: [
              { address: { in: walletValues } },
              { address: { in: lowered } },
            ],
          },
          select: { address: true, kolHandle: true },
        });
        const matchSet = new Map<string, string>();
        for (const m of matches) {
          matchSet.set(m.address.toLowerCase(), m.kolHandle);
        }

        // Fetch proceeds data for matched KOL handles.
        // Prefer KolProceedsSummary.totalProceedsUsd (authoritative) over
        // KolProfile.totalDocumented (may be stale).
        const matchedKolHandles = Array.from(new Set(matches.map((m) => m.kolHandle)));
        const kolProceedsByHandle = new Map<string, number>();
        const kolFlagsByHandle = new Map<
          string,
          { rugCount: number; riskFlag: string }
        >();
        if (matchedKolHandles.length > 0) {
          const profiles = await prisma.kolProfile.findMany({
            where: { handle: { in: matchedKolHandles, mode: "insensitive" } },
            select: {
              handle: true,
              totalDocumented: true,
              totalScammed: true,
              rugCount: true,
              riskFlag: true,
            },
          });
          for (const p of profiles) {
            const usd = p.totalDocumented ?? p.totalScammed ?? 0;
            if (usd > 0) kolProceedsByHandle.set(p.handle.toLowerCase(), usd);
            kolFlagsByHandle.set(p.handle.toLowerCase(), {
              rugCount: p.rugCount ?? 0,
              riskFlag: p.riskFlag ?? "unverified",
            });
          }

          // Override with KolProceedsSummary where available.
          try {
            const summaries = await prisma.$queryRaw<
              Array<{ kolHandle: string; totalProceedsUsd: number | null }>
            >`
              SELECT "kolHandle", "totalProceedsUsd"
              FROM "KolProceedsSummary"
              WHERE "kolHandle" = ANY(${matchedKolHandles})
            `;
            for (const s of summaries) {
              if (s.totalProceedsUsd && s.totalProceedsUsd > 0) {
                kolProceedsByHandle.set(
                  s.kolHandle.toLowerCase(),
                  s.totalProceedsUsd
                );
              }
            }
          } catch (err) {
            console.error("[enrich] proceeds summary lookup failed", err);
          }
        }

        for (const e of entities) {
          if (e.type !== "WALLET" && e.type !== "CONTRACT") continue;
          const hit = matchSet.get(e.value.toLowerCase());
          if (hit) {
            result[e.id].isKnownBad = true;
            result[e.id].inIntelVault = true;
            const flags = kolFlagsByHandle.get(hit.toLowerCase());
            if (
              flags &&
              (flags.rugCount > 0 || flags.riskFlag !== "unverified")
            ) {
              result[e.id].inWatchlist = true;
            }
            const proceeds = kolProceedsByHandle.get(hit.toLowerCase());
            if (proceeds) result[e.id].proceedsTotalUSD = proceeds;
          }
        }
      } catch (err) {
        console.error("[enrich] kol wallet lookup failed", err);
      }
    }

    // HANDLE — cross-check against KolProfile.handle (case-insensitive).
    if (handleValues.length > 0) {
      try {
        const normalized = Array.from(
          new Set(handleValues.map(normalizeHandle))
        );
        const matches = await prisma.kolProfile.findMany({
          where: {
            handle: { in: normalized, mode: "insensitive" },
          },
          select: {
            handle: true,
            displayName: true,
            rugCount: true,
            totalDocumented: true,
            totalScammed: true,
            riskFlag: true,
            publishable: true,
            publishStatus: true,
          },
        });
        const byHandle = new Map<string, (typeof matches)[number]>();
        for (const m of matches) {
          byHandle.set(m.handle.toLowerCase(), m);
        }
        for (const e of entities) {
          if (e.type !== "HANDLE") continue;
          const hit = byHandle.get(normalizeHandle(e.value));
          if (hit) {
            result[e.id].inKolRegistry = true;
            result[e.id].kolName = hit.displayName ?? hit.handle;
            result[e.id].kolScore =
              typeof hit.rugCount === "number" ? hit.rugCount : null;
            if (isKolPublic(hit)) {
              result[e.id].inIntelVault = true;
            }
            // Watchlist proxy — WatchScan has no address column, so we
            // approximate "on our watchlist" as: rugCount > 0 OR risk flagged.
            if (
              (hit.rugCount ?? 0) > 0 ||
              (hit.riskFlag && hit.riskFlag !== "unverified")
            ) {
              result[e.id].inWatchlist = true;
            }
            const proceeds = hit.totalDocumented ?? hit.totalScammed ?? 0;
            if (proceeds > 0) result[e.id].proceedsTotalUSD = proceeds;
          }
        }
      } catch (err) {
        console.error("[enrich] kol profile lookup failed", err);
      }
    }

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "ENTITIES_ENRICHED",
      actor: ctx.access.label,
      request,
      metadata: { count: entities.length },
    });
  } catch (err) {
    console.error("[enrich] top-level failure", err);
    return NextResponse.json({ enrichment: {} });
  }

  return NextResponse.json({ enrichment: result });
}
