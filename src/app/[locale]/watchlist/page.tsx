"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Watch = {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  lastScore: number | null;
  lastTier: string | null;
  lastGovernedStatus: string | null;
  lastScannedAt: string | null;
  alertCount: number;
  createdAt: string;
};

function tierColor(tier: string | null): string {
  if (tier === "RED") return "#FF3B5C";
  if (tier === "ORANGE") return "#FF6B00";
  if (tier === "GREEN") return "#4ADE80";
  return "rgba(255,255,255,0.3)";
}

function truncateAddress(addr: string): string {
  if (addr.length <= 18) return addr;
  return addr.slice(0, 8) + "…" + addr.slice(-8);
}

function hoursAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / (1000 * 60 * 60));
  if (h < 1) return "just now";
  if (h === 1) return "1 hour ago";
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

export default function WatchlistPage() {
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watch")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/access";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setWatches(d.watches ?? []);
      })
      .catch((err) => {
        if (!cancelled && err?.message !== "unauthorized") {
          setError("Failed to load watchlist.");
          setWatches([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(id: string) {
    if (removing) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/watch/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWatches((prev) => (prev ?? []).filter((w) => w.id !== id));
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        color: "#FFFFFF",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "60px 24px" }}>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "#FF6B00",
            marginBottom: 8,
          }}
        >
          INTERLIGENS · WATCH
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: 8,
          }}
        >
          My Watchlist
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 40,
            lineHeight: 1.7,
          }}
        >
          Addresses you&apos;ve chosen to track. We re-scan them daily and
          alert you if the TigerScore, tier, or governed status changes.
        </p>

        {watches === null && (
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.3)",
              padding: "20px 0",
            }}
          >
            Loading your watchlist…
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#FF3B5C",
              padding: "12px 16px",
              border: "1px solid rgba(255,59,92,0.3)",
              borderRadius: 6,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {watches && watches.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              backgroundColor: "#0a0a0a",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 8,
              }}
            >
              No addresses watched yet.
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1.7,
              }}
            >
              Scan an address on the demo page. If the score is in the
              attention zone, click <strong>Watch this address</strong> to
              track it here.
            </div>
            <Link
              href="/en/demo"
              style={{
                display: "inline-block",
                marginTop: 20,
                padding: "10px 18px",
                backgroundColor: "#FF6B00",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Go to scanner →
            </Link>
          </div>
        )}

        {watches && watches.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {watches.map((w) => (
              <div
                key={w.id}
                style={{
                  padding: 18,
                  backgroundColor: "#0a0a0a",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 13,
                          color: "#FFFFFF",
                          wordBreak: "break-all",
                        }}
                      >
                        {truncateAddress(w.address)}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "2px 8px",
                          borderRadius: 4,
                          backgroundColor: "rgba(255,107,0,0.1)",
                          color: "#FF6B00",
                          border: "1px solid rgba(255,107,0,0.3)",
                        }}
                      >
                        {w.chain}
                      </span>
                      {w.alertCount > 0 && (
                        <span
                          style={{
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            padding: "2px 8px",
                            borderRadius: 4,
                            backgroundColor: "rgba(255,59,92,0.08)",
                            color: "#FF3B5C",
                            border: "1px solid rgba(255,59,92,0.4)",
                          }}
                        >
                          {w.alertCount} new alert
                          {w.alertCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      {w.lastScore != null && (
                        <span>
                          TigerScore:{" "}
                          <strong style={{ color: tierColor(w.lastTier) }}>
                            {w.lastScore}
                          </strong>
                          {w.lastTier && (
                            <span
                              style={{
                                marginLeft: 6,
                                color: tierColor(w.lastTier),
                                fontWeight: 600,
                              }}
                            >
                              {w.lastTier}
                            </span>
                          )}
                        </span>
                      )}
                      {w.lastScore == null && <span>Not scanned yet</span>}
                      <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
                      <span>Last scanned: {hoursAgo(w.lastScannedAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Link
                      href={`/en/demo?addr=${encodeURIComponent(w.address)}`}
                      style={{
                        fontSize: 11,
                        padding: "6px 12px",
                        border: "1px solid rgba(255,107,0,0.3)",
                        backgroundColor: "rgba(255,107,0,0.05)",
                        color: "#FF6B00",
                        borderRadius: 4,
                        textDecoration: "none",
                      }}
                    >
                      Scan now
                    </Link>
                    <button
                      onClick={() => handleRemove(w.id)}
                      disabled={removing === w.id}
                      style={{
                        fontSize: 11,
                        padding: "6px 12px",
                        border: "1px solid rgba(255,255,255,0.12)",
                        backgroundColor: "transparent",
                        color: "rgba(255,255,255,0.5)",
                        borderRadius: 4,
                        cursor: removing === w.id ? "wait" : "pointer",
                        opacity: removing === w.id ? 0.6 : 1,
                      }}
                    >
                      {removing === w.id ? "…" : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
