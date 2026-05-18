"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  handle: string;
  tier: string | null;
  publishStatus: string;
  pdfUrl: string | null;
  pdfGeneratedAt: string | null;
  pdfScore: number | null;
  pdfVersion: number;
  lastHeliusScan: string | null;
};

type RegenState = { status: "idle" | "loading" | "done" | "error"; message?: string };

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toISOString().slice(0, 16).replace("T", " ");
}

function scoreBadgeClasses(score: number | null): string {
  if (score == null) return "bg-[#1a1a1a] text-gray-400";
  if (score >= 60) return "bg-green-900/40 text-green-300 border border-green-800";
  if (score >= 30) return "bg-orange-900/40 text-orange-300 border border-orange-800";
  return "bg-red-900/40 text-red-300 border border-red-800";
}

export default function AdminPdfPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regenAll, setRegenAll] = useState<RegenState>({ status: "idle" });
  const [perRow, setPerRow] = useState<Record<string, RegenState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pdf/list", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const regenOne = async (handle: string) => {
    setPerRow((p) => ({ ...p, [handle]: { status: "loading" } }));
    try {
      const res = await fetch("/api/internal/pdf/regen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ handle }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setPerRow((p) => ({ ...p, [handle]: { status: "done", message: `score ${data.score}/100` } }));
      await load();
    } catch (e) {
      setPerRow((p) => ({
        ...p,
        [handle]: { status: "error", message: e instanceof Error ? e.message : "erreur" },
      }));
    }
  };

  const regenAllProfiles = async () => {
    setRegenAll({ status: "loading" });
    try {
      const res = await fetch("/api/internal/pdf/regen?handle=all", { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRegenAll({
        status: "done",
        message: `${data.succeeded}/${data.count} régénérés`,
      });
      await load();
    } catch (e) {
      setRegenAll({ status: "error", message: e instanceof Error ? e.message : "erreur" });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">PDF Dossiers</h1>
            <p className="text-gray-400 text-sm">
              Génération automatique des PDFs d'intelligence — triggered par cron Helius 72h
            </p>
          </div>
          <button
            onClick={regenAllProfiles}
            disabled={regenAll.status === "loading"}
            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-lg transition text-sm"
          >
            {regenAll.status === "loading" ? "Régénération en cours…" : "Tout régénérer"}
          </button>
        </div>

        {regenAll.status === "done" && regenAll.message && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-400 text-sm">
            ✓ {regenAll.message}
          </div>
        )}
        {regenAll.status === "error" && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            ⚠️ {regenAll.message}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Profils ({rows.length})
          </h2>
          {loading ? (
            <div className="text-gray-500 text-sm">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="text-gray-500 text-sm">Aucun profil.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="text-left py-2 px-3 font-semibold">Handle</th>
                  <th className="text-left py-2 px-3 font-semibold">Tier</th>
                  <th className="text-left py-2 px-3 font-semibold">Status</th>
                  <th className="text-left py-2 px-3 font-semibold">Score</th>
                  <th className="text-left py-2 px-3 font-semibold">Version</th>
                  <th className="text-left py-2 px-3 font-semibold">Généré le</th>
                  <th className="text-left py-2 px-3 font-semibold">Helius scan</th>
                  <th className="text-right py-2 px-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const state = perRow[r.handle] || { status: "idle" };
                  return (
                    <tr key={r.handle} className="border-b border-gray-800 hover:bg-gray-900/50 transition">
                      <td className="py-2 px-3 font-mono text-orange-400">@{r.handle}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] text-gray-300">
                          {r.tier || "—"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-400">{r.publishStatus}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${scoreBadgeClasses(r.pdfScore)}`}>
                          {r.pdfScore ?? "—"}/100
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-500">v{r.pdfVersion}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{fmt(r.pdfGeneratedAt)}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{fmt(r.lastHeliusScan)}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-2">
                          {r.pdfUrl && (
                            <a
                              href={r.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] text-gray-300 hover:bg-gray-700 transition"
                            >
                              PDF ↗
                            </a>
                          )}
                          <button
                            onClick={() => regenOne(r.handle)}
                            disabled={state.status === "loading"}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black transition"
                          >
                            {state.status === "loading" ? "…" : "Régénérer"}
                          </button>
                        </div>
                        {state.status === "error" && (
                          <div className="text-xs text-red-400 mt-1">{state.message}</div>
                        )}
                        {state.status === "done" && state.message && (
                          <div className="text-xs text-green-400 mt-1">✓ {state.message}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
