import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultVisibility } from "@prisma/client";
import { getVaultAccess, logAudit } from "@/lib/vault/auth.server";

export async function GET(request: NextRequest) {
  const ctx = await getVaultAccess(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.profile) return NextResponse.json({ profile: null });
  const p = ctx.profile;
  return NextResponse.json({
    profile: {
      id: p.id,
      handle: p.handle,
      displayName: p.displayName,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      languages: p.languages,
      specialties: p.specialties,
      coverageZones: p.coverageZones,
      websiteUrl: p.websiteUrl,
      twitterHandle: p.twitterHandle,
      telegramHandle: p.telegramHandle,
      contactEmail: p.contactEmail,
      visibility: p.visibility,
      isFeatured: p.isFeatured,
      isVerified: p.isVerified,
      badges: p.badges,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getVaultAccess(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  const {
    displayName,
    bio,
    specialties,
    languages,
    coverageZones,
    websiteUrl,
    twitterHandle,
    telegramHandle,
    contactEmail,
    visibility,
  } = body as Record<string, unknown>;

  if (typeof displayName === "string") data.displayName = displayName.slice(0, 80);
  if (typeof bio === "string") data.bio = bio.slice(0, 1000);
  if (Array.isArray(specialties)) data.specialties = specialties.slice(0, 20).map((s) => String(s).slice(0, 40));
  if (Array.isArray(languages)) data.languages = languages.slice(0, 10).map((s) => String(s).slice(0, 20));
  if (Array.isArray(coverageZones)) data.coverageZones = coverageZones.slice(0, 20).map((s) => String(s).slice(0, 40));
  if (typeof websiteUrl === "string") data.websiteUrl = websiteUrl.slice(0, 200);
  if (typeof twitterHandle === "string") data.twitterHandle = twitterHandle.slice(0, 50);
  if (typeof telegramHandle === "string") data.telegramHandle = telegramHandle.slice(0, 50);
  if (typeof contactEmail === "string") data.contactEmail = contactEmail.slice(0, 200);
  if (visibility === "PRIVATE" || visibility === "SEMI_PUBLIC" || visibility === "PUBLIC") {
    data.visibility = visibility as VaultVisibility;
  }

  const updated = await prisma.vaultProfile.update({
    where: { id: ctx.profile.id },
    data,
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: null,
    action: "PROFILE_UPDATED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json({
    profile: {
      id: updated.id,
      handle: updated.handle,
      displayName: updated.displayName,
      bio: updated.bio,
      specialties: updated.specialties,
      visibility: updated.visibility,
    },
  });
}
