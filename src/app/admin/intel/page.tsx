"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function redirectToLogin() {
  if (typeof window === "undefined") return;
  window.location.href = "/admin/login?redirect=/admin/intel";
}

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.5)";
const MUTED = "rgba(255,255,255,0.35)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

type Category = "SCAM" | "COMPETITOR" | "AI" | "REGULATORY" | "ECOSYSTEM";
type Priority = "HIGH" | "NORMAL" | "LOW";

type Item = {
  id: string;
  title: string;
  excerpt: string | null;
  summary: string | null;
  summaryDone: boolean;
  summaryAttempts: number;
  url: string;
  source: string;
  category: Category;
  priority: Priority;
  tags: string[];
  starRating: number;
  starOverride: number | null;
  read: boolean;
  starred: boolean;
  publishedAt: string;
};

type FeedResponse = {
  items: Item[];
  nextCursor: string | null;
  unreadCount: number;
};

const CATEGORY_COLORS: Record<Category, string> = {
  SCAM: "#FF3B5C",
  COMPETITOR: "#F59E0B",
  AI: "#3B82F6",
  REGULATORY: "#8B5CF6",
  ECOSYSTEM: "#6B7280",
};

const CATEGORIES: Array<Category | "ALL"> = [
  "ALL",
  "SCAM",
  "COMPETITOR",
  "AI",
  "REGULATORY",
  "ECOSYSTEM",
];

