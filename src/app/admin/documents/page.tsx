"use client";

import { useState } from "react";

type DocCategory = "LEGAL" | "DATA_ROOM" | "OPERATIONAL" | "EDITORIAL";

type DocCard = {
  title: string;
  description: string;
  category: DocCategory;
  version: string;
  url?: string;
};

const DOCS: DocCard[] = [
  {
    title: "NDA Investigators v1.0",
    description:
      "Accord de confidentialité — programme Trusted Investigators",
    category: "LEGAL",
    version: "v1.0",
  },
  {
    title: "Terms of Service v1.0",
    description:
      "Conditions d'utilisation du programme investigators",
    category: "LEGAL",
    version: "v1.0",
  },
  {
    title: "Publishing Standard v1.0",
    description:
      "Standard éditorial — 3 buckets de preuves vérifiées",
    category: "EDITORIAL",
    version: "v1.0",
  },
  {
    title: "Pitch Deck Pre-seed",
    description:
      "Présentation investisseurs — €2M Post-money SAFE",
    category: "DATA_ROOM",
    version: "2026-Q1",
  },
  {
    title: "Modèle Financier",
    description:
      "Projections 3 ans — hypothèses et métriques clés",
    category: "DATA_ROOM",
    version: "2026-Q1",
  },
  {
    title: "Cap Table",
    description:
      "Structure de capitalisation — fondateurs + equity investigators",
    category: "DATA_ROOM",
    version: "2026-Q1",
  },
  {
    title: "Methodology — TigerScore",
    description:
      "Documentation du moteur de scoring propriétaire",
    category: "OPERATIONAL",
    version: "v1.0",
  },
  {
    title: "Retail Charter v1.0",
    description:
      "Charte de communication retail INTERLIGENS",
    category: "OPERATIONAL",
    version: "v1.0",
  },
  {
    title: "Investigator Handbook",
    description:
      "Guide complet du programme Trusted Investigators",
    category: "OPERATIONAL",
    version: "v1.0",
  },
];

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.4)";
const MUTED = "rgba(255,255,255,0.25)";
const CARD_BG = "rgba(255,255,255,0.02)";
const CARD_BORDER = "rgba(255,255,255,0.06)";

const CATEGORY_LABEL: Record<DocCategory, string> = {
  LEGAL: "Légal",
  DATA_ROOM: "Data room",
  OPERATIONAL: "Opérationnel",
  EDITORIAL: "Éditorial",
};

const CATEGORY_COLOR: Record<DocCategory, string> = {
  LEGAL: ACCENT,
  DATA_ROOM: "rgba(255,255,255,0.8)",
  OPERATIONAL: "rgba(255,255,255,0.35)",
  EDITORIAL: ACCENT,
};

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: ACCENT,
  marginBottom: 16,
  marginTop: 36,
};

const CARD: React.CSSProperties = {
  background: CARD_BG,
  border: "1px solid " + CARD_BORDER,
  borderRadius: 8,
  padding: 20,
};

