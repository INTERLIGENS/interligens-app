"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type Criterion = { met: boolean; value?: number; required?: number };

type DetailData = {
  profile: {
    id: string;
    handle: string;
    legalFirstName: string | null;
    legalLastName: string | null;
    primaryEmail: string | null;
    country: string | null;
    organizationName: string | null;
    verificationStatus: string;
    accessLevel: string;
    accessState: string;
    workspaceActivatedAt: string | null;
    lastActiveAt: string | null;
    isEligibleForPublishing: boolean;
    isEligibleForSharing: boolean;
    substantiveContribution: boolean;
    ndaAcceptance: {
      ndaVersion: string;
      ndaLanguage: string;
      ndaDocHash: string;
      signedAt: string;
    } | null;
    betaTermsAcceptance: {
      termsVersion: string;
      termsLanguage: string;
      termsDocHash: string;
      acceptedAt: string;
    } | null;
  };
  programAudit: Array<{
    id: string;
    event: string;
    actorId: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
  activity: Array<{
    id: string;
    event: string;
    ipAddress: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
  activitySummary: Record<string, number>;
  eligibility: {
    eligible: boolean;
    criteria: Record<string, Criterion>;
  };
};

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300 font-mono uppercase">
      {value.replace(/_/g, " ")}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mt-8 mb-4">
      {children}
    </h2>
  );
}

