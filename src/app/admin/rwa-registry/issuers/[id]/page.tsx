"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  PageShell,
  Crumbs,
  Card,
  StatusPill,
  Field,
  PrimaryBtn,
  GhostBtn,
  Msg,
  inputCls,
} from "@/components/admin/rwa/RwaUi";

const ISSUER_TYPES = [
  "ASSET_MANAGER",
  "PLATFORM",
  "SPV",
  "REAL_ESTATE_ISSUER",
  "BANK",
  "OTHER",
];
const ISSUER_STATUS = ["DRAFT", "REVIEW", "PUBLISHED", "DEPRECATED"];
const ASSET_CLASSES = [
  "STOCKS",
  "TREASURIES",
  "REAL_ESTATE",
  "CREDIT",
  "COMMODITY",
  "YIELD",
  "MONEY_MARKET",
];

type Asset = {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  isActive: boolean;
  contractCount: number;
};

type Issuer = {
  id: string;
  slug: string;
  displayName: string;
  legalEntityName: string | null;
  issuerType: string;
  jurisdictionCode: string | null;
  regulatoryStatus: string | null;
  websiteUrl: string | null;
  status: string;
  riskNotesInternal: string | null;
  assets: Asset[];
};

export default function IssuerDetail() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [issuer, setIssuer] = useState<Issuer | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newAsset, setNewAsset] = useState({
    symbol: "",
    name: "",
    assetClass: "STOCKS",
    officialProductUrl: "",
  });

  async function load() {
    const res = await fetch(`/api/admin/rwa/issuers/${id}`, {
      credentials: "include",
    });
    if (res.ok) {
      const j = (await res.json()) as { issuer: Issuer };
      setIssuer(j.issuer);
    } else {
      setMsg("✗ Issuer not found");
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function save() {
    if (!issuer) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/rwa/issuers/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: issuer.displayName,
        slug: issuer.slug,
        legalEntityName: issuer.legalEntityName,
        issuerType: issuer.issuerType,
        jurisdictionCode: issuer.jurisdictionCode,
        regulatoryStatus: issuer.regulatoryStatus,
        websiteUrl: issuer.websiteUrl,
        riskNotesInternal: issuer.riskNotesInternal,
        status: issuer.status,
      }),
    });
    const j = (await res.json()) as { error?: string };
    setMsg(res.ok ? "✓ Saved" : `✗ ${j.error ?? "Save failed"}`);
    setSaving(false);
    if (res.ok) load();
  }

  async function publish() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/rwa/issuers/${id}/publish`, {
      method: "POST",
      credentials: "include",
    });
    const j = (await res.json()) as { registryVersion?: number; error?: string };
    setMsg(
      res.ok
        ? `✓ Published — registry v${j.registryVersion}`
        : `✗ ${j.error ?? "Publish failed"}`,
    );
    setSaving(false);
    if (res.ok) load();
  }

  async function addAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!newAsset.symbol || !newAsset.name) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/rwa/assets", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issuerId: id, ...newAsset }),
    });
    const j = (await res.json()) as { error?: string };
    if (res.ok) {
      setNewAsset({ symbol: "", name: "", assetClass: "STOCKS", officialProductUrl: "" });
      setMsg("✓ Asset added");
      load();
    } else {
      setMsg(`✗ ${j.error ?? "Add failed"}`);
    }
    setSaving(false);
  }

  if (!issuer) {
    return (
      <PageShell title="Issuer" sub="Loading…">
        <Msg msg={msg} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={issuer.displayName}
      sub={`${issuer.issuerType} · slug ${issuer.slug}`}
      right={
        <div className="flex gap-2 items-center">
          <StatusPill status={issuer.status} />
          {issuer.status !== "PUBLISHED" && (
            <PrimaryBtn onClick={publish} disabled={saving}>
              Publish
            </PrimaryBtn>
          )}
        </div>
      }
    >
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          { label: "Issuers", href: "/admin/rwa-registry/issuers" },
          { label: issuer.displayName },
        ]}
      />
      <Msg msg={msg} />

      <Card title="Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Display name">
            <input
              className={inputCls}
              value={issuer.displayName}
              onChange={(e) =>
                setIssuer({ ...issuer, displayName: e.target.value })
              }
            />
          </Field>
          <Field label="Slug">
            <input
              className={inputCls}
              value={issuer.slug}
              onChange={(e) => setIssuer({ ...issuer, slug: e.target.value })}
            />
          </Field>
          <Field label="Legal entity">
            <input
              className={inputCls}
              value={issuer.legalEntityName ?? ""}
              onChange={(e) =>
                setIssuer({ ...issuer, legalEntityName: e.target.value })
              }
            />
          </Field>
          <Field label="Issuer type">
            <select
              className={inputCls}
              value={issuer.issuerType}
              onChange={(e) =>
                setIssuer({ ...issuer, issuerType: e.target.value })
              }
            >
              {ISSUER_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Jurisdiction">
            <input
              className={inputCls}
              value={issuer.jurisdictionCode ?? ""}
              onChange={(e) =>
                setIssuer({ ...issuer, jurisdictionCode: e.target.value })
              }
            />
          </Field>
          <Field label="Regulatory status">
            <input
              className={inputCls}
              value={issuer.regulatoryStatus ?? ""}
              onChange={(e) =>
                setIssuer({ ...issuer, regulatoryStatus: e.target.value })
              }
            />
          </Field>
          <Field label="Website">
            <input
              className={inputCls}
              value={issuer.websiteUrl ?? ""}
              onChange={(e) =>
                setIssuer({ ...issuer, websiteUrl: e.target.value })
              }
            />
          </Field>
          <Field label="Status">
            <select
              className={inputCls}
              value={issuer.status}
              onChange={(e) => setIssuer({ ...issuer, status: e.target.value })}
            >
              {ISSUER_STATUS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Risk notes (internal)">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={issuer.riskNotesInternal ?? ""}
                onChange={(e) =>
                  setIssuer({ ...issuer, riskNotesInternal: e.target.value })
                }
              />
            </Field>
          </div>
        </div>
        <div className="p-5 border-t border-gray-800">
          <PrimaryBtn onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </PrimaryBtn>
        </div>
      </Card>

      <Card title={`Assets (${issuer.assets.length})`}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-gray-500 bg-gray-900/50">
            <tr>
              <th className="text-left px-5 py-3">Symbol</th>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Class</th>
              <th className="text-right px-5 py-3">Contracts</th>
              <th className="text-right px-5 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {issuer.assets.map((a) => (
              <tr
                key={a.id}
                className="border-t border-gray-800/70 hover:bg-gray-900/50"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/rwa-registry/assets/${a.id}`}
                    className="text-orange-400 hover:underline font-mono"
                  >
                    {a.symbol}
                  </Link>
                </td>
                <td className="px-5 py-3 text-gray-300">{a.name}</td>
                <td className="px-5 py-3 text-gray-400">{a.assetClass}</td>
                <td className="px-5 py-3 text-right text-gray-300">
                  {a.contractCount}
                </td>
                <td className="px-5 py-3 text-right text-gray-400">
                  {a.isActive ? "yes" : "no"}
                </td>
              </tr>
            ))}
            {issuer.assets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-gray-500">
                  No assets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Add asset">
        <form
          onSubmit={addAsset}
          className="p-5 grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <input
            className={inputCls}
            placeholder="Symbol (bCSPX)"
            value={newAsset.symbol}
            onChange={(e) =>
              setNewAsset({ ...newAsset, symbol: e.target.value })
            }
            required
          />
          <input
            className={inputCls}
            placeholder="Name"
            value={newAsset.name}
            onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
            required
          />
          <select
            className={inputCls}
            value={newAsset.assetClass}
            onChange={(e) =>
              setNewAsset({ ...newAsset, assetClass: e.target.value })
            }
          >
            {ASSET_CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            className={inputCls}
            placeholder="Product URL (optional)"
            value={newAsset.officialProductUrl}
            onChange={(e) =>
              setNewAsset({ ...newAsset, officialProductUrl: e.target.value })
            }
          />
          <div className="md:col-span-4">
            <PrimaryBtn type="submit" disabled={saving}>
              + Add asset
            </PrimaryBtn>
          </div>
        </form>
      </Card>
    </PageShell>
  );
}
