
"use client";
import { useEffect, useState } from "react";

interface Submission {
  id: string; createdAt: string; chain: string; address: string;
  labelType: string; label: string | null; message: string | null;
  evidenceUrl: string | null; txHash: string | null;
  severityDerived: string; status: string;
}

const SEV_COLOR: Record<string, string> = {
  danger: "text-red-400", warn: "text-yellow-400", info: "text-blue-400",
};

export default function SubmissionsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async (s: string) => {
    setLoading(true);
    const r = await fetch(`/api/admin/submissions?status=${s}`, {
      credentials: "same-origin",
    });
    const d = await r.json();
    setItems(d.submissions ?? []);
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const act = async (id: string, action: string) => {
    await fetch(`/api/admin/submissions/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action, adminNotes: note[id] ?? "" }),
    });
    load(filter);
  };

  return (
    <div className="p-6 text-white min-h-screen bg-zinc-950">
      <h1 className="text-2xl font-black mb-4">Community Submissions</h1>
      <div className="flex gap-2 mb-6">
        {["pending","approved","rejected","needs_info"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded text-xs font-bold uppercase ${filter === s ? "bg-orange-500" : "bg-zinc-800 hover:bg-zinc-700"}`}>
            {s}
          </button>
        ))}
      </div>
      {loading && <p className="text-zinc-500">Loading...</p>}
      {!loading && items.length === 0 && <p className="text-zinc-500">No submissions.</p>}
      <div className="flex flex-col gap-3">
        {items.map(s => (
          <div key={s.id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-black uppercase ${SEV_COLOR[s.severityDerived]}`}>{s.severityDerived}</span>
              <span className="text-xs text-zinc-400">{s.chain}</span>
              <code className="text-xs text-zinc-300 font-mono">{s.address}</code>
              <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{s.labelType}</span>
            </div>
            {s.message && <p className="text-xs text-zinc-400 mb-1">"{s.message}"</p>}
            {s.txHash && <p className="text-xs text-zinc-500 mb-1">tx: {s.txHash}</p>}
            {s.evidenceUrl && <p className="text-xs text-zinc-500 mb-1">evidence: {s.evidenceUrl}</p>}
            <p className="text-xs text-zinc-600 mb-2">{new Date(s.createdAt).toLocaleString()}</p>
            {s.status === "pending" && (
              <div className="flex gap-2 items-center">
                <input
                  className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white w-48"
                  placeholder="Admin note (optional)"
                  value={note[s.id] ?? ""}
                  onChange={e => setNote(n => ({ ...n, [s.id]: e.target.value }))}
                />
                <button onClick={() => act(s.id, "approve")}
                  className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-bold">Approve</button>
                <button onClick={() => act(s.id, "needs_info")}
                  className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-xs font-bold">Needs Info</button>
                <button onClick={() => act(s.id, "reject")}
                  className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs font-bold">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
