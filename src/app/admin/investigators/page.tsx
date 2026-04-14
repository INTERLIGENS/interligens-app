"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

type Application = {
  id: string;
  handle: string;
  displayName: string | null;
  email: string;
  country: string;
  languages: string[];
  specialties: string[];
  background: string;
  motivation: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  submittedAt: string;
  internalNote: string | null;
};

type Profile = {
  id: string;
  handle: string;
  legalFirstName: string | null;
  legalLastName: string | null;
  primaryEmail: string | null;
  verificationStatus: string;
  accessLevel: string;
  accessState: string;
  workspaceActivatedAt: string | null;
  lastActiveAt: string | null;
  ndaAcceptance: { ndaVersion: string; ndaLanguage: string; signedAt: string } | null;
  betaTermsAcceptance: { termsVersion: string; termsLanguage: string; acceptedAt: string } | null;
};

const statusColors: Record<string, { bg: string; fg: string; border: string }> = {
  PENDING: { bg: "rgba(255,107,0,0.08)", fg: "#FF6B00", border: "rgba(255,107,0,0.4)" },
  APPROVED: { bg: "rgba(74,222,128,0.08)", fg: "#4ADE80", border: "rgba(74,222,128,0.4)" },
  REJECTED: { bg: "rgba(255,59,92,0.08)", fg: "#FF3B5C", border: "rgba(255,59,92,0.4)" },
  NEEDS_REVIEW: { bg: "rgba(255,200,0,0.08)", fg: "#FFC800", border: "rgba(255,200,0,0.4)" },
  VERIFIED: { bg: "rgba(74,222,128,0.08)", fg: "#4ADE80", border: "rgba(74,222,128,0.4)" },
  TRUSTED: { bg: "rgba(255,107,0,0.12)", fg: "#FF6B00", border: "rgba(255,107,0,0.5)" },
  SUSPENDED: { bg: "rgba(255,200,0,0.08)", fg: "#FFC800", border: "rgba(255,200,0,0.4)" },
  REVOKED: { bg: "rgba(255,59,92,0.08)", fg: "#FF3B5C", border: "rgba(255,59,92,0.4)" },
  ACTIVE: { bg: "rgba(74,222,128,0.06)", fg: "#4ADE80", border: "rgba(74,222,128,0.3)" },
  APPLICANT: { bg: "rgba(255,255,255,0.04)", fg: "rgba(255,255,255,0.6)", border: LINE },
  BETA: { bg: "rgba(255,107,0,0.08)", fg: "#FF6B00", border: "rgba(255,107,0,0.3)" },
  TRUSTED_CONTRIBUTOR: { bg: "rgba(255,107,0,0.14)", fg: "#FF6B00", border: "rgba(255,107,0,0.6)" },
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

export default function AdminInvestigatorsPage() {
  const [tab, setTab] = useState<"apps" | "profiles">("apps");
  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const [appsRes, profsRes] = await Promise.all([
        fetch("/api/admin/investigators/applications"),
        fetch("/api/admin/investigators"),
      ]);
      if (appsRes.status === 401) {
        setError("Admin authentication required.");
        setLoading(false);
        return;
      }
      const apps = appsRes.ok ? await appsRes.json() : { applications: [] };
      const profs = profsRes.ok ? await profsRes.json() : { profiles: [] };
      setApplications(apps.applications ?? []);
      setProfiles(profs.profiles ?? []);
      setError(null);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function reviewApp(id: string, decision: "APPROVED" | "REJECTED" | "NEEDS_REVIEW") {
    setPendingAction(id);
    try {
      const res = await fetch(`/api/admin/investigators/applications/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, internalNote: noteDrafts[id] ?? undefined }),
      });
      if (res.ok) await loadAll();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px" }}>
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
          INTERLIGENS · ADMIN
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            marginBottom: 32,
          }}
        >
          Trusted Investigator Program
        </h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `1px solid ${LINE}` }}>
          {(["apps", "profiles"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "12px 20px",
                background: "none",
                border: "none",
                borderBottom: tab === t ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: tab === t ? ACCENT : DIM,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.12em",
                fontFamily: "monospace",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {t === "apps" ? `Applications (${applications.length})` : `Investigators (${profiles.length})`}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              color: "#FF3B5C",
              fontSize: 12,
              fontFamily: "monospace",
              padding: 12,
              border: "1px solid rgba(255,59,92,0.4)",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {loading && !error && <div style={{ color: DIM, fontSize: 12 }}>Loading...</div>}

        {/* Applications tab */}
        {tab === "apps" && !loading && (
          <div>
            {applications.length === 0 ? (
              <div style={{ color: DIM, fontSize: 13, padding: 40, textAlign: "center" }}>
                No applications yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {applications.map((app) => (
                  <div
                    key={app.id}
                    style={{
                      background: SURFACE,
                      border: `1px solid ${LINE}`,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 16,
                        marginBottom: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: TEXT,
                            marginBottom: 4,
                          }}
                        >
                          @{app.handle}
                          {app.displayName && (
                            <span style={{ color: DIM, fontWeight: 400, marginLeft: 8 }}>
                              · {app.displayName}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: DIM, fontFamily: "monospace" }}>
                          {app.email} · {app.country} · {new Date(app.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge value={app.status} />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                      {app.languages.map((l) => (
                        <span
                          key={l}
                          style={{
                            fontSize: 9,
                            padding: "2px 8px",
                            border: `1px solid ${LINE}`,
                            color: DIM,
                            fontFamily: "monospace",
                            textTransform: "uppercase",
                          }}
                        >
                          {l}
                        </span>
                      ))}
                      {app.specialties.map((s) => (
                        <span
                          key={s}
                          style={{
                            fontSize: 9,
                            padding: "2px 8px",
                            background: "rgba(255,107,0,0.08)",
                            color: ACCENT,
                            fontFamily: "monospace",
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    <details style={{ marginBottom: 12 }}>
                      <summary style={{ color: DIM, fontSize: 11, cursor: "pointer" }}>
                        Show full application
                      </summary>
                      <div style={{ marginTop: 10, fontSize: 12, color: DIM, lineHeight: 1.7 }}>
                        <div style={{ marginBottom: 8 }}>
                          <strong style={{ color: TEXT }}>Background:</strong>
                          <br />
                          {app.background}
                        </div>
                        <div>
                          <strong style={{ color: TEXT }}>Motivation:</strong>
                          <br />
                          {app.motivation}
                        </div>
                      </div>
                    </details>

                    <textarea
                      value={noteDrafts[app.id] ?? app.internalNote ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((d) => ({ ...d, [app.id]: e.target.value }))
                      }
                      placeholder="Internal review note..."
                      rows={2}
                      style={{
                        width: "100%",
                        background: "#0d0d0d",
                        border: `1px solid ${LINE}`,
                        color: TEXT,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        outline: "none",
                        marginBottom: 12,
                        resize: "vertical",
                      }}
                    />

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => reviewApp(app.id, "APPROVED")}
                        disabled={pendingAction === app.id}
                        style={{
                          fontSize: 10,
                          padding: "8px 14px",
                          background: "rgba(74,222,128,0.12)",
                          color: "#4ADE80",
                          border: "1px solid rgba(74,222,128,0.4)",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reviewApp(app.id, "NEEDS_REVIEW")}
                        disabled={pendingAction === app.id}
                        style={{
                          fontSize: 10,
                          padding: "8px 14px",
                          background: "rgba(255,200,0,0.12)",
                          color: "#FFC800",
                          border: "1px solid rgba(255,200,0,0.4)",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        Needs Review
                      </button>
                      <button
                        onClick={() => reviewApp(app.id, "REJECTED")}
                        disabled={pendingAction === app.id}
                        style={{
                          fontSize: 10,
                          padding: "8px 14px",
                          background: "rgba(255,59,92,0.12)",
                          color: "#FF3B5C",
                          border: "1px solid rgba(255,59,92,0.4)",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profiles tab */}
        {tab === "profiles" && !loading && (
          <div>
            {profiles.length === 0 ? (
              <div style={{ color: DIM, fontSize: 13, padding: 40, textAlign: "center" }}>
                No investigators yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {profiles.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/investigators/${p.id}`}
                    style={{
                      display: "block",
                      padding: 16,
                      background: SURFACE,
                      border: `1px solid ${LINE}`,
                      textDecoration: "none",
                      color: TEXT,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>
                          @{p.handle}
                          {p.legalFirstName && (
                            <span style={{ color: DIM, fontWeight: 400, marginLeft: 8 }}>
                              · {p.legalFirstName} {p.legalLastName}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: DIM, fontFamily: "monospace", marginTop: 4 }}>
                          {p.primaryEmail ?? "—"} ·{" "}
                          {p.lastActiveAt
                            ? `last active ${new Date(p.lastActiveAt).toLocaleDateString()}`
                            : "never active"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Badge value={p.verificationStatus} />
                        <Badge value={p.accessLevel} />
                        <Badge value={p.accessState} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
