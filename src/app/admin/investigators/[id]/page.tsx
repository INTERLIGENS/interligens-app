"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";
const MUTED = "rgba(255,255,255,0.35)";

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

const statusColors: Record<string, { bg: string; fg: string; border: string }> = {
  PENDING: { bg: "rgba(255,107,0,0.08)", fg: "#FF6B00", border: "rgba(255,107,0,0.4)" },
  APPROVED: { bg: "rgba(74,222,128,0.08)", fg: "#4ADE80", border: "rgba(74,222,128,0.4)" },
  REJECTED: { bg: "rgba(255,59,92,0.08)", fg: "#FF3B5C", border: "rgba(255,59,92,0.4)" },
  VERIFIED: { bg: "rgba(74,222,128,0.08)", fg: "#4ADE80", border: "rgba(74,222,128,0.4)" },
  TRUSTED: { bg: "rgba(255,107,0,0.12)", fg: "#FF6B00", border: "rgba(255,107,0,0.5)" },
  SUSPENDED: { bg: "rgba(255,200,0,0.08)", fg: "#FFC800", border: "rgba(255,200,0,0.4)" },
  REVOKED: { bg: "rgba(255,59,92,0.08)", fg: "#FF3B5C", border: "rgba(255,59,92,0.4)" },
  ACTIVE: { bg: "rgba(74,222,128,0.06)", fg: "#4ADE80", border: "rgba(74,222,128,0.3)" },
  APPLICANT: { bg: "rgba(255,255,255,0.04)", fg: "rgba(255,255,255,0.6)", border: LINE },
  BETA: { bg: "rgba(255,107,0,0.08)", fg: "#FF6B00", border: "rgba(255,107,0,0.3)" },
  TRUSTED_CONTRIBUTOR: { bg: "rgba(255,107,0,0.14)", fg: "#FF6B00", border: "rgba(255,107,0,0.6)" },
  NEEDS_REVIEW: { bg: "rgba(255,200,0,0.08)", fg: "#FFC800", border: "rgba(255,200,0,0.4)" },
};

