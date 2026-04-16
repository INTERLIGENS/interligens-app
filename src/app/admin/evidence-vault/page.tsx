"use client";

import { useState } from "react";

const ACCENT = "#FF6B00";

type EvidenceItem = {
  nom: string;
  affaire: "VINE" | "BOTIFY" | "DRAIN";
  date: string;
  hash: string;
  statut: "CONSTATE" | "ATTRIBUE" | "A_CONFIRMER";
  note: string;
  path: string;
};

const EVIDENCE: EvidenceItem[] = [
  {
    nom: "document_interne_botify_original.pdf",
    affaire: "BOTIFY",
    date: "2026-04-16",
    hash: "c29122cbda2bf90568259cdaf6b55b60152950a8773e30809574529959770feb",
    statut: "A_CONFIRMER",
    note: "Document BOTIFY complet 15 pages — PIÈCE MAÎTRESSE — pitch deck + 40+ KOLs + F&F + dépenses TX Solscan",
    path: "evidence/botify/document_interne_botify_original.pdf",
  },
  {
    nom: "INTERLIGENS_DRAIN_PRINT.pdf",
    affaire: "DRAIN",
    date: "2026-04-16",
    hash: "1e2bab6db4cbe260b3e79bbaa16246b385c3c066fa13bb8f66d8e046ff01f0ba",
    statut: "CONSTATE",
    note: "Dossier judiciaire DRAIN — version impression BEFTI",
    path: "evidence/drain/INTERLIGENS_DRAIN_PRINT.pdf",
  },
  {
    nom: "INTERLIGENS_DRAIN_SCREEN.pdf",
    affaire: "DRAIN",
    date: "2026-04-16",
    hash: "18e2a5bac9c803684e92cd54b12295bd3510e81bae8da7c70defe29a88908814",
    statut: "CONSTATE",
    note: "Dossier judiciaire DRAIN — version écran INTERLIGENS",
    path: "evidence/drain/INTERLIGENS_DRAIN_SCREEN.pdf",
  },
  {
    nom: "INTERLIGENS_VINE_PRINT.pdf",
    affaire: "VINE",
    date: "2026-04-16",
    hash: "bf50434c72fff745d2a754230b190b4d2b8b024844ae0ef1d09434cd03f31ec5",
    statut: "CONSTATE",
    note: "Dossier judiciaire VINE — version impression BEFTI",
    path: "evidence/vine/INTERLIGENS_VINE_PRINT.pdf",
  },
  {
    nom: "INTERLIGENS_VINE_SCREEN.pdf",
    affaire: "VINE",
    date: "2026-04-16",
    hash: "3771a58f924e48089a7b0bce33f268029bd27fcfdc9534751e070380d1817a3e",
    statut: "CONSTATE",
    note: "Dossier judiciaire VINE — version écran INTERLIGENS",
    path: "evidence/vine/INTERLIGENS_VINE_SCREEN.pdf",
  },
  {
    nom: "INTERLIGENS_BOTIFY_PRINT.pdf",
    affaire: "BOTIFY",
    date: "2026-04-16",
    hash: "8bec2037706b539a93efb51ec41fa00169f3008b9fd92fdb288316e2caf4af3c",
    statut: "CONSTATE",
    note: "Dossier judiciaire BOTIFY — version impression BEFTI",
    path: "evidence/botify/INTERLIGENS_BOTIFY_PRINT.pdf",
  },
  {
    nom: "INTERLIGENS_BOTIFY_SCREEN.pdf",
    affaire: "BOTIFY",
    date: "2026-04-16",
    hash: "a7d4fa9fe01f9389d6665bc25cf533ee63ab8a50e86a45b5e07a1e326f3773d7",
    statut: "CONSTATE",
    note: "Dossier judiciaire BOTIFY — version écran INTERLIGENS",
    path: "evidence/botify/INTERLIGENS_BOTIFY_SCREEN.pdf",
  },
];

function statutBadge(s: EvidenceItem["statut"]) {
  const map = {
    CONSTATE: { color: "#2d7a2d", label: "CONSTATÉ" },
    ATTRIBUE: { color: ACCENT, label: "ATTRIBUÉ" },
    A_CONFIRMER: { color: "#888", label: "À CONFIRMER" },
  };
  const m = map[s];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 9,
        fontWeight: 700,
        color: m.color,
        border: `1px solid ${m.color}`,
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {m.label}
    </span>
  );
}

