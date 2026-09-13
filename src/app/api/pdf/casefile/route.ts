import { puppeteerSsrfGuard } from "@/lib/security/ssrfGuard";
import { checkAuth } from "@/lib/security/auth";
import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { computeScore } from "@/lib/scoring";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";
import type { ScanResult } from "@/app/api/scan/solana/route";
import { produireArtefactGouverne } from "@/lib/storage/registre/production";
import { envInt } from "@/lib/config/envNumber";
import { canonicalRefForMint } from "@/lib/casefile/publicProjection";
import { loadCanonicalCaseFile } from "@/lib/casefile/canonicalReader";

// ─── BUILD 13 · S3 — LE REFUS, ET IL EST UNIQUE ────────────────────────────
//
// ██  No governed dossier → no canonical CaseFile artifact.             ██
//
// Cette route produit UN artefact CaseFile. Sans `CaseFileRef` gouverné qui se
// résout en dossier persisté, elle n'en produit AUCUN : pas de « Reference — »,
// pas de mint tronqué en substitut, pas de `case_meta.case_id`, pas de CaseFile
// sans CaseFileRef. On REFUSE, on ne dégrade pas — et on ne transforme pas
// implicitement cette route en « PDF de scan générique » pour éviter le
// fail-closed. Si un PDF pour n'importe quel mint est voulu un jour, ce sera
// une capacité DISTINCTE, explicitement non-CaseFile.
//
// ─── POURQUOI UNE SEULE VALEUR, GELÉE ──────────────────────────────────────
//
// ██  Ce qu'on protège n'est pas le mint — il est public on-chain.       ██
// ██  C'est L'EXISTENCE D'UN DOSSIER NON PUBLIÉ.                         ██
//
// C'est la règle des huit routes KOL, transposée : cinq d'entre elles ne sont
// pas des oracles PARCE QUE « inconnu » et « non publié » produisent la même
// réponse. Quatre causes doivent ici converger vers la MÊME réponse, octet pour
// octet — aucun dossier n'existe ; un dossier existe mais la carte ne le résout
// pas ; un ref se résout mais aucun dossier gouverné ne le porte ; le mint est
// valide et inconnu. Un champ `cause` qui varierait, ou un `detail` qui se
// personnaliserait, rouvrirait l'oracle avec de bonnes manières.
//
// La valeur est donc UNE CONSTANTE GELÉE, rendue telle quelle — comme
// `resolveCaseFileRef` rend la constante `NOT_FOUND` elle-même et non un objet
// équivalent. Un seul site de construction : la forme ne peut pas diverger.
//
// 404 et non 400 : la requête est BIEN FORMÉE — un mint valide est une adresse
// valide. C'est la RESSOURCE qui manque, pas la syntaxe. Et l'absence SE NOMME :
// un opérateur habilité qui reçoit un corps muet ne peut pas distinguer une
// route cassée d'un mint sans dossier.
const REFUS_ARTEFACT_NON_GOUVERNE = Object.freeze({
  error: "no_governed_casefile",
  detail:
    "This route produces a CaseFile artifact only. It requires a governed " +
    "CaseFileRef resolving to a persisted case file; without one, no artifact " +
    "is produced — degraded, partial or otherwise.",
});

