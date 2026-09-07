// src/app/api/casefile/pdf/route.ts
//
// GET /api/casefile/pdf?handle=<kolHandle>&template=<public|internal>&lang=<en|fr>
//
// Two-template PDF endpoint:
//   template=public   → public-safe, printable, 9-section diffamation-safe
//                       intelligence report (generateCaseFilePdfPublic).
//                       This is what the KOL page CaseFile button calls.
//   template=internal → full internal forensic report with smoking guns,
//                       requisitions and shiller roster (generateCaseFilePdf).
//
// Auth: ADMIN_TOKEN is always required (SEC P0 — the previous ?mock=1
// retail bypass has been removed).
//
// ── BUILD 9 / ÉTAPE 5 — les deux gabarits, une seule autorité de claims ─────
//
// Les CLAIMS des deux gabarits viennent de l'autorité canonique, et d'elle
// seule. Ce qui change entre les deux, c'est la PROJECTION :
//
//   public   → `loadPublicProjection` : ce qui est publiable, et la liste
//              nommée de ce qui est retenu. Un claim non promu n'y est pas.
//   internal → le dossier ENTIER, tous états confondus, chaque claim portant
//              son état et sa provenance. La surface interne doit voir ce que
//              la surface publique ne montre pas — c'est sa raison d'être.
//
// Les presets survivent, mais UNIQUEMENT pour ce qu'aucune structure
// canonique ne porte : chronologie et réquisitions, que la DDL du bloc 3 a
// explicitement refusé de créer faute de faits démontrés. Le rapport interne
// le DIT sur la page. Un preset qui prend le relais en silence est ce que
// l'étape 5 ferme ; un preset qui annonce son périmètre est une dette datée.
//
// Aucun repli : si l'autorité ne porte pas le dossier, la route échoue.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/security/auth";
import { generateCaseFilePdf } from "@/lib/casefile/pdfGenerator";
import {
  generateCaseFilePdfPublic,
  StaticSectionsMismatchError,
  type PublicReportLang,
} from "@/lib/casefile/pdfGeneratorPublic";
import { buildBotifyInput, buildVineInput } from "@/lib/casefile/presets";
import { loadCanonicalCaseFile } from "@/lib/casefile/canonicalReader";
import {
  canonicalRefForMint,
  loadPublicProjection,
  CanonicalCaseFileMissingError,
  BOTIFY_CASEFILE_REF,
  VINE_CASEFILE_REF,
} from "@/lib/casefile/publicProjection";
import { kolHandleToCanonicalMint } from "@/lib/kol-memory/tokenIdentity";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Template = "public" | "internal";

// Les sections SANS structure canonique (chronologie, réquisitions, wallets,
// shillers, smoking guns) viennent encore d'un preset. La carte est indexée
// sur la ref canonique — le dossier reste l'identifiant, le preset n'est plus
// qu'un fournisseur de sections nommées.
const PRESET_SECTIONS_BY_REF: Record<string, () => ReturnType<typeof buildBotifyInput>> = {
  [BOTIFY_CASEFILE_REF]: buildBotifyInput,
  [VINE_CASEFILE_REF]: buildVineInput,
};

function parseTemplate(raw: string | null): Template {
  if (raw === "internal") return "internal";
  return "public"; // default to public — it's the retail surface
}

function parseLang(raw: string | null): PublicReportLang {
  if (raw === "fr") return "fr";
  return "en";
}

/** `?preset=` reste accepté, mais il désigne désormais un DOSSIER. */
function refForPresetOverride(raw: string | null): string | null {
  if (raw === "botify") return BOTIFY_CASEFILE_REF;
  if (raw === "vine") return VINE_CASEFILE_REF;
  return null;
}

export async function GET(req: NextRequest) {
  // SEC P0 — auth is ALWAYS required. Previous ?mock=1 retail bypass
  // removed; this endpoint is admin-only.
  const auth = await checkAuth(req);
  if (!auth.authorized) return auth.response!;

  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get("handle") ?? "").trim();
  const mint = (searchParams.get("mint") ?? "").trim();
  const presetOverride = searchParams.get("preset");
  const template = parseTemplate(searchParams.get("template"));
  const lang = parseLang(searchParams.get("lang"));

  if (!handle && !mint && !presetOverride) {
    return NextResponse.json(
      { error: "handle, mint or preset required" },
      { status: 400 }
    );
  }

  // Mint takes precedence when provided — it's the most specific anchor.
  // handle/presetOverride are still supported for the KOL-page button.
  let ref: string | null = refForPresetOverride(presetOverride);
  if (!ref && mint) {
    ref = canonicalRefForMint(mint);
    if (!ref) {
      return NextResponse.json(
        { error: "mint has no linked case file" },
        { status: 400 }
      );
    }
  }
  if (!ref) ref = canonicalRefForMint(kolHandleToCanonicalMint(handle));
  if (!ref) {
    return NextResponse.json(
      { error: "handle has no linked case file" },
      { status: 404 }
    );
  }

  try {
    // ── PUBLIC template — la projection publique, telle quelle ───────────
    if (template === "public") {
      const dossier = await loadPublicProjection(ref, "api/casefile/pdf");
      const result = await generateCaseFilePdfPublic(lang, dossier);
      if (!result.success || !result.pdfBytes) {
        return NextResponse.json(
          { error: result.error ?? "pdf_render_failed" },
          { status: 500 }
        );
      }
      return new NextResponse(Buffer.from(result.pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${ref}-public-${lang}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ── INTERNAL template — le dossier ENTIER, états et provenance ────────
    const dossier = await loadCanonicalCaseFile(ref);
    if (!dossier) throw new CanonicalCaseFileMissingError(ref, "api/casefile/pdf");

    const sections = PRESET_SECTIONS_BY_REF[ref];
    if (!sections) {
      // Un dossier canonique sans sections de preset : on ne fabrique pas de
      // chronologie pour combler, on refuse le gabarit interne.
      return NextResponse.json(
        { error: "internal template has no sections for this case file" },
        { status: 404 }
      );
    }

    const input = {
      ...sections(),
      canonical: { ref: dossier.ref, claims: dossier.claims },
    };
    const result = await generateCaseFilePdf(input, { uploadToR2: false });
    if (!result.success || !result.pdfBytes) {
      return NextResponse.json(
        { error: result.error ?? "pdf_render_failed" },
        { status: 500 }
      );
    }
    return new NextResponse(Buffer.from(result.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ref}-internal-${lang}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof StaticSectionsMismatchError) {
      return NextResponse.json(
        { error: "public template not available for this case file" },
        { status: 404 }
      );
    }
    if (err instanceof CanonicalCaseFileMissingError) {
      return NextResponse.json(
        { error: "canonical_casefile_missing" },
        { status: 500 }
      );
    }
    throw err;
  }
}
