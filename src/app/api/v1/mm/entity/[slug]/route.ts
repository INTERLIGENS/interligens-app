import { NextRequest, NextResponse } from "next/server";
import { getEntityFull } from "@/lib/mm/registry/entities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "slug_required" }, { status: 400 });
  }

  const entity = await getEntityFull(slug);
  if (!entity) {
    return NextResponse.json({ error: "not_found", slug }, { status: 404 });
  }

  // Public exposure: only PUBLISHED and CHALLENGED workflows are visible to
  // unauthenticated callers. All others are editorial drafts.
  const admin =
    new URL(_req.url).searchParams.get("admin") === "1" &&
    _req.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;

  if (!admin && entity.workflow !== "PUBLISHED" && entity.workflow !== "CHALLENGED") {
    return NextResponse.json({ error: "not_published", slug }, { status: 404 });
  }

  const publishedClaims = admin
    ? entity.claims
    : entity.claims.filter((c) => c.publishStatus === "PUBLISHED");

  return NextResponse.json({
    version: "1.0",
    entity: {
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      legalName: entity.legalName,
      jurisdiction: entity.jurisdiction,
      foundedYear: entity.foundedYear,
      founders: entity.founders,
      status: entity.status,
      riskBand: entity.riskBand,
      defaultScore: entity.defaultScore,
      publicSummary: entity.publicSummary,
      publicSummaryFr: entity.publicSummaryFr,
      knownAliases: entity.knownAliases,
      officialDomains: entity.officialDomains,
      workflow: entity.workflow,
      publishedAt: entity.publishedAt,
    },
    claims: publishedClaims.map((c) => ({
      id: c.id,
      claimType: c.claimType,
      text: c.text,
      textFr: c.textFr,
      jurisdiction: c.jurisdiction,
      orderIndex: c.orderIndex,
      publishStatus: c.publishStatus,
      publishedAt: c.publishedAt,
      source: {
        id: c.source.id,
        publisher: c.source.publisher,
        sourceType: c.source.sourceType,
        url: c.source.url,
        title: c.source.title,
        credibilityTier: c.source.credibilityTier,
        publishedAt: c.source.publishedAt,
        archivedUrl: c.source.archivedUrl,
        archivalStatus: c.source.archivalStatus,
      },
    })),
    attributions: entity.attributions.map((a) => ({
      id: a.id,
      walletAddress: a.walletAddress,
      chain: a.chain,
      attributionMethod: a.attributionMethod,
      confidence: a.confidence,
      reviewedAt: a.reviewedAt,
      createdAt: a.createdAt,
    })),
    meta: {
      rightOfReplyUrl: `/api/v1/mm/challenge`,
      methodologyUrl: "/mm/methodology",
      legalUrl: "/mm/legal",
    },
  });
}
