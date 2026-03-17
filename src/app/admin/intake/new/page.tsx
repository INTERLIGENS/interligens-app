"use client";
import { useState } from "react";
import Link from "next/link";

type Tab = "url" | "file" | "text";

export default function NewIntake() {
  const [tab, setTab]           = useState<Tab>("url");
  const [url, setUrl]           = useState("");
  const [text, setText]         = useState("");
  const [file, setFile]         = useState<File | null>(null);
  const [investigator, setInv]  = useState("");
  const [context, setCtx]       = useState("");
  const [tags, setTags]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [error, setError]       = useState<string | null>(null);

  async function submit() {
    setLoading(true); setError(null); setResult(null);
        const provenance = { investigatorHandle: investigator || "david", context, tags: tags ? tags.split(",").map(t => t.trim()) : [] };

    try {
      let res: Response;
      if (tab === "file" && file) {
        const fd = new FormData();
        fd.append("type", "file");
        fd.append("file", file);
        fd.append("provenance", JSON.stringify(provenance));
        res = await fetch("/api/admin/intake", { method: "POST", credentials: "include", headers: { }, body: fd });
      } else {
        const body = tab === "url"
          ? { type: "url", url, provenance }
          : { type: "text", text, provenance };
        res = await fetch("/api/admin/intake", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error"); return; }
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const clrMap: Record<string,string> = { ioc: "#ef4444", kol: "#8b5cf6", mixed: "#f97316", rawdoc: "#6b7280" };

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: "32px", fontFamily: "monospace", maxWidth: 720, margin: "0 auto" }}>
      <Link href="/admin/intake" style={{ color: "#4f46e5", textDecoration: "none", fontSize: 13 }}>← Inbox</Link>

      <h1 style={{ fontSize: 22, fontWeight: 900, margin: "16px 0 4px" }}>New Intake</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>Paste a URL, upload a file, or paste raw text. The system extracts + routes automatically.</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#1e293b", borderRadius: 8, padding: 4, width: "fit-content" }}>
        {(["url","file","text"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? "#4f46e5" : "transparent", color: tab === t ? "#fff" : "#94a3b8", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        {tab === "url" && (
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/... or Google Sheets URL"
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "12px 16px", color: "#f1f5f9", fontSize: 13, boxSizing: "border-box" }} />
        )}
        {tab === "text" && (
          <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
            placeholder="Paste addresses, handles, or any text..."
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "12px 16px", color: "#f1f5f9", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
        )}
        {tab === "file" && (
          <div>
            <input type="file" accept=".pdf,.csv,.json,.txt" onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ color: "#94a3b8", fontSize: 13 }} />
            {file && <div style={{ color: "#22c55e", fontSize: 12, marginTop: 8 }}>✓ {file.name} ({(file.size/1024).toFixed(1)} KB)</div>}
          </div>
        )}
      </div>

      {/* Provenance */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>PROVENANCE (optional)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input value={investigator} onChange={e => setInv(e.target.value)} placeholder="@zachxbt"
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13 }} />
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="drainer, rug, scam (comma-sep)"
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13 }} />
        </div>
        <input value={context} onChange={e => setCtx(e.target.value)} placeholder="Context (e.g. 'Binance bridge exploit report')"
          style={{ marginTop: 12, width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13, boxSizing: "border-box" }} />
      </div>

      <button onClick={submit} disabled={loading}
        style={{ width: "100%", background: loading ? "#334155" : "#4f46e5", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.05em" }}>
        {loading ? "PROCESSING..." : "SUBMIT INTAKE →"}
      </button>

      {error && (
        <div style={{ marginTop: 16, background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 10, padding: 16, color: "#fca5a5", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, background: "#0f2027", border: "1px solid " + (clrMap[result.classification] ?? "#334155") + "55", borderRadius: 10, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span style={{ background: (clrMap[result.classification] ?? "#334155") + "33", color: clrMap[result.classification] ?? "#94a3b8", padding: "4px 12px", borderRadius: 6, fontWeight: 900, fontSize: 13, marginRight: 8 }}>
                {result.classification?.toUpperCase()}
              </span>
              <span style={{ color: "#6b7280", fontSize: 12 }}>{(result.routerConfidence * 100).toFixed(0)}% confidence</span>
            </div>
            <span style={{ color: result.status === "routed" ? "#22c55e" : "#f97316", fontWeight: 700, fontSize: 13 }}>{result.status}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
            {[
              ["Addresses", result.addressCount],
              ["Handles",   result.handleCount],
              ["Batch",     result.linkedBatchId ? "✓" : result.pendingBatch ? "pending" : "—"],
              ["Warnings",  result.warnings?.length ?? 0],
            ].map(([l, v]) => (
              <div key={l as string} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#f1f5f9" }}>{v}</div>
              </div>
            ))}
          </div>
          {result.warnings?.length > 0 && (
            <div style={{ background: "#451a03", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
              {result.warnings.map((w: string, i: number) => <div key={i} style={{ color: "#fb923c", fontSize: 12 }}>⚠ {w}</div>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/admin/intake/${result.intakeId}`} style={{ background: "#1e293b", color: "#60a5fa", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
              View Record →
            </Link>
            {result.linkedBatchId && (
              <Link href={`/admin/intel-vault/batch/${result.linkedBatchId}`} style={{ background: "#1e293b", color: "#22c55e", padding: "8px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                Review Batch →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
