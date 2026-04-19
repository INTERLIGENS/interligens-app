"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { decryptString, decryptTags } from "@/lib/vault/crypto.client";
import { UNREADABLE_LABEL } from "@/lib/vault/display";

type CaseRow = {
  id: string;
  titleEnc: string;
  titleIv: string;
  tagsEnc: string;
  tagsIv: string;
  status: string;
  entityCount: number;
  fileCount: number;
  updatedAt: string;
};

type DecryptedCase = CaseRow & { title: string; tags: string[] };

type Metrics = {
  activeCases: number | null;
  trackedEntities: number | null;
  openHypotheses: number | null;
  publishReadyCases: number | null;
};

type GraphSummary = {
  id: string;
  title: string;
  visibility: "PRIVATE" | "TEAM_POOL" | "PUBLIC";
  updatedAt: string;
  nodeCount: number;
};

const ACCENT = "#FF6B00";
const DIM = "rgba(255,255,255,0.5)";
const DIMMER = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

const PRIMARY_BTN: React.CSSProperties = {
  backgroundColor: ACCENT,
  color: "#FFFFFF",
  height: 38,
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 13,
  paddingLeft: 16,
  paddingRight: 16,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  border: "none",
};

const SECONDARY_BTN: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "rgba(255,255,255,0.7)",
  height: 38,
  borderRadius: 6,
  fontSize: 13,
  paddingLeft: 16,
  paddingRight: 16,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  border: `1px solid ${LINE}`,
};

