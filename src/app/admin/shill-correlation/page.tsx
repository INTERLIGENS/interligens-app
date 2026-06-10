"use client";

// src/app/admin/shill-correlation/page.tsx
// PHASE 5 — admin-only review surface for the Shill Correlation Engine.
// Shadow mode: no public links here, no TigerScore / PDF coupling. Read +
// triage (reviewStatus) only. Auth enforced server-side by requireAdminApi.

import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert,
  ExternalLink,
  Check,
  X,
  HelpCircle,
  RotateCcw,
  RefreshCw,
  Search,
} from "lucide-react";

const ACCENT = "#FF6B00";
const DANGER = "#FF3B5C";
const WARNING = "#FFB800";
const SAFE = "#00FF94";
const MUTED = "#8A8A8A";

const CLASS_COLOR: Record<string, string> = {
  high_interest: DANGER,
  candidate: WARNING,
  watch: MUTED,
};
const REVIEW_COLOR: Record<string, string> = {
  confirmed: SAFE,
  dismissed: MUTED,
  needs_data: WARNING,
  draft: "#FFFFFF",
};

interface Candidate {
  id: string;
  kolHandle: string;
  wallet: string;
  chain: string;
  observedShillCount: number;
  analyzableShillCount: number;
  ratioObserved: number;
  preTweetCount: number;
  nearTweetCount: number;
  postTweetCount: number;
  recurrenceScore: number;
  specificityScore: number;
  timingScore: number;
  exitScore: number;
  genericSniperPenalty: number;
  correlationScore: number;
  confidence: string;
  classification: string;
  reviewStatus: string;
  notes: string | null;
}

interface ApiResponse {
  total: number;
  returned: number;
  summary: {
    classification: Record<string, number>;
    reviewStatus: Record<string, number>;
  };
  candidates: Candidate[];
}

const REVIEW_ACTIONS: Array<{
  status: string;
  label: string;
  color: string;
  Icon: typeof Check;
}> = [
  { status: "confirmed", label: "Confirm", color: SAFE, Icon: Check },
  { status: "dismissed", label: "Dismiss", color: MUTED, Icon: X },
  { status: "needs_data", label: "Needs data", color: WARNING, Icon: HelpCircle },
  { status: "draft", label: "Reset", color: "#FFFFFF", Icon: RotateCcw },
];

