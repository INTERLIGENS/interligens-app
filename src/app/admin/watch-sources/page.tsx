"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function WatchSources() {
  const [sources, setSources]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [name, setName]         = useState("");
  const [url, setUrl]           = useState("");
  const [investigator, setInv]  = useState("@zachxbt");
  const [tags, setTags]         = useState("");
  const [msg, setMsg]           = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/watch-sources", { credentials: "include" });
    const data = await res.json();
    setSources(data.sources ?? []);
    setLoading(false);
  }

  async function addSource() {
    setAdding(true); setMsg(null);
    const res = await fetch("/api/admin/watch-sources", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, investigator, tags: tags.split(",").map(t => t.trim()).filter(Boolean) }),
    });
    const data = await res.json();
    if (res.ok) { setMsg("Source added"); setName(""); setUrl(""); setTags(""); load(); }
    else setMsg(`Error: ${data.error}`);
    setAdding(false);
  }

  async function checkNow(id: string) {
    setChecking(id); setMsg(null);
    const res = await fetch(`/api/admin/watch-sources/${id}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_now" }),
    });
    const data = await res.json();
    setMsg(data.intakeId ? `New content detected → intake ${data.intakeId}` : "No changes detected");
    setChecking(null);
    load();
  }

  async function removeSource(id: string) {
    await fetch(`/api/admin/watch-sources/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-[#FF6B00]">Watch Sources</h1>
          <p className="text-zinc-400 text-sm">Auto-monitored URLs — checked every 6h</p>
        </div>

        {msg && (
          <div className={`rounded-lg p-3 text-sm ${msg.startsWith("Error") ? "bg-red-950 border border-red-800 text-red-400" : "bg-[#0a0a0a] border border-zinc-800 text-green-400"}`}>
            {msg}
          </div>
        )}

        {/* Add form */}
        <div className="bg-[#0a0a0a] rounded-xl border border-zinc-800 p-5 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Add Source</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (ex: ZachXBT Scam List)"
              className="w-full bg-[#1a1a1a] border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B00]" />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/..."
              className="md:col-span-2 w-full bg-[#1a1a1a] border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B00]" />
            <input value={investigator} onChange={e => setInv(e.target.value)} placeholder="@investigator"
              className="w-full bg-[#1a1a1a] border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B00]" />
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tags (comma-sep: scam, drainer)"
              className="md:col-span-2 w-full bg-[#1a1a1a] border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B00]" />
          </div>
          <button onClick={addSource} disabled={adding || !name || !url}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#FF6B00] hover:bg-orange-400 disabled:opacity-50 text-black transition">
            {adding ? "Adding..." : "+ Add"}
          </button>
        </div>

        {/* Sources list */}
        <div className="bg-[#0a0a0a] rounded-xl border border-zinc-800 p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                {["Name","URL","Investigator","Last Checked","Last Intake","Errors","Actions"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-zinc-500">Loading...</td></tr>
              ) : sources.filter(s => s.active).length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-zinc-500">No sources yet</td></tr>
              ) : sources.filter(s => s.active).map((s: any) => (
                <tr key={s.id} className="border-b border-zinc-800 hover:bg-white/5 transition">
                  <td className="py-2 px-3 text-white font-semibold">{s.name}</td>
                  <td className="py-2 px-3 text-zinc-500 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{s.url}</td>
                  <td className="py-2 px-3 text-[#FF6B00]">{s.investigator}</td>
                  <td className="py-2 px-3 text-zinc-500">{s.lastChecked ? new Date(s.lastChecked).toLocaleString() : "never"}</td>
                  <td className="py-2 px-3">
                    {s.lastIntakeId ? <Link href={`/admin/intake/${s.lastIntakeId}`} className="text-[#FF6B00] hover:text-orange-300 transition">→ view</Link> : "—"}
                  </td>
                  <td className={`py-2 px-3 ${s.errorCount > 0 ? "text-red-400" : "text-zinc-500"}`}>{s.errorCount || "—"}</td>
                  <td className="py-2 px-3 flex gap-2">
                    <button onClick={() => checkNow(s.id)} disabled={checking === s.id}
                      className="px-2 py-1 rounded text-xs bg-[#1a1a1a] text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition">
                      {checking === s.id ? "..." : "Check Now"}
                    </button>
                    <button onClick={() => removeSource(s.id)}
                      className="px-2 py-1 rounded text-xs bg-[#1a1a1a] text-red-400 hover:bg-zinc-700 transition">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
