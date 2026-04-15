"use client";

import { useState } from "react";

const ACCENT = "#FF6B00";
const BG = "#000000";

type DocCategory = "LEGAL" | "DATA_ROOM" | "OPS";

type Doc = {
  title: string;
  description: string;
  category: DocCategory;
  version: string;
};

const DOCS: Doc[] = [
  {
    title: "NDA Investigators v1.0",
    description:
      "Accord de confidentialité — programme Trusted Investigators",
    category: "LEGAL",
    version: "v1.0",
  },
  {
    title: "Terms of Service v1.0",
    description: "Conditions d'utilisation du programme investigators",
    category: "LEGAL",
    version: "v1.0",
  },
  {
    title: "Publishing Standard v1.0",
    description: "Standard éditorial — 3 buckets de preuves vérifiées",
    category: "LEGAL",
    version: "v1.0",
  },
  {
    title: "Pitch Deck Pre-seed",
    description: "Présentation investisseurs — €2M Post-money SAFE",
    category: "DATA_ROOM",
    version: "v1.0",
  },
  {
    title: "Modèle Financier",
    description: "Projections 3 ans — hypothèses et métriques clés",
    category: "DATA_ROOM",
    version: "v1.0",
  },
  {
    title: "Cap Table",
    description: "Structure de capitalisation — fondateurs + equity",
    category: "DATA_ROOM",
    version: "v1.0",
  },
  {
    title: "Methodology — TigerScore",
    description: "Documentation du moteur de scoring propriétaire",
    category: "OPS",
    version: "v1.0",
  },
  {
    title: "Retail Charter v1.0",
    description: "Charte de communication retail INTERLIGENS",
    category: "OPS",
    version: "v1.0",
  },
  {
    title: "Investigator Handbook",
    description: "Guide complet du programme Trusted Investigators",
    category: "OPS",
    version: "v1.0",
  },
];

const CAT_LABEL: Record<DocCategory, string> = {
  LEGAL: "Légal",
  DATA_ROOM: "Data Room",
  OPS: "Opérationnel",
};

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8,
  padding: 20,
  transition: "border-color 150ms",
};

export default function AdminDocumentsPage() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "LEGAL" as DocCategory,
    version: "",
    file: null as File | null,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#FFFFFF",
        padding: "32px 40px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          DOCUMENTS OFFICIELS
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.45)",
            marginTop: 6,
          }}
        >
          NDA · Terms · Data Room · Opérationnel
        </div>

        {/* 9 docs grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 32,
          }}
        >
          {DOCS.map((d) => (
            <div
              key={d.title}
              className="interligens-doc-card"
              style={CARD}
            >
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: ACCENT,
                  fontWeight: 700,
                }}
              >
                {CAT_LABEL[d.category]}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#FFFFFF",
                  fontWeight: 600,
                  marginTop: 8,
                }}
              >
                {d.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {d.description}
              </div>
              <button
                disabled
                style={{
                  marginTop: 14,
                  padding: "8px 12px",
                  background: "transparent",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  cursor: "not-allowed",
                }}
              >
                À uploader
              </button>
            </div>
          ))}
        </div>

        {/* Upload */}
        <div style={{ ...CARD, marginTop: 32 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: ACCENT,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Uploader un document
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Upload document:", form);
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <input
              type="text"
              placeholder="Nom"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              style={inputStyle}
            />
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as DocCategory })
              }
              style={inputStyle}
            >
              <option value="LEGAL">Légal</option>
              <option value="DATA_ROOM">Data Room</option>
              <option value="OPS">Opérationnel</option>
            </select>
            <input
              type="text"
              placeholder="Version (ex: v1.0)"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              style={inputStyle}
            />
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) =>
                setForm({ ...form, file: e.target.files?.[0] ?? null })
              }
              style={{ ...inputStyle, padding: 8 }}
            />
            <button
              type="submit"
              style={{
                padding: "10px 16px",
                background: ACCENT,
                color: "#000",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                justifySelf: "start",
              }}
            >
              Uploader
            </button>
          </form>
        </div>

        {/* Quick access */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 24,
          }}
        >
          <QuickLink href="https://data.interligens.com" label="Data Room" external />
          <QuickLink
            href="/investigators/box"
            label="Espace Investigators"
            external
          />
          <QuickLink href="/admin/intel-vault" label="Base documentaire" />
        </div>
      </div>

      <style>{`
        .interligens-doc-card:hover {
          border-color: rgba(255,107,0,0.3) !important;
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  padding: "10px 12px",
  color: "#fff",
  fontSize: 12,
  fontFamily: "inherit",
};

function QuickLink({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const style: React.CSSProperties = {
    display: "block",
    padding: "14px 18px",
    background: "rgba(255,107,0,0.06)",
    border: "1px solid rgba(255,107,0,0.2)",
    borderRadius: 8,
    color: ACCENT,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    textDecoration: "none",
    textAlign: "center" as const,
  };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
        {label} →
      </a>
    );
  }
  return (
    <a href={href} style={style}>
      {label} →
    </a>
  );
}
