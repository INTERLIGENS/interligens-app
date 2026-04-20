"use client";

import { useEffect, useState } from "react";

type EquitySignal = {
  id: string;
  ticker: string;
  entityName: string;
  tradeDate: string;
  tweetDate: string | null;
  deltaHours: number | null;
  suspectLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notes: string | null;
  source: string;
  createdAt: string;
};

const PAGE_BG = "#000000";
const SURFACE = "#0a0a0a";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.5)";
const ACCENT = "#FF6B00";

const LEVEL_COLORS: Record<EquitySignal["suspectLevel"], string> = {
  LOW: "rgba(255,255,255,0.4)",
  MEDIUM: "#FFB800",
  HIGH: "#FF6B00",
  CRITICAL: "#ff4040",
};

export default function AdminEquityPage() {
  const [signals, setSignals] = useState<EquitySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [ticker, setTicker] = useState("");
  const [entityName, setEntityName] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [tweetDate, setTweetDate] = useState("");
  const [suspectLevel, setSuspectLevel] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("LOW");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/equity", { credentials: "include" });
      if (!res.ok) {
        setErr(`load failed: ${res.status}`);
        setSignals([]);
        return;
      }
      const data = (await res.json()) as { signals: EquitySignal[]; pending?: boolean };
      setSignals(data.signals ?? []);
      setPending(Boolean(data.pending));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErr(null);
    setSubmitting(true);
    try {
      const tweet = tweetDate ? new Date(tweetDate) : null;
      const trade = new Date(tradeDate);
      const deltaHours =
        tweet && !Number.isNaN(trade.getTime())
          ? (tweet.getTime() - trade.getTime()) / 3_600_000
          : null;

      const res = await fetch("/api/admin/equity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticker,
          entityName,
          tradeDate,
          tweetDate: tweetDate || null,
          deltaHours,
          suspectLevel,
          notes: notes || null,
          source,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `create failed: ${res.status}`);
        return;
      }
      setTicker("");
      setEntityName("");
      setTradeDate("");
      setTweetDate("");
      setSuspectLevel("LOW");
      setSource("");
      setNotes("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: PAGE_BG, color: "#FFF", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: MUTED,
          }}
        >
          ADMIN · EQUITY WATCH
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>Equity signal board</h1>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5, marginTop: 8, maxWidth: 680 }}>
          Silent intake for suspected insider equity trades tied to upcoming tweets or public
          announcements. All entries are admin-only — no retail exposure.
        </p>

        {pending && (
          <div
            style={{
              marginTop: 20,
              padding: 14,
              border: `1px solid rgba(255,107,0,0.4)`,
              borderRadius: 6,
              background: "rgba(255,107,0,0.07)",
              color: ACCENT,
              fontSize: 12,
            }}
          >
            ⚠ Migration pending. Paste{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>
              prisma/migrations/manual_equity_watch/migration.sql
            </code>{" "}
            in the Neon SQL Editor to activate this page.
          </div>
        )}

        {err && (
          <div
            style={{
              marginTop: 20,
              padding: 12,
              border: `1px solid rgba(255,64,64,0.4)`,
              borderRadius: 6,
              background: "rgba(255,64,64,0.08)",
              color: "#ff7070",
              fontSize: 12,
            }}
          >
            {err}
          </div>
        )}

        {/* ── New entry form ─────────────────────────────────────────── */}
        <form
          onSubmit={onSubmit}
          style={{
            marginTop: 24,
            padding: 20,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <Field label="Ticker" required>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Entity name" required>
            <input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="Apple Inc."
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Trade date" required>
            <input
              type="datetime-local"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Tweet date (optional)">
            <input
              type="datetime-local"
              value={tweetDate}
              onChange={(e) => setTweetDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Suspect level">
            <select
              value={suspectLevel}
              onChange={(e) => setSuspectLevel(e.target.value as typeof suspectLevel)}
              style={inputStyle}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </Field>
          <Field label="Source" required>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="SEC filing, Bloomberg, ..."
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Notes" span={2}>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Free text"
              style={inputStyle}
            />
          </Field>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={submitting || !ticker || !entityName || !tradeDate || !source}
              style={{
                background: ACCENT,
                color: "#FFFFFF",
                border: 0,
                padding: "10px 18px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Saving…" : "Add signal"}
            </button>
          </div>
        </form>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 28 }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: MUTED,
              marginBottom: 10,
            }}
          >
            Recent signals {loading ? "· loading…" : `· ${signals.length}`}
          </div>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  <Th>Ticker</Th>
                  <Th>Entity</Th>
                  <Th>Trade</Th>
                  <Th>Tweet</Th>
                  <Th>Δ hrs</Th>
                  <Th>Level</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {signals.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} style={{ padding: "20px", color: MUTED, textAlign: "center" }}>
                      No signals yet.
                    </td>
                  </tr>
                )}
                {signals.map((s) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <Td>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#FFF" }}>
                        {s.ticker}
                      </span>
                    </Td>
                    <Td>{s.entityName}</Td>
                    <Td>{new Date(s.tradeDate).toISOString().slice(0, 16).replace("T", " ")}</Td>
                    <Td>
                      {s.tweetDate
                        ? new Date(s.tweetDate).toISOString().slice(0, 16).replace("T", " ")
                        : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                    </Td>
                    <Td>
                      {s.deltaHours == null
                        ? "—"
                        : <span style={{ fontFamily: "ui-monospace, monospace" }}>{s.deltaHours.toFixed(1)}</span>}
                    </Td>
                    <Td>
                      <span
                        style={{
                          color: LEVEL_COLORS[s.suspectLevel],
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontSize: 11,
                        }}
                      >
                        {s.suspectLevel}
                      </span>
                    </Td>
                    <Td>{s.source}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Small render helpers ──────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 5,
  padding: "8px 10px",
  color: "#FFF",
  fontSize: 12,
  outline: "none",
};

function Field({
  label,
  required,
  span,
  children,
}: {
  label: string;
  required?: boolean;
  span?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <label
        style={{
          display: "block",
          textTransform: "uppercase",
          fontSize: 10,
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.4)",
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: "#FF6B00", marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: "left",
        textTransform: "uppercase",
        fontSize: 10,
        letterSpacing: "0.1em",
        color: "rgba(255,255,255,0.5)",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.85)" }}>{children}</td>
  );
}
