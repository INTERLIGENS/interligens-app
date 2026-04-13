"use client";

import { useEffect, useState } from "react";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  confidence: number | null;
  extractionMethod: string | null;
  sourceFileId: string | null;
  createdAt: string;
};

type EntityEnrichment = {
  inWatchlist: boolean;
  isKnownBad: boolean;
  knownBadScore: number | null;
  inKolRegistry: boolean;
  kolName: string | null;
  kolScore: number | null;
  inIntelVault: boolean;
};

type Hypothesis = {
  id: string;
  title: string;
  status: "OPEN" | "CONFIRMED" | "REFUTED" | "NEEDS_VERIFICATION";
  confidence: number;
  notes: string | null;
  createdAt: string;
};

type Props = {
  caseId: string;
  entities: Entity[];
  notes: { id: string; content: string }[];
  timelineEvents: number;
  caseTemplate: string | null;
  updatedAt: string;
  enrichment: Record<string, EntityEnrichment>;
};

const SECTION_TITLE: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.3)",
  marginBottom: 10,
};

const SEPARATOR: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.06)",
  margin: "20px 0",
};

const BODY: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.7)",
  lineHeight: 1.6,
};

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

export default function CaseTwin({
  caseId,
  entities,
  notes,
  timelineEvents,
  caseTemplate,
  updatedAt,
  enrichment,
}: Props) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<Hypothesis["status"]>("OPEN");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/investigators/cases/${caseId}/hypotheses`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHypotheses(d.hypotheses ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  async function addHypothesis() {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/hypotheses`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: newTitle.trim(), status: newStatus }),
        }
      );
      if (res.ok) {
        const d = await res.json();
        if (d.hypothesis) setHypotheses((prev) => [d.hypothesis, ...prev]);
        setNewTitle("");
        setNewStatus("OPEN");
        setShowAddForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  // Section A — counts
  const wallets = entities.filter((e) => e.type === "WALLET");
  const handles = entities.filter((e) => e.type === "HANDLE");
  const txs = entities.filter((e) => e.type === "TX_HASH");
  const domains = entities.filter(
    (e) => e.type === "URL" || e.type === "DOMAIN"
  );

  const kolHits = Object.values(enrichment).filter((e) => e.inKolRegistry).length;
  const watchHits = Object.values(enrichment).filter((e) => e.inWatchlist).length;

  // Section C — gaps
  const gaps: string[] = [];
  if (entities.length === 0) gaps.push("No evidence deposited yet");
  if (wallets.length > 0 && txs.length === 0) {
    gaps.push("No transaction hashes linked to wallets");
  }
  if (txs.length > 0 && timelineEvents === 0) {
    gaps.push("No timeline built yet");
  }
  if (entities.length > 0 && notes.length === 0) {
    gaps.push("No analyst notes added");
  }
  const age = daysAgo(updatedAt);
  if (age > 7) gaps.push(`Case inactive for ${age} days`);
  if (!caseTemplate || caseTemplate === "blank") {
    gaps.push("No case structure defined");
  }
  const unlabeled = entities.filter((e) => !e.label).length;
  if (unlabeled > 0) {
    gaps.push(`${unlabeled} entities have no analyst label`);
  }

  // Section D — readiness
  let readinessScore = 0;
  if (entities.length >= 3) readinessScore++;
  if (hypotheses.some((h) => h.status === "CONFIRMED")) readinessScore++;
  if (notes.length >= 1) readinessScore++;
  if (gaps.length === 0) readinessScore++;
  if (entities.some((e) => e.confidence != null && e.confidence >= 0.8)) {
    readinessScore++;
  }

  let readinessText = "";
  let readinessColor = "rgba(255,255,255,0.4)";
  if (readinessScore <= 1) {
    readinessText = "Not ready · Too little evidence";
    readinessColor = "#FF3B5C";
  } else if (readinessScore <= 3) {
    readinessText = "In progress · Build more before publishing";
    readinessColor = "#FF6B00";
  } else {
    readinessText = "Ready to review · Consider publishing";
    readinessColor = "#4ADE80";
  }

  // Section E — next action
  let nextAction = "";
  if (entities.length === 0) {
    nextAction = "Add your first entity — start with a wallet or handle";
  } else if (wallets.length > 0 && txs.length === 0) {
    nextAction = "Look for transaction hashes linked to these wallets";
  } else if (handles.length > 0 && kolHits === 0) {
    nextAction = "Check these handles against the KOL Registry";
  } else if (hypotheses.length === 0) {
    nextAction = "Add your first working hypothesis";
  } else if (notes.length === 0) {
    nextAction = "Write your first analyst note";
  } else if (timelineEvents === 0) {
    nextAction = "Build the case timeline";
  } else {
    nextAction = "Review publication readiness — this case may be ready";
  }

  const scoredRed = entities.filter((e) => {
    const r = enrichment[e.id];
    return r?.isKnownBad;
  }).length;

  return (
    <div>
      {/* SECTION A */}
      <div style={SECTION_TITLE}>What we know</div>
      <div style={BODY}>
        {wallets.length} wallets · {handles.length} handles · {txs.length} transactions · {domains.length} domains
      </div>
      {(scoredRed > 0 || kolHits > 0 || watchHits > 0) && (
        <div style={{ ...BODY, marginTop: 6 }}>
          {scoredRed > 0 && `${scoredRed} flagged known-bad · `}
          {kolHits > 0 && `${kolHits} KOL Registry match · `}
          {watchHits > 0 && `${watchHits} Watchlist match`}
        </div>
      )}

      <div style={SEPARATOR} />

      {/* SECTION B — Hypotheses */}
      <div style={SECTION_TITLE}>Working hypotheses</div>
      {hypotheses.length === 0 && !showAddForm && (
        <div style={BODY}>No hypotheses yet. Add your first working theory.</div>
      )}
      {hypotheses.length > 0 && (
        <div className="flex flex-col gap-2">
          {hypotheses.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 13, color: "#FFFFFF" }}>{h.title}</div>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 6px",
                  borderRadius: 4,
                  color: "#FF6B00",
                  border: "1px solid rgba(255,107,0,0.3)",
                }}
              >
                {h.status}
              </div>
            </div>
          ))}
        </div>
      )}
      {showAddForm ? (
        <div style={{ marginTop: 12 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Hypothesis title"
            style={{
              width: "100%",
              backgroundColor: "#0d0d0d",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              padding: "10px 12px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
              marginBottom: 8,
            }}
          />
          <div className="flex gap-2 items-center">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as Hypothesis["status"])}
              style={{
                backgroundColor: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#FFFFFF",
                fontSize: 12,
              }}
            >
              <option value="OPEN">OPEN</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="REFUTED">REFUTED</option>
              <option value="NEEDS_VERIFICATION">NEEDS_VERIFICATION</option>
            </select>
            <button
              onClick={addHypothesis}
              disabled={saving || !newTitle.trim()}
              className="disabled:opacity-50"
              style={{
                backgroundColor: "#FF6B00",
                color: "#FFFFFF",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 12,
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewTitle("");
              }}
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                background: "none",
                border: "none",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            marginTop: 10,
            color: "#FF6B00",
            fontSize: 12,
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          + Add hypothesis
        </button>
      )}

      <div style={SEPARATOR} />

      {/* SECTION C — Gaps */}
      <div style={SECTION_TITLE}>Gaps detected</div>
      {gaps.length === 0 ? (
        <div style={BODY}>No gaps detected.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {gaps.map((gap) => (
            <div key={gap} className="flex items-center gap-2">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  backgroundColor: "#FF6B00",
                  display: "inline-block",
                }}
              />
              <span style={BODY}>{gap}</span>
            </div>
          ))}
        </div>
      )}

      <div style={SEPARATOR} />

      {/* SECTION D — Readiness */}
      <div style={SECTION_TITLE}>Publication readiness</div>
      <div className="flex items-center gap-3">
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "4px 10px",
            borderRadius: 4,
            color: readinessColor,
            border: `1px solid ${readinessColor}`,
          }}
        >
          {readinessScore}/5
        </span>
        <span style={BODY}>{readinessText}</span>
      </div>

      <div style={SEPARATOR} />

      {/* SECTION E — Next action */}
      <div style={SECTION_TITLE}>Next suggested action</div>
      <div
        style={{
          backgroundColor: "#0a0a0a",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 6,
          padding: 14,
          fontSize: 14,
          color: "#FFFFFF",
        }}
      >
        {nextAction}
      </div>
    </div>
  );
}
