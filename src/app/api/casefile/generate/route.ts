// src/app/api/casefile/generate/route.ts
//
// POST /api/casefile/generate
//   Body: { source: "vine" | "botify" | "custom", data?: CaseFileInput, uploadToR2?: boolean }
//   Returns: PDF binary (application/pdf) or JSON with R2 key
//
// Admin-only route. For the retail-safe GET equivalent see
// src/app/api/casefile/pdf/route.ts.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import {
  generateCaseFilePdf,
  type CaseFileInput,
} from "@/lib/casefile/pdfGenerator";
import { buildBotifyInput, buildVineInput } from "@/lib/casefile/presets";
import { loadCanonicalCaseFile } from "@/lib/casefile/canonicalReader";
import {
  BOTIFY_CASEFILE_REF,
  VINE_CASEFILE_REF,
  CanonicalCaseFileMissingError,
} from "@/lib/casefile/publicProjection";

// ─── BUILD 9 / ÉTAPE 7 — OPTION A : les claims viennent de l'autorité ──────
//
// `source=botify|vine` construisait TOUT depuis `presets.ts`, claims compris.
// Les claims viennent désormais du dossier canonique ; le preset ne fournit
// plus que les sections qu'aucune structure canonique ne porte — chronologie
// et réquisitions, que la DDL du bloc 3 a refusé de créer faute de faits
// démontrés. Le rapport le NOMME sur sa page.
//
// `body.data` reste accepté : c'est une génération à la demande sur des
// données fournies par l'appelant, pas une lecture de dossier. Elle ne reçoit
// donc aucun bloc canonique — et le rapport annonce alors ses claims comme
// HORS autorité canonique, ce qui est exact.
const CANONICAL_REF_BY_SOURCE: Record<string, string> = {
  botify: BOTIFY_CASEFILE_REF,
  vine: VINE_CASEFILE_REF,
};

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { source?: string; data?: CaseFileInput; uploadToR2?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ─── BUILD 13 · S3 — CE QUI NOMMERA L'ARTEFACT ───────────────────────────
  //
  // ██  Le nom survit au document. Il est ce qui reste quand le PDF a été  ██
  // ██  transmis, renommé nulle part, classé dans un dossier partagé.      ██
  //
  // La route chargeait le dossier gouverné (plus bas), en posait le `ref` dans
  // le document — et nommait ensuite le fichier depuis `case_meta.case_id`,
  // c'est-à-dire depuis le PRESET. Elle DISPOSAIT de l'identité fondée au
  // moment où elle nommait, et nommait avec l'autre : deux artefacts du même
  // dossier, l'un nommé par la frontière et l'autre par le vestige.
  //
  // `null` tant qu'aucun dossier n'est chargé. La branche `body.data` n'en
  // charge aucun, et c'est exact : elle ne produit pas un artefact CaseFile
  // gouverné, donc elle ne porte aucune identité de citation à dériver.
  let refGouverne: string | null = null;

  let input: CaseFileInput;
  if (body.source === "vine" || body.source === "botify") {
    const ref = CANONICAL_REF_BY_SOURCE[body.source];
    const dossier = await loadCanonicalCaseFile(ref);
    // Aucun repli vers le preset : si l'autorité ne porte pas le dossier, on
    // le dit. Un preset qui prend le relais en silence est ce que l'étape 7
    // ferme.
    if (!dossier) {
      const err = new CanonicalCaseFileMissingError(ref, "api/casefile/generate");
      console.error(err.message);
      return NextResponse.json({ error: "canonical_casefile_missing" }, { status: 500 });
    }
    refGouverne = dossier.ref;
    input = {
      ...(body.source === "vine" ? buildVineInput() : buildBotifyInput()),
      canonical: { ref: dossier.ref, claims: dossier.claims },
    };
  } else if (body.data) {
    input = body.data;
  } else {
    return NextResponse.json(
      { error: "Provide source='vine'|'botify' or a custom data object" },
      { status: 400 }
    );
  }

  const result = await generateCaseFilePdf(input, {
    uploadToR2: body.uploadToR2 ?? false,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (body.uploadToR2 && result.r2Key) {
    return NextResponse.json({
      success: true,
      r2Key: result.r2Key,
      sizeBytes: result.pdfBytes?.length,
    });
  }

  // Le nom DÉRIVE du ref chargé — il ne coïncide pas avec lui. Un littéral en
  // dur satisferait l'apparence sans rien dériver, et c'est exactement la
  // coïncidence que S2 a démontée : le `ref` du dossier change, le nom suit.
  //
  // Sans dossier gouverné, le nom ne prétend à AUCUNE identité de citation. Il
  // reprend le vocabulaire déjà posé sur le document lui-même par b051d55 —
  // « Ungoverned Artifact » — plutôt que d'inventer une étiquette de plus.
  const nomFichier = refGouverne ? `${refGouverne}.pdf` : "casefile-ungoverned.pdf";

  return new NextResponse(result.pdfBytes ? Buffer.from(result.pdfBytes) : null, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "no-cache",
    },
  });
}
