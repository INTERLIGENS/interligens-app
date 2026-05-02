"use client";

import { useEffect, useState } from "react";

type SourceType =
  | "WEBSITE"
  | "X_POST"
  | "TELEGRAM"
  | "DISCORD"
  | "GITHUB"
  | "MEDIUM"
  | "WHITEPAPER"
  | "EXPLORER"
  | "ARKHAM"
  | "METASLEUTH"
  | "DUNE"
  | "CHAINABUSE"
  | "GOPLUS"
  | "SCAMSNIFFER"
  | "OTHER";

type Publishability = "PRIVATE" | "SHAREABLE" | "PUBLISHABLE" | "REDACTED";

type EvidenceSnapshot = {
  id: string;
  url: string | null;
  title: string;
  sourceType: SourceType;
  publishability: Publishability;
  note: string | null;
  tags: string[];
  relatedEntityId: string | null;
  contentHashSha256: string;
  capturedAt: string;
  createdAt: string;
};

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
};

const SOURCE_TYPES: SourceType[] = [
  "WEBSITE",
  "X_POST",
  "TELEGRAM",
  "DISCORD",
  "GITHUB",
  "MEDIUM",
  "WHITEPAPER",
  "EXPLORER",
  "ARKHAM",
  "METASLEUTH",
  "DUNE",
  "CHAINABUSE",
  "GOPLUS",
  "SCAMSNIFFER",
  "OTHER",
];

const PUBLISHABILITY_OPTIONS: Publishability[] = [
  "PRIVATE",
  "SHAREABLE",
  "PUBLISHABLE",
  "REDACTED",
];

const PUBLISHABILITY_STYLE: Record<Publishability, React.CSSProperties> = {
  PRIVATE: {
    color: "rgba(255,255,255,0.5)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  SHAREABLE: {
    color: "#FFB020",
    border: "1px solid rgba(255,176,32,0.4)",
    backgroundColor: "rgba(255,176,32,0.06)",
  },
  PUBLISHABLE: {
    color: "#00FF94",
    border: "1px solid rgba(0,255,148,0.3)",
    backgroundColor: "rgba(0,255,148,0.05)",
  },
  REDACTED: {
    color: "#FF3B5C",
    border: "1px solid rgba(255,59,92,0.4)",
    backgroundColor: "rgba(255,59,92,0.06)",
  },
};

const BADGE: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 600,
  display: "inline-block",
};

const EMPTY_FORM = {
  url: "",
  title: "",
  sourceType: "WEBSITE" as SourceType,
  publishability: "PRIVATE" as Publishability,
  note: "",
  tags: "",
  relatedEntityId: "",
};