function refuserArtefact(): NextResponse {
  const res = NextResponse.json(REFUS_ARTEFACT_NON_GOUVERNE, { status: 404 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(request: NextRequest) {
  const _auth = await checkAuth(request);
  if (!_auth.authorized) return _auth.response!;
  const _rl = await checkRateLimit(getClientIp(request), RATE_LIMIT_PRESETS.pdf);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(request));

  const { searchParams } = new URL(request.url);
  const mint = searchParams.get("mint");
  if (!mint) return NextResponse.json({ error: "Missing ?mint=" }, { status: 400 });

  const mint_clean = mint.trim();
  const lang = searchParams.get("lang") ?? "en";

  // ── LA FRONTIÈRE — elle est ICI, avant toute production ────────────────
  //
  // Avant le marché, avant le rendu, avant Puppeteer. On refuse AVANT de
  // produire, jamais après : un artefact commencé puis jeté aurait déjà coûté
  // un appel réseau et laissé une trace, et surtout il aurait existé.
  //
  // Les deux étapes sont RÉSOLUTION puis FONDATION, et il faut les deux :
  // `canonicalRefForMint` rend un ref, `loadCanonicalCaseFile` dit s'il porte
  // un dossier PERSISTÉ. La propriété exige le ref gouverné ET persisté — un
  // ref qui ne fonde rien n'est pas une identité de citation.
  //
  // Leur échec est INDISCERNABLE de l'extérieur : même constante, même statut.
  const refGouverne = canonicalRefForMint(mint_clean);
  const dossierGouverne = refGouverne ? await loadCanonicalCaseFile(refGouverne) : null;
  if (!dossierGouverne) return refuserArtefact();

  // ── LEGACY_SCORING_INPUT, et rien d'autre ───────────────────────────────
  //
  // `loadCaseByMint` alimente encore les claims, sources et résumé de ce
  // rendu. `src/lib/caseDb.ts` déclare que ce module n'a PAS le droit
  // d'alimenter « le PDF ou l'export CaseFile » — et cette fenêtre ferme la
  // part du défaut qui est une IDENTITÉ. Le CONTENU reste à basculer : c'est
  // un changement de ce qui entre dans un score publié, et le module lui-même
  // dit que cette bascule exige sa propre qualification. Dette nommée, HOLD.
  const caseFile = loadCaseByMint(mint_clean);
  const marketSnapshot = await getMarketSnapshot("solana", mint_clean);
  const scoring = computeScore(caseFile?.claims ?? []);

  const scanResult: ScanResult = {
    mint: mint_clean,
    chain: "solana",
    scanned_at: new Date().toISOString(),
    off_chain: {
      status: caseFile?.case_meta.status ?? "Unknown",
      source: caseFile ? "case_db" : "none",
      // L'IDENTITÉ DE CITATION VIENT DE LA FRONTIÈRE. C'est le précédent du
      // dépôt (`api/report/casefile:71` pose déjà `case_id = dossier.ref`) :
      // la référence fondée occupe l'emplacement, sans changer aucun type.
      // Le champ garde son nom historique — y mettre un CaseFileRef ferme la
      // causalité d'identité du PDF, pas la sémantique du champ. Le renommage
      // est une dette P1 SERVED / SCHEMA SEMANTICS, dans un lot séparé.
      case_id: dossierGouverne.ref,
      summary: caseFile?.case_meta.summary ?? null,
      claims: (caseFile?.claims ?? []).map((c) => ({
        id: c.claim_id, title: c.title, severity: c.severity, status: c.status,
        description: c.description,
        evidence_files: (caseFile?.sources ?? []).filter((s) => c.evidence_refs.includes(s.source_id)).map((s) => s.filename ?? ""),
        thread_url: c.thread_url, category: c.category,
      })),
      sources: (caseFile?.sources ?? []).map((s) => ({ source_id: s.source_id, filename: s.filename, caption: s.caption, type: s.type })),
    },
    on_chain: { markets: { source: marketSnapshot.source, primary_pool: marketSnapshot.primary_pool, dex: marketSnapshot.dex, url: marketSnapshot.url, price: marketSnapshot.price, liquidity_usd: marketSnapshot.liquidity_usd, volume_24h_usd: marketSnapshot.volume_24h_usd, fdv_usd: marketSnapshot.fdv_usd, fetched_at: marketSnapshot.fetched_at, cache_hit: marketSnapshot.cache_hit } },
    risk: { score: scoring.score, tier: scoring.tier, breakdown: scoring.breakdown, flags: scoring.flags },
  };

  const html = renderCaseFilePDF(scanResult, lang);

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

    const pdfBuf = Buffer.from(pdfBuffer);

    // ── E-RC · LEASE A — LA PRODUCTION GOUVERNÉE, FAIL-CLOSED ────────────
    //
    // ██  "No registry authority → no governed artifact production        ██
    // ██   OR DELIVERY."                                                  ██
    //
    // Ce bloc s'intitulait « Storage R2 (non-bloquant) », et c'était vrai au
    // mauvais sens. TROIS chemins menaient au même résultat — le PDF servi en
    // flux direct, HORS REGISTRE :
    //
    //   1. `PDF_STORAGE_ENABLED` absent → le bloc entier était sauté ;
    //   2. `upload === null`            → « R2 down → fallback stream direct » ;
    //   3. « comportement original »    → le repli commun des deux.
    //
    // Une variable d'environnement peut configurer l'INFRASTRUCTURE ; elle ne
    // peut pas transformer un artefact gouverné en artefact hors registre.
    // `isStorageEnabled()` n'est plus lu ici : la primitive le lit, et son
    // absence y est un REFUS, pas un contournement.
    //
    // Le nom de fichier a disparu AVEC le flux : il ne nommait que le corps
    // servi directement. Un artefact enregistré est nommé par son registre —
    // `registreId` ci-dessous est ce qui le relie à la ligne qui le fonde, et
    // c'est lui qui permet de dire à un cabinet « l'artefact que vous ouvrez
    // est celui qui a été enregistré ».
    const production = await produireArtefactGouverne({
      buffer: pdfBuf,
      subject: mint_clean,
      batchId: "casefile",
    });

    if (!production.produit) {
      // 503, et non 500 : le PDF a été RENDU, c'est l'autorité qui manque.
      // Annoncer « PDF generation failed » enverrait chercher au mauvais
      // endroit. Le motif est NOMMÉ — un refus anonyme est indiscernable
      // d'une panne.
      console.error("[pdf/casefile] production refusée", {
        mint: mint_clean,
        raison: production.raison,
      });
      return NextResponse.json(
        {
          error: "governed_production_unavailable",
          raison: production.raison,
          detail: production.explication,
        },
        { status: production.statutHttp },
      );
    }

    return NextResponse.json({
      status: "stored",
      signedUrl: production.signedUrl,
      key: production.key,
      sha256: production.sha256,
      sizeBytes: production.sizeBytes,
      registreId: production.registreId,
      // Non fini -> 900. Doit rester ALIGNÉ sur pdfStorage.signedUrlTtl(),
      // qui applique le même défaut : une divergence annoncerait au client
      // une expiration que l'URL signée ne respecte pas.
      expiresInSeconds: envInt("PDF_SIGNED_URL_TTL_SECONDS", 900),
    });
  } catch (err) {
    console.error("[pdf/casefile] Puppeteer error:", err);
    return NextResponse.json({ error: "PDF generation failed", detail: String(err) }, { status: 500 });
  }
}
