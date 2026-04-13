"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { decryptString, decryptTags } from "@/lib/vault/crypto.client";

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  tigerScore: number | null;
};

type Hypothesis = {
  id: string;
  title: string;
  status: string;
  confidence: number;
  notes: string | null;
};

type TimelineEvent = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
};

type DecryptedNote = {
  id: string;
  content: string;
  createdAt: string;
};

function PrintInner({ caseId }: { caseId: string }) {
  const { keys } = useVaultSession();
  const searchParams = useSearchParams();
  const includeNotes = searchParams.get("includeNotes") === "true";

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [investigator, setInvestigator] = useState<string>("—");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!keys) return;
    (async () => {
      try {
        const [caseRes, entRes, hypRes, tlRes, notesRes] = await Promise.all([
          fetch(`/api/investigators/cases/${caseId}`).then((r) => r.json()),
          fetch(`/api/investigators/cases/${caseId}/entities`).then((r) =>
            r.json()
          ),
          fetch(`/api/investigators/cases/${caseId}/hypotheses`).then((r) =>
            r.json()
          ),
          fetch(`/api/investigators/cases/${caseId}/timeline-events`).then(
            (r) => r.json()
          ),
          includeNotes
            ? fetch(`/api/investigators/cases/${caseId}/notes`).then((r) =>
                r.json()
              )
            : Promise.resolve({ notes: [] }),
        ]);

        if (caseRes.case) {
          try {
            setTitle(
              await decryptString(
                caseRes.case.titleEnc,
                caseRes.case.titleIv,
                keys.metaKey
              )
            );
            setTags(
              await decryptTags(
                caseRes.case.tagsEnc,
                caseRes.case.tagsIv,
                keys.metaKey
              )
            );
          } catch {
            setTitle("[unreadable]");
          }
        }

        setEntities(entRes.entities ?? []);
        setHypotheses(hypRes.hypotheses ?? []);
        setEvents(tlRes.events ?? []);

        if (includeNotes) {
          const rows = notesRes.notes ?? [];
          const dec: DecryptedNote[] = [];
          for (const n of rows) {
            try {
              const content = await decryptString(
                n.contentEnc,
                n.contentIv,
                keys.noteKey
              );
              dec.push({ id: n.id, content, createdAt: n.createdAt });
            } catch {
              // skip unreadable
            }
          }
          setNotes(dec);
        }

        const profileRes = await fetch("/api/investigators/me").catch(
          () => null
        );
        if (profileRes?.ok) {
          const p = await profileRes.json();
          setInvestigator(p.profile?.handle ?? p.handle ?? "—");
        }
      } finally {
        setReady(true);
      }
    })();
  }, [caseId, keys, includeNotes]);

  if (!ready) {
    return (
      <main
        style={{
          backgroundColor: "#FFFFFF",
          color: "#000000",
          minHeight: "100vh",
          padding: 40,
        }}
      >
        Loading case report…
      </main>
    );
  }

  const generatedAt = new Date().toLocaleString();

  return (
    <main
      style={{
        backgroundColor: "#FFFFFF",
        color: "#000000",
        minHeight: "100vh",
        padding: "40px 60px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <style>{`
        @media print {
          @page { margin: 20mm; }
          body { background: white; }
        }
        .print-section { margin-bottom: 24px; }
        .print-label { text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em; color: #666; margin-bottom: 6px; }
        .print-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
        th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        td { font-size: 11px; word-break: break-all; }
      `}</style>

      <div
        style={{
          borderBottom: "2px solid #000",
          paddingBottom: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#000",
          }}
        >
          INTERLIGENS CASE REPORT — CONFIDENTIAL
        </div>
      </div>

      <div className="print-section">
        <div className="print-title">{title}</div>
        {tags.length > 0 && (
          <div
            style={{ fontSize: 10, color: "#666", marginTop: 4 }}
          >
            Tags: {tags.join(", ")}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#666", marginTop: 8 }}>
          Generated: {generatedAt}
          {" · "}
          Investigator: {investigator}
        </div>
      </div>

      <div className="print-section">
        <div className="print-label">Entities ({entities.length})</div>
        {entities.length === 0 ? (
          <div style={{ color: "#666" }}>No entities.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Type</th>
                <th>Value</th>
                <th style={{ width: 140 }}>Label</th>
                <th style={{ width: 60 }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id}>
                  <td>{e.type}</td>
                  <td style={{ fontFamily: "ui-monospace, monospace" }}>
                    {e.value}
                  </td>
                  <td>{e.label ?? "—"}</td>
                  <td>{e.tigerScore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="print-section">
        <div className="print-label">Hypotheses ({hypotheses.length})</div>
        {hypotheses.length === 0 ? (
          <div style={{ color: "#666" }}>No hypotheses.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 80 }}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {hypotheses.map((h) => (
                <tr key={h.id}>
                  <td>{h.title}</td>
                  <td>{h.status}</td>
                  <td>{h.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="print-section">
        <div className="print-label">Timeline ({events.length})</div>
        {events.length === 0 ? (
          <div style={{ color: "#666" }}>No timeline events.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th style={{ width: 200 }}>Title</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{new Date(ev.eventDate).toLocaleDateString()}</td>
                  <td>{ev.title}</td>
                  <td>{ev.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {includeNotes && (
        <div className="print-section">
          <div className="print-label">Notes ({notes.length})</div>
          {notes.length === 0 ? (
            <div style={{ color: "#666" }}>No notes.</div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                style={{
                  borderLeft: "2px solid #000",
                  paddingLeft: 12,
                  marginBottom: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>
                  {new Date(n.createdAt).toLocaleString()}
                </div>
                <div>{n.content}</div>
              </div>
            ))
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 40,
          paddingTop: 12,
          borderTop: "1px solid #ccc",
          fontSize: 9,
          color: "#666",
        }}
      >
        Generated by INTERLIGENS Investigators — Client-side encrypted. This
        document contains derived intelligence only. Raw files are never
        included.
      </div>

      <div style={{ marginTop: 24, textAlign: "center" }} className="no-print">
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#000",
            color: "#FFF",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Print / Save as PDF
        </button>
      </div>
      <style>{`@media print { .no-print { display: none; } }`}</style>
    </main>
  );
}

export default function CasePrintPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  return (
    <VaultGate>
      <PrintInner caseId={caseId} />
    </VaultGate>
  );
}
