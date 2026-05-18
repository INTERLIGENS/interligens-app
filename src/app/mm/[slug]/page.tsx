// ─── /mm/[slug] — public fact-sheet (spec §13.7) ──────────────────────────
// Server component. Renders the full editorial fact-sheet for a single
// entity. Non-published workflows (DRAFT / REVIEWED / UNPUBLISHED) return
// 404 unless the caller carries a valid X-Admin-Token.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getEntityFull } from "@/lib/mm/registry/entities";
import { MmPageShell } from "@/components/mm/MmPageShell";
import { MmStatusBadge } from "@/components/mm/MmStatusBadge";
import { MmRiskBandBadge } from "@/components/mm/MmRiskBandBadge";
import { MmScoreDisplay } from "@/components/mm/MmScoreDisplay";
import { MmClaimBlock } from "@/components/mm/MmClaimBlock";
import { MmSourceCard } from "@/components/mm/MmSourceCard";
import { MmMethodologyFooter } from "@/components/mm/MmMethodologyFooter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const h = await headers();
  return h.get("x-admin-token") === expected;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityFull(slug);
  const isPublic =
    entity && (entity.workflow === "PUBLISHED" || entity.workflow === "CHALLENGED");

  if (!entity) {
    return { title: "MM Intelligence — Entité introuvable", robots: { index: false } };
  }
  return {
    title: `${entity.name} — MM Intelligence | INTERLIGENS`,
    description: entity.publicSummary.slice(0, 200),
    openGraph: {
      title: `${entity.name} — MM Intelligence`,
      description: entity.publicSummary.slice(0, 200),
      type: "article",
    },
    robots: isPublic ? { index: true, follow: true } : { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MmEntityPage({ params }: PageProps) {
  const { slug } = await params;
  const entity = await getEntityFull(slug);
  if (!entity) notFound();

  const admin = await isAdmin();
  const isPublic =
    entity.workflow === "PUBLISHED" || entity.workflow === "CHALLENGED";
  if (!isPublic && !admin) notFound();

  const publishedClaims = admin
    ? entity.claims
    : entity.claims.filter((c) => c.publishStatus === "PUBLISHED");

  const facts = publishedClaims.filter((c) => c.claimType === "FACT");
  const allegations = publishedClaims.filter((c) => c.claimType === "ALLEGATION");
  const inferences = publishedClaims.filter((c) => c.claimType === "INFERENCE");
  const responses = publishedClaims.filter((c) => c.claimType === "RESPONSE");

  const sources = Array.from(
    new Map(publishedClaims.map((c) => [c.source.id, c.source])).values(),
  );

  // Attributions shown publicly require confidence ≥ 0.85 (spec §4.1).
  const activeAttribs = entity.attributions.filter(
    (a) => a.revokedAt === null && a.confidence >= 0.85,
  );

  return (
    <MmPageShell activeNav="index">
      <nav
        aria-label="breadcrumb"
        style={{ fontSize: 11, letterSpacing: 1, color: "#666", marginBottom: 20 }}
      >
        <a href="/mm" style={{ color: "#FF6B00", textDecoration: "none" }}>
          ← REGISTRY
        </a>
      </nav>

      {!isPublic && admin ? (
        <div
          style={{
            padding: 14,
            marginBottom: 24,
            border: "1px solid #FF6B00",
            color: "#FF6B00",
            fontSize: 12,
            letterSpacing: 2,
            fontWeight: 900,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          ADMIN PREVIEW — WORKFLOW {entity.workflow}
        </div>
      ) : null}

      <EntityHeader entity={entity} isPublic={isPublic} />

      {facts.length > 0 ? (
        <Section id="procedural" title="Statut procédural">
          {facts.map((c) => (
            <MmClaimBlock key={c.id} claim={c} locale="fr" />
          ))}
        </Section>
      ) : null}

      {allegations.length > 0 ? (
        <Section id="allegations" title="Éléments documentés">
          {allegations.map((c) => (
            <MmClaimBlock key={c.id} claim={c} locale="fr" />
          ))}
        </Section>
      ) : null}

      {inferences.length > 0 ? (
        <Section id="inferences" title="Inférences & corroborations">
          {inferences.map((c) => (
            <MmClaimBlock key={c.id} claim={c} locale="fr" />
          ))}
        </Section>
      ) : null}

      {responses.length > 0 ? (
        <Section id="responses" title="Position adverse">
          <p
            style={{
              color: "#888",
              fontSize: 12,
              marginTop: 0,
              marginBottom: 12,
              lineHeight: 1.6,
            }}
          >
            Cette section reproduit, sans altération, les réponses officielles de
            l&apos;entité ou de son conseil, reçues via l&apos;endpoint de droit de
            réponse.
          </p>
          {responses.map((c) => (
            <MmClaimBlock key={c.id} claim={c} locale="fr" />
          ))}
        </Section>
      ) : null}

      <Section id="sources" title={`Sources (${sources.length})`}>
        {sources.length === 0 ? (
          <p style={{ color: "#666", fontSize: 14 }}>
            Aucune source publiée à ce jour.
          </p>
        ) : (
          sources.map((s) => <MmSourceCard key={s.id} source={s} />)
        )}
      </Section>

      <Section
        id="attributions"
        title={`Wallets attribués (${activeAttribs.length})`}
      >
        {activeAttribs.length === 0 ? (
          <p style={{ color: "#666", fontSize: 14 }}>
            Aucun wallet attribué publiquement à cette entité au-dessus du seuil
            de confiance 0.85.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {activeAttribs.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "#0A0A0A",
                  border: "1px solid #1A1A1A",
                  borderRadius: 2,
                  fontSize: 13,
                }}
              >
                <code
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 13,
                    wordBreak: "break-all",
                  }}
                >
                  {a.walletAddress}
                </code>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexShrink: 0,
                    color: "#888",
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  <span>{a.chain}</span>
                  <span>{a.attributionMethod}</span>
                  <span style={{ color: "#FF6B00" }}>
                    conf {(a.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <ReplyNotice />

      <MmMethodologyFooter lastUpdated={entity.updatedAt} />
    </MmPageShell>
  );
}

function EntityHeader({
  entity,
  isPublic,
}: {
  entity: Awaited<ReturnType<typeof getEntityFull>> & object;
  isPublic: boolean;
}) {
  return (
    <header style={{ marginBottom: 40 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <MmStatusBadge status={entity.status} size="md" />
        <MmRiskBandBadge band={entity.riskBand} size="md" />
      </div>
      <h1
        style={{
          fontSize: 52,
          fontWeight: 900,
          lineHeight: 1.02,
          letterSpacing: -1.5,
          marginBottom: 10,
        }}
      >
        {entity.name}
      </h1>
      {entity.legalName && entity.legalName !== entity.name ? (
        <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
          {entity.legalName}
          {entity.foundedYear ? ` · fondée en ${entity.foundedYear}` : ""}
          {entity.jurisdiction ? ` · ${entity.jurisdiction}` : ""}
        </div>
      ) : null}
      {entity.founders.length > 0 ? (
        <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
          Fondateur{entity.founders.length > 1 ? "s" : ""} :{" "}
          {entity.founders.join(", ")}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 220px) 1fr",
          gap: 28,
          alignItems: "center",
          marginTop: 24,
          padding: 20,
          background: "#0A0A0A",
          border: "1px solid #1A1A1A",
          borderRadius: 2,
        }}
      >
        <MmScoreDisplay
          score={entity.defaultScore}
          band={entity.riskBand}
          size={140}
        />
        <div>
          <p style={{ color: "#E5E5E5", fontSize: 15, lineHeight: 1.65, margin: 0 }}>
            {entity.publicSummaryFr || entity.publicSummary}
          </p>
          {isPublic ? (
            <a
              href={`/api/v1/mm/entity/${entity.slug}/report`}
              download={`mm-report-${entity.slug}.pdf`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
                padding: "10px 16px",
                border: "1px solid #FF6B00",
                color: "#FF6B00",
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: "uppercase",
                borderRadius: 2,
              }}
            >
              ↓ Télécharger le rapport forensique (PDF)
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginTop: 40 }}>
      <h2
        style={{
          fontSize: 12,
          letterSpacing: 3,
          fontWeight: 900,
          color: "#FF6B00",
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ReplyNotice() {
  return (
    <section
      style={{
        marginTop: 40,
        padding: 24,
        border: "1px solid #FF6B00",
        background: "rgba(255, 107, 0, 0.05)",
        borderRadius: 2,
      }}
    >
      <h3
        style={{
          fontSize: 12,
          letterSpacing: 3,
          fontWeight: 900,
          color: "#FF6B00",
          textTransform: "uppercase",
          margin: 0,
          marginBottom: 10,
        }}
      >
        Méthodologie &amp; droit de réponse
      </h3>
      <p style={{ color: "#E5E5E5", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Toutes les informations figurant sur cette fiche sont sourcées
        publiquement. L&apos;entité ou son conseil peut contester un élément via{" "}
        <a href="mailto:legal@interligens.com" style={{ color: "#FF6B00" }}>
          legal@interligens.com
        </a>{" "}
        ou l&apos;endpoint{" "}
        <code style={{ color: "#FF6B00" }}>POST /api/v1/mm/challenge</code>.
        Instruction : 14 jours. Vérification d&apos;identité obligatoire (DKIM, et
        signature légale pour les entités Tier A).
      </p>
    </section>
  );
}
