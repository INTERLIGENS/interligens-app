"use client";

import { useEffect, useState } from "react";

type PresenceRow = { handle: string; lastSeenAt: string | null };
type PresencePayload = { investigators: PresenceRow[]; now: string };

type Status = "online" | "recent" | "offline";

const ONLINE_MS = 2 * 60 * 1000;      // < 2 min
const RECENT_MS = 30 * 60 * 1000;     // < 30 min

const LABELS: Record<Status, string> = {
  online: "En ligne",
  recent: "Actif récemment",
  offline: "Hors ligne",
};

const DOTS: Record<Status, string> = {
  online: "🟢",
  recent: "🟡",
  offline: "⚪",
};

function classify(lastSeen: string | null, nowIso: string): Status {
  if (!lastSeen) return "offline";
  const diff = Date.parse(nowIso) - Date.parse(lastSeen);
  if (Number.isNaN(diff)) return "offline";
  if (diff < ONLINE_MS) return "online";
  if (diff < RECENT_MS) return "recent";
  return "offline";
}

export default function InvestigatorPresence() {
  const [data, setData] = useState<PresencePayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        await fetch("/api/presence/ping", { method: "POST", credentials: "include", cache: "no-store" });
      } catch {
        /* silent */
      }
    }

    async function refresh() {
      try {
        const res = await fetch("/api/presence/list", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as PresencePayload;
        if (!cancelled) setData(payload);
      } catch {
        /* silent */
      }
    }

    ping();
    refresh();

    const pingId = setInterval(ping, 60_000);
    const refreshId = setInterval(refresh, 30_000);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        ping();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(pingId);
      clearInterval(refreshId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!data) return null;

  const nowIso = data.now;
  const visible = data.investigators.slice(0, 4);
  const onlineCount = data.investigators.filter(
    (i) => classify(i.lastSeenAt, nowIso) === "online",
  ).length;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 11,
        color: "rgba(255,255,255,0.5)",
        fontFamily: "inherit",
      }}
      title={`${onlineCount} en ligne / ${data.investigators.length} actifs 24h`}
    >
      <span style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10 }}>
        {onlineCount} en ligne
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {visible.map((p) => {
          const status = classify(p.lastSeenAt, nowIso);
          return (
            <span
              key={p.handle}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: status === "online" ? "#FF6B00" : "rgba(255,255,255,0.4)",
              }}
              title={`@${p.handle} · ${LABELS[status]}`}
            >
              <span aria-hidden>{DOTS[status]}</span>
              <span>@{p.handle}</span>
            </span>
          );
        })}
        {data.investigators.length > visible.length && (
          <span style={{ color: "rgba(255,255,255,0.25)" }}>
            +{data.investigators.length - visible.length}
          </span>
        )}
      </div>
    </div>
  );
}
