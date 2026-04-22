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

export default function DeprecateContract() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [actor, setActor] = useState("admin");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setMsg("✗ Reason is required");
      return;
    }
    setSubmitting(true);
    setMsg(null);
    const res = await fetch(`/api/admin/rwa/contracts/${id}/deprecate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, actor }),
    });
    const j = (await res.json()) as { registryVersion?: number; error?: string };
    if (res.ok) {
      setMsg(`✓ Deprecated — registry v${j.registryVersion}`);
      setTimeout(() => router.push(`/admin/rwa-registry/contracts/${id}`), 600);
    } else {
      setMsg(`✗ ${j.error ?? "Deprecate failed"}`);
    }
    setSubmitting(false);
  }

  return (
    <PageShell
      title="Deprecate contract"
      sub="Marks the contract DEPRECATED and bumps registry version — public lookup will stop treating it as primary"
    >
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          { label: "Contract", href: `/admin/rwa-registry/contracts/${id}` },
          { label: "Deprecate" },
        ]}
      />
      <form onSubmit={submit} className="space-y-4">
        <Card title="Deprecation record">
          <div className="p-5 grid grid-cols-1 gap-4">
            <Field label="Reason (required)">
              <textarea
                className={`${inputCls} min-h-[100px]`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="e.g. replaced by V2 rollout, discovered issuer revocation, chain migration…"
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
          <GhostBtn type="submit" danger disabled={submitting}>
            {submitting ? "Deprecating…" : "Confirm deprecation"}
          </GhostBtn>
          <PrimaryBtn
            onClick={() => router.push(`/admin/rwa-registry/contracts/${id}`)}
          >
            Cancel
          </PrimaryBtn>
        </div>
      </form>
    </PageShell>
  );
}
