"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_PILL: Record<string,string> = {
  pending:      "bg-zinc-800 text-yellow-400",
  routed:       "bg-zinc-800 text-green-400",
  needs_manual: "bg-zinc-800 text-orange-400",
  archived:     "bg-zinc-800 text-zinc-400",
  failed:       "bg-zinc-800 text-red-400",
};
const CLASS_PILL: Record<string,string> = {
  ioc:    "text-red-400",
  kol:    "text-orange-300",
  mixed:  "text-orange-400",
  rawdoc: "text-zinc-400",
};

export default function IntakeInbox() {
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState("");
  const [classification, setCls] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (classification) params.set("classification", classification);
    const res = await fetch(`/api/admin/intake?${params}`, { credentials: "include" });
    const data = await res.json();
    setRecords(data.records ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, status, classification]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-[#FF6B00]">Intake Inbox</h1>
            <p className="text-zinc-400 text-sm">{total} records</p>
          </div>
          <Link href="/admin/intake/new" className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#FF6B00] hover:bg-orange-400 text-black transition">
            + New Intake
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {["","pending","routed","needs_manual","archived","failed"].map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${status === s ? "bg-[#FF6B00] text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                {s || "All"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {["","ioc","kol","mixed","rawdoc"].map(c => (
              <button key={c} onClick={() => { setCls(c); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${classification === c ? "bg-[#FF6B00] text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                {c || "All types"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                {["Status","Type","Source","Classification","Confidence","Warnings","Batch","Created",""].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-zinc-500">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-zinc-500">No records</td></tr>
              ) : records.map((r: any) => {
                const warns = JSON.parse(r.extractWarnings || "[]");
                return (
                  <tr key={r.id} className="border-b border-zinc-800 hover:bg-white/5 transition">
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_PILL[r.status] ?? "bg-zinc-800 text-zinc-400"}`}>{r.status}</span>
                    </td>
                    <td className="py-2 px-3 text-zinc-400">{r.inputType}</td>
                    <td className="py-2 px-3 text-zinc-300 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{r.sourceRef ?? "—"}</td>
                    <td className="py-2 px-3">
                      <span className={`font-semibold ${CLASS_PILL[r.classification] ?? "text-zinc-400"}`}>{r.classification ?? "—"}</span>
                    </td>
                    <td className="py-2 px-3 text-zinc-400">{r.routerConfidence ? (r.routerConfidence * 100).toFixed(0) + "%" : "—"}</td>
                    <td className={`py-2 px-3 ${warns.length ? "text-orange-400" : "text-zinc-500"}`}>{warns.length ? warns.length + " ⚠" : "—"}</td>
                    <td className="py-2 px-3">
                      {r.linkedBatchId ? (
                        <Link href={`/admin/intel-vault/batch/${r.linkedBatchId}`} className="text-[#FF6B00] hover:text-orange-300 transition">→ batch</Link>
                      ) : r.pendingBatch ? <span className="text-orange-400">pending</span> : "—"}
                    </td>
                    <td className="py-2 px-3 text-zinc-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 px-3">
                      <Link href={`/admin/intake/${r.id}`} className="text-[#FF6B00] hover:text-orange-300 transition font-semibold">View →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition">← Prev</button>
          <span className="text-zinc-500 text-sm py-1.5">Page {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={records.length < 25}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition">Next →</button>
        </div>
      </div>
    </div>
  );
}
