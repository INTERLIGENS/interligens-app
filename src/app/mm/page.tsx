// ─── /mm — public MM Tracker index (spec §13.7) ───────────────────────────
// Server component. Renders the list of published (or CHALLENGED) entities
// with filter controls. Admin override via X-Admin-Token unlocks DRAFT +
// REVIEWED entities for editorial preview.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { MmRiskBand, MmStatus, MmWorkflow } from "@/lib/mm/types";
import { MmPageShell } from "@/components/mm/MmPageShell";
import { MmStatusBadge } from "@/components/mm/MmStatusBadge";
import { MmRiskBandBadge } from "@/components/mm/MmRiskBandBadge";
import { MmMethodologyFooter } from "@/components/mm/MmMethodologyFooter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Market Maker Intelligence — INTERLIGENS",
  description:
    "Registre éditorial des market makers crypto — condamnations, inculpations, règlements et pratiques documentées.",
  openGraph: {
    title: "Market Maker Intelligence — INTERLIGENS",
    description:
      "Registre éditorial des market makers crypto avec workflow de droit de réponse.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

const ALL_STATUSES: MmStatus[] = [
  "CONVICTED",
  "CHARGED",
  "SETTLED",
  "INVESTIGATED",
  "DOCUMENTED",
  "OBSERVED",
];
const ALL_BANDS: MmRiskBand[] = ["RED", "ORANGE", "YELLOW", "GREEN"];

const PUBLIC_WORKFLOWS: MmWorkflow[] = ["PUBLISHED", "CHALLENGED"];
const ADMIN_WORKFLOWS: MmWorkflow[] = [
  "DRAFT",
  "REVIEWED",
  "PUBLISHED",
  "CHALLENGED",
];

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const h = await headers();
  return h.get("x-admin-token") === expected;
}

interface PageProps {
  searchParams: Promise<{
    status?: string | string[];
    band?: string | string[];
  }>;
}

export default async function MmIndexPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const bandParam = Array.isArray(sp.band) ? sp.band[0] : sp.band;

  const admin = await isAdmin();

  const entities = await prisma.mmEntity.findMany({
    where: {
      workflow: { in: admin ? ADMIN_WORKFLOWS : PUBLIC_WORKFLOWS },
      ...(statusParam && ALL_STATUSES.includes(statusParam as MmStatus)
        ? { status: statusParam as MmStatus }
        : {}),
      ...(bandParam && ALL_BANDS.includes(bandParam as MmRiskBand)
        ? { riskBand: bandParam as MmRiskBand }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      legalName: true,
      jurisdiction: true,
      status: true,
      riskBand: true,
      defaultScore: true,
      workflow: true,
      publishedAt: true,
      updatedAt: true,
      publicSummary: true,
      _count: {
        select: {
          attributions: { where: { revokedAt: null } },
        },
      },
    },
    orderBy: [{ defaultScore: "desc" }, { name: "asc" }],
  });

  return (
    <MmPageShell activeNav="index">
      <Header admin={admin} totalCount={entities.length} />

      <FilterBar activeStatus={statusParam} activeBand={bandParam} />

      {entities.length === 0 ? (
        <EmptyState admin={admin} />
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 16,
          }}
        >
          {entities.map((e) => (
            <EntityRow
              key={e.id}
              entity={{
                ...e,
                attributionsCount: e._count.attributions,
              }}
              admin={admin}
            />
          ))}
        </ul>
      )}

      <MmMethodologyFooter
        lastUpdated={entities[0]?.updatedAt ?? null}
      />
    </MmPageShell>
  );
}

function Header({ admin, totalCount }: { admin: boolean; totalCount: number }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            fontSize: 10,
            letterSpacing: 3,
            fontWeight: 900,
            border: "1px solid #FF6B00",
            color: "#FF6B00",
            borderRadius: 2,
          }}
        >
          MARKET MAKER INTELLIGENCE
        </span>
        {admin ? (
          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              fontSize: 10,
              letterSpacing: 3,
              fontWeight: 900,
              background: "#FF6B00",
              color: "#000000",
              borderRadius: 2,
            }}
          >
            ADMIN PREVIEW
          </span>
        ) : null}
      </div>
      <h1
        style={{
          fontSize: 48,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: -1,
          marginBottom: 12,
        }}
      >
        Le registre des market makers crypto
      </h1>
      <p style={{ color: "#999", fontSize: 16, lineHeight: 1.6, maxWidth: 760 }}>
        Inventaire éditorial et sourcé des market makers mis en cause par le DOJ, la
        SEC ou une presse établie. Chaque fiche expose son statut procédural,
        ses sources archivées et son droit de réponse vérifié.
      </p>
      <div
        style={{
          marginTop: 12,
          color: "#666",
          fontSize: 13,
          letterSpacing: 1,
        }}
      >
        {totalCount} {totalCount === 1 ? "entité" : "entités"}
      </div>
    </div>
  );
}

