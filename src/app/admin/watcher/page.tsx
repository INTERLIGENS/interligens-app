"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type Summary = {
  kolCount: number;
  signalCount: number;
  campaignCount: number;
  highPriorityCount: number;
  lastScanAt: string | null;
  lastDigestStatus: string | null;
};

type CampaignKol = {
  kolHandle: string;
  signalCount: number;
};

type Campaign = {
  id: string;
  primaryTokenSymbol: string | null;
  primaryContractAddress: string | null;
  priority: string;
  status: string;
  signalCount: number;
  kolCount: number;
  lastSeenAt: string;
  firstSeenAt: string;
  claimPatterns: string;
  campaignKols: CampaignKol[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#FF3B5C",
  HIGH:     "#FF6B00",
  MEDIUM:   "#FFB800",
  LOW:      "#4a4a4a",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "#00FF94",
  WATCHING:  "#FFB800",
  RESOLVED:  "#4a4a4a",
  DISMISSED: "#2a2a2a",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-block",
      background: `${color}20`,
      color,
      border: `1px solid ${color}50`,
      fontSize: 9,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      padding: "2px 7px",
      borderRadius: 3,
    }}>
      {label}
    </span>
  );
}

function StatBox({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1,
      background: "#0d0d0d",
      border: `1px solid ${accent ? "#FF6B00" : "#1c1c1c"}`,
      borderRadius: 8,
      padding: "16px 12px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: accent ? "#FF6B00" : "#FFFFFF" }}>
        {value}
      </div>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", marginTop: 5 }}>
        {label}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WatcherDashboard() {
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId]     = useState<string | null>(null);

  const adminToken =
    typeof window !== "undefined"
      ? (document.cookie.match(/admin_token=([^;]+)/)?.[1] ?? "")
      : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, camRes] = await Promise.all([
        fetch("/api/admin/watcher/summary", {
          headers: { "x-admin-token": adminToken },
        }),
        fetch(
          `/api/admin/watcher/campaigns?page=${page}${statusFilter ? `&status=${statusFilter}` : ""}`,
          { headers: { "x-admin-token": adminToken } }
        ),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (camRes.ok) {
        const data = await camRes.json();
        setCampaigns(data.campaigns ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, adminToken]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      await fetch("/api/admin/watcher/campaigns", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ id, status }),
      });
      await load();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1100, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#FFFFFF" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "#FF6B00", fontWeight: 700 }}>
          INTERLIGENS · WATCHER
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, letterSpacing: "-0.02em" }}>
          Campaign Intelligence Dashboard
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
          Auto-refreshes every 60s
          {summary?.lastScanAt && ` · Last scan: ${new Date(summary.lastScanAt).toLocaleString()}`}
          {summary?.lastDigestStatus && ` · Digest: ${summary.lastDigestStatus}`}
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          <StatBox value={summary.kolCount}    label="KOLs Today"    accent />
          <StatBox value={summary.signalCount} label="Signals Today"  />
          <StatBox value={summary.campaignCount} label="Campaigns"    />
          <StatBox value={summary.highPriorityCount} label="High Priority" accent={summary.highPriorityCount > 0} />
        </div>
      )}

      {/* Campaigns section */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#FF6B00", fontWeight: 700 }}>
          Campaigns ({total})
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ background: "#111", color: "#FFFFFF", border: "1px solid #2a2a2a", borderRadius: 4, padding: "4px 8px", fontSize: 11 }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="WATCHING">Watching</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
          <a
            href="/admin/social/candidates"
            style={{ fontSize: 11, color: "#FF6B00", textDecoration: "none", border: "1px solid #FF6B0040", padding: "4px 10px", borderRadius: 4 }}
          >
            Raw Signals →
          </a>
        </div>
      </div>

      {/* Campaigns table */}
      <div style={{ background: "#080808", border: "1px solid #1a1a1a", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#101010" }}>
              {["Priority", "Token / Contract", "KOLs", "Signals", "Status", "Last Seen", "Actions"].map((h) => (
                <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px 14px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  Loading…
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px 14px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  No campaigns found.
                </td>
              </tr>
            ) : campaigns.map((c) => {
              const claims = (() => { try { return JSON.parse(c.claimPatterns) as string[]; } catch { return []; } })();
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #181818" }}>
                  <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                    <Badge label={c.priority} color={PRIORITY_COLOR[c.priority] ?? "#4a4a4a"} />
                  </td>
                  <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                      {c.primaryTokenSymbol ? `$${c.primaryTokenSymbol}` : "—"}
                    </div>
                    {c.primaryContractAddress && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginTop: 2 }}>
                        {c.primaryContractAddress.slice(0, 14)}…
                      </div>
                    )}
                    {claims.length > 0 && (
                      <div style={{ fontSize: 9, color: "#FFB800", marginTop: 3 }}>
                        {claims.join(", ")}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", verticalAlign: "top", fontSize: 11 }}>
                    {c.campaignKols.slice(0, 4).map((k) => (
                      <a key={k.kolHandle} href={`/admin/kol?handle=${k.kolHandle}`}
                        style={{ display: "block", color: "#FF6B00", textDecoration: "none", marginBottom: 1 }}>
                        @{k.kolHandle} <span style={{ color: "rgba(255,255,255,0.3)" }}>({k.signalCount})</span>
                      </a>
                    ))}
                    {c.kolCount > 4 && (
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>+{c.kolCount - 4} more</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 15, fontWeight: 700 }}>
                    {c.signalCount}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <Badge label={c.status} color={STATUS_COLOR[c.status] ?? "#4a4a4a"} />
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                    {new Date(c.lastSeenAt).toLocaleDateString()}<br />
                    <span style={{ fontSize: 10 }}>{new Date(c.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <select
                      disabled={updatingId === c.id}
                      value={c.status}
                      onChange={(e) => updateStatus(c.id, e.target.value)}
                      style={{ background: "#111", color: "#FFFFFF", border: "1px solid #2a2a2a", borderRadius: 4, padding: "3px 6px", fontSize: 10, cursor: "pointer" }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="WATCHING">Watching</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="DISMISSED">Dismissed</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            style={{ background: "#111", color: "#FFFFFF", border: "1px solid #2a2a2a", borderRadius: 4, padding: "6px 14px", fontSize: 11, cursor: page > 1 ? "pointer" : "default", opacity: page > 1 ? 1 : 0.4 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "6px 8px" }}>
            Page {page} of {Math.ceil(total / 25)}
          </span>
          <button disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((p) => p + 1)}
            style={{ background: "#111", color: "#FFFFFF", border: "1px solid #2a2a2a", borderRadius: 4, padding: "6px 14px", fontSize: 11, cursor: page < Math.ceil(total / 25) ? "pointer" : "default", opacity: page < Math.ceil(total / 25) ? 1 : 0.4 }}>
            Next →
          </button>
        </div>
      )}

      {/* Link to raw signals */}
      <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 20, display: "flex", gap: 12 }}>
        <a href="/admin/social/candidates"
          style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none", padding: "6px 12px", border: "1px solid #2a2a2a", borderRadius: 4 }}>
          Raw Signals (SocialPostCandidate) →
        </a>
        <a href="/admin/kol"
          style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none", padding: "6px 12px", border: "1px solid #2a2a2a", borderRadius: 4 }}>
          KOL Registry →
        </a>
      </div>

    </div>
  );
}
