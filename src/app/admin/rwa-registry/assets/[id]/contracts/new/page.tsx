"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  PageShell,
  Crumbs,
  Card,
  Field,
  PrimaryBtn,
  GhostBtn,
  Msg,
  inputCls,
} from "@/components/admin/rwa/RwaUi";

const CHAIN_KEYS = [
  "eip155:1",
  "eip155:137",
  "eip155:42161",
  "eip155:8453",
  "eip155:56",
  "eip155:10",
  "solana:mainnet",
];

const TOKEN_STANDARDS = ["", "ERC-20", "ERC-1400", "ERC-3643", "SPL", "OTHER"];

export default function NewContract() {
  const params = useParams();
  const assetId = params?.id as string;
  const router = useRouter();

  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    chainKey: "eip155:1",
    contractAddress: "",
    tokenStandard: "",
    isPrimary: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/rwa/assets/${assetId}/contracts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainKey: f.chainKey,
          contractAddress: f.contractAddress.trim(),
          tokenStandard: f.tokenStandard || undefined,
          isPrimary: f.isPrimary,
        }),
      });
      const j = (await res.json()) as {
        contract?: { id: string };
        error?: string;
      };
      if (res.ok && j.contract) {
        router.push(`/admin/rwa-registry/contracts/${j.contract.id}`);
      } else {
        setMsg(`✗ ${j.error ?? "Create failed"}`);
      }
    } catch (err) {
      setMsg(`✗ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title="New contract" sub="Verified-official on creation">
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          {
            label: "Asset",
            href: `/admin/rwa-registry/assets/${assetId}`,
          },
          { label: "New contract" },
        ]}
      />

      <form onSubmit={submit} className="space-y-4">
        <Card title="Identification">
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Chain key">
              <select
                className={inputCls}
                value={f.chainKey}
                onChange={(e) => setF({ ...f, chainKey: e.target.value })}
              >
                {CHAIN_KEYS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Token standard">
              <select
                className={inputCls}
                value={f.tokenStandard}
                onChange={(e) => setF({ ...f, tokenStandard: e.target.value })}
              >
                {TOKEN_STANDARDS.map((t) => (
                  <option key={t} value={t}>
                    {t || "— select —"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Contract address (on-chain)">
                <input
                  className={`${inputCls} font-mono`}
                  value={f.contractAddress}
                  onChange={(e) =>
                    setF({ ...f, contractAddress: e.target.value })
                  }
                  required
                  placeholder="0x… or Solana base58"
                />
              </Field>
              <p className="text-xs text-gray-500 mt-1">
                EVM addresses are lowercased on save. Solana kept case-sensitive.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 md:col-span-2">
              <input
                type="checkbox"
                checked={f.isPrimary}
                onChange={(e) => setF({ ...f, isPrimary: e.target.checked })}
              />
              Mark as primary contract for this chain (demotes any existing primary)
            </label>
          </div>
        </Card>

        <Msg msg={msg} />

        <div className="flex gap-2">
          <PrimaryBtn type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create contract"}
          </PrimaryBtn>
          <GhostBtn
            onClick={() => router.push(`/admin/rwa-registry/assets/${assetId}`)}
          >
            Cancel
          </GhostBtn>
        </div>
      </form>
    </PageShell>
  );
}
