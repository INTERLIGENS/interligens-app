"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function KolDirectory() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/kol?${params}`, { credentials: "include" });
    const data = await res.json();
    setProfiles(data.profiles ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, search]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">KOL Directory</h1>
            <p className="text-gray-400 text-sm">{total} profiles</p>
          </div>
          <Link href="/admin/intake/new" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-black transition">
            + New Intake
          </Link>
        </div>

        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search @handle..."
          className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
        />

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                {["Handle","Tier","Price/Post","Platform","Label","Risk","Wallets","Source","Created"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-500">Loading...</td></tr>
              ) : profiles.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-500">No profiles</td></tr>
              ) : profiles.map((p: any) => {
                const wallets = JSON.parse(p.wallets || "[]");
                const intakeIds = JSON.parse(p.sourceIntakeIds || "[]");
                return (
                  <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-900/50 transition">
                    <td className="py-2 px-3 text-orange-400 font-semibold">{p.handle}</td>
                    <td className="py-2 px-3">
                      {p.tier ? <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 font-semibold">{p.tier}</span> : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="py-2 px-3 text-green-400 font-semibold">{p.pricePerPost ? `$${p.pricePerPost.toLocaleString()}` : "—"}</td>
                    <td className="py-2 px-3 text-gray-400">{p.platform}</td>
                    <td className="py-2 px-3">
                      <span className="text-gray-300 font-semibold">{p.label}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-gray-400">{p.riskFlag}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">{wallets.length || "—"}</td>
                    <td className="py-2 px-3">
                      {intakeIds[0] ? (
                        <Link href={`/admin/intake/${intakeIds[0]}`} className="text-orange-400 hover:text-orange-300 transition">→ intake</Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition">← Prev</button>
          <span className="text-gray-500 text-sm py-1.5">Page {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={profiles.length < 25}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition">Next →</button>
        </div>
      </div>
    </div>
  );
}
