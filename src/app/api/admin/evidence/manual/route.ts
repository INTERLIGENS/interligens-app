/**
 * src/app/api/admin/evidence/manual/route.ts
 *
 * Fallback si X bloque la capture automatique.
 * Accepte texte collé + screenshot optionnel.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { captureManual } from "@/lib/surveillance/evidencePack";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const formData = await req.formData();
  const handle     = formData.get("handle") as string;
  const postUrl    = formData.get("postUrl") as string;
  const pastedText = formData.get("text") as string;
  const screenshot = formData.get("screenshot") as File | null;

  if (!handle || !postUrl || !pastedText) {
    return NextResponse.json(
      { error: "handle, postUrl and text are required" },
      { status: 400 }
    );
  }

  const influencer = await prisma.influencer.upsert({
    where: { handle },
    create: { handle, platform: "x" },
    update: {},
  });

  const screenshotBuffer = screenshot
    ? Buffer.from(await screenshot.arrayBuffer())
    : undefined;

  const result = await captureManual(
    postUrl, handle, influencer.id, pastedText, screenshotBuffer
  );

  return NextResponse.json(result, { status: 200 });
}
