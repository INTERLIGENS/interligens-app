"use client";

import { useState } from "react";

type Verdict = "RED" | "ORANGE" | "GREEN";

type ScoreResponse = {
  score?: number;
  verdict?: Verdict;
  signals?: Array<{ id: string; label: string; severity: string }>;
  error?: string;
  message?: string;
};

/**
 * Jupiter swap demo — UI simulation only. No real Jupiter call, no chain
 * interaction. The point is: a swap UI wired to INTERLIGENS's public
 * `/api/v1/score` endpoint gates the action based on the token's verdict.
 *
 *   RED     → full overlay, swap button disabled
 *   ORANGE  → amber banner, swap button still available
 *   GREEN   → inline checkmark
 *
 * The swap-button handler is a no-op; this page never executes anything
 * on-chain.
 */
export default function JupiterIntegrationDemo() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runScan(e: React.FormEvent) {
    e.preventDefault();
    const target = mint.trim();
    if (!target || loading) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/v1/score?mint=${encodeURIComponent(target)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as ScoreResponse;
      if (!res.ok) {
        setErr(data.message ?? data.error ?? `scan failed: ${res.status}`);
        return;
      }
      setResult(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setLoading(false);
    }
  }

  const verdict = result?.verdict;
  const score = result?.score;

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#FFF", position: "relative" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px 120px" }}>
        <Kicker href="/en/integrations">&larr; Back to integrations</Kicker>

        <div
          style={{
            marginTop: 16,
            display: "inline-block",
            padding: "3px 10px",
            background: "rgba(255,107,0,0.12)",
            border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 3,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "#FF6B00",
          }}
        >
          Demo · Simulation
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginTop: 12, letterSpacing: "-0.01em" }}>
          Jupiter × INTERLIGENS
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.55, marginTop: 10 }}>
          A swap UI that asks INTERLIGENS for the token&rsquo;s verdict{" "}
          <strong>before</strong> the signature prompt. No swap is actually
          executed; this page is a static simulation wired to the public
          <code style={{ color: "#FF6B00", padding: "0 4px" }}>/api/v1/score</code>
          endpoint.
        </p>

        {/* ── SCAN FORM ───────────────────────────────────────────── */}
        <form
          onSubmit={runScan}
          style={{
            marginTop: 32,
            padding: 20,
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
          }}
        >
          <label
            style={{
              display: "block",
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 8,
            }}
          >
            Token mint (SOL)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="A1b2...xyz — a Solana token mint"
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              style={{
                flex: 1,
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "10px 12px",
                color: "#FFF",
                fontSize: 13,
                outline: "none",
                fontFamily: "ui-monospace, monospace",
              }}
            />
            <button
              type="submit"
              disabled={loading || !mint.trim()}
              style={{
                background: "#FF6B00",
                color: "#FFF",
                border: 0,
                padding: "10px 18px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: loading || !mint.trim() ? 0.6 : 1,
              }}
            >
              {loading ? "Scanning…" : "Check token"}
            </button>
          </div>

          {err && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                border: "1px solid rgba(255,64,64,0.4)",
                background: "rgba(255,64,64,0.08)",
                borderRadius: 6,
                color: "#ff7070",
                fontSize: 12,
              }}
            >
              {err}
            </div>
          )}
        </form>

        {/* ── VERDICT ─────────────────────────────────────────────── */}
        {verdict === "GREEN" && (
          <VerdictBar
            tint="#00c46c"
            bg="rgba(0,196,108,0.1)"
            border="rgba(0,196,108,0.35)"
            label={`CLEAR · TigerScore ${score ?? "—"}`}
            text="No critical signals. Still verify the URL and start small."
          />
        )}
        {verdict === "ORANGE" && (
          <VerdictBar
            tint="#FFB800"
            bg="rgba(255,184,0,0.08)"
            border="rgba(255,184,0,0.35)"
            label={`CAUTION · TigerScore ${score ?? "—"}`}
            text="Suspicious signals. Review the case file before signing."
          />
        )}

        {/* ── MOCK SWAP FORM (disabled when RED) ─────────────────── */}
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            opacity: verdict === "RED" ? 0.4 : 1,
            pointerEvents: verdict === "RED" ? "none" : undefined,
          }}
        >
          <SwapRow label="You pay" amount="1.0 SOL" />
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", margin: "6px 0" }}>↓</div>
          <SwapRow
            label="You receive (simulated)"
            amount={mint.trim() ? `~— · ${mint.slice(0, 4)}…${mint.slice(-4)}` : "—"}
          />
          <button
            type="button"
            onClick={() => {}}
            disabled={verdict === "RED"}
            style={{
              marginTop: 18,
              width: "100%",
              background: "#FF6B00",
              color: "#FFF",
              border: 0,
              padding: "12px",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: verdict === "RED" ? "not-allowed" : "pointer",
            }}
          >
            {verdict === "RED" ? "Blocked" : "Swap (simulation)"}
          </button>
        </div>

        {/* ── SIGNALS ─────────────────────────────────────────────── */}
        {result?.signals && result.signals.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 10,
              }}
            >
              Detected signals
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {result.signals.map((s) => (
                <li
                  key={s.id}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  <span>{s.label}</span>
                  <span
                    style={{
                      color:
                        s.severity === "critical" || s.severity === "CRITICAL"
                          ? "#ff4040"
                          : s.severity === "high" || s.severity === "HIGH"
                            ? "#FF6B00"
                            : "rgba(255,255,255,0.45)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                    }}
                  >
                    {s.severity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── RED FULL-PAGE OVERLAY ─────────────────────────────────── */}
      {verdict === "RED" && (
        <div
          role="dialog"
          aria-modal="true"
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
        >
          <div
            style={{
              maxWidth: 480,
              padding: 28,
              background: "#0a0a0a",
              border: "1px solid rgba(255,64,64,0.5)",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#ff4040",
                fontWeight: 700,
              }}
            >
              STOP · High-risk token
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#FFF", marginTop: 10 }}>
              Don&rsquo;t swap this.
            </div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.55, marginTop: 14 }}>
              INTERLIGENS detected {result?.signals?.length ?? "multiple"} critical
              signal{(result?.signals?.length ?? 0) === 1 ? "" : "s"} on this
              token. Signing this swap could result in full loss.
            </p>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setMint("");
              }}
              style={{
                marginTop: 20,
                background: "#ff4040",
                color: "#FFF",
                border: 0,
                padding: "10px 22px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Got it — clear
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function Kicker({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        textTransform: "uppercase",
        fontSize: 11,
        letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.4)",
        textDecoration: "none",
      }}
    >
      {children}
    </a>
  );
}

function VerdictBar({
  tint,
  bg,
  border,
  label,
  text,
}: {
  tint: string;
  bg: string;
  border: string;
  label: string;
  text: string;
}) {
  return (
    <div
      style={{
        marginTop: 20,
        padding: 14,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: tint,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
        {text}
      </p>
    </div>
  );
}

function SwapRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div style={{ padding: "10px 14px", background: "#0d0d0d", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#FFF", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
        {amount}
      </div>
    </div>
  );
}
