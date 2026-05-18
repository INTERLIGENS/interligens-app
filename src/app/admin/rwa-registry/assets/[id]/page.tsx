"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  PageShell,
  Crumbs,
  Card,
  StatusPill,
  PrimaryBtn,
} from "@/components/admin/rwa/RwaUi";

type Contract = {
  id: string;
  chainKey: string;
  chainFamily: string;
  contractAddressRaw: string;
  contractAddressNorm: string;
  tokenStandard: string | null;
  isPrimary: boolean;
  isDeprecated: boolean;
  verificationStatus: string;
  supersededByContractId: string | null;
};

type Asset = {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  underlyingReference: string | null;
  isinOrEquivalent: string | null;
  cusipOrEquivalent: string | null;
  officialProductUrl: string | null;
  isActive: boolean;
  issuer: { id: string; slug: string; displayName: string; status: string };
  contracts: Contract[];
};

export default function AssetDetail() {
  const params = useParams();
  const id = params?.id as string;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/rwa/assets/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const j = (await res.json()) as { asset: Asset };
        setAsset(j.asset);
      } else {
        setErr("Asset not found");
      }
    })();
  }, [id]);

  if (!asset) {
    return (
      <PageShell title="Asset" sub="Loading…">
        {err && <div className="text-red-400 text-sm">{err}</div>}
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`${asset.symbol} — ${asset.name}`}
      sub={`${asset.assetClass} · issued by ${asset.issuer.displayName}`}
      right={
        <div className="flex gap-2 items-center">
          <StatusPill status={asset.issuer.status} />
          <Link
            href={`/admin/rwa-registry/assets/${asset.id}/contracts/new`}
          >
            <PrimaryBtn>+ New contract</PrimaryBtn>
          </Link>
        </div>
      }
    >
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          { label: "Issuers", href: "/admin/rwa-registry/issuers" },
          {
            label: asset.issuer.displayName,
            href: `/admin/rwa-registry/issuers/${asset.issuer.id}`,
          },
          { label: asset.symbol },
        ]}
      />

      <Card title="Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <KV k="Symbol" v={<span className="font-mono">{asset.symbol}</span>} />
          <KV k="Name" v={asset.name} />
          <KV k="Class" v={asset.assetClass} />
          <KV k="Active" v={asset.isActive ? "yes" : "no"} />
          <KV k="Underlying" v={asset.underlyingReference ?? "—"} />
          <KV k="ISIN / equivalent" v={asset.isinOrEquivalent ?? "—"} />
          <KV k="CUSIP / equivalent" v={asset.cusipOrEquivalent ?? "—"} />
          <KV
            k="Product URL"
            v={
              asset.officialProductUrl ? (
                <a
                  href={asset.officialProductUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-400 hover:underline break-all"
                >
                  {asset.officialProductUrl}
                </a>
              ) : (
                "—"
              )
            }
          />
        </div>
      </Card>

      <Card title={`Contracts (${asset.contracts.length})`}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-gray-500 bg-[#0a0a0a]">
            <tr>
              <th className="text-left px-5 py-3">Chain</th>
              <th className="text-left px-5 py-3">Address</th>
              <th className="text-left px-5 py-3">Standard</th>
              <th className="text-left px-5 py-3">Primary</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {asset.contracts.map((c) => (
              <tr
                key={c.id}
                className="border-t border-gray-800/70 hover:bg-[#0a0a0a]"
              >
                <td className="px-5 py-3 font-mono text-gray-400">
                  {c.chainKey}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/rwa-registry/contracts/${c.id}`}
                    className="text-orange-400 hover:underline font-mono text-xs break-all"
                  >
                    {c.contractAddressRaw}
                  </Link>
                </td>
                <td className="px-5 py-3 text-gray-400">
                  {c.tokenStandard ?? "—"}
                </td>
                <td className="px-5 py-3 text-gray-300">
                  {c.isPrimary ? "★" : ""}
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={c.verificationStatus} />
                </td>
              </tr>
            ))}
            {asset.contracts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-gray-500">
                  No contracts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500">{k}</div>
      <div className="text-gray-200">{v}</div>
    </div>
  );
}
