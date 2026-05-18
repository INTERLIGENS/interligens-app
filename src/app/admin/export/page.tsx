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
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-orange-400">Export</h1>
          <p className="text-gray-400 text-sm">Address labels export options</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* CSV Export */}
          <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">CSV Download</h2>
            <p className="text-gray-400 text-sm">Download all active address labels as CSV. Instant, no setup required.</p>
            <button onClick={exportCsv}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition text-sm">
              ↓ Download CSV
            </button>
          </div>

          {/* Google Sheets Export */}
          <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Google Sheets</h2>

            {!process.env.NEXT_PUBLIC_SHEETS_CONFIGURED && (
              <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 text-sm text-gray-300">
                ⚙ Setup: add <code>GOOGLE_APPS_SCRIPT_URL</code> in Vercel env.<br/>
                <a href="https://developers.google.com/apps-script/guides/web" target="_blank" className="text-orange-400 hover:text-orange-300 transition">Apps Script guide →</a>
              </div>
            )}

            <div className="space-y-3">
              {[
                ["Chain", chain, setChain, "EVM / SOL / TRON"],
                ["Label Type", labelType, setLabelType, "scam / drainer / phishing"],
                ["Confidence", confidence, setConfidence, "low / medium / high"],
              ].map(([label, val, setter, placeholder]) => (
                <div key={label as string}>
                  <label className="text-xs text-gray-500 mb-1 block">{label as string} (optional)</label>
                  <input value={val as string} onChange={e => (setter as Function)(e.target.value)}
                    placeholder={placeholder as string}
                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
              ))}
            </div>

            <button onClick={exportSheets} disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition text-sm">
              {loading ? "Exporting..." : "→ Push to Google Sheets"}
            </button>

            {error && <div className="text-red-400 text-sm">✗ {error}</div>}
            {result && (
              <div className="bg-[#1a1a1a] rounded-lg p-3 text-sm text-green-400">
                ✓ {result.rowsExported} rows exported
                {result.sheetUrl && <><br/><a href={result.sheetUrl} target="_blank" className="text-orange-400 hover:text-orange-300 transition">Open Sheet →</a></>}
              </div>
            )}
          </div>
        </div>

        {/* Apps Script setup instructions */}
        <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Google Apps Script Setup</h2>
          <ol className="text-gray-400 text-sm leading-loose list-decimal pl-5">
            <li>Crée un Google Sheet vide</li>
            <li>Extensions → Apps Script</li>
            <li>Colle ce code et déploie comme "Web App" (accès : Anyone) :</li>
          </ol>
          <pre className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4 text-xs text-gray-400 overflow-auto">{`function doPost(e) {
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
          <div className="text-gray-500 text-sm">
            4. Copie l'URL de déploiement → Vercel env → <code className="text-orange-400">GOOGLE_APPS_SCRIPT_URL</code>
          </div>
        </div>
      </div>
    </div>
  );
}
