"use client";

import { useEffect, useState } from "react";

type TimelineEvent = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  entityIds: string[];
  eventType: string;
  createdAt: string;
};

type EntityLite = {
  id: string;
  type: string;
  value: string;
};

type Props = { caseId: string; entities: EntityLite[] };

const LABEL: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)",
  display: "block",
  marginBottom: 8,
};

const INPUT: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6,
  padding: "10px 12px",
  color: "#FFFFFF",
  fontSize: 13,
  outline: "none",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TimelineBuilder({ caseId, entities }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(
    new Set()
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/investigators/cases/${caseId}/timeline-events`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  async function addEvent() {
    if (!title.trim() || !eventDate || saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/timeline-events`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            eventDate: new Date(eventDate).toISOString(),
            entityIds: Array.from(selectedEntityIds),
          }),
        }
      );
      if (res.ok) {
        const d = await res.json();
        if (d.event) {
          setEvents((prev) =>
            [...prev, d.event].sort(
              (a, b) =>
                new Date(a.eventDate).getTime() -
                new Date(b.eventDate).getTime()
            )
          );
        }
        setTitle("");
        setDescription("");
        setEventDate("");
        setSelectedEntityIds(new Set());
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    const res = await fetch(
      `/api/investigators/cases/${caseId}/timeline-events/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function toggleEntity(id: string) {
    setSelectedEntityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* ADD EVENT FORM */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: 24,
          marginBottom: 32,
        }}
      >
        <label style={LABEL}>Add timeline event</label>
        <div style={{ marginBottom: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            style={INPUT}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            style={{ ...INPUT, colorScheme: "dark" }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            style={{ ...INPUT, resize: "vertical" }}
          />
        </div>
        {entities.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={LABEL}>Linked entities (optional)</label>
            <div
              className="flex flex-wrap gap-2"
              style={{ maxHeight: 120, overflowY: "auto" }}
            >
              {entities.map((e) => {
                const active = selectedEntityIds.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleEntity(e.id)}
                    style={{
                      fontSize: 10,
                      padding: "4px 8px",
                      borderRadius: 20,
                      border: active
                        ? "1px solid #FF6B00"
                        : "1px solid rgba(255,255,255,0.12)",
                      backgroundColor: active
                        ? "rgba(255,107,0,0.1)"
                        : "transparent",
                      color: active ? "#FF6B00" : "rgba(255,255,255,0.4)",
                      cursor: "pointer",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {e.type}:{" "}
                    {e.value.length > 16 ? e.value.slice(0, 16) + "…" : e.value}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button
          onClick={addEvent}
          disabled={saving || !title.trim() || !eventDate}
          className="disabled:opacity-50"
          style={{
            backgroundColor: "#FF6B00",
            color: "#FFFFFF",
            height: 44,
            borderRadius: 6,
            fontSize: 14,
            padding: "0 20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Add to timeline"}
        </button>
      </div>

      {/* TIMELINE */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          Loading timeline…
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 13,
            padding: "40px 0",
            textAlign: "center",
          }}
        >
          No timeline events yet. Add the first event to start building the
          chronology of this case.
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 24 }}>
          <div
            style={{
              position: "absolute",
              left: 7,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          />
          {events.map((ev) => {
            const linked = entities.filter((e) => ev.entityIds.includes(e.id));
            return (
              <div
                key={ev.id}
                style={{ position: "relative", marginBottom: 28 }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -21,
                    top: 4,
                    width: 12,
                    height: 12,
                    borderRadius: 12,
                    backgroundColor: "#FF6B00",
                    border: "2px solid #000",
                  }}
                />
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {formatDate(ev.eventDate)}
                </div>
                <div
                  className="flex items-start justify-between gap-3"
                  style={{ marginTop: 4 }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#FFFFFF",
                      }}
                    >
                      {ev.title}
                    </div>
                    {ev.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                          marginTop: 4,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {ev.description}
                      </div>
                    )}
                    {linked.length > 0 && (
                      <div
                        className="flex flex-wrap gap-1"
                        style={{ marginTop: 8 }}
                      >
                        {linked.map((e) => (
                          <span
                            key={e.id}
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              border: "1px solid rgba(255,107,0,0.3)",
                              borderRadius: 4,
                              color: "#FF6B00",
                              fontFamily: "ui-monospace, monospace",
                            }}
                          >
                            {e.type}:{" "}
                            {e.value.length > 14
                              ? e.value.slice(0, 14) + "…"
                              : e.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteEvent(ev.id)}
                    aria-label="Delete"
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,0.3)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
