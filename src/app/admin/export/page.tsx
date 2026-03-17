"use client";
import { useState } from "react";

export default function ExportPage() {
  const [chain, setChain]           = useState("");
  const [labelType, setLabelType]   = useState("");
  const [confidence, setConfidence] = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [error, setError]           = useState<string | null>(null);

  async function exportCsv() {
    const params = new URLSearchParams({ format: "csv" });
    window.open(`/api/admin/export/address-labels?${params}`, "_blank");
  }

  async function exportSheets() {
    setLoading(true); setError(null); setResult(null);
    const filter: Record<string,string> = {};
    if (chain)      filter.chain      = chain;
    if (labelType)  filter.labelType  = labelType;
    if (confidence) filter.confidence = confidence;

    const res = await fetch("/api/admin/export/sheets", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: Object.keys(filter).length ? filter : undefined }),
    });
    const data = await res.json();
    if (res.ok) setResult(data);
    else setError(data.error ?? "Error");
    setLoading(false);
  }

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: "32px", fontFamily: "monospace" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 4 }}>INTEL VAULT</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>EXPORT</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>

        {/* CSV Export */}
        <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>CSV DOWNLOAD</div>
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Download all active address labels as CSV. Instant, no setup required.</p>
          <button onClick={exportCsv}
            style={{ width: "100%", background: "#14532d", color: "#4ade80", border: "1px solid #14532d", borderRadius: 8, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ↓ Download CSV
          </button>
        </div>

        {/* Google Sheets Export */}
        <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>GOOGLE SHEETS</div>

          {!process.env.NEXT_PUBLIC_SHEETS_CONFIGURED && (
            <div style={{ background: "#1e1b4b", border: "1px solid #4f46e533", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#a5b4fc" }}>
              ⚙ Setup: add <code>GOOGLE_APPS_SCRIPT_URL</code> in Vercel env.<br/>
              <a href="https://developers.google.com/apps-script/guides/web" target="_blank" style={{ color: "#818cf8" }}>Apps Script guide →</a>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {[
              ["Chain", chain, setChain, "EVM / SOL / TRON"],
              ["Label Type", labelType, setLabelType, "scam / drainer / phishing"],
              ["Confidence", confidence, setConfidence, "low / medium / high"],
            ].map(([label, val, setter, placeholder]) => (
              <div key={label as string}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label as string} (optional)</div>
                <input value={val as string} onChange={e => (setter as Function)(e.target.value)}
                  placeholder={placeholder as string}
                  style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", color: "#f1f5f9", fontSize: 12, boxSizing: "border-box" }} />
              </div>
            ))}
          </div>

          <button onClick={exportSheets} disabled={loading}
            style={{ width: "100%", background: loading ? "#334155" : "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Exporting..." : "→ Push to Google Sheets"}
          </button>

          {error && <div style={{ marginTop: 12, color: "#fca5a5", fontSize: 12 }}>✗ {error}</div>}
          {result && (
            <div style={{ marginTop: 12, background: "#14532d", borderRadius: 8, padding: 12, fontSize: 12, color: "#4ade80" }}>
              ✓ {result.rowsExported} rows exported
              {result.sheetUrl && <><br/><a href={result.sheetUrl} target="_blank" style={{ color: "#86efac" }}>Open Sheet →</a></>}
            </div>
          )}
        </div>
      </div>

      {/* Apps Script setup instructions */}
      <div style={{ marginTop: 32, background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 24, maxWidth: 900 }}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>GOOGLE APPS SCRIPT SETUP</div>
        <ol style={{ color: "#94a3b8", fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
          <li>Crée un Google Sheet vide</li>
          <li>Extensions → Apps Script</li>
          <li>Colle ce code et déploie comme "Web App" (accès : Anyone) :</li>
        </ol>
        <pre style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 16, fontSize: 11, color: "#94a3b8", overflow: "auto", marginTop: 12 }}>{`function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(data.sheetName);
  if (!sheet) sheet = ss.insertSheet(data.sheetName);
  sheet.clearContents();
  sheet.appendRow(data.headers);
  data.rows.forEach(row => sheet.appendRow(row));
  return ContentService
    .createTextOutput(JSON.stringify({ sheetUrl: ss.getUrl() }))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
        <div style={{ marginTop: 12, color: "#64748b", fontSize: 12 }}>
          4. Copie l'URL de déploiement → Vercel env → <code style={{ color: "#a5b4fc" }}>GOOGLE_APPS_SCRIPT_URL</code>
        </div>
      </div>
    </div>
  );
}
