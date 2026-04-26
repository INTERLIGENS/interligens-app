"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function IntakeDetail() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  async function load() {
    setLoading(true);
        const res = await fetch(`/api/admin/intake/${id}`, { credentials: "include", headers: { } });
    const data = await res.json();
    setRecord(data);
    setLoading(false);
  }

  async function action(act: string) {
    setActing(true); setMsg(null);
        const res = await fetch(`/api/admin/intake/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const data = await res.json();
    setMsg(res.ok ? `✓ ${act} done` : `✗ ${data.error}`);
    if (res.ok) load();
    setActing(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="min-h-screen bg-gray-950 text-white p-6">Loading...</div>;
  if (!record)  return <div className="min-h-screen bg-gray-950 text-white p-6">Not found</div>;

  const classColor: Record<string,string> = { ioc: "text-red-400", kol: "text-orange-300", mixed: "text-orange-400", rawdoc: "text-gray-400" };
  const ex = record.extracted ?? {};

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/admin/intake" className="text-sm text-gray-400 hover:text-orange-400 transition">← Inbox</Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400 font-mono">{id}</h1>
            <div className="flex gap-2 items-center mt-2">
              <span className={`inline-block px-2 py-0.5 rounded text-xs bg-gray-800 font-semibold ${classColor[record.classification] ?? "text-gray-400"}`}>
                {record.classification?.toUpperCase()}
              </span>
              <span className="text-gray-500 text-xs">v{record.extractVersion} · {new Date(record.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => action("rerun_extract")} disabled={acting}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
              ↻ Rerun Extract
            </button>
            {record.pendingBatch && (
              <button onClick={() => action("push_to_vault")} disabled={acting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-black transition">
                → Push to Vault
              </button>
            )}
            <button onClick={() => action("archive")} disabled={acting}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
              Archive
            </button>
          </div>
        </div>

        {msg && (
          <div className={`rounded-lg p-3 text-sm ${msg.startsWith("✓") ? "bg-gray-900 border border-gray-800 text-green-400" : "bg-red-900/30 border border-red-700 text-red-400"}`}>
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Provenance */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Provenance</h2>
            {[
              ["Source",     record.sourceRef ?? "—"],
              ["Submitted",  record.submittedBy ?? "—"],
              ["Parser",     record.parserUsed],
              ["Investigator", record.provenance?.investigatorHandle ?? "—"],
              ["Context",    record.provenance?.context ?? "—"],
              ["Tags",       (record.provenance?.tags ?? []).join(", ") || "—"],
            ].map(([l,v]) => (
              <div key={l as string} className="flex justify-between text-sm">
                <span className="text-gray-500">{l}</span>
                <span className="text-gray-300 max-w-[240px] text-right break-all">{v}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Extraction Stats</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Addresses",  ex.addressCount ?? ex.addresses?.length ?? 0],
                ["Handles",    ex.handleCount ?? ex.handles?.length ?? 0],
                ["Domains",    ex.domains?.length ?? 0],
                ["TX Hashes",  ex.txHashes?.length ?? 0],
                ["Confidence", record.routerConfidence ? (record.routerConfidence*100).toFixed(0)+"%" : "—"],
                ["Pending Batch", record.pendingBatch ? "YES" : "no"],
              ].map(([l,v]) => (
                <div key={l as string} className="bg-zinc-900 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">{l}</div>
                  <div className="text-lg font-bold text-white">{v}</div>
                </div>
              ))}
            </div>
            {record.linkedBatchId && (
              <Link href={`/admin/intel-vault/batch/${record.linkedBatchId}`}
                className="block mt-2 bg-orange-500 hover:bg-orange-400 text-black font-bold py-2 rounded-lg text-sm text-center transition">
                Review Batch in Intel Vault →
              </Link>
            )}
          </div>

          {/* Sample addresses */}
          {ex.addresses?.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Sample Addresses ({ex.addressCount ?? ex.addresses.length})</h2>
              {ex.addresses.slice(0,10).map((a: any, i: number) => (
                <div key={i} className="text-xs text-gray-400 font-mono">
                  <span className="text-gray-500 mr-2">{a.chain}</span>{a.address}
                </div>
              ))}
            </div>
          )}

          {/* Sample handles */}
          {ex.handles?.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Handles ({ex.handleCount ?? ex.handles.length})</h2>
              {ex.handles.slice(0,15).map((h: any, i: number) => (
                <div key={i} className="text-sm text-gray-300">{h.handle}</div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {record.warnings?.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-5 md:col-span-2 space-y-2">
              <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Warnings</h2>
              {record.warnings.map((w: string, i: number) => (
                <div key={i} className="text-sm text-red-400">⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
