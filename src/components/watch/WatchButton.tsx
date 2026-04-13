"use client";

import { useEffect, useState } from "react";

type Props = {
  address: string;
  chain: string; // raw from the scan result — we normalize internally
  score: number;
};

function normalizeChain(raw: string): string | null {
  const c = raw.toLowerCase().trim();
  if (c === "sol" || c === "solana") return "solana";
  if (c === "eth" || c === "ethereum") return "ethereum";
  if (c === "base") return "base";
  if (c === "arb" || c === "arbitrum") return "arbitrum";
  return null;
}

export default function WatchButton({ address, chain, score }: Props) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show if score is in attention zone (ORANGE or RED).
  const shouldShow = score >= 30;

  useEffect(() => {
    if (!shouldShow) return;
    // Check if already in watchlist on mount.
    fetch("/api/watch")
      .then((r) => (r.ok ? r.json() : { watches: [] }))
      .then((d) => {
        const nc = normalizeChain(chain);
        const hit = (d.watches ?? []).find(
          (w: { address: string; chain: string }) =>
            w.address.toLowerCase() === address.toLowerCase() &&
            w.chain === nc
        );
        if (hit) setWatching(true);
      })
      .catch(() => {});
  }, [address, chain, shouldShow]);

  async function handleToggle() {
    if (loading) return;
    setError(null);
    const nc = normalizeChain(chain);
    if (!nc) {
      setError("Unsupported chain");
      return;
    }
    setLoading(true);
    try {
      if (watching) {
        // Find and delete.
        const listRes = await fetch("/api/watch");
        if (!listRes.ok) throw new Error("list_failed");
        const listData = await listRes.json();
        const hit = (listData.watches ?? []).find(
          (w: { id: string; address: string; chain: string }) =>
            w.address.toLowerCase() === address.toLowerCase() && w.chain === nc
        );
        if (hit) {
          const delRes = await fetch(`/api/watch/${hit.id}`, {
            method: "DELETE",
          });
          if (!delRes.ok && delRes.status !== 401) throw new Error("delete_failed");
          if (delRes.status === 401) {
            window.location.href = "/access";
            return;
          }
        }
        setWatching(false);
      } else {
        const res = await fetch("/api/watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, chain: nc }),
        });
        if (res.status === 401) {
          window.location.href = "/access";
          return;
        }
        if (!res.ok) throw new Error("watch_failed");
        setWatching(true);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? "Action failed. Try again."
          : "Action failed."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!shouldShow) return null;

  const BellIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );

  const CheckIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  return (
    <div style={{ width: "100%", marginTop: 8 }}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          border: watching
            ? "1px solid rgba(74,222,128,0.4)"
            : "1px solid rgba(255,107,0,0.3)",
          backgroundColor: watching
            ? "rgba(74,222,128,0.05)"
            : "rgba(255,107,0,0.05)",
          color: watching ? "#4ADE80" : "#FF6B00",
          borderRadius: 6,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.6 : 1,
          transition: "all 150ms ease",
          fontFamily: "inherit",
        }}
      >
        {watching ? <CheckIcon /> : <BellIcon />}
        <span>
          {loading
            ? "Working…"
            : watching
              ? "Watching — click to stop"
              : "Watch this address"}
        </span>
      </button>
      {error && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "#FF3B5C",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
