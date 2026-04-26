// src/app/admin/intel-vault/review/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface BatchSummary {
  id: string;
  status: string;
  inputType: string;
  matchedAddrs: number;
  createdAt: string;
  warnings: string[];
}



export default function ReviewPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch batches list — we reuse the batches API indirectly
    // For now, load a placeholder list (full pagination endpoint can be added later)
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/admin/intel-vault")} className="text-gray-500 hover:text-gray-300 text-sm mb-2 block">← Nouveau import</button>
            <h1 className="text-xl font-bold text-orange-400">Batches en quarantaine</h1>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Chargement…</p>
        ) : batches.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            Aucun batch en attente.<br />
            <button onClick={() => router.push("/admin/intel-vault")} className="mt-3 text-orange-400 hover:text-orange-300">
              Importer une source →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(b => (
              <div
                key={b.id}
                onClick={() => router.push(`/admin/intel-vault/batch/${b.id}`)}
                className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-orange-500/50 transition"
              >
                <div>
                  <p className="font-mono text-sm text-gray-300">{b.id.slice(0, 16)}…</p>
                  <p className="text-xs text-gray-500 mt-1">{b.inputType} · {b.matchedAddrs} adresses · {new Date(b.createdAt).toLocaleDateString()}</p>
                  {b.warnings.length > 0 && <p className="text-xs text-yellow-400 mt-1">⚠️ {b.warnings[0]}</p>}
                </div>
                <span className="text-yellow-400 text-xs font-semibold">{b.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
