import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Map of settings the caller is allowed to read/write. Anything outside this
// list is ignored on PATCH (defence against sending arbitrary columns).
const MODE_KEYS = [
  "autoKolRegistryMode",
  "autoIntelVaultMode",
  "autoObservedProceedsMode",
  "autoLaundryTrailMode",
  "autoWalletJourneyMode",
  "autoCaseCorrelationMode",
  "autoMarketMakerMode",
  "autoNextStepsMode",
] as const;
const LEVELS = ["FULL_ASSIST", "BALANCED", "MANUAL_FIRST"] as const;
const MODES = ["ON", "QUIET", "OFF"] as const;

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const row = await prisma.vaultWorkspace.findUnique({
      where: { id: ctx.workspace.id },
      select: {
        assistanceLevel: true,
        autoKolRegistryMode: true,
        autoIntelVaultMode: true,
        autoObservedProceedsMode: true,
        autoLaundryTrailMode: true,
        autoWalletJourneyMode: true,
        autoCaseCorrelationMode: true,
        autoMarketMakerMode: true,
        autoNextStepsMode: true,
      },
    });
    return NextResponse.json({ settings: row ?? {} });
  } catch (err) {
    // Pre-migration: columns don't exist → respond with defaults so the UI
    // still renders and the PATCH path can seed values after migration.
    console.warn("[workspace/settings] GET failed (pre-migration?)", err);
    return NextResponse.json({
      settings: {
        assistanceLevel: "BALANCED",
        autoKolRegistryMode: "ON",
        autoIntelVaultMode: "ON",
        autoObservedProceedsMode: "ON",
        autoLaundryTrailMode: "QUIET",
        autoWalletJourneyMode: "ON",
        autoCaseCorrelationMode: "QUIET",
        autoMarketMakerMode: "QUIET",
        autoNextStepsMode: "ON",
      },
      preMigration: true,
    });
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, string> = {};

  if (typeof body.assistanceLevel === "string" && (LEVELS as readonly string[]).includes(body.assistanceLevel)) {
    data.assistanceLevel = body.assistanceLevel;
  }
  for (const key of MODE_KEYS) {
    const v = body[key];
    if (typeof v === "string" && (MODES as readonly string[]).includes(v)) {
      data[key] = v;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  try {
    const row = await prisma.vaultWorkspace.update({
      where: { id: ctx.workspace.id },
      data,
      select: {
        assistanceLevel: true,
        autoKolRegistryMode: true,
        autoIntelVaultMode: true,
        autoObservedProceedsMode: true,
        autoLaundryTrailMode: true,
        autoWalletJourneyMode: true,
        autoCaseCorrelationMode: true,
        autoMarketMakerMode: true,
        autoNextStepsMode: true,
      },
    });
    return NextResponse.json({ settings: row });
  } catch (err) {
    console.error("[workspace/settings] PATCH failed", err);
    return NextResponse.json(
      { error: "update_failed" },
      { status: 503 }
    );
  }
}
