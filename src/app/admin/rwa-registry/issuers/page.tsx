"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PageShell,
  Crumbs,
  Card,
  StatusPill,
  PrimaryBtn,
} from "@/components/admin/rwa/RwaUi";

type Issuer = {
  id: string;
  slug: string;
  displayName: string;
  issuerType: string;
  status: string;
  jurisdictionCode: string | null;
  regulatoryStatus: string | null;
  assetCount: number;
};

export default function IssuersList() {
  const [items, setItems] = useState<Issuer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/rwa/issuers", {
        credentials: "include",
      });
      if (res.ok) {
        const j = (await res.json()) as { issuers: Issuer[] };
        setItems(j.issuers);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = q.trim()
    ? items.filter(
        (i) =>
          i.displayName.toLowerCase().includes(q.toLowerCase()) ||
          i.slug.toLowerCase().includes(q.toLowerCase()),
      )
    : items;

  return (
    <PageShell
      title="Issuers"
      sub="Every registered RWA issuer"
      right={
        <Link href="/admin/rwa-registry/issuers/new">
          <PrimaryBtn>+ New issuer</PrimaryBtn>
        </Link>
      }
    >
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          { label: "Issuers" },
        ]}
      />

      <input
        placeholder="Filter by name or slug"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
      />

      <Card title={`${filtered.length} issuer${filtered.length === 1 ? "" : "s"}`}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-gray-500 bg-[#0a0a0a]/50">
            <tr>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Type</th>
              <th className="text-left px-5 py-3">Jurisdiction</th>
              <th className="text-left px-5 py-3">Regulatory</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Assets</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr
                key={i.id}
                className="border-t border-gray-800/70 hover:bg-[#0a0a0a]/50"
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
                <td className="px-5 py-3 text-gray-400">
                  {i.regulatoryStatus ?? "—"}
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={i.status} />
                </td>
                <td className="px-5 py-3 text-right text-gray-300">
                  {i.assetCount}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-gray-500">
                  {items.length === 0 ? "No issuers yet." : "No matches."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