function FilterBar({
  activeStatus,
  activeBand,
}: {
  activeStatus?: string;
  activeBand?: string;
}) {
  return (
    <form
      method="get"
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "flex-end",
        marginBottom: 28,
        padding: 16,
        border: "1px solid #1A1A1A",
        background: "#0A0A0A",
        borderRadius: 2,
      }}
    >
      <FilterSelect
        name="status"
        label="Statut"
        value={activeStatus ?? ""}
        options={[{ value: "", label: "Tous" }, ...ALL_STATUSES.map((s) => ({ value: s, label: s }))]}
      />
      <FilterSelect
        name="band"
        label="Risk band"
        value={activeBand ?? ""}
        options={[{ value: "", label: "Tous" }, ...ALL_BANDS.map((b) => ({ value: b, label: b }))]}
      />
      <button
        type="submit"
        style={{
          padding: "10px 18px",
          background: "#FF6B00",
          color: "#000000",
          border: "none",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 2,
          textTransform: "uppercase",
          cursor: "pointer",
          borderRadius: 2,
        }}
      >
        Appliquer
      </button>
      {activeStatus || activeBand ? (
        <a
          href="/mm"
          style={{
            fontSize: 11,
            color: "#888",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Réinitialiser
        </a>
      ) : null}
    </form>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          color: "#999",
          letterSpacing: 2,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        style={{
          padding: "10px 12px",
          background: "#000000",
          color: "#FFFFFF",
          border: "1px solid #333",
          borderRadius: 2,
          fontSize: 13,
          minWidth: 160,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface EntityRowProps {
  entity: {
    slug: string;
    name: string;
    legalName: string | null;
    jurisdiction: string | null;
    status: MmStatus;
    riskBand: MmRiskBand;
    defaultScore: number;
    workflow: MmWorkflow;
    publishedAt: Date | null;
    publicSummary: string;
    attributionsCount: number;
  };
  admin: boolean;
}

function EntityRow({ entity, admin }: EntityRowProps) {
  return (
    <li>
      <a
        href={`/mm/${entity.slug}`}
        style={{
          display: "block",
          padding: 20,
          border: "1px solid #222",
          background: "#0A0A0A",
          color: "#FFFFFF",
          textDecoration: "none",
          borderRadius: 2,
          transition: "border-color 160ms ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginBottom: 4,
                flexWrap: "wrap",
              }}
            >
              <MmStatusBadge status={entity.status} size="sm" />
              <MmRiskBandBadge band={entity.riskBand} size="sm" />
              {admin && entity.workflow !== "PUBLISHED" ? (
                <span
                  style={{
                    padding: "3px 8px",
                    background: "#1A1A1A",
                    color: "#FF6B00",
                    fontSize: 10,
                    letterSpacing: 2,
                    fontWeight: 900,
                    borderRadius: 2,
                  }}
                >
                  {entity.workflow}
                </span>
              ) : null}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              {entity.name}
            </div>
            {entity.legalName && entity.legalName !== entity.name ? (
              <div style={{ fontSize: 12, color: "#666" }}>
                {entity.legalName}
                {entity.jurisdiction ? ` · ${entity.jurisdiction}` : ""}
              </div>
            ) : entity.jurisdiction ? (
              <div style={{ fontSize: 12, color: "#666" }}>
                Juridiction : {entity.jurisdiction}
              </div>
            ) : null}
          </div>
          <div
            style={{
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              minWidth: 80,
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: 1,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              {entity.defaultScore}
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: "#888",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Score défaut
            </div>
          </div>
        </div>

        <p
          style={{
            color: "#CCCCCC",
            fontSize: 14,
            lineHeight: 1.6,
            margin: 0,
            marginBottom: 10,
          }}
        >
          {entity.publicSummary}
        </p>

        <div
          style={{
            fontSize: 11,
            color: "#666",
            display: "flex",
            gap: 18,
            letterSpacing: 0.5,
            flexWrap: "wrap",
          }}
        >
          <span>{entity.attributionsCount} wallet(s) attribué(s)</span>
          {entity.publishedAt ? (
            <span>
              Publié le {entity.publishedAt.toISOString().slice(0, 10)}
            </span>
          ) : null}
        </div>
      </a>
    </li>
  );
}

function EmptyState({ admin }: { admin: boolean }) {
  return (
    <div
      style={{
        padding: 40,
        border: "1px dashed #333",
        textAlign: "center",
        color: "#888",
        borderRadius: 2,
      }}
    >
      <p style={{ fontSize: 14, margin: 0 }}>
        Aucune entité ne correspond aux filtres sélectionnés.
      </p>
      {!admin ? (
        <p style={{ fontSize: 12, marginTop: 8, color: "#555" }}>
          Les entités du registre sont publiées progressivement après revue
          juridique.
        </p>
      ) : null}
    </div>
  );
}