export default function EvidenceSnapshotsSection({
  caseId,
  entities,
}: {
  caseId: string;
  entities: Entity[];
}) {
  const [snapshots, setSnapshots] = useState<EvidenceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/investigators/cases/${caseId}/evidence-snapshots`)
      .then((r) => r.json())
      .then((d) => setSnapshots(d.snapshots ?? []))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(
        `/api/investigators/cases/${caseId}/evidence-snapshots`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: form.url.trim() || undefined,
            title: form.title.trim() || undefined,
            sourceType: form.sourceType,
            publishability: form.publishability,
            note: form.note.trim() || undefined,
            tags,
            relatedEntityId: form.relatedEntityId || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg: Record<string, string> = {
          invalid_url: "Invalid URL — must be http:// or https://",
          title_required: "Title is required",
          related_entity_not_in_case: "Selected entity does not belong to this case",
          create_failed: "Server error. Try again.",
        };
        setError(msg[data.error] ?? "Unexpected error");
        return;
      }
      setSnapshots((prev) => [data.snapshot, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function copyHash(hash: string) {
    navigator.clipboard
      .writeText(hash)
      .then(() => {
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 1800);
      })
      .catch(() => {});
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Evidence Snapshots
          {snapshots.length > 0 && (
            <span style={{ marginLeft: 6, color: "rgba(255,107,0,0.6)" }}>
              ({snapshots.length})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
          style={{
            fontSize: 12,
            color: "#FF6B00",
            background: "none",
            border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 4,
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ Add Evidence Snapshot"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: "#0a0a0a",
            border: "1px solid rgba(255,107,0,0.18)",
            borderRadius: 6,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#FF6B00",
              marginBottom: 14,
            }}
          >
            New Evidence Snapshot · Private by default
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FormField label="Source URL">
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://…"
                style={INPUT}
              />
            </FormField>

            <FormField label="Title *">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of this snapshot"
                maxLength={500}
                style={INPUT}
              />
            </FormField>

            <div style={{ display: "flex", gap: 12 }}>
              <FormField label="Source Type" style={{ flex: 1 }}>
                <select
                  value={form.sourceType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sourceType: e.target.value as SourceType,
                    }))
                  }
                  style={INPUT}
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Publication Status" style={{ flex: 1 }}>
                <select
                  value={form.publishability}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      publishability: e.target.value as Publishability,
                    }))
                  }
                  style={INPUT}
                >
                  {PUBLISHABILITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {entities.length > 0 && (
              <FormField label="Related Entity (optional)">
                <select
                  value={form.relatedEntityId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, relatedEntityId: e.target.value }))
                  }
                  style={INPUT}
                >
                  <option value="">None</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      [{e.type}] {e.label ?? e.value}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Tags (comma-separated)">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="wallet-drainer, rug-pull, kol"
                style={INPUT}
              />
            </FormField>

            <FormField label="Analyst Note">
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={3}
                placeholder="Context, observations, caveats…"
                maxLength={8000}
                style={{ ...INPUT, resize: "vertical", fontFamily: "inherit" }}
              />
            </FormField>
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#FF3B5C",
                padding: "8px 12px",
                border: "1px solid rgba(255,59,92,0.3)",
                borderRadius: 4,
                backgroundColor: "rgba(255,59,92,0.05)",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor: saving ? "rgba(255,107,0,0.4)" : "#FF6B00",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 4,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 500,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save snapshot"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
                setForm(EMPTY_FORM);
              }}
              style={{
                backgroundColor: "transparent",
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 4,
                padding: "8px 18px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>
          Loading…
        </div>
      )}

      {!loading && snapshots.length === 0 && !showForm && (
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
            padding: "40px 0",
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          <div>No evidence snapshots yet.</div>
          <div style={{ marginTop: 8 }}>
            Record a URL, post, or source you observed during investigation.
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            Private by default. A snapshot record hash is generated at capture time.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {snapshots.map((s) => {
          const relEntity = s.relatedEntityId
            ? entities.find((e) => e.id === s.relatedEntityId)
            : null;
          return (
            <div
              key={s.id}
              style={{
                backgroundColor: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{ fontSize: 14, color: "#FFFFFF", fontWeight: 500, flex: 1 }}
                >
                  {s.title}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <span
                    style={{
                      ...BADGE,
                      color: "#FF6B00",
                      border: "1px solid rgba(255,107,0,0.3)",
                      backgroundColor: "rgba(255,107,0,0.08)",
                    }}
                  >
                    {s.sourceType.replace(/_/g, " ")}
                  </span>
                  <span style={{ ...BADGE, ...PUBLISHABILITY_STYLE[s.publishability] }}>
                    {s.publishability}
                  </span>
                </div>
              </div>

              {s.url && (
                <div style={{ marginBottom: 6 }}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11,
                      color: "rgba(255,107,0,0.7)",
                      wordBreak: "break-all",
                      textDecoration: "none",
                    }}
                  >
                    {s.url}
                  </a>
                </div>
              )}

              {s.note && (
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.5,
                    marginBottom: 6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {s.note}
                </div>
              )}

              {s.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 3,
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {relEntity && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
                  Linked entity: [{relEntity.type}] {relEntity.label ?? relEntity.value}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                  Captured {new Date(s.capturedAt).toLocaleString()}
                </div>
                <button
                  type="button"
                  onClick={() => copyHash(s.contentHashSha256)}
                  title={s.contentHashSha256}
                  style={{
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    padding: "2px 8px",
                    cursor: "pointer",
                    color:
                      copiedHash === s.contentHashSha256
                        ? "#00FF94"
                        : "rgba(255,255,255,0.25)",
                    fontSize: 10,
                    fontFamily: "ui-monospace, monospace",
                    transition: "color 150ms",
                  }}
                >
                  {copiedHash === s.contentHashSha256
                    ? "copied"
                    : `#${s.contentHashSha256.slice(0, 8)}…`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "rgba(255,255,255,0.35)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const INPUT: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#000000",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  color: "#FFFFFF",
  fontSize: 13,
  padding: "8px 10px",
  outline: "none",
  boxSizing: "border-box",
};
