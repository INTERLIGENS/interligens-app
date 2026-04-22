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

type Mode = "create" | "link";

export default function MigrateContract() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("create");
  const [reason, setReason] = useState("Migrated to successor contract");
  const [actor, setActor] = useState("admin");

  // mode === "create"
  const [chainKey, setChainKey] = useState("eip155:1");
  const [contractAddress, setContractAddress] = useState("");
  const [tokenStandard, setTokenStandard] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);

  // mode === "link"
  const [newContractId, setNewContractId] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    const body: Record<string, unknown> = { reason, actor };
    if (mode === "link") {
      if (!newContractId.trim()) {
        setMsg("✗ Enter the successor contract ID");
        setSubmitting(false);
        return;
      }
      body.newContractId = newContractId.trim();
    } else {
      if (!contractAddress.trim()) {
        setMsg("✗ Enter the new contract address");
        setSubmitting(false);
        return;
      }
      body.chainKey = chainKey;
      body.contractAddress = contractAddress.trim();
      body.tokenStandard = tokenStandard || undefined;
      body.isPrimary = isPrimary;
    }

    const res = await fetch(`/api/admin/rwa/contracts/${id}/migrate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as {
      newContractId?: string;
      createdSuccessor?: boolean;
      registryVersion?: number;
      error?: string;
    };
    if (res.ok) {
      setMsg(
        `✓ Migrated — registry v${j.registryVersion} — successor ${j.newContractId}`,
      );
      setTimeout(
        () =>
          router.push(
            `/admin/rwa-registry/contracts/${j.newContractId ?? id}`,
          ),
        700,
      );
    } else {
      setMsg(`✗ ${j.error ?? "Migrate failed"}`);
    }
    setSubmitting(false);
  }

  return (
    <PageShell
      title="Migrate contract"
      sub="Points the legacy contract at a successor. Legacy becomes SUSPECTED_OLD + deprecated; successor becomes the new primary."
    >
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          { label: "Contract", href: `/admin/rwa-registry/contracts/${id}` },
          { label: "Migrate" },
        ]}
      />

      <div className="flex gap-2">
        <button
          onClick={() => setMode("create")}
          className={`text-xs uppercase tracking-wider px-3 py-2 rounded border ${
            mode === "create"
              ? "border-orange-500 text-orange-400"
              : "border-gray-700 text-gray-400"
          }`}
        >
          Create successor
        </button>
        <button
          onClick={() => setMode("link")}
          className={`text-xs uppercase tracking-wider px-3 py-2 rounded border ${
            mode === "link"
              ? "border-orange-500 text-orange-400"
              : "border-gray-700 text-gray-400"
          }`}
        >
          Link to existing contract
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "create" && (
          <Card title="New successor contract">
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Chain key">
                <select
                  className={inputCls}
                  value={chainKey}
                  onChange={(e) => setChainKey(e.target.value)}
                >
                  {CHAIN_KEYS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Token standard">
                <select
                  className={inputCls}
                  value={tokenStandard}
                  onChange={(e) => setTokenStandard(e.target.value)}
                >
                  {TOKEN_STANDARDS.map((t) => (
                    <option key={t} value={t}>
                      {t || "— select —"}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Successor contract address">
                  <input
                    className={`${inputCls} font-mono`}
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                    required
                    placeholder="0x… or Solana base58"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                Promote successor as the new primary on this chain
              </label>
            </div>
          </Card>
        )}

        {mode === "link" && (
          <Card title="Link to existing contract">
            <div className="p-5 grid grid-cols-1 gap-4">
              <Field label="Successor contract ID (must belong to the same asset)">
                <input
                  className={`${inputCls} font-mono`}
                  value={newContractId}
                  onChange={(e) => setNewContractId(e.target.value)}
                  required
                  placeholder="cXXXXXXXXXX"
                />
              </Field>
            </div>
          </Card>
        )}

        <Card title="Migration record">
          <div className="p-5 grid grid-cols-1 gap-4">
            <Field label="Reason">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Field label="Actor">
              <input
                className={inputCls}
                value={actor}
                onChange={(e) => setActor(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Msg msg={msg} />

        <div className="flex gap-2">
          <PrimaryBtn type="submit" disabled={submitting}>
            {submitting ? "Migrating…" : "Confirm migration"}
          </PrimaryBtn>
          <GhostBtn
            onClick={() => router.push(`/admin/rwa-registry/contracts/${id}`)}
          >
            Cancel
          </GhostBtn>
        </div>
      </form>
    </PageShell>
  );
}
