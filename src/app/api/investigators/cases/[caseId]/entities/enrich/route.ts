import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
        for (const e of entities) {
          if (e.type !== "WALLET" && e.type !== "CONTRACT") continue;
          const hit = matchSet.get(e.value.toLowerCase());
          if (hit) {
            result[e.id].isKnownBad = true;
            result[e.id].inIntelVault = true;
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
            publishable: true,
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
            if (hit.publishable) {
              result[e.id].inIntelVault = true;
            }
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