export default function ShillCorrelationReviewPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [classification, setClassification] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [minScore, setMinScore] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    if (classification) sp.set("classification", classification);
    if (reviewStatus) sp.set("reviewStatus", reviewStatus);
    if (minScore) sp.set("minScore", minScore);
    if (query) sp.set("kol", query);
    sp.set("limit", "500");
    try {
      const res = await fetch(
        `/api/admin/shill-correlation/candidates?${sp.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [classification, reviewStatus, minScore, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const triage = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/shill-correlation/candidates", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reviewStatus: status }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { candidate } = (await res.json()) as { candidate: Candidate };
      setData((prev) =>
        prev
          ? {
              ...prev,
              candidates: prev.candidates.map((c) =>
                c.id === id ? { ...c, reviewStatus: candidate.reviewStatus } : c,
              ),
            }
          : prev,
      );
    } catch {
      /* surface via reload */
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const label = "text-[10px] uppercase tracking-widest font-black";

  return (
    <div className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert size={22} style={{ color: ACCENT }} />
          <h1 className="text-xl uppercase tracking-widest font-black">
            Shill Correlation — Candidate Review
          </h1>
        </div>
        <p
          className="text-[10px] uppercase tracking-widest font-black mb-6"
          style={{ color: ACCENT }}
        >
          Shadow mode · admin only · candidates, never &quot;the KOL&apos;s wallet&quot;
        </p>

        {/* Summary */}
        {data && (
          <div className="flex flex-wrap gap-6 mb-6 text-sm">
            <Stat label="Total" value={data.total} />
            {Object.entries(data.summary.classification).map(([k, v]) => (
              <Stat
                key={k}
                label={k}
                value={v}
                color={CLASS_COLOR[k] ?? "#FFFFFF"}
              />
            ))}
            <span className="opacity-30">|</span>
            {Object.entries(data.summary.reviewStatus).map(([k, v]) => (
              <Stat
                key={k}
                label={k}
                value={v}
                color={REVIEW_COLOR[k] ?? "#FFFFFF"}
              />
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-5">
          <Field label="Classification">
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="bg-black border border-white/20 px-2 py-1 text-sm"
            >
              <option value="">all</option>
              <option value="high_interest">high_interest</option>
              <option value="candidate">candidate</option>
              <option value="watch">watch</option>
            </select>
          </Field>
          <Field label="Review status">
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
              className="bg-black border border-white/20 px-2 py-1 text-sm"
            >
              <option value="">all</option>
              <option value="draft">draft</option>
              <option value="confirmed">confirmed</option>
              <option value="dismissed">dismissed</option>
              <option value="needs_data">needs_data</option>
            </select>
          </Field>
          <Field label="Min score">
            <input
              type="number"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="0"
              className="bg-black border border-white/20 px-2 py-1 text-sm w-20"
            />
          </Field>
          <Field label="KOL handle">
            <div className="flex items-center border border-white/20">
              <Search size={14} className="mx-1 opacity-50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="handle…"
                className="bg-black px-1 py-1 text-sm w-36"
              />
            </div>
          </Field>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1 border px-3 py-1 text-sm uppercase tracking-widest font-black"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm" style={{ color: DANGER }}>
            Error: {error}
          </div>
        )}
        {loading && <div className="text-sm opacity-60">Loading…</div>}

        {/* Table */}
        {data && !loading && (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/20 text-left">
                  {[
                    "Score",
                    "Rec",
                    "Spec",
                    "Tim",
                    "Sniper",
                    "Obs/Anz",
                    "Pre/Near/Post",
                    "Class",
                    "Conf",
                    "KOL",
                    "Wallet",
                    "Review",
                    "Triage",
                  ].map((h) => (
                    <th key={h} className={`${label} px-2 py-2 opacity-70`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.candidates.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-2 py-2 font-black">
                      {c.correlationScore.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 opacity-80">{c.recurrenceScore}</td>
                    <td className="px-2 py-2 opacity-80">
                      {c.specificityScore}
                    </td>
                    <td className="px-2 py-2 opacity-80">{c.timingScore}</td>
                    <td
                      className="px-2 py-2"
                      style={{
                        color: c.genericSniperPenalty > 0 ? DANGER : MUTED,
                      }}
                    >
                      {c.genericSniperPenalty}
                    </td>
                    <td className="px-2 py-2">
                      {c.observedShillCount}/{c.analyzableShillCount}
                    </td>
                    <td className="px-2 py-2">
                      <span style={{ color: ACCENT }}>{c.preTweetCount}</span>/
                      {c.nearTweetCount}/{c.postTweetCount}
                    </td>
                    <td className="px-2 py-2">
                      <Badge
                        text={c.classification}
                        color={CLASS_COLOR[c.classification] ?? "#FFFFFF"}
                      />
                    </td>
                    <td className="px-2 py-2 opacity-80">{c.confidence}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {c.kolHandle}
                    </td>
                    <td className="px-2 py-2">
                      <a
                        href={`https://solscan.io/account/${c.wallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                        style={{ color: ACCENT }}
                        title={c.wallet}
                      >
                        {c.wallet.slice(0, 6)}…{c.wallet.slice(-4)}
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="px-2 py-2">
                      <Badge
                        text={c.reviewStatus}
                        color={REVIEW_COLOR[c.reviewStatus] ?? "#FFFFFF"}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        {REVIEW_ACTIONS.map(({ status, label: lbl, color, Icon }) => (
                          <button
                            key={status}
                            disabled={
                              busyId === c.id || c.reviewStatus === status
                            }
                            onClick={() => void triage(c.id, status)}
                            title={lbl}
                            className="p-1 border border-white/15 disabled:opacity-25 hover:bg-white/10"
                            style={{ color }}
                          >
                            <Icon size={14} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.candidates.length === 0 && (
              <div className="p-6 text-center text-sm opacity-50">
                No candidates match the current filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color = "#FFFFFF",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-lg font-black" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-widest opacity-60">
        {label}
      </span>
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest font-black opacity-60">
        {label}
      </span>
      {children}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="text-[10px] uppercase tracking-widest font-black px-2 py-0.5 border"
      style={{ color, borderColor: color }}
    >
      {text}
    </span>
  );
}