function WorkspaceInner() {
  const router = useRouter();
  const { keys, lock } = useVaultSession();
  const [cases, setCases] = useState<DecryptedCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>({
    activeCases: null,
    trackedEntities: null,
    openHypotheses: null,
    publishReadyCases: null,
  });
  const [metricsError, setMetricsError] = useState(false);
  const [graphs, setGraphs] = useState<GraphSummary[]>([]);
  const [teamGraphs, setTeamGraphs] = useState<GraphSummary[]>([]);

  useEffect(() => {
    if (!keys) return;
    fetch("/api/investigators/workspace/metrics")
      .then(async (r) => {
        if (!r.ok) throw new Error("metrics_failed");
        const d = (await r.json()) as Metrics;
        setMetrics(d);
        setMetricsError(false);
      })
      .catch(() => setMetricsError(true));
  }, [keys]);

  useEffect(() => {
    if (!keys) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/investigators/cases");
        if (res.status === 401) {
          router.replace("/investigators/box/onboarding");
          return;
        }
        const data = await res.json();
        const rows: CaseRow[] = data.cases ?? [];
        const decrypted: DecryptedCase[] = [];
        for (const row of rows.slice(0, 4)) {
          try {
            const title = await decryptString(row.titleEnc, row.titleIv, keys.metaKey);
            const tags = await decryptTags(row.tagsEnc, row.tagsIv, keys.metaKey);
            decrypted.push({ ...row, title, tags });
          } catch {
            decrypted.push({ ...row, title: UNREADABLE_LABEL, tags: [] });
          }
        }
        if (!cancelled) setCases(decrypted);
      } finally {
        if (!cancelled) setLoadingCases(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keys, router]);

  useEffect(() => {
    if (!keys) return;
    fetch("/api/investigators/graphs")
      .then((r) => (r.ok ? r.json() : { graphs: [] }))
      .then((d: { graphs?: GraphSummary[] }) => setGraphs(d.graphs ?? []))
      .catch(() => setGraphs([]));
    fetch("/api/investigators/team-pool")
      .then((r) => (r.ok ? r.json() : { graphs: [] }))
      .then((d: { graphs?: GraphSummary[] }) => setTeamGraphs(d.graphs ?? []))
      .catch(() => setTeamGraphs([]));
  }, [keys]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: DIM,
              }}
            >
              INTERLIGENS · WORKSPACE
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                marginTop: 8,
                letterSpacing: "-0.01em",
              }}
            >
              Welcome back
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/investigators/box/cases/new" style={PRIMARY_BTN}>
              + New case
            </Link>
            <Link href="/investigators/box/graphs" style={SECONDARY_BTN}>
              + New graph
            </Link>
            <button onClick={lock} style={SECONDARY_BTN}>
              Lock
            </button>
          </div>
        </div>

        {/* Metrics strip */}
        <div
          style={{
            display: "flex",
            gap: 40,
            paddingTop: 28,
            paddingBottom: 24,
            marginTop: 24,
            marginBottom: 32,
            borderTop: `1px solid ${LINE}`,
            borderBottom: `1px solid ${LINE}`,
            flexWrap: "wrap",
          }}
        >
          {(
            [
              { key: "activeCases", label: "Active cases" },
              { key: "trackedEntities", label: "Tracked entities" },
              { key: "openHypotheses", label: "Open hypotheses" },
              { key: "publishReadyCases", label: "Publish ready" },
            ] as const
          ).map((m) => {
            const val = metrics[m.key];
            return (
              <div key={m.key}>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
                  {metricsError ? "—" : val ?? "—"}
                </div>
                <div
                  style={{
                    textTransform: "uppercase",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: DIMMER,
                    marginTop: 6,
                  }}
                >
                  {m.label}
                </div>
              </div>
            );
          })}
          {metricsError && (
            <div
              style={{
                fontSize: 11,
                color: "#FF3B5C",
                alignSelf: "center",
                marginLeft: "auto",
              }}
            >
              Couldn&apos;t load metrics — try refreshing
            </div>
          )}
        </div>

        {/* Two-column: Recent cases + Graphs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
            gap: 32,
          }}
          className="dashboard-cols"
        >
          {/* LEFT: Recent cases */}
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: ACCENT,
                }}
              >
                Resume work
              </h2>
              <Link
                href="/investigators/box"
                style={{ fontSize: 12, color: DIM, textDecoration: "none" }}
              >
                View all cases →
              </Link>
            </div>

            {loadingCases ? (
              <div style={{ fontSize: 13, color: DIMMER }}>Loading cases…</div>
            ) : cases.length === 0 ? (
              <div
                style={{
                  border: `1px dashed ${LINE}`,
                  borderRadius: 6,
                  padding: 32,
                  textAlign: "center",
                  backgroundColor: SURFACE,
                }}
              >
                <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)" }}>
                  No active cases yet
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: DIMMER,
                    marginTop: 8,
                    lineHeight: 1.6,
                    maxWidth: 360,
                    margin: "8px auto 0",
                  }}
                >
                  Open a case to start depositing wallets, evidence and notes —
                  everything is encrypted client-side before it reaches our
                  servers.
                </div>
                <Link
                  href="/investigators/box/cases/new"
                  style={{ ...PRIMARY_BTN, marginTop: 20 }}
                >
                  Create your first case
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {cases.map((c) => (
                  <Link
                    key={c.id}
                    href={`/investigators/box/cases/${c.id}`}
                    className="dashboard-case"
                    style={{
                      border: `1px solid ${LINE}`,
                      borderRadius: 6,
                      padding: 18,
                      backgroundColor: SURFACE,
                      textDecoration: "none",
                      display: "block",
                      transition: "border-color 150ms",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#FFFFFF",
                          wordBreak: "break-word",
                          flex: 1,
                        }}
                      >
                        {c.title}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "3px 8px",
                          borderRadius: 4,
                          backgroundColor: "rgba(255,255,255,0.06)",
                          color: DIM,
                          alignSelf: "flex-start",
                        }}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 10,
                      }}
                    >
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "rgba(255,255,255,0.5)",
                            border: `1px solid ${LINE}`,
                            borderRadius: 4,
                            padding: "2px 8px",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: DIMMER,
                      }}
                    >
                      <span>
                        {c.entityCount} entities · {c.fileCount} files
                      </span>
                      <span style={{ color: ACCENT }}>Continue →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* RIGHT: Quick actions + Graphs */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <section>
              <h2
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: ACCENT,
                  marginBottom: 16,
                }}
              >
                Quick actions
              </h2>
              <div style={{ display: "grid", gap: 8 }}>
                <Link
                  href="/investigators/box/cases/new"
                  className="dashboard-quick"
                  style={QUICK_ROW}
                >
                  <span>New case</span>
                  <span style={{ color: DIMMER }}>→</span>
                </Link>
                <Link href="/en/demo" className="dashboard-quick" style={QUICK_ROW}>
                  <span>Scan a wallet or URL</span>
                  <span style={{ color: DIMMER }}>→</span>
                </Link>
                <Link
                  href="/investigators/box/redact"
                  className="dashboard-quick"
                  style={QUICK_ROW}
                >
                  <span>Redact screenshot</span>
                  <span style={{ color: DIMMER }}>→</span>
                </Link>
                <Link href="/en/kol" className="dashboard-quick" style={QUICK_ROW}>
                  <span>KOL registry lookup</span>
                  <span style={{ color: DIMMER }}>→</span>
                </Link>
              </div>
            </section>

            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: ACCENT,
                  }}
                >
                  Your graphs
                </h2>
                <Link
                  href="/investigators/box/network"
                  style={{ fontSize: 11, color: DIM, textDecoration: "none" }}
                >
                  Open →
                </Link>
              </div>
              {graphs.length === 0 ? (
                <div
                  style={{
                    border: `1px dashed ${LINE}`,
                    borderRadius: 6,
                    padding: 16,
                    backgroundColor: SURFACE,
                    fontSize: 12,
                    color: DIMMER,
                    lineHeight: 1.6,
                  }}
                >
                  No personal graphs yet. Build one from your case entities — it
                  stays private until you promote it to the team pool.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {graphs.slice(0, 3).map((g) => (
                    <GraphRow key={g.id} g={g} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: ACCENT,
                  }}
                >
                  Team pool
                </h2>
                <span style={{ fontSize: 11, color: DIMMER }}>Read-only</span>
              </div>
              {teamGraphs.length === 0 ? (
                <div
                  style={{
                    border: `1px dashed ${LINE}`,
                    borderRadius: 6,
                    padding: 16,
                    backgroundColor: SURFACE,
                    fontSize: 12,
                    color: DIMMER,
                    lineHeight: 1.6,
                  }}
                >
                  Nothing shared with the team pool yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {teamGraphs.slice(0, 3).map((g) => (
                    <GraphRow key={g.id} g={g} />
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      <style>{`
        .dashboard-case:hover { border-color: rgba(255,107,0,0.35) !important; }
        .dashboard-quick:hover { color: #fff !important; border-color: rgba(255,107,0,0.25) !important; }
        @media (max-width: 860px) {
          .dashboard-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

const QUICK_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  border: `1px solid ${LINE}`,
  borderRadius: 6,
  backgroundColor: SURFACE,
  fontSize: 13,
  color: "rgba(255,255,255,0.75)",
  textDecoration: "none",
  transition: "color 150ms, border-color 150ms",
};

function GraphRow({ g }: { g: GraphSummary }) {
  const badgeColor =
    g.visibility === "PUBLIC"
      ? "#FFB800"
      : g.visibility === "TEAM_POOL"
      ? ACCENT
      : "rgba(255,255,255,0.5)";
  return (
    <div
      style={{
        border: `1px solid ${LINE}`,
        borderRadius: 6,
        padding: 12,
        backgroundColor: SURFACE,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#FFFFFF",
            wordBreak: "break-word",
          }}
        >
          {g.title}
        </span>
        <span
          style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: badgeColor,
            flexShrink: 0,
          }}
        >
          {g.visibility.replace("_", " ")}
        </span>
      </div>
      <div style={{ fontSize: 11, color: DIMMER, marginTop: 6 }}>
        {g.nodeCount} nodes
      </div>
    </div>
  );
}

export default function DashboardWorkspace() {
  return (
    <VaultGate>
      <WorkspaceInner />
    </VaultGate>
  );
}
