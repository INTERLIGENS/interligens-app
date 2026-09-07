// src/app/api/casefile/public/route.ts
//
// GET /api/casefile/public?handle=<kolHandle>&lang=<en|fr>
// GET /api/casefile/public?mint=<tokenMint>&lang=<en|fr>
//
// Retail-facing public CaseFile endpoint. No auth. IP-rate-limited
// (RATE_LIMIT_PRESETS.pdf = 10 req / 5 min / IP, fail-closed on Upstash).
// Always renders the public 9-section diffamation-safe template via
// generateCaseFilePdfPublic — there is no path from this route to the
// internal forensic generator. Admin surface lives at /api/casefile/pdf
// and stays behind checkAuth.
//
// Response: application/pdf, Cache-Control: public, max-age=3600.
//
// ── BUILD 9 / ÉTAPE 5 — ce que cette route sert, et d'où ────────────────────
//
// AVANT : elle résolvait un preset (`kolHandleToCasefilePreset`), passait un
// `caseId` littéral au générateur, et le générateur allait lire
// `data/cases/botify.json`. La route parlait de dossier ; le PDF servait un
// JSON de fichier. Deux autorités, dont une invisible depuis ici.
//
// MAINTENANT : elle résout une IDENTITÉ (mint canonique → ref de dossier),
// charge la projection publique depuis l'autorité, et la passe au générateur.
// Le générateur ne lit plus rien.
//
// Et surtout : AUCUN REPLI. Si l'autorité ne connaît pas le dossier que la
// carte d'identité désigne, la route échoue en le disant. Se rabattre sur le
// preset rendrait un PDF — c'est bien le problème : il aurait l'air normal.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import {
  generateCaseFilePdfPublic,
  StaticSectionsMismatchError,
  type PublicReportLang,
} from "@/lib/casefile/pdfGeneratorPublic";
import {
  canonicalRefForMint,
  loadPublicProjection,
  CanonicalCaseFileMissingError,
} from "@/lib/casefile/publicProjection";
import { kolHandleToCanonicalMint } from "@/lib/kol-memory/tokenIdentity";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function parseLang(raw: string | null): PublicReportLang {
  return raw === "fr" ? "fr" : "en";
}

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.pdf);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get("handle") ?? "").trim();
  const mint = (searchParams.get("mint") ?? "").trim();
  const lang = parseLang(searchParams.get("lang"));

  if (!handle && !mint) {
    return NextResponse.json(
      { error: "handle or mint required" },
      { status: 400 },
    );
  }

  // ── Identité, et rien d'autre ──────────────────────────────────────────
  // Le handle passe par le mint CANONIQUE, pas par un preset : le preset est
  // une autorité de contenu, et on ne veut plus en dépendre, même pour du
  // routage. `canonicalRefForMint` résout l'alias BOTIFY synthétique.
  const ref = mint
    ? canonicalRefForMint(mint)
    : canonicalRefForMint(kolHandleToCanonicalMint(handle));

  if (!ref) {
    return NextResponse.json(
      { error: "no linked public case file" },
      { status: 404 },
    );
  }

  try {
    const dossier = await loadPublicProjection(ref, "api/casefile/public");
    const result = await generateCaseFilePdfPublic(lang, dossier);
    if (!result.success || !result.pdfBytes) {
      return NextResponse.json(
        { error: result.error ?? "pdf_render_failed" },
        { status: 500 },
      );
    }
    return new NextResponse(Buffer.from(result.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ref}-public-${lang}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    // Le gabarit public ne documente qu'un dossier : ses sections statiques
    // (chronologie, métriques, cluster) décrivent BOTIFY. Le refus est une
    // propriété du GABARIT, pas une liste d'autorisation par preset.
    if (err instanceof StaticSectionsMismatchError) {
      return NextResponse.json(
        { error: "public template not available for this case file" },
        { status: 404 },
      );
    }
    // L'identité désigne un dossier que l'autorité ne porte pas. On le dit —
    // on ne sert pas un preset à la place.
    if (err instanceof CanonicalCaseFileMissingError) {
      return NextResponse.json(
        { error: "canonical_casefile_missing" },
        { status: 500 },
      );
    }
    throw err;
  }
}
