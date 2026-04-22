"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Issuer = {
  id: string;
  slug: string;
  displayName: string;
  issuerType: string;
  status: string;
  jurisdictionCode: string | null;
  assetCount: number;
};

export default function RwaRegistryDashboard() {
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [iRes, vRes] = await Promise.all([
        fetch("/api/admin/rwa/issuers", { credentials: "include" }),
        fetch("/api/admin/rwa/registry/bump-version", { credentials: "include" }),
      ]);
      if (!iRes.ok) throw new Error("issuers fetch failed");
      const iJson = (await iRes.json()) as { issuers: Issuer[] };
      setIssuers(iJson.issuers);
      if (vRes.ok) {
        const vJson = (await vRes.json()) as { registryVersion: number };
        setVersion(vJson.registryVersion);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalAssets = issuers.reduce((s, i) => s + i.assetCount, 0);
  const published = issuers.filter((i) => i.status === "PUBLISHED").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">RWA Registry</h1>
            <p className="text-gray-400 text-sm">
              Authenticity layer — issuers, assets, on-chain contracts
            </p>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {version !== null ? `registry v${version}` : "—"}
          </div>
        </div>

        {err && (
          <div className="rounded-lg p-3 text-sm bg-red-900/30 border border-red-700 text-red-400">
            {err}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Issuers" value={issuers.length} />
          <StatCard label="Published" value={published} />
          <StatCard label="Assets" value={totalAssets} />
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/rwa-registry/issuers"
            className="text-xs uppercase tracking-wider px-3 py-2 rounded border border-gray-700 hover:border-orange-500 hover:text-orange-400"
          >
            All issuers →
          </Link>
          <Link
            href="/admin/rwa-registry/issuers/new"
            className="text-xs uppercase tracking-wider px-3 py-2 rounded bg-orange-500 text-black font-semibold hover:bg-orange-400"
          >
            + New issuer
          </Link>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Recent issuers
            </h2>
            {loading && <span className="text-xs text-gray-500">Loading…</span>}
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-gray-500 bg-gray-900/50">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Jurisdiction</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Assets</th>
              </tr>
            </thead>
            <tbody>
              {issuers.slice(0, 20).map((i) => (
                <tr
                  key={i.id}
                  className="border-t border-gray-800/70 hover:bg-gray-900/50"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/rwa-registry/issuers/${i.id}`}
                      className="text-orange-400 hover:underline"
                    >
                      {i.displayName}
                    </Link>
                    <div className="text-xs text-gray-500 font-mono">{i.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{i.issuerType}</td>
                  <td className="px-5 py-3 text-gray-400">
                    {i.jurisdictionCode ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={i.status} />
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">
                    {i.assetCount}
                  </td>
                </tr>
              ))}
              {!loading && issuers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-gray-500">
                    No issuers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "PUBLISHED"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : status === "REVIEW"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : status === "DEPRECATED"
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : "bg-gray-700/30 text-gray-400 border-gray-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${color}`}
    >
      {status}
    </span>
  );
}
