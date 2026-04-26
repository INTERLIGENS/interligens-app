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
  GhostBtn,
  Msg,
  Field,
  inputCls,
} from "@/components/admin/rwa/RwaUi";

type Event = {
  id: string;
  eventType: string;
  summary: string;
  actor: string;
  createdAt: string;
};

type Source = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  capturedAt: string;
  isPrimaryEvidence: boolean;
  notes: string | null;
};

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
  verificationDate: string | null;
  lastCheckedAt: string | null;
  supersededByContractId: string | null;
  supersededBy: { id: string; contractAddressRaw: string; chainKey: string } | null;
  supersedes: { id: string; contractAddressRaw: string; chainKey: string }[];
  asset: {
    id: string;
    symbol: string;
    name: string;
    issuer: { id: string; slug: string; displayName: string };
  };
  sources: Source[];
  verificationEvents: Event[];
};

export default function ContractDetail() {
  const params = useParams();
  const id = params?.id as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{
    tokenStandard: string;
    isPrimary: boolean;
  }>({ tokenStandard: "", isPrimary: false });

  async function load() {
    const res = await fetch(`/api/admin/rwa/contracts/${id}`, {
      credentials: "include",
    });
    if (res.ok) {
      const j = (await res.json()) as { contract: Contract };
      setContract(j.contract);
      setEdit({
        tokenStandard: j.contract.tokenStandard ?? "",
        isPrimary: j.contract.isPrimary,
      });
    } else {
      setMsg("✗ Contract not found");
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/rwa/contracts/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    const j = (await res.json()) as { error?: string };
    setMsg(res.ok ? "✓ Saved" : `✗ ${j.error ?? "Save failed"}`);
    setSaving(false);
    if (res.ok) load();
  }

  if (!contract) {
    return (
      <PageShell title="Contract" sub="Loading…">
        <Msg msg={msg} />
      </PageShell>
    );
  }

  const ab = contract.contractAddressRaw;
  const short = ab.length > 16 ? `${ab.slice(0, 8)}…${ab.slice(-6)}` : ab;

  return (
    <PageShell
      title={`Contract ${short}`}
      sub={`${contract.chainKey} · asset ${contract.asset.symbol}`}
      right={
        <div className="flex gap-2 items-center">
          <StatusPill status={contract.verificationStatus} />
          {contract.isPrimary && (
            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 uppercase tracking-wider">
              primary
            </span>
          )}
          {contract.isDeprecated && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 uppercase tracking-wider">
              deprecated
            </span>
          )}
        </div>
      }
    >
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          {
            label: contract.asset.issuer.displayName,
            href: `/admin/rwa-registry/issuers/${contract.asset.issuer.id}`,
          },
          {
            label: contract.asset.symbol,
            href: `/admin/rwa-registry/assets/${contract.asset.id}`,
          },
          { label: short },
        ]}
      />
      <Msg msg={msg} />

      <Card title="On-chain">
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <KV k="Chain" v={<span className="font-mono">{contract.chainKey}</span>} />
          <KV k="Family" v={contract.chainFamily} />
          <KV
            k="Address (raw)"
            v={<span className="font-mono break-all">{contract.contractAddressRaw}</span>}
          />
          <KV
            k="Address (normalized)"
            v={<span className="font-mono break-all">{contract.contractAddressNorm}</span>}
          />
          <KV k="Verified at" v={fmt(contract.verificationDate)} />
          <KV k="Last checked" v={fmt(contract.lastCheckedAt)} />
          {contract.supersededBy && (
            <div className="md:col-span-2 text-xs text-gray-400">
              Superseded by{" "}
              <Link
                href={`/admin/rwa-registry/contracts/${contract.supersededBy.id}`}
                className="text-orange-400 hover:underline font-mono"
              >
                {contract.supersededBy.contractAddressRaw} ({contract.supersededBy.chainKey})
              </Link>
            </div>
          )}
          {contract.supersedes.length > 0 && (
            <div className="md:col-span-2 text-xs text-gray-400">
              Supersedes:{" "}
              {contract.supersedes.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link
                    href={`/admin/rwa-registry/contracts/${s.id}`}
                    className="text-orange-400 hover:underline font-mono"
                  >
                    {s.contractAddressRaw}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Edit">
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Token standard">
            <input
              className={inputCls}
              value={edit.tokenStandard}
              onChange={(e) =>
                setEdit({ ...edit, tokenStandard: e.target.value })
              }
              placeholder="ERC-20, SPL, …"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-300 mt-6">
            <input
              type="checkbox"
              checked={edit.isPrimary}
              onChange={(e) => setEdit({ ...edit, isPrimary: e.target.checked })}
            />
            Primary contract for this chain
          </label>
        </div>
        <div className="p-5 border-t border-gray-800 flex gap-2">
          <PrimaryBtn onClick={save} disabled={saving}>
            Save changes
          </PrimaryBtn>
          <Link href={`/admin/rwa-registry/contracts/${id}/verify`}>
            <GhostBtn>Verify</GhostBtn>
          </Link>
          <Link href={`/admin/rwa-registry/contracts/${id}/deprecate`}>
            <GhostBtn danger>Deprecate</GhostBtn>
          </Link>
          <Link href={`/admin/rwa-registry/contracts/${id}/migrate`}>
            <GhostBtn>Migrate</GhostBtn>
          </Link>
        </div>
      </Card>

      <Card title={`Verification events (${contract.verificationEvents.length})`}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-gray-500 bg-[#0a0a0a]">
            <tr>
              <th className="text-left px-5 py-3">When</th>
              <th className="text-left px-5 py-3">Type</th>
              <th className="text-left px-5 py-3">Summary</th>
              <th className="text-left px-5 py-3">Actor</th>
            </tr>
          </thead>
          <tbody>
            {contract.verificationEvents.map((e) => (
              <tr key={e.id} className="border-t border-gray-800/70">
                <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                  {fmt(e.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={e.eventType} />
                </td>
                <td className="px-5 py-3 text-gray-300">{e.summary}</td>
                <td className="px-5 py-3 text-gray-500">{e.actor}</td>
              </tr>
            ))}
            {contract.verificationEvents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-gray-500">
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title={`Sources (${contract.sources.length})`}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-gray-500 bg-[#0a0a0a]">
            <tr>
              <th className="text-left px-5 py-3">Type</th>
              <th className="text-left px-5 py-3">URL</th>
              <th className="text-left px-5 py-3">Captured</th>
              <th className="text-left px-5 py-3">Primary</th>
            </tr>
          </thead>
          <tbody>
            {contract.sources.map((s) => (
              <tr key={s.id} className="border-t border-gray-800/70">
                <td className="px-5 py-3 text-gray-400">{s.sourceType}</td>
                <td className="px-5 py-3">
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-400 hover:underline text-xs break-all"
                  >
                    {s.sourceUrl}
                  </a>
                </td>
                <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                  {fmt(s.capturedAt)}
                </td>
                <td className="px-5 py-3 text-gray-400">
                  {s.isPrimaryEvidence ? "★" : ""}
                </td>
              </tr>
            ))}
            {contract.sources.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-gray-500">
                  No sources captured.
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

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return d;
  }
}
