import { puppeteerSsrfGuard } from "@/lib/security/ssrfGuard";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";
import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { checkAuth } from "@/lib/security/auth";
import {
  loadPublicProjection,
  canonicalRefForMint,
} from "@/lib/casefile/publicProjection";
import { safeEvidenceUrl } from "@/lib/kol-memory/publicIdentityProjection";

export const runtime = "nodejs";
export const maxDuration = 300;

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  // SEC-001 — auth is ALWAYS required. The previous `?mock=1` query bypass
  // was a P0 and has been removed. If you need a fixture for E2E, use a
  // dedicated test endpoint, not this one.
  const _auth = await checkAuth(req);
  if (!_auth.authorized) return _auth.response!;

  // Rate limit BEFORE spinning up Puppeteer (expensive).
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.pdf);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));
  const { searchParams } = new URL(req.url);
  const mint = (searchParams.get("mint") || "").trim();
  const lang = searchParams.get("lang") ?? "en";
  if (!mint) return NextResponse.json({ error: "Missing ?mint=" }, { status: 400 });

  const baseUrl = getBaseUrl(req);
  const scanUrl = `${baseUrl}/api/scan/solana?mint=${encodeURIComponent(mint)}`;
  console.log("[REPORT]", { mint, scanUrl });

  const r = await fetch(scanUrl, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "scan_failed", status: r.status }, { status: 500 });

  const casefile = await r.json();
  console.log("[REPORT_OFFCHAIN]", { source: casefile?.off_chain?.source, claims: casefile?.off_chain?.claims?.length ?? 0 });

  // ── BUILD 10 · P3 — LES CLAIMS DU PDF VIENNENT DE L'AUTORITÉ ────────────
  //
  // ██  LEGACY_SCORING_INPUT n'alimente plus le PDF CaseFile.              ██
  //
  // Avant : les claims arrivaient de /api/scan/solana, qui les tire de
  // `loadCaseByMint` et pose `off_chain.source = "case_db"`. Le PDF publiait
  // donc le corpus legacy — ce que la doctrine ratifiée interdit nommément
  // (« ni le PDF ni l'export CaseFile »).
  //
  // Et un `require("data/cases/botify.json")` enrichissait les titres FR :
  // une SECONDE lecture de la même autorité legacy, dans le même fichier.
  //
  // Les deux sont partis. Les claims viennent de la projection canonique,
  // dans la locale demandée — la projection porte `titleFr` et
  // `descriptionFr`, il n'y a plus rien à enrichir.
  //
  // AUCUN CHAMP DE SCORE N'EST TOUCHÉ : `risk` et `tiger_score` traversent
  // inchangés. Ils sont calculés dans le scan, à partir de `rawClaims`, que
  // cette substitution ne lit ni ne modifie.
  const ref = canonicalRefForMint(mint);
  if (ref) {
    const dossier = await loadPublicProjection(ref, "api/report/casefile");
    casefile.off_chain.source = "canonical";
    casefile.off_chain.case_id = dossier.ref;
    casefile.off_chain.summary = dossier.title;
    casefile.off_chain.claims = dossier.claims.map((c) => ({
      id: c.claimId,
      title: (lang === "fr" ? c.titleFr : null) ?? c.title,
      severity: c.severity ?? "",
      status: c.status ?? "",
      description: (lang === "fr" ? c.descriptionFr : null) ?? c.description ?? "",
      // Une pièce n'est listée que si elle est PUBLIABLE : la projection ne
      // rend que celles qui portent empreinte, origine et capture.
      evidence_files: c.provenance.sources.map((s) => s.sourceId),
      // ─── BUILD 10 / FENÊTRE 1 — LE LIEN NE POINTE PAS UNE IDENTITÉ FERMÉE ──
      //
      // Question laissée ouverte par le handoff T2 (§6b), faute d'accès base.
      // Mesurée ici le 2026-09-08 sur `CaseFileClaim` : 4 des 14 `threadUrl`
      // canoniques portent la clé synthétique 43 — C3, C4, C5 et C7 de
      // IL-SHILL-BOTIFY-001, les mêmes quatre URL que le P0 a fermées sur
      // scan/timeline et scan/solana. 0 porte la clé canonique.
      //
      // Ce patch fait de ce champ un NOUVEAU point de consommation : sans la
      // gate, le PDF publierait vers un jeton qui n'est pas le sujet du dossier,
      // dans un document destiné à un conseil. La gate canonique posée au P0
      // est RÉUTILISÉE, jamais recopiée ; une URL sans identité fermée la
      // traverse inchangée.
      thread_url: safeEvidenceUrl(c.provenance.threadUrl) || null,
      category: c.category ?? "",
    }));
    casefile.off_chain.sources = dossier.sources.map((s) => ({
      source_id: s.sourceId,
      filename: null,
      caption: s.caption,
      captured_at: s.capturedAt,
    }));
  } else {
    // Aucun dossier canonique pour ce mint : on ne se rabat PAS sur le corpus
    // legacy servi par le scan. Le document rend une liste vide, et
    // `off_chain.source` le dit.
    casefile.off_chain.source = "none";
    casefile.off_chain.claims = [];
    casefile.off_chain.sources = [];
  }

  // Fix 4: inject market data from scan if missing
  if (!casefile.on_chain?.markets?.source) {
    try {
      const host = req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto") ?? "http";
      const scanUrl = `${proto}://${host}/api/scan/solana?mint=${encodeURIComponent(mint)}`;
      const scanRes = await fetch(scanUrl, { cache: "no-store" });
      if (scanRes.ok) {
        const scanData = await scanRes.json();
        if (scanData?.on_chain?.markets?.source) {
          casefile.on_chain = scanData.on_chain;
        }
      }
    } catch(e) { console.error("[market] injection failed", e); }
  }

  // ── Fetch graph report (best-effort, non-bloquant) ──────────────────────
  let graphReport: any = null;
  try {
    const graphUrl = `${baseUrl}/api/scan/solana/graph?mint=${encodeURIComponent(mint)}&hops=1&days=30`;
    const gRes = await fetch(graphUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (gRes.ok) {
      const gData = await gRes.json();
      if (gData?.version === "1.0") graphReport = gData;
    }
  } catch(e) { console.warn("[casefile] graph fetch skipped:", e instanceof Error ? e.message : e); }

  const html = renderCaseFilePDF(casefile, lang, graphReport);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: await chromium.executablePath("https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev/chromium-v143.0.4-pack.x64.tar"),
      args: chromium.args,
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", puppeteerSsrfGuard);

    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "32px", right: "32px", bottom: "32px", left: "32px" } });
    await browser.close();
    const filename = `casefile-${mint.slice(0, 8)}-${Date.now()}.pdf`;
    return new NextResponse(Buffer.from(pdfBuffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache" } });
  } catch (err) {
    console.error("[report/casefile] Puppeteer error:", err);
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
