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
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-[#FF6B00]">KOL Directory</h1>
            <p className="text-zinc-400 text-sm">{total} profiles</p>
          </div>
          <Link href="/admin/intake/new" className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#FF6B00] hover:bg-orange-400 text-black transition">
            + New Intake
          </Link>
        </div>

        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search @handle..."
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B00]"
        />

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                {["Handle","Tier","Price/Post","Platform","Label","Risk","Wallets","Source","Created"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-zinc-500">Loading...</td></tr>
              ) : profiles.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-zinc-500">No profiles</td></tr>
              ) : profiles.map((p: any) => {
                const wallets = JSON.parse(p.wallets || "[]");
                const intakeIds = JSON.parse(p.sourceIntakeIds || "[]");
                return (
                  <tr key={p.id} className="border-b border-zinc-800 hover:bg-white/5 transition">
                    <td className="py-2 px-3 text-[#FF6B00] font-semibold">{p.handle}</td>
                    <td className="py-2 px-3">
                      {p.tier ? <span className="inline-block px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 font-semibold">{p.tier}</span> : <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="py-2 px-3 text-green-400 font-semibold">{p.pricePerPost ? `$${p.pricePerPost.toLocaleString()}` : "—"}</td>
                    <td className="py-2 px-3 text-zinc-400">{p.platform}</td>
                    <td className="py-2 px-3">
                      <span className="text-zinc-300 font-semibold">{p.label}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-zinc-400">{p.riskFlag}</span>
                    </td>
                    <td className="py-2 px-3 text-zinc-400">{wallets.length || "—"}</td>
                    <td className="py-2 px-3">
                      {intakeIds[0] ? (
                        <Link href={`/admin/intake/${intakeIds[0]}`} className="text-[#FF6B00] hover:text-orange-300 transition">→ intake</Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3 text-zinc-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition">← Prev</button>
          <span className="text-zinc-500 text-sm py-1.5">Page {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={profiles.length < 25}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition">Next →</button>
        </div>
      </div>
    </div>
  );
}
