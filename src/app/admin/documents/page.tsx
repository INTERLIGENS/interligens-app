"use client";

import { useState, useEffect } from "react";

type DocCategory = "LEGAL" | "DATA_ROOM" | "OPERATIONAL" | "EDITORIAL";
type UploadPhase = "idle" | "presigning" | "uploading" | "saving" | "done" | "error";

type DbDoc = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  version: string | null;
  r2Key: string | null;
  r2Url: string | null;
  status: string;
  createdAt: string;
};

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
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dbDocs, setDbDocs] = useState<DbDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const adminToken =
    typeof window !== "undefined"
      ? (document.cookie.match(/admin_token=([^;]+)/)?.[1] ?? "")
      : "";

  useEffect(() => {
    fetch("/api/admin/documents", {
      headers: { "x-admin-token": adminToken },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.documents) setDbDocs(d.documents); })
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [adminToken]);

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) { setUploadError("Sélectionnez un fichier."); return; }

    setUploadPhase("presigning");
    setUploadError(null);

    try {
      // Step 1 — get presigned PUT URL from R2
      const presignRes = await fetch(
        `/api/admin/documents/presign?filename=${encodeURIComponent(uploadFile.name)}&mimeType=${encodeURIComponent(uploadFile.type || "application/pdf")}`,
        { headers: { "x-admin-token": adminToken } },
      );
      if (!presignRes.ok) throw new Error(`Presign ${presignRes.status}`);
      const { uploadUrl, r2Key, publicUrl } = await presignRes.json();

      // Step 2 — PUT file directly to Cloudflare R2
      setUploadPhase("uploading");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: uploadFile,
        headers: { "Content-Type": uploadFile.type || "application/pdf" },
      });
      if (!putRes.ok) throw new Error(`R2 PUT ${putRes.status}`);

      // Step 3 — persist metadata row in DB
      setUploadPhase("saving");
      const saveRes = await fetch("/api/admin/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({
          title: uploadName.trim(),
          description: uploadDesc.trim() || null,
          category: uploadCategory,
          version: uploadVersion.trim() || null,
          r2Key,
          r2Url: publicUrl,
          status: "uploaded",
        }),
      });
      if (!saveRes.ok) throw new Error(`Save ${saveRes.status}`);
      const { document: newDoc } = await saveRes.json();

      setDbDocs((prev) => [newDoc, ...prev]);
      setUploadPhase("done");
      setUploadName("");
      setUploadDesc("");
      setUploadVersion("");
      setUploadFile(null);
      setTimeout(() => setUploadPhase("idle"), 3000);
    } catch (err: unknown) {
      setUploadPhase("error");
      setUploadError(err instanceof Error ? err.message : "Upload échoué");
    }
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

        {/* SECTION 1 — Live documents from DB (fallback: hardcoded placeholders) */}
        <div style={SECTION_HEADER}>1 · Bibliothèque</div>
        {docsLoading ? (
          <div style={{ fontSize: 12, color: DIM, fontFamily: "monospace" }}>Chargement…</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {(dbDocs.length > 0
              ? dbDocs.map((doc) => ({
                  title: doc.title,
                  description: doc.description ?? "",
                  category: (doc.category in CATEGORY_LABEL
                    ? doc.category
                    : "OPERATIONAL") as DocCategory,
                  version: doc.version ?? "",
                  url: doc.r2Url ?? undefined,
                  status: doc.status as string,
                }))
              : DOCS.map((doc) => ({ ...doc, status: "à uploader" as string }))
            ).map((doc, i) => (
              <div
                key={i}
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
                  {doc.version} · {doc.status}
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
        )}

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
            disabled={uploadPhase !== "idle" && uploadPhase !== "error"}
            style={{
              padding: "12px 22px",
              background: uploadPhase === "done" ? "#22c55e" : ACCENT,
              color: BG,
              border: "none",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: uploadPhase !== "idle" && uploadPhase !== "error" ? "not-allowed" : "pointer",
              borderRadius: 6,
              opacity: uploadPhase !== "idle" && uploadPhase !== "error" && uploadPhase !== "done" ? 0.7 : 1,
            }}
          >
            {uploadPhase === "presigning" ? "Presigning…"
              : uploadPhase === "uploading" ? "Upload R2…"
              : uploadPhase === "saving" ? "Enregistrement…"
              : uploadPhase === "done" ? "Enregistré"
              : "Uploader"}
          </button>
          {uploadError && (
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontFamily: "monospace" }}>
              {uploadError}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              fontStyle: "italic",
              marginTop: 10,
            }}
          >
            Fichiers stockés sur Cloudflare R2 · URL publique enregistrée en base.
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
