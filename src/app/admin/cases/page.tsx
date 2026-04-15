"use client";
import { useEffect, useState } from "react";

const BUCKET_LABEL: Record<string, string> = {
  BLATANT: "BLATANT",
  PROBABLE: "PROBABLE",
  POSSIBLE: "POSSIBLE",
};

export default function CasesPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter) params.set("severity", filter);
      const r = await fetch(`/api/admin/signals?${params}`);
      const data = await r.json();
      setSignals(data.signals ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page); }, [page, filter]);

  async function generateCasefile(signalId: string) {
    setGenerating(signalId);
    try {
      const r = await fetch("/api/admin/casefiles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId }),
      });
      const data = await r.json();
      if (data.storageKey) {
        alert(`Casefile generated\nSHA256: ${data.pdfSha256}`);
      }
    } catch (e) {
      alert("Error generating casefile");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-orange-400">Cases</h1>
          <p className="text-gray-400 text-sm">{total} signal{total !== 1 ? "s" : ""} detected</p>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex gap-2 flex-wrap">
            {["", "danger", "warn", "info"].map(s => (
              <button key={s} onClick={() => { setFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === s ? "bg-orange-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
                {s || "ALL"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : signals.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
            No signals detected yet.<br/>
            <span className="text-xs mt-2 block">Signals are generated when a wallet sells a token shortly after a post mentioning its contract address.</span>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  {["Handle", "Bucket", "Window", "Token", "TX Hash", "Detected", "Action"].map(h => (
                    <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-900/50 transition">
                    <td className="py-2 px-3 text-white font-semibold">{s.influencer?.handle}</td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-800 text-orange-400 font-semibold">
                        {BUCKET_LABEL[s.windowBucket ?? ""] ?? s.windowBucket ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">{s.windowMinutes ? `${s.windowMinutes}m` : "—"}</td>
                    <td className="py-2 px-3 text-gray-400 font-mono">
                      {s.tokenAddress ? `${s.tokenAddress.slice(0, 8)}...` : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {s.t1TxHash ? (
                        <a href={`https://etherscan.io/tx/${s.t1TxHash}`} target="_blank" className="text-orange-400 hover:text-orange-300 transition">
                          {s.t1TxHash.slice(0, 10)}...
                        </a>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3">
                      <button onClick={() => generateCasefile(s.id)} disabled={generating === s.id}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition">
                        {generating === s.id ? "..." : "Generate PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 25 && (
          <div className="flex gap-2 justify-end">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition">Prev</button>
            <span className="py-1.5 text-gray-500 text-sm">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={signals.length < 25}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
