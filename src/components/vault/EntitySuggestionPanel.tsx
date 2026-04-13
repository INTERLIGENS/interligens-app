"use client";

import { useEffect, useState } from "react";

export type Suggestion = {
  type: string;
  value: string;
  label: string | null;
  source: string;
  confidence: number;
};

type Props = {
  caseId: string;
  suggestions: Suggestion[];
  onAdded: () => void;
  onDismiss: () => void;
};

export default function EntitySuggestionPanel({
  caseId,
  suggestions,
  onAdded,
  onDismiss,
}: Props) {
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => onDismiss(), 10000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  function key(s: Suggestion) {
    return `${s.type}|${s.value}`;
  }

  async function addOne(s: Suggestion) {
    const k = key(s);
    if (adding.has(k) || addedKeys.has(k)) return;
    setAdding((prev) => new Set(prev).add(k));
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/entities`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entities: [
              {
                type: s.type,
                value: s.value,
                label: s.label ?? undefined,
                confidence: s.confidence,
                extractionMethod: `suggest:${s.source}`,
              },
            ],
          }),
        }
      );
      if (res.ok) {
        setAddedKeys((prev) => new Set(prev).add(k));
        onAdded();
      }
    } finally {
      setAdding((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  }

  async function addAll() {
    for (const s of suggestions) {
      if (!addedKeys.has(key(s))) {
        await addOne(s);
      }
    }
  }

  const visible = suggestions.filter((s) => !addedKeys.has(key(s)));
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        backgroundColor: "#0a0a0a",
        border: "1px solid rgba(255,107,0,0.2)",
        borderRadius: 8,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "#FF6B00",
          }}
        >
          Related entities found
        </div>
        <button
          onClick={onDismiss}
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            background: "none",
            border: "none",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {visible.map((s) => {
          const k = key(s);
          return (
            <div
              key={k}
              className="flex items-center gap-3"
              style={{
                padding: "8px 10px",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: "#FF6B00",
                  textTransform: "uppercase",
                  width: 58,
                  flexShrink: 0,
                }}
              >
                {s.type}
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.85)",
                  flex: 1,
                  wordBreak: "break-all",
                }}
              >
                {s.value}
              </span>
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 4,
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  flexShrink: 0,
                }}
              >
                {s.source}
              </span>
              <button
                onClick={() => addOne(s)}
                disabled={adding.has(k)}
                className="disabled:opacity-50"
                style={{
                  fontSize: 11,
                  color: "#FF6B00",
                  background: "none",
                  border: "1px solid rgba(255,107,0,0.3)",
                  borderRadius: 4,
                  padding: "3px 10px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {adding.has(k) ? "Adding…" : "Add"}
              </button>
            </div>
          );
        })}
      </div>
      {visible.length > 1 && (
        <button
          onClick={addAll}
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "#FF6B00",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          + Add all {visible.length}
        </button>
      )}
    </div>
  );
}
