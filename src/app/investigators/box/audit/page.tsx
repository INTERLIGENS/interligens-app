"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { describeResponse } from "@/lib/investigators/errorMessages";

type Entry = {
  id: string;
  action: string;
  actor: string;
  ipAddress: string | null;
  userAgent: string | null;
  caseId: string | null;
  createdAt: string;
};

const ACCENT = "#FF6B00";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";

export default function AuditLogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/investigators/audit/mine");
      if (!res.ok) {
        setError(describeResponse(res));
        return;
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      setError("Couldn't reach the server — check your connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div style={{ marginBottom: 8 }}>
          <Link
            href="/investigators/box/trust"
            style={{ fontSize: 11, color: DIM, textDecoration: "none" }}
          >
            ← Trust model
          </Link>
        </div>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: DIM,
            marginTop: 12,
          }}
        >
          INTERLIGENS · AUDIT TRAIL
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginTop: 8,
            letterSpacing: "-0.01em",
          }}
        >
          Your session audit trail
        </h1>
        <p
          style={{
            fontSize: 13,
            color: DIM,
            marginTop: 10,
            lineHeight: 1.6,
            maxWidth: 620,
          }}
        >
          This is every audit entry attached to your access or workspace — the
          same log we reference in the trust model. IP addresses are stored
          hashed; we never keep the raw value.
        </p>

        <div style={{ marginTop: 32 }}>
          {loading && (
            <div style={{ fontSize: 13, color: DIM }}>Loading…</div>
          )}
          {error && (
            <div
              role="alert"
              style={{
                border: "1px solid rgba(255,59,92,0.35)",
                background: "rgba(255,59,92,0.08)",
                borderRadius: 6,
                padding: "12px 14px",
                fontSize: 13,
                color: "#FF9AAB",
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={load}
                style={{
                  background: "transparent",
                  color: "#FF9AAB",
                  border: "1px solid rgba(255,154,171,0.4)",
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div style={{ fontSize: 13, color: DIM }}>No audit entries yet.</div>
          )}
          {!loading && !error && entries.length > 0 && (
            <div
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    <th style={TH}>When</th>
                    <th style={TH}>Action</th>
                    <th style={TH}>Actor</th>
                    <th style={TH}>IP (hash)</th>
                    <th style={TH}>Case</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      style={{ borderTop: `1px solid ${LINE}` }}
                    >
                      <td style={TD}>
                        {new Date(e.createdAt).toLocaleString("en-US")}
                      </td>
                      <td style={TD}>
                        <span style={{ color: ACCENT }}>{e.action}</span>
                      </td>
                      <td style={TD}>{e.actor}</td>
                      <td style={{ ...TD, fontFamily: "ui-monospace, monospace", color: DIM }}>
                        {e.ipAddress
                          ? e.ipAddress.slice(0, 10) + "…"
                          : "—"}
                      </td>
                      <td style={{ ...TD, fontFamily: "ui-monospace, monospace", color: DIM }}>
                        {e.caseId ? e.caseId.slice(0, 8) + "…" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const TH: React.CSSProperties = {
  textAlign: "left",
  textTransform: "uppercase",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: DIM,
  padding: "10px 12px",
  fontWeight: 600,
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  color: "#FFFFFF",
  verticalAlign: "top",
};
