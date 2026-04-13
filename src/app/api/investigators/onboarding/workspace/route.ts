import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultVisibility } from "@prisma/client";
import { getVaultAccess, logAudit } from "@/lib/vault/auth.server";

export async function POST(request: NextRequest) {
  const ctx = await getVaultAccess(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (ctx.profile) {
    return NextResponse.json(
      { error: "profile_exists", handle: ctx.profile.handle },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    handle,
    kdfSalt,
    displayName,
    bio,
    specialties,
    visibility,
  } = body as {
    handle?: string;
    kdfSalt?: string;
    displayName?: string;
    bio?: string;
    specialties?: string[];
    visibility?: string;
  };

  if (!handle || !/^[a-z0-9-]{2,30}$/.test(handle)) {
    return NextResponse.json({ error: "bad_handle" }, { status: 400 });
  }
  if (!kdfSalt || !/^[a-f0-9]{32}$/.test(kdfSalt)) {
    return NextResponse.json({ error: "bad_salt" }, { status: 400 });
  }

  // NDA must be present
  const nda = await prisma.vaultNdaAcceptance.findUnique({
    where: { investigatorAccessId: ctx.access.id },
  });
  if (!nda) {
    return NextResponse.json({ error: "nda_required" }, { status: 400 });
  }

  const handleTaken = await prisma.vaultProfile.findUnique({
    where: { handle },
    select: { id: true },
  });
  if (handleTaken) {
    return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }

  let visibilityEnum: VaultVisibility = VaultVisibility.PRIVATE;
  if (visibility === "SEMI_PUBLIC") visibilityEnum = VaultVisibility.SEMI_PUBLIC;
  else if (visibility === "PUBLIC") visibilityEnum = VaultVisibility.PUBLIC;

  const profile = await prisma.vaultProfile.create({
    data: {
      investigatorAccessId: ctx.access.id,
      handle,
      displayName: displayName?.slice(0, 80) ?? null,
      bio: bio?.slice(0, 1000) ?? null,
      specialties: Array.isArray(specialties)
        ? specialties.slice(0, 20).map((s) => String(s).slice(0, 40))
        : [],
      languages: [],
      coverageZones: [],
      badges: [],
      visibility: visibilityEnum,
    },
  });

  const workspace = await prisma.vaultWorkspace.create({
    data: {
      profileId: profile.id,
      kdfSalt,
      kdfAlgo: "PBKDF2-SHA256",
      kdfIterations: 310000,
      encMode: "CLIENT_SIDE_AES256GCM",
    },
  });

  // Link the NDA record we created in the previous step
  await prisma.vaultNdaAcceptance.updateMany({
    where: { investigatorAccessId: ctx.access.id, profileId: null },
    data: { profileId: profile.id },
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: profile.id,
    workspaceId: workspace.id,
    action: "WORKSPACE_CREATED",
    actor: ctx.access.label,
    request,
    metadata: { handle },
  });

  return NextResponse.json({ workspaceId: workspace.id, handle });
}