const STAR_FILTERS = [
  { label: "ALL", value: 0 },
  { label: "3+", value: 3 },
  { label: "4+", value: 4 },
  { label: "5", value: 5 },
];

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - d) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months}mo`;
}

function effectiveStars(item: Item): number {
  return item.starOverride ?? item.starRating;
}

export default function FounderIntelPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<Category | "ALL">("ALL");
  const [filterStars, setFilterStars] = useState<number>(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterHigh, setFilterHigh] = useState(false);

  const [starEditing, setStarEditing] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filterCategory !== "ALL") p.set("category", filterCategory);
    if (filterStars > 0) p.set("minStars", String(filterStars));
    if (filterUnread) p.set("unreadOnly", "true");
    if (filterHigh) p.set("priority", "HIGH");
    p.set("limit", "50");
    return p.toString();
  }, [filterCategory, filterStars, filterUnread, filterHigh]);

  const loadPage = useCallback(
    async (opts: { reset?: boolean; cursor?: string | null }) => {
      setLoading(true);
      setError(null);
      const myId = ++requestIdRef.current;
      try {
        const p = new URLSearchParams(queryString);
        if (opts.cursor) p.set("cursor", opts.cursor);
        const res = await fetch(`/api/admin/intel?${p.toString()}`, {
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403) {
          redirectToLogin();
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(
            `Feed load failed (${res.status}): ${body?.message ?? body?.error ?? "unknown"}`,
          );
          return;
        }
        const data = (await res.json()) as FeedResponse;
        if (myId !== requestIdRef.current) return;
        setItems((prev) => (opts.reset ? data.items : [...prev, ...data.items]));
        setNextCursor(data.nextCursor);
        setUnreadCount(data.unreadCount);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [queryString],
  );

  useEffect(() => {
    loadPage({ reset: true, cursor: null });
  }, [loadPage]);

  async function handleRetryFailed() {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/intel/retry-failed", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(`Retry failed (${res.status}): ${body?.error ?? "unknown"}`);
        return;
      }
      setError(`Retry OK — ${body?.reset ?? 0} article(s) remis en file`);
    } catch {
      setError("Retry network error.");
    } finally {
      setRetrying(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/intel/run", {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        redirectToLogin();
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          `Sync failed (${res.status}): ${body?.message ?? body?.error ?? "unknown"}`,
        );
        return;
      }
      if (body?.skipped === "lock") {
        setError("Sync skipped: another run is in progress (lock window 10min).");
      } else if (body?.errors && body.errors.length > 0) {
        setError(
          `Sync OK — ingested ${body.itemsIngested} items, ${body.errors.length} source error(s): ${body.errors.slice(0, 2).join(" | ")}`,
        );
      }
      await loadPage({ reset: true, cursor: null });
    } catch {
      setError("Sync network error.");
    } finally {
      setSyncing(false);
    }
  }

  async function patchItem(id: string, body: Partial<{ read: boolean; starred: boolean; starOverride: number | null }>) {
    const prev = items.find((i) => i.id === id);
    if (!prev) return;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...body } : i)));
    try {
      const res = await fetch(`/api/admin/intel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setItems((list) => list.map((i) => (i.id === id ? prev : i)));
      } else if (body.read !== undefined) {
        setUnreadCount((n) => Math.max(0, n + (body.read ? -1 : 1)));
      }
    } catch {
      setItems((list) => list.map((i) => (i.id === id ? prev : i)));
    }
  }

  async function handleOpen(item: Item) {
    const win = window.open("about:blank", "_blank");
    try {
      const res = await fetch(`/api/admin/intel/open/${item.id}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        if (win) win.location.href = data.url;
        if (!item.read) {
          setItems((list) => list.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
          setUnreadCount((n) => Math.max(0, n - 1));
        }
      } else if (win) {
        win.location.href = item.url;
      }
    } catch {
      if (win) win.location.href = item.url;
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-orange-400 flex items-center gap-3">
              Founder Intel Feed
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 bg-red-600 text-white text-xs font-bold rounded">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-gray-400 text-sm">Signal feed · internal</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRetryFailed}
              disabled={retrying}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 transition"
            >
              {retrying ? "Retry..." : "Retry failed"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black transition"
            >
              {syncing ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3 sticky top-0 z-10">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <FilterPill
                key={c}
                label={c}
                active={filterCategory === c}
                onClick={() => setFilterCategory(c)}
              />
            ))}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {STAR_FILTERS.map((s) => (
              <FilterPill
                key={s.label}
                label={`${s.label} ★`}
                active={filterStars === s.value}
                onClick={() => setFilterStars(s.value)}
              />
            ))}
            <div style={{ width: 12 }} />
            <FilterPill
              label="NON LUS"
              active={filterUnread}
              onClick={() => setFilterUnread((v) => !v)}
            />
            <FilterPill
              label="HIGH PRIORITY"
              active={filterHigh}
              onClick={() => setFilterHigh((v) => !v)}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Feed */}
        <div className="flex flex-col gap-4">
          {items.length === 0 && !loading && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
              No items. Click SYNC to ingest.
            </div>
          )}
          {items.map((item) => (
            <Card
              key={item.id}
              item={item}
              starEditing={starEditing === item.id}
              onStartEdit={() => setStarEditing(item.id)}
              onStopEdit={() => setStarEditing(null)}
              onOpen={() => handleOpen(item)}
              onToggleRead={() => patchItem(item.id, { read: !item.read })}
              onToggleStar={() => patchItem(item.id, { starred: !item.starred })}
              onSetStarOverride={(n) => {
                setStarEditing(null);
                patchItem(item.id, { starOverride: n });
              }}
            />
          ))}
        </div>

        {/* Load more */}
        {nextCursor && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => loadPage({ cursor: nextCursor })}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition"
            >
              {loading ? "Loading..." : "Charger plus"}
            </button>
          </div>
        )}
        {loading && items.length === 0 && (
          <div className="text-gray-500 text-sm p-6">
            Loading...
          </div>
        )}
      </div>
    </main>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? "bg-orange-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
    >
      {label}
    </button>
  );
}

function Stars({
  value,
  editing,
  onStartEdit,
  onPick,
}: {
  value: number;
  editing: boolean;
  onStartEdit: () => void;
  onPick: (n: number) => void;
}) {
  if (editing) {
    return (
      <div style={{ display: "inline-flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={(e) => {
              e.stopPropagation();
              onPick(n);
            }}
            style={{
              padding: "2px 6px",
              background: "transparent",
              border: `1px solid ${ACCENT}80`,
              color: ACCENT,
              fontSize: 11,
              fontFamily: "monospace",
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }
  const filled = "★".repeat(Math.max(0, Math.min(5, value)));
  const empty = "☆".repeat(5 - Math.max(0, Math.min(5, value)));
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      style={{
        background: "transparent",
        border: "none",
        color: ACCENT,
        fontSize: 13,
        fontFamily: "monospace",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {filled}
      <span style={{ color: MUTED }}>{empty}</span>
    </button>
  );
}

function Card({
  item,
  starEditing,
  onStartEdit,
  onStopEdit,
  onOpen,
  onToggleRead,
  onToggleStar,
  onSetStarOverride,
}: {
  item: Item;
  starEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onOpen: () => void;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onSetStarOverride: (n: number) => void;
}) {
  const catColor = CATEGORY_COLORS[item.category];
  const stars = effectiveStars(item);
  const isUnread = !item.read;
  const summaryBullets = item.summary
    ? item.summary
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  return (
    <article
      className={`bg-gray-900 rounded-xl border border-gray-800 p-5 relative ${isUnread ? "border-l-2 border-l-orange-500" : ""}`}
      onClick={() => {
        if (starEditing) onStopEdit();
      }}
    >
      {/* top row: category + priority + stars + relative time */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span
          style={{
            padding: "3px 8px",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "monospace",
            color: catColor,
            background: `${catColor}18`,
            border: `1px solid ${catColor}55`,
            borderRadius: 2,
          }}
        >
          {item.category}
        </span>
        {item.priority === "HIGH" && (
          <span
            className="intel-high-badge"
            style={{
              padding: "3px 8px",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.08em",
              fontFamily: "monospace",
              color: BG,
              background: "#FF3B5C",
              borderRadius: 2,
            }}
          >
            HIGH
          </span>
        )}
        <Stars
          value={stars}
          editing={starEditing}
          onStartEdit={onStartEdit}
          onPick={onSetStarOverride}
        />
        {item.starOverride !== null && !starEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetStarOverride(0);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: MUTED,
              fontSize: 10,
              fontFamily: "monospace",
              cursor: "pointer",
              padding: 0,
            }}
            title="Reset override"
          >
            reset
          </button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
          {item.source} · {relativeTime(item.publishedAt)}
        </span>
      </div>

      {/* title */}
      <h2
        onClick={onOpen}
        style={{
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.4,
          color: TEXT,
          marginBottom: 10,
          cursor: "pointer",
        }}
      >
        {item.title}
      </h2>

      {/* summary */}
      {summaryBullets.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {summaryBullets.map((b, idx) => {
            const text = b.replace(/^•\s*/, "");
            return (
              <div
                key={idx}
                style={{
                  fontSize: 12,
                  color: TEXT,
                  lineHeight: 1.55,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span style={{ color: ACCENT, fontWeight: 900 }}>•</span>
                <span>{text}</span>
              </div>
            );
          })}
        </div>
      )}
      {!item.summaryDone && item.summaryAttempts < 5 && !summaryBullets.length && (
        <div
          style={{
            fontSize: 11,
            color: DIM,
            fontStyle: "italic",
            fontFamily: "monospace",
            marginBottom: 12,
          }}
        >
          Analyse en cours...
        </div>
      )}

      {/* tags */}
      {item.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {item.tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                color: MUTED,
                border: `1px solid ${LINE}`,
                padding: "2px 6px",
                borderRadius: 2,
                textTransform: "lowercase",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleRead();
          }}
          style={actionStyle(item.read)}
        >
          {item.read ? "✓ Lu" : "Marquer lu"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          style={actionStyle(item.starred)}
        >
          {item.starred ? "★ Étoilé" : "Étoiler"}
        </button>
      </div>

      <style>{`
        .intel-high-badge { animation: intelHighPulse 1.6s ease-in-out infinite; }
        @keyframes intelHighPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </article>
  );
}

function actionStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    background: "transparent",
    border: `1px solid ${active ? ACCENT : LINE}`,
    color: active ? ACCENT : DIM,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    cursor: "pointer",
    borderRadius: 2,
  };
}