export default function AdminDocumentsPage() {
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DocCategory>("LEGAL");
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Persist wiring to /api/admin/documents/presign + PUT is scheduled for
    // a follow-up session. For now, log and reset so the form is functional.
    console.log("[admin/documents] upload submit (not yet wired)", {
      title: uploadName,
      description: uploadDesc,
      category: uploadCategory,
      version: uploadVersion,
      fileName: uploadFile?.name,
      fileSize: uploadFile?.size,
    });
    alert(
      "Metadata captured — R2 upload pipeline will be wired in a later session.",
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        padding: "40px 40px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 6,
          }}
        >
          DOCUMENTS OFFICIELS
        </div>
        <div style={{ fontSize: 12, color: DIM }}>
          NDA · Terms · Data Room · Opérationnel
        </div>

        {/* SECTION 1 — Hardcoded document cards */}
        <div style={SECTION_HEADER}>1 · Bibliothèque</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {DOCS.map((doc) => (
            <div
              key={doc.title}
              className="interligens-doc-card"
              style={CARD}
            >
              <div
                style={{
                  display: "inline-block",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: CATEGORY_COLOR[doc.category],
                  padding: "3px 8px",
                  border: "1px solid " + CATEGORY_COLOR[doc.category] + "55",
                  borderRadius: 3,
                  marginBottom: 10,
                  fontFamily: "monospace",
                }}
              >
                {CATEGORY_LABEL[doc.category]}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: TEXT,
                  lineHeight: 1.35,
                  marginBottom: 6,
                }}
              >
                {doc.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.55,
                  marginBottom: 12,
                  minHeight: 36,
                }}
              >
                {doc.description}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: MUTED,
                  fontFamily: "monospace",
                  marginBottom: 12,
                }}
              >
                {doc.version} · status : à uploader
              </div>
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    background: ACCENT,
                    color: BG,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    borderRadius: 4,
                    textDecoration: "none",
                  }}
                >
                  Télécharger PDF
                </a>
              ) : (
                <button
                  disabled
                  style={{
                    padding: "8px 14px",
                    background: "transparent",
                    color: DIM,
                    border: "1px solid " + CARD_BORDER,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    borderRadius: 4,
                    cursor: "not-allowed",
                  }}
                >
                  À uploader
                </button>
              )}
            </div>
          ))}
        </div>

        <style>{`
          .interligens-doc-card {
            transition: border-color 150ms;
          }
          .interligens-doc-card:hover {
            border-color: rgba(255,107,0,0.3) !important;
          }
        `}</style>

        {/* SECTION 2 — Upload new document */}
        <div style={SECTION_HEADER}>2 · Ajouter un document</div>
        <form onSubmit={handleUploadSubmit} style={CARD}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: DIM,
                  fontFamily: "monospace",
                }}
              >
                Nom
              </span>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                required
                style={{
                  background: "#0d0d0d",
                  border: "1px solid " + CARD_BORDER,
                  color: TEXT,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  borderRadius: 6,
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: DIM,
                  fontFamily: "monospace",
                }}
              >
                Version
              </span>
              <input
                type="text"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="v1.0"
                style={{
                  background: "#0d0d0d",
                  border: "1px solid " + CARD_BORDER,
                  color: TEXT,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  borderRadius: 6,
                }}
              />
            </label>
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: DIM,
                fontFamily: "monospace",
              }}
            >
              Description
            </span>
            <textarea
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              rows={3}
              style={{
                background: "#0d0d0d",
                border: "1px solid " + CARD_BORDER,
                color: TEXT,
                padding: "10px 12px",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                borderRadius: 6,
                resize: "vertical",
              }}
            />
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: DIM,
                  fontFamily: "monospace",
                }}
              >
                Catégorie
              </span>
              <select
                value={uploadCategory}
                onChange={(e) =>
                  setUploadCategory(e.target.value as DocCategory)
                }
                style={{
                  background: "#0d0d0d",
                  border: "1px solid " + CARD_BORDER,
                  color: TEXT,
                  padding: "10px 12px",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  borderRadius: 6,
                  appearance: "none",
                }}
              >
                <option value="LEGAL">Légal</option>
                <option value="DATA_ROOM">Data room</option>
                <option value="OPERATIONAL">Opérationnel</option>
                <option value="EDITORIAL">Éditorial</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: DIM,
                  fontFamily: "monospace",
                }}
              >
                Fichier (.pdf)
              </span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                style={{
                  background: "#0d0d0d",
                  border: "1px solid " + CARD_BORDER,
                  color: DIM,
                  padding: "8px 10px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  borderRadius: 6,
                }}
              />
            </label>
          </div>
          <button
            type="submit"
            style={{
              padding: "12px 22px",
              background: ACCENT,
              color: BG,
              border: "none",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 6,
            }}
          >
            Uploader
          </button>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              fontStyle: "italic",
              marginTop: 10,
            }}
          >
            Fichiers stockés sur Cloudflare R2. Pipeline d'upload à brancher
            dans une session dédiée.
          </div>
        </form>

        {/* SECTION 3 — Quick access */}
        <div style={SECTION_HEADER}>3 · Accès rapide</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href="https://data.interligens.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "12px 20px",
              background: CARD_BG,
              border: "1px solid " + CARD_BORDER,
              color: TEXT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Data Room →
          </a>
          <a
            href="/investigators/box"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "12px 20px",
              background: CARD_BG,
              border: "1px solid " + CARD_BORDER,
              color: TEXT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Espace Investigators →
          </a>
          <a
            href="/admin/intel-vault"
            style={{
              padding: "12px 20px",
              background: CARD_BG,
              border: "1px solid " + CARD_BORDER,
              color: TEXT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Base documentaire →
          </a>
        </div>
      </div>
    </main>
  );
}
