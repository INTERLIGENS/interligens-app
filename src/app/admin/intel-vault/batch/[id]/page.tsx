// src/app/admin/intel-vault/batch/[id]/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface BatchData {
  id: string;
  status: string;
  inputType: string;
  totalRows: number;
  matchedAddrs: number;
  dedupedRows: number;
  warnings: string[];
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  chains: Record<string, number>;
  topLabels: Record<string, number>;
  sample: Array<{ chain: string; address: string; labelType: string; label: string; confidence: string; sourceName: string; evidence?: string }>;
}

function getAdminToken() {
  return document.cookie.split(";").find(c => c.trim().startsWith("admin_token="))?.split("=")[1] ?? "";
}

export default function BatchPreviewPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch(`/api/admin/batches/${id}`, {
      headers: { "x-admin-token": getAdminToken() },
    })
      .then(r => r.json())
      .then(setBatch)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    setApproving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/batches/${id}/approve`, {
        method: "POST",
        headers: { "x-admin-token": getAdminToken() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setSuccess(`✅ Approuvé — ${data.created} créés, ${data.updated} mis à jour`);
      setBatch(b => b ? { ...b, status: "approved" } : b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center text-sm">Chargement…</div>;
  if (!batch) return <div className="min-h-screen bg-gray-950 text-red-400 flex items-center justify-center text-sm">Batch introuvable</div>;

  const statusColor = batch.status === "approved" ? "text-green-400" : batch.status === "rejected" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => router.push("/admin/intel-vault")} className="text-gray-500 hover:text-gray-300 text-sm mb-2 block">← Retour</button>
            <h1 className="text-xl font-bold">Batch <span className="text-orange-400 font-mono text-base">{batch.id.slice(0, 12)}…</span></h1>
            <p className={`text-sm font-semibold mt-1 ${statusColor}`}>{batch.status.toUpperCase()}</p>
          </div>
          {batch.status === "pending" && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition"
            >
              {approving ? "Publication…" : "✅ Approuver & Publier"}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Lignes scannées", value: batch.totalRows },
            { label: "Adresses détectées", value: batch.matchedAddrs },
            { label: "Type d'import", value: batch.inputType },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{value}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Chains + Labels */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Chains</h3>
            {Object.entries(batch.chains).map(([c, n]) => (
              <div key={c} className="flex justify-between text-sm py-0.5">
                <span className="text-gray-300">{c}</span>
                <span className="text-orange-400 font-mono">{n}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Labels</h3>
            {Object.entries(batch.topLabels).map(([l, n]) => (
              <div key={l} className="flex justify-between text-sm py-0.5">
                <span className="text-gray-300">{l}</span>
                <span className="text-orange-400 font-mono">{n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings */}
        {batch.warnings.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-yellow-400 uppercase mb-2">⚠️ Avertissements</h3>
            {batch.warnings.map((w, i) => <p key={i} className="text-yellow-300 text-sm">{w}</p>)}
          </div>
        )}

        {/* Sample */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Aperçu — {batch.sample.length} premières lignes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left p-3">Adresse</th>
                  <th className="text-left p-3">Chain</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Confidence</th>
                  <th className="text-left p-3">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {batch.sample.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-3 font-mono text-orange-300">{row.address.slice(0, 10)}…</td>
                    <td className="p-3 text-gray-300">{row.chain}</td>
                    <td className="p-3 text-gray-300">{row.labelType}</td>
                    <td className="p-3 text-gray-300">{row.confidence}</td>
                    <td className="p-3 text-gray-500 truncate max-w-[180px]">{row.evidence ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">⚠️ {error}</div>}
        {success && <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-400 text-sm">{success}</div>}
      </div>
    </div>
  );
}