function Badge({ value }: { value: string }) {
  const c = statusColors[value] ?? { bg: "rgba(255,255,255,0.04)", fg: "#888", border: LINE };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontFamily: "monospace",
        backgroundColor: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: 2,
      }}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.2em",
        fontFamily: "monospace",
        textTransform: "uppercase",
        color: ACCENT,
        marginBottom: 16,
        marginTop: 40,
      }}
    >
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
      <main
        style={{
          minHeight: "100vh",
          background: BG,
          color: TEXT,
          padding: 40,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ color: "#FF3B5C", fontFamily: "monospace" }}>{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: BG,
          color: DIM,
          padding: 40,
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        Loading...
      </main>
    );
  }

  const p = data.profile;
  const criteria = data.eligibility.criteria;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 120px" }}>
        <Link
          href="/admin/investigators"
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: DIM,
            textDecoration: "none",
          }}
        >
          ← Back to list
        </Link>

        {/* Profile card */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.25em",
              fontFamily: "monospace",
              color: ACCENT,
              marginBottom: 8,
            }}
          >
            INTERLIGENS · INVESTIGATOR DASHBOARD
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              fontStyle: "italic",
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              marginBottom: 12,
            }}
          >
            @{p.handle}
          </h1>
          {(p.legalFirstName || p.legalLastName) && (
            <div style={{ fontSize: 14, color: DIM, marginBottom: 12 }}>
              {p.legalFirstName} {p.legalLastName}
              {p.country && ` · ${p.country}`}
              {p.organizationName && ` · ${p.organizationName}`}
            </div>
          )}
          {p.primaryEmail && (
            <div
              style={{
                fontSize: 12,
                color: MUTED,
                fontFamily: "monospace",
                marginBottom: 16,
              }}
            >
              {p.primaryEmail}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge value={p.verificationStatus} />
            <Badge value={p.accessLevel} />
            <Badge value={p.accessState} />
          </div>

          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 16,
            }}
          >
            <Field label="Workspace activated" value={p.workspaceActivatedAt ? new Date(p.workspaceActivatedAt).toLocaleString() : "Not yet"} />
            <Field label="Last active" value={p.lastActiveAt ? new Date(p.lastActiveAt).toLocaleString() : "Never"} />
            <Field
              label="NDA"
              value={
                p.ndaAcceptance
                  ? `v${p.ndaAcceptance.ndaVersion} · ${p.ndaAcceptance.ndaLanguage.toUpperCase()} · ${p.ndaAcceptance.ndaDocHash.slice(0, 16)}... · ${new Date(p.ndaAcceptance.signedAt).toLocaleDateString()}`
                  : "Not signed"
              }
            />
            <Field
              label="Beta Terms"
              value={
                p.betaTermsAcceptance
                  ? `v${p.betaTermsAcceptance.termsVersion} · ${p.betaTermsAcceptance.termsLanguage.toUpperCase()} · ${p.betaTermsAcceptance.termsDocHash.slice(0, 16)}... · ${new Date(p.betaTermsAcceptance.acceptedAt).toLocaleDateString()}`
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 16,
          }}
        >
          <Metric label="Logins" value={data.activitySummary.LOGIN ?? 0} />
          <Metric label="Workspace opens" value={data.activitySummary.WORKSPACE_OPENED ?? 0} />
          <Metric label="Cases created" value={data.activitySummary.CASE_CREATED ?? 0} />
          <Metric label="Entities added" value={data.activitySummary.ENTITY_ADDED ?? 0} />
          <Metric label="Exports triggered" value={data.activitySummary.EXPORT_TRIGGERED ?? 0} />
          <Metric label="Assistant queries" value={data.activitySummary.ASSISTANT_QUERIED ?? 0} />
        </div>

        {/* Eligibility */}
        <SectionHeader>Trusted Contributor Eligibility</SectionHeader>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(criteria).map(([key, c]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    color: c.met ? "#4ADE80" : "#FF3B5C",
                    fontFamily: "monospace",
                    fontWeight: 900,
                    width: 14,
                  }}
                >
                  {c.met ? "✓" : "✗"}
                </span>
                <span style={{ color: c.met ? TEXT : DIM, textTransform: "capitalize" }}>
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                {c.value !== undefined && c.required !== undefined && (
                  <span style={{ color: MUTED, fontFamily: "monospace", fontSize: 11 }}>
                    ({c.value} / {c.required})
                  </span>
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${LINE}`,
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: data.eligibility.eligible ? "#4ADE80" : "#FFC800",
            }}
          >
            {data.eligibility.eligible ? "✓ Eligible" : "Not yet eligible"}
          </div>
          <button
            onClick={() => setActionModal({ kind: "upgrade" })}
            disabled={!data.eligibility.eligible}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: data.eligibility.eligible ? ACCENT : "rgba(255,107,0,0.2)",
              color: BG,
              border: "none",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.15em",
              fontFamily: "monospace",
              textTransform: "uppercase",
              cursor: data.eligibility.eligible ? "pointer" : "not-allowed",
            }}
          >
            Upgrade to Trusted Contributor
          </button>
        </div>

        {/* Trust actions */}
        <SectionHeader>Trust Actions</SectionHeader>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!p.workspaceActivatedAt && (
            <button
              onClick={() => setActionModal({ kind: "activate" })}
              style={{
                padding: "10px 18px",
                background: ACCENT,
                color: BG,
                border: "none",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.15em",
                fontFamily: "monospace",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Activate Workspace
            </button>
          )}
          <button
            onClick={() => setActionModal({ kind: "suspend", reason: "" })}
            style={actionBtn("#FFC800")}
          >
            Suspend
          </button>
          <button
            onClick={() => setActionModal({ kind: "revoke", reason: "" })}
            style={actionBtn("#FF3B5C")}
          >
            Revoke
          </button>
          <button
            onClick={() => setActionModal({ kind: "restore" })}
            style={actionBtn("#4ADE80")}
          >
            Restore
          </button>
        </div>

        {/* Activity timeline */}
        <SectionHeader>Activity Timeline (Metadata Only)</SectionHeader>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            fontSize: 11,
            fontFamily: "monospace",
          }}
        >
          {data.activity.length === 0 && (
            <div style={{ padding: 20, color: DIM }}>No activity recorded.</div>
          )}
          {data.activity.map((a) => (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 200px 120px 1fr",
                gap: 12,
                padding: "10px 16px",
                borderBottom: `1px solid ${LINE}`,
              }}
            >
              <span style={{ color: MUTED }}>
                {new Date(a.createdAt).toLocaleString()}
              </span>
              <span style={{ color: ACCENT }}>{a.event}</span>
              <span style={{ color: MUTED }}>{a.ipAddress ?? "—"}</span>
              <span style={{ color: DIM, wordBreak: "break-all" }}>
                {a.metadata ? JSON.stringify(a.metadata).slice(0, 200) : "—"}
              </span>
            </div>
          ))}
        </div>

        {/* Program audit log */}
        <SectionHeader>Program Audit Log</SectionHeader>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            fontSize: 11,
            fontFamily: "monospace",
          }}
        >
          {data.programAudit.length === 0 && (
            <div style={{ padding: 20, color: DIM }}>No audit entries.</div>
          )}
          {data.programAudit.map((l) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 280px 120px 1fr",
                gap: 12,
                padding: "10px 16px",
                borderBottom: `1px solid ${LINE}`,
              }}
            >
              <span style={{ color: MUTED }}>
                {new Date(l.createdAt).toLocaleString()}
              </span>
              <span style={{ color: ACCENT }}>{l.event}</span>
              <span style={{ color: MUTED }}>{l.actorId ?? "—"}</span>
              <span style={{ color: DIM, wordBreak: "break-all" }}>
                {l.metadata ? JSON.stringify(l.metadata).slice(0, 200) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action modal */}
      {actionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActionModal(null);
          }}
        >
          <div
            style={{
              background: BG,
              border: `1px solid ${ACCENT}`,
              padding: 32,
              maxWidth: 480,
              width: "100%",
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: ACCENT,
                marginBottom: 16,
              }}
            >
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
                style={{
                  width: "100%",
                  background: "#0d0d0d",
                  border: `1px solid ${LINE}`,
                  color: TEXT,
                  padding: 12,
                  fontSize: 13,
                  fontFamily: "monospace",
                  outline: "none",
                  resize: "vertical",
                  marginBottom: 16,
                }}
              />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={runAction}
                disabled={
                  actionBusy ||
                  ((actionModal.kind === "suspend" || actionModal.kind === "revoke") &&
                    !actionModal.reason?.trim())
                }
                style={{
                  padding: "10px 18px",
                  background: ACCENT,
                  color: BG,
                  border: "none",
                  fontSize: 10,
                  fontFamily: "monospace",
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {actionBusy ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => setActionModal(null)}
                style={{
                  padding: "10px 18px",
                  background: "transparent",
                  color: DIM,
                  border: `1px solid ${LINE}`,
                  fontSize: 10,
                  fontFamily: "monospace",
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
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
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          fontFamily: "monospace",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${LINE}`,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          fontStyle: "italic",
          color: TEXT,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          fontFamily: "monospace",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: "10px 18px",
    background: "transparent",
    color,
    border: `1px solid ${color}80`,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.15em",
    fontFamily: "monospace",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}
