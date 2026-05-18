"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

const ISSUER_TYPES = [
  "ASSET_MANAGER",
  "PLATFORM",
  "SPV",
  "REAL_ESTATE_ISSUER",
  "BANK",
  "OTHER",
];

export default function NewIssuer() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({
    slug: "",
    displayName: "",
    legalEntityName: "",
    issuerType: "ASSET_MANAGER",
    jurisdictionCode: "",
    regulatoryStatus: "",
    websiteUrl: "",
    riskNotesInternal: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/rwa/issuers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = (await res.json()) as { issuer?: { id: string }; error?: string };
      if (res.ok && j.issuer) {
        router.push(`/admin/rwa-registry/issuers/${j.issuer.id}`);
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
    <PageShell title="New issuer" sub="Draft status — publish explicitly from the detail page">
      <Crumbs
        items={[
          { label: "RWA Registry", href: "/admin/rwa-registry" },
          { label: "Issuers", href: "/admin/rwa-registry/issuers" },
          { label: "New" },
        ]}
      />
      <form onSubmit={submit} className="space-y-4">
        <Card title="Identification">
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Slug (unique, lowercase)">
              <input
                className={inputCls}
                value={f.slug}
                onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })}
                required
                placeholder="backed-finance"
              />
            </Field>
            <Field label="Display name">
              <input
                className={inputCls}
                value={f.displayName}
                onChange={(e) => setF({ ...f, displayName: e.target.value })}
                required
                placeholder="Backed Finance"
              />
            </Field>
            <Field label="Legal entity">
              <input
                className={inputCls}
                value={f.legalEntityName}
                onChange={(e) => setF({ ...f, legalEntityName: e.target.value })}
                placeholder="Backed Assets GmbH"
              />
            </Field>
            <Field label="Issuer type">
              <select
                className={inputCls}
                value={f.issuerType}
                onChange={(e) => setF({ ...f, issuerType: e.target.value })}
              >
                {ISSUER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jurisdiction code (ISO)">
              <input
                className={inputCls}
                value={f.jurisdictionCode}
                onChange={(e) => setF({ ...f, jurisdictionCode: e.target.value })}
                placeholder="CH"
              />
            </Field>
            <Field label="Regulatory status">
              <input
                className={inputCls}
                value={f.regulatoryStatus}
                onChange={(e) => setF({ ...f, regulatoryStatus: e.target.value })}
                placeholder="BaFin-regulated, Swiss FINMA compliant"
              />
            </Field>
            <Field label="Website">
              <input
                className={inputCls}
                value={f.websiteUrl}
                onChange={(e) => setF({ ...f, websiteUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>
        </Card>

        <Card title="Internal notes">
          <div className="p-5">
            <Field label="Risk notes (internal, not public)">
              <textarea
                className={`${inputCls} min-h-[80px]`}
                value={f.riskNotesInternal}
                onChange={(e) =>
                  setF({ ...f, riskNotesInternal: e.target.value })
                }
                placeholder="Compliance caveats, pending reviews…"
              />
            </Field>
          </div>
        </Card>

        <Msg msg={msg} />

        <div className="flex gap-2">
          <PrimaryBtn type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create draft"}
          </PrimaryBtn>
          <GhostBtn onClick={() => router.push("/admin/rwa-registry/issuers")}>
            Cancel
          </GhostBtn>
        </div>
      </form>
    </PageShell>
  );
}
