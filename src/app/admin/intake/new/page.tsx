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

  const classColor: Record<string,string> = { ioc: "text-red-400", kol: "text-orange-300", mixed: "text-orange-400", rawdoc: "text-gray-400" };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/admin/intake" className="text-sm text-gray-400 hover:text-orange-400 transition">← Inbox</Link>

        <div>
          <h1 className="text-2xl font-bold text-orange-400">New Intake</h1>
          <p className="text-gray-400 text-sm">Paste a URL, upload a file, or paste raw text. The system extracts + routes automatically.</p>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["url","file","text"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition uppercase ${tab === t ? "bg-orange-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Input */}
          {tab === "url" && (
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://raw.githubusercontent.com/... or Google Sheets URL"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
          )}
          {tab === "text" && (
            <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
              placeholder="Paste addresses, handles, or any text..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono" />
          )}
          {tab === "file" && (
            <div>
              <input type="file" accept=".pdf,.csv,.json,.txt" onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" />
              {file && <div className="text-green-400 text-xs mt-2">✓ {file.name} ({(file.size/1024).toFixed(1)} KB)</div>}
            </div>
          )}
        </div>

        {/* Provenance */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Provenance (optional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Investigator</label>
              <input value={investigator} onChange={e => setInv(e.target.value)} placeholder="@zachxbt"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tags</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="drainer, rug, scam (comma-sep)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Context</label>
            <input value={context} onChange={e => setCtx(e.target.value)} placeholder="Context (e.g. 'Binance bridge exploit report')"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
          </div>
        </div>

        <button onClick={submit} disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition text-sm">
          {loading ? "PROCESSING..." : "SUBMIT INTAKE →"}
        </button>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            ⚠ {error}
          </div>
        )}

        {result && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs bg-gray-800 font-semibold mr-2 ${classColor[result.classification] ?? "text-gray-400"}`}>
                  {result.classification?.toUpperCase()}
                </span>
                <span className="text-gray-500 text-xs">{(result.routerConfidence * 100).toFixed(0)}% confidence</span>
              </div>
              <span className={`text-sm font-semibold ${result.status === "routed" ? "text-green-400" : "text-orange-400"}`}>{result.status}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                ["Addresses", result.addressCount],
                ["Handles",   result.handleCount],
                ["Batch",     result.linkedBatchId ? "✓" : result.pendingBatch ? "pending" : "—"],
                ["Warnings",  result.warnings?.length ?? 0],
              ].map(([l, v]) => (
                <div key={l as string} className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{l}</div>
                  <div className="text-xl font-bold text-white">{v}</div>
                </div>
              ))}
            </div>
            {result.warnings?.length > 0 && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                {result.warnings.map((w: string, i: number) => <div key={i} className="text-orange-400 text-xs">⚠ {w}</div>)}
              </div>
            )}
            <div className="flex gap-2">
              <Link href={`/admin/intake/${result.intakeId}`} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
                View Record →
              </Link>
              {result.linkedBatchId && (
                <Link href={`/admin/intel-vault/batch/${result.linkedBatchId}`} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-black transition">
                  Review Batch →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
