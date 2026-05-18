"use client";

import { useEffect, useState, useCallback } from "react";

type CandidateMatch = {
  kolHandle: string;
  address: string;
  label: string | null;
  confidence: string;
  attributionStatus: string;
};

type QueueItem = {
  eventId: string;
  address: string;
  chain: string;
  confidence: string;
  evidence: string[];
  candidateMatches: CandidateMatch[];
  createdAt: string;
  ageMs: number;
};

type QueueResponse = {
  total: number;
  items: QueueItem[];
};

type ResolveAction = "confirm_link" | "reject" | "create_candidate" | "merge_to_existing";

function fmtAge(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 48) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const color =
    confidence === "high" || confidence === "exact" || confidence === "strong"
      ? "#00FF94"
      : confidence === "medium" || confidence === "probable"
      ? "#FFB800"
      : "#FF3B5C";
  return (
    <span
      style={{ color, border: `1px solid ${color}` }}
      className="px-2 py-0.5 text-xs font-black tracking-widest rounded"
    >
      {confidence.toUpperCase()}
    </span>
  );
}

function QueueCard({
  item,
  onResolved,
}: {
  item: QueueItem;
  onResolved: () => void;
}) {
  const [handle, setHandle] = useState(
    item.candidateMatches[0]?.kolHandle ?? ""
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState<ResolveAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: ResolveAction) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/identity/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: item.eventId, action, handle: handle || undefined, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onResolved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="rounded border p-4 flex flex-col gap-3"
      style={{ borderColor: "#FF6B00", background: "#0a0a0a" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-sm text-white break-all">{item.address}</span>
          <span
            className="ml-2 px-2 py-0.5 text-xs font-black tracking-widest rounded"
            style={{ background: "#FF6B00", color: "#000" }}
          >
            {item.chain}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceBadge confidence={item.confidence} />
          <span className="text-xs text-gray-500">{fmtAge(item.ageMs)} ago</span>
        </div>
      </div>

      {/* Evidence */}
      {item.evidence.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.evidence.map((e, i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-xs rounded"
              style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #333" }}
            >
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Candidate matches */}
      {item.candidateMatches.length > 0 && (
        <div>
          <p className="text-xs font-black tracking-widest text-gray-500 mb-1">CANDIDATE MATCHES</p>
          <div className="flex flex-col gap-1">
            {item.candidateMatches.map((c, i) => (
              <button
                key={i}
                onClick={() => setHandle(c.kolHandle)}
                className="text-left px-2 py-1 rounded text-xs font-mono hover:opacity-80 transition-opacity"
                style={{
                  background: handle === c.kolHandle ? "#1a0a00" : "#111",
                  border: `1px solid ${handle === c.kolHandle ? "#FF6B00" : "#333"}`,
                  color: "#fff",
                }}
              >
                <span style={{ color: "#FF6B00" }}>{c.kolHandle}</span>
                <span className="text-gray-500 ml-2">{c.address.slice(0, 12)}…</span>
                <span className="text-gray-600 ml-2">{c.confidence}/{c.attributionStatus}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Handle input */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-black tracking-widest text-gray-500">HANDLE TARGET</label>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle"
          className="bg-black border rounded px-3 py-1.5 text-sm text-white font-mono outline-none focus:border-orange-500"
          style={{ borderColor: "#333" }}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-black tracking-widest text-gray-500">NOTES (OPTIONAL)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Resolution notes…"
          className="bg-black border rounded px-3 py-1.5 text-sm text-white outline-none focus:border-orange-500"
          style={{ borderColor: "#333" }}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <ActionBtn
          label="CONFIRM LINK"
          action="confirm_link"
          color="#00FF94"
          loading={loading}
          disabled={!handle}
          onClick={() => resolve("confirm_link")}
        />
        <ActionBtn
          label="MERGE"
          action="merge_to_existing"
          color="#FFB800"
          loading={loading}
          disabled={!handle}
          onClick={() => resolve("merge_to_existing")}
        />
        <ActionBtn
          label="CREATE CANDIDATE"
          action="create_candidate"
          color="#FF6B00"
          loading={loading}
          onClick={() => resolve("create_candidate")}
        />
        <ActionBtn
          label="REJECT"
          action="reject"
          color="#FF3B5C"
          loading={loading}
          onClick={() => resolve("reject")}
        />
      </div>

      {error && (
        <p className="text-xs font-mono" style={{ color: "#FF3B5C" }}>
          ERROR: {error}
        </p>
      )}
    </div>
  );
}

function ActionBtn({
  label,
  action,
  color,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  action: ResolveAction;
  color: string;
  loading: ResolveAction | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isLoading = loading === action;
  return (
    <button
      onClick={onClick}
      disabled={!!loading || disabled}
      className="px-3 py-1.5 text-xs font-black tracking-widest rounded transition-opacity hover:opacity-80 disabled:opacity-40"
      style={{ background: color, color: "#000" }}
    >
      {isLoading ? "..." : label}
    </button>
  );
}

export default function AdminIdentityPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/identity/queue");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen p-6" style={{ background: "#000", color: "#fff" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black tracking-widest uppercase" style={{ color: "#FF6B00" }}>
            IDENTITY QUEUE
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            identity.review_required — pending resolutions
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-xs text-gray-600">
              Refreshed {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs font-black tracking-widest rounded hover:opacity-80 transition-opacity"
            style={{ background: "#FF6B00", color: "#000" }}
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded mb-6"
          style={{ background: "#0a0a0a", border: "1px solid #333" }}
        >
          <span className="text-2xl font-black" style={{ color: "#FF6B00" }}>
            {data.total}
          </span>
          <span className="text-xs text-gray-500 font-black tracking-widest uppercase">
            events in queue
          </span>
        </div>
      )}

      {/* States */}
      {loading && (
        <p className="text-sm text-gray-500">Loading queue…</p>
      )}
      {error && (
        <p className="text-sm font-mono" style={{ color: "#FF3B5C" }}>
          ERROR: {error}
        </p>
      )}

      {/* Queue */}
      {data && data.items.length === 0 && (
        <div
          className="rounded p-8 text-center"
          style={{ border: "1px solid #333" }}
        >
          <p className="text-gray-500 text-sm font-black tracking-widest">QUEUE EMPTY</p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className="flex flex-col gap-4 max-w-2xl">
          {data.items.map((item) => (
            <QueueCard key={item.eventId} item={item} onResolved={load} />
          ))}
        </div>
      )}
    </div>
  );
}