export default function InvestigatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<
    | { kind: "suspend" | "revoke"; reason: string }
    | { kind: "restore" | "upgrade" | "activate"; reason?: undefined }
    | null
  >(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/admin/investigators/${id}`);
      if (!res.ok) {
        setError("Failed to load profile.");
        return;
      }
      const d = (await res.json()) as DetailData;
      setData(d);
      setError(null);
    } catch {
      setError("Network error.");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function runAction() {
    if (!actionModal) return;
    setActionBusy(true);
    try {
      const pathMap = {
        suspend: "suspend",
        revoke: "revoke",
        restore: "restore",
        upgrade: "upgrade-trusted",
        activate: "activate-workspace",
      };
      const endpoint = `/api/admin/investigators/${id}/${pathMap[actionModal.kind]}`;
      const body =
        actionModal.kind === "suspend" || actionModal.kind === "revoke"
          ? JSON.stringify({ reason: actionModal.reason })
          : JSON.stringify({});
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        setActionModal(null);
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Action failed");
      }
    } finally {
      setActionBusy(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6">
        <div className="text-red-400 text-sm">{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-950 text-gray-400 p-6 text-sm">
        Loading...
      </main>
    );
  }

  const p = data.profile;
  const criteria = data.eligibility.criteria;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/admin/investigators"
          className="text-sm text-gray-400 hover:text-orange-400 transition"
        >
          ← Back to list
        </Link>

        {/* Profile card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <h1 className="text-2xl font-bold text-orange-400">
            @{p.handle}
          </h1>
          {(p.legalFirstName || p.legalLastName) && (
            <div className="text-sm text-gray-400">
              {p.legalFirstName} {p.legalLastName}
              {p.country && ` · ${p.country}`}
              {p.organizationName && ` · ${p.organizationName}`}
            </div>
          )}
          {p.primaryEmail && (
            <div className="text-xs text-gray-500 font-mono">
              {p.primaryEmail}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Badge value={p.verificationStatus} />
            <Badge value={p.accessLevel} />
            <Badge value={p.accessState} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <Field label="Workspace activated" value={p.workspaceActivatedAt ? new Date(p.workspaceActivatedAt).toLocaleString() : "Not yet"} />
            <Field label="Last active" value={p.lastActiveAt ? new Date(p.lastActiveAt).toLocaleString() : "Never"} />
            <Field
              label="NDA"
              value={
                p.ndaAcceptance
                  ? `v${p.ndaAcceptance.ndaVersion} · ${p.ndaAcceptance.ndaLanguage.toUpperCase()} · ${p.ndaAcceptance.ndaDocHash.slice(0, 16)}... · ${new Date(p.ndaAcceptance.signedAt).toLocaleDateString("fr-FR")}`
                  : "Not signed"
              }
            />
            <Field
              label="Beta Terms"
              value={
                p.betaTermsAcceptance
                  ? `v${p.betaTermsAcceptance.termsVersion} · ${p.betaTermsAcceptance.termsLanguage.toUpperCase()} · ${p.betaTermsAcceptance.termsDocHash.slice(0, 16)}... · ${new Date(p.betaTermsAcceptance.acceptedAt).toLocaleDateString("fr-FR")}`
                  : "Not accepted"
              }
            />
            <Field label="Eligible to publish" value={p.isEligibleForPublishing ? "Yes" : "No"} />
            <Field label="Eligible to share" value={p.isEligibleForSharing ? "Yes" : "No"} />
            <Field label="Substantive contribution" value={p.substantiveContribution ? "Yes" : "No"} />
          </div>
        </div>

        {/* Activity summary */}
        <SectionHeader>Activity Summary</SectionHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric label="Logins" value={data.activitySummary.LOGIN ?? 0} />
          <Metric label="Workspace opens" value={data.activitySummary.WORKSPACE_OPENED ?? 0} />
          <Metric label="Cases created" value={data.activitySummary.CASE_CREATED ?? 0} />
          <Metric label="Entities added" value={data.activitySummary.ENTITY_ADDED ?? 0} />
          <Metric label="Exports triggered" value={data.activitySummary.EXPORT_TRIGGERED ?? 0} />
          <Metric label="Assistant queries" value={data.activitySummary.ASSISTANT_QUERIED ?? 0} />
        </div>

        {/* Eligibility */}
        <SectionHeader>Trusted Contributor Eligibility</SectionHeader>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <div className="flex flex-col gap-2">
            {Object.entries(criteria).map(([key, c]) => (
              <div
                key={key}
                className="flex items-center gap-3 text-sm"
              >
                <span className={`font-mono font-bold w-4 ${c.met ? "text-green-400" : "text-red-400"}`}>
                  {c.met ? "✓" : "✗"}
                </span>
                <span className={`capitalize ${c.met ? "text-white" : "text-gray-400"}`}>
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                {c.value !== undefined && c.required !== undefined && (
                  <span className="text-gray-500 font-mono text-xs">
                    ({c.value} / {c.required})
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className={`pt-4 border-t border-gray-800 text-sm font-mono font-bold uppercase tracking-wider ${data.eligibility.eligible ? "text-green-400" : "text-orange-400"}`}>
            {data.eligibility.eligible ? "✓ Eligible" : "Not yet eligible"}
          </div>
          <button
            onClick={() => setActionModal({ kind: "upgrade" })}
            disabled={!data.eligibility.eligible}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black transition"
          >
            Upgrade to Trusted Contributor
          </button>
        </div>

        {/* Trust actions */}
        <SectionHeader>Trust Actions</SectionHeader>
        <div className="flex gap-2 flex-wrap">
          {!p.workspaceActivatedAt && (
            <button
              onClick={() => setActionModal({ kind: "activate" })}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 text-black transition"
            >
              Activate Workspace
            </button>
          )}
          <button
            onClick={() => setActionModal({ kind: "suspend", reason: "" })}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
          >
            Suspend
          </button>
          <button
            onClick={() => setActionModal({ kind: "revoke", reason: "" })}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-red-400 hover:bg-gray-700 transition"
          >
            Revoke
          </button>
          <button
            onClick={() => setActionModal({ kind: "restore" })}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-green-400 hover:bg-gray-700 transition"
          >
            Restore
          </button>
        </div>

        {/* Activity timeline */}
        <SectionHeader>Activity Timeline (Metadata Only)</SectionHeader>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-xs font-mono">
          {data.activity.length === 0 && (
            <div className="text-gray-500">No activity recorded.</div>
          )}
          {data.activity.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[180px_200px_120px_1fr] gap-3 py-2 border-b border-gray-800"
            >
              <span className="text-gray-500">
                {new Date(a.createdAt).toLocaleString()}
              </span>
              <span className="text-orange-400">{a.event}</span>
              <span className="text-gray-500">{a.ipAddress ?? "—"}</span>
              <span className="text-gray-400 break-all">
                {a.metadata ? JSON.stringify(a.metadata).slice(0, 200) : "—"}
              </span>
            </div>
          ))}
        </div>

        {/* Program audit log */}
        <SectionHeader>Program Audit Log</SectionHeader>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-xs font-mono">
          {data.programAudit.length === 0 && (
            <div className="text-gray-500">No audit entries.</div>
          )}
          {data.programAudit.map((l) => (
            <div
              key={l.id}
              className="grid grid-cols-[180px_280px_120px_1fr] gap-3 py-2 border-b border-gray-800"
            >
              <span className="text-gray-500">
                {new Date(l.createdAt).toLocaleString()}
              </span>
              <span className="text-orange-400">{l.event}</span>
              <span className="text-gray-500">{l.actorId ?? "—"}</span>
              <span className="text-gray-400 break-all">
                {l.metadata ? JSON.stringify(l.metadata).slice(0, 200) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action modal */}
      {actionModal && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-6 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActionModal(null);
          }}
        >
          <div className="bg-gray-900 rounded-xl border border-orange-500 p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">
              Confirm {actionModal.kind}
            </h3>
            {(actionModal.kind === "suspend" || actionModal.kind === "revoke") && (
              <textarea
                value={actionModal.reason}
                onChange={(e) =>
                  setActionModal({ kind: actionModal.kind, reason: e.target.value })
                }
                placeholder="Reason (required)"
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={runAction}
                disabled={
                  actionBusy ||
                  ((actionModal.kind === "suspend" || actionModal.kind === "revoke") &&
                    !actionModal.reason?.trim())
                }
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black transition"
              >
                {actionBusy ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm text-white font-mono">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="text-3xl font-bold text-white mb-2">
        {value}
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
