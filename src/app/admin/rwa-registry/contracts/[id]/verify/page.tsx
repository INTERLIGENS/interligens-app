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

export default function VerifyContract() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [summary, setSummary] = useState("Manual verification — cross-checked with official source");
  const [actor, setActor] = useState("admin");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    const res = await fetch(`/api/admin/rwa/contracts/${id}/verify`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, actor }),
    });
    const j = (await res.json()) as { registryVersion?: number; error?: string };
    if (res.ok) {
      setMsg(`✓ Verified — registry v${j.registryVersion}`);
      setTimeout(() => router.push(`/admin/rwa-registry/contracts/${id}`), 600);
    } else {
      setMsg(`✗ ${j.error ?? "Verify failed"}`);
    }
    setSubmitting(false);
  }

  return (
    <PageShell title="Verify contract" sub="Marks the contract VERIFIED_OFFICIAL and bumps registry version">
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          { label: "Contract", href: `/admin/rwa-registry/contracts/${id}` },
          { label: "Verify" },
        ]}
      />
      <form onSubmit={submit} className="space-y-4">
        <Card title="Verification record">
          <div className="p-5 grid grid-cols-1 gap-4">
            <Field label="Summary">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
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
            {submitting ? "Verifying…" : "Mark verified"}
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
