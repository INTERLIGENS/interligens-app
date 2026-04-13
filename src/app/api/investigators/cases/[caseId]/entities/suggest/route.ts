import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultEntityType } from "@prisma/client";
import {
  getVaultWorkspace,
  assertCaseOwnership,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

type Suggestion = {
  type: VaultEntityType;
  value: string;
  label: string | null;
  source: string;
  confidence: number;
};

function normalizeHandle(v: string): string {
  return v.replace(/^@+/, "").trim().toLowerCase();
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const type = body.type as VaultEntityType | undefined;
  const value =
    typeof body.value === "string" ? body.value.trim() : "";
  if (!type || !value) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();
  function pushSuggestion(s: Suggestion) {
    const key = `${s.type}|${s.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(s);
  }

  try {
    if (type === "WALLET" || type === "CONTRACT") {
      // Find KolWallet row by address (case-insensitive)
      const wallets = await prisma.kolWallet.findMany({
        where: {
          OR: [
            { address: value },
            { address: value.toLowerCase() },
          ],
        },
        take: 5,
      });

      const handles = Array.from(new Set(wallets.map((w) => w.kolHandle)));
      if (handles.length > 0) {
        const profiles = await prisma.kolProfile.findMany({
          where: { handle: { in: handles, mode: "insensitive" } },
          select: { handle: true, displayName: true },
        });
        for (const p of profiles) {
          pushSuggestion({
            type: "HANDLE",
            value: p.handle,
            label: p.displayName ?? null,
            source: "KOL Registry",
            confidence: 0.95,
          });
        }
      }

      // Other cases in same workspace referencing the same wallet
      const others = await prisma.vaultCaseEntity.findMany({
        where: {
          value: { equals: value, mode: "insensitive" },
          caseId: { not: caseId },
          case: { workspaceId: ctx.workspace.id },
        },
        select: { type: true, value: true, label: true },
        take: 10,
      });
      for (const o of others) {
        pushSuggestion({
          type: o.type,
          value: o.value,
          label: o.label,
          source: "Your other cases",
          confidence: 0.85,
        });
      }
    } else if (type === "HANDLE") {
      const normalized = normalizeHandle(value);
      const profile = await prisma.kolProfile.findFirst({
        where: { handle: { equals: normalized, mode: "insensitive" } },
        select: { handle: true, displayName: true },
      });

      if (profile) {
        const wallets = await prisma.kolWallet.findMany({
          where: { kolHandle: { equals: profile.handle, mode: "insensitive" } },
          take: 20,
          select: { address: true, chain: true, label: true },
        });
        for (const w of wallets) {
          pushSuggestion({
            type: "WALLET",
            value: w.address,
            label: w.label ?? `${profile.displayName ?? profile.handle} (${w.chain})`,
            source: "KOL Registry",
            confidence: 0.9,
          });
        }
      }

      const others = await prisma.vaultCaseEntity.findMany({
        where: {
          type: "HANDLE",
          value: { equals: value, mode: "insensitive" },
          caseId: { not: caseId },
          case: { workspaceId: ctx.workspace.id },
        },
        select: { type: true, value: true, label: true },
        take: 5,
      });
      for (const o of others) {
        pushSuggestion({
          type: o.type,
          value: o.value,
          label: o.label,
          source: "Your other cases",
          confidence: 0.85,
        });
      }
    }
  } catch (err) {
    console.error("[entities/suggest] failed", err);
    return NextResponse.json({ suggestions: [] });
  }

  // Filter out entities that already exist in this case
  if (suggestions.length > 0) {
    const existing = await prisma.vaultCaseEntity.findMany({
      where: { caseId },
      select: { type: true, value: true },
    });
    const existingKeys = new Set(
      existing.map((e) => `${e.type}|${e.value.toLowerCase()}`)
    );
    const filtered = suggestions.filter(
      (s) => !existingKeys.has(`${s.type}|${s.value.toLowerCase()}`)
    );
    return NextResponse.json({ suggestions: filtered });
  }

  return NextResponse.json({ suggestions });
}