function affaireBadge(a: string) {
  const colors: Record<string, string> = {
    VINE: "#9B59B6",
    BOTIFY: ACCENT,
    DRAIN: "#E74C3C",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 9,
        fontWeight: 700,
        color: "#fff",
        background: colors[a] || "#666",
        borderRadius: 4,
      }}
    >
      {a}
    </span>
  );
}

function generateInventaire(): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  let txt = `=== INVENTAIRE DES PIÈCES À CONVICTION ===\n`;
  txt += `Généré par INTERLIGENS — app.interligens.com\n`;
  txt += `Date : ${now} UTC\n\n`;
  txt += `Ce fichier certifie l'intégrité des pièces à conviction au ${now}.\n`;
  txt += `Conserver avec les dossiers imprimés.\n\n`;
  txt += `${"=".repeat(80)}\n\n`;

  for (const e of EVIDENCE) {
    txt += `[${e.affaire}] ${e.nom}\n`;
    txt += `  Date d'ajout : ${e.date}\n`;
    txt += `  SHA-256 : ${e.hash}\n`;
    txt += `  Statut : ${e.statut}\n`;
    txt += `  Note : ${e.note}\n`;
    txt += `  R2 path : ${e.path}\n\n`;
  }

  txt += `${"=".repeat(80)}\n`;
  txt += `Total : ${EVIDENCE.length} pièces\n`;
  txt += `CONFIDENTIEL — Usage judiciaire uniquement\n`;
  return txt;
}

export default function EvidenceVaultPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(e: EvidenceItem) {
    setDownloading(e.path);
    try {
      const res = await fetch(`/api/pdf/${encodeURIComponent(e.path)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const blob = await fetch(`/api/pdf/${encodeURIComponent(e.nom)}`, {
          credentials: "same-origin",
        }).then((r) => r.blob());
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = e.nom;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        window.open(res.url, "_blank");
      }
    } catch {
      alert(`Download failed for ${e.nom}`);
    } finally {
      setDownloading(null);
    }
  }

  function handleDownloadInventaire() {
    const txt = generateInventaire();
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `INVENTAIRE_PIECES_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "32px 40px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          EVIDENCE VAULT
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
          Pièces à conviction — stockées R2 — intégrité SHA-256
        </div>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            {EVIDENCE.length} pièces · {EVIDENCE.filter((e) => e.statut === "CONSTATE").length} constatées · {EVIDENCE.filter((e) => e.statut === "A_CONFIRMER").length} à confirmer
          </div>
          <button
            onClick={handleDownloadInventaire}
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.04)",
              color: ACCENT,
              border: `1px solid ${ACCENT}`,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            Générer INVENTAIRE.txt
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                {["Fichier", "Affaire", "Date", "SHA-256", "Statut", "Note", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 10px",
                        background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.55)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {EVIDENCE.map((e) => (
                <tr
                  key={e.path}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <td style={{ padding: "10px", fontWeight: 600, color: "#fff" }}>
                    {e.nom}
                  </td>
                  <td style={{ padding: "10px" }}>{affaireBadge(e.affaire)}</td>
                  <td style={{ padding: "10px", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                    {e.date}
                  </td>
                  <td
                    style={{
                      padding: "10px",
                      fontFamily: "Menlo, monospace",
                      fontSize: 9,
                      color: "rgba(255,255,255,0.45)",
                      maxWidth: 180,
                      wordBreak: "break-all",
                    }}
                  >
                    {e.hash.slice(0, 16)}…{e.hash.slice(-8)}
                  </td>
                  <td style={{ padding: "10px" }}>{statutBadge(e.statut)}</td>
                  <td
                    style={{
                      padding: "10px",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.55)",
                      maxWidth: 200,
                    }}
                  >
                    {e.note}
                  </td>
                  <td style={{ padding: "10px" }}>
                    <button
                      onClick={() => handleDownload(e)}
                      disabled={downloading === e.path}
                      style={{
                        padding: "5px 10px",
                        background: ACCENT,
                        color: "#000",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: downloading === e.path ? 0.5 : 1,
                      }}
                    >
                      {downloading === e.path ? "…" : "DL"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 32,
            padding: 14,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1.6,
          }}
        >
          Les pièces sont stockées sur Cloudflare R2 (bucket <code>interligens-reports</code>). Les hash SHA-256 sont calculés localement avant upload et certifient l'intégrité de chaque fichier. Le bouton "Générer INVENTAIRE.txt" produit un fichier texte téléchargeable listant toutes les pièces avec leurs hash — à conserver avec les dossiers imprimés pour la BEFTI.
        </div>
      </div>
    </div>
  );
}
