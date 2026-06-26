/**
 * Admin — Watcher Draft Queue (Evidence Intake Bridge, Sprint 6).
 *
 * READ-ONLY review surface. Lists bridge-created draft KolTokenLinks +
 * needs_resolution SignalIntake rows. No approve/reject actions this sprint
 * (those land in Sprint 7).
 *
 * AUTH: gated server-side here via isAdminSessionFromCookies() + redirect.
 * NOTE: unlike the pre-existing admin pages in this hub (ask-logs, casefile-*,
 * shill-correlation), which are NOT gated at the page level and rely on a
 * "/admin/* middleware" that does not exist as a tracked file — a real security
 * gap, logged as debt for a dedicated security sprint — this page enforces the
 * admin session itself so public users can never reach the queue.
 */
import { redirect } from "next/navigation";
import { isAdminSessionFromCookies } from "@/lib/security/adminAuth";
import {
  loadWatcherDraftQueue,
  type DraftQueueRow,
  type NeedsResolutionRow,
} from "@/lib/watcher-bridge/loadWatcherDraftQueue";
import DraftActions from "./DraftActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const C = {
  bg: "#000000",
  accent: "#FF6B00",
  text: "#FFFFFF",
  danger: "#FF3B5C",
  dim: "#8A8A8A",
  line: "#222222",
  panel: "#0A0A0A",
};

const label: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  fontWeight: 900,
  fontSize: 11,
  color: C.dim,
};

const th: React.CSSProperties = { ...label, textAlign: "left", padding: "8px 12px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 12px", borderBottom: `1px solid ${C.line}`, fontSize: 13, verticalAlign: "top" };

function Mint({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: C.dim }}>—</span>;
  return <span style={{ fontFamily: "monospace", fontSize: 12 }} title={value}>{value.slice(0, 6)}…{value.slice(-4)}</span>;
}

function Pill({ text, tone }: { text: string; tone?: "accent" | "danger" | "dim" }) {
  const color = tone === "danger" ? C.danger : tone === "dim" ? C.dim : C.accent;
  return (
    <span style={{ border: `1px solid ${color}`, color, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

export default async function WatcherDraftsPage() {
  // ── Strict server-side admin gate ────────────────────────────────────────
  if (!(await isAdminSessionFromCookies())) redirect("/admin/login");

  const { drafts, needsResolution, counts } = await loadWatcherDraftQueue();

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "28px 32px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
        <h1 style={{ ...label, fontSize: 18, color: C.accent, margin: 0 }}>Watcher Draft Queue</h1>
        <span style={{ color: C.dim, fontSize: 12 }}>read-only · review pending (approve/reject = Sprint 7)</span>
      </div>
      <p style={{ color: C.dim, fontSize: 12, marginBottom: 24 }}>
        {counts.drafts} draft link{counts.drafts === 1 ? "" : "s"} · {counts.needsResolution} needs-resolution · none public
      </p>

      {/* ── DRAFTS ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ ...label, color: C.accent, fontSize: 13, marginBottom: 10 }}>Draft KolTokenLinks ({counts.drafts})</h2>
        <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
            <thead>
              <tr>
                {["KOL", "Symbol", "Canonical mint", "Conf.", "Res. status", "Priority", "Score", "kolCount", "Evidence", "Draft status", "Duplicate", "Post", "Actions"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drafts.length === 0 ? (
                <tr><td style={{ ...td, color: C.dim }} colSpan={13}>No draft links.</td></tr>
              ) : (
                drafts.map((d: DraftQueueRow) => (
                  <tr key={d.id}>
                    <td style={td}>{d.kolHandle}</td>
                    <td style={td}>{d.tokenSymbol ? `$${d.tokenSymbol}` : <span style={{ color: C.dim }}>—</span>}</td>
                    <td style={td}><Mint value={d.canonicalMint} /> <span style={{ color: C.dim, fontSize: 11 }}>{d.chain}</span></td>
                    <td style={td}><Pill text={d.resolutionConfidence ?? "—"} /></td>
                    <td style={td}>{d.resolutionStatus ?? "—"}</td>
                    <td style={td}>{d.campaignPriority ? <Pill text={d.campaignPriority} tone={d.campaignPriority === "HIGH" || d.campaignPriority === "CRITICAL" ? "danger" : "dim"} /> : "—"}</td>
                    <td style={td}>{d.signalScore ?? "—"}</td>
                    <td style={td}>{d.campaignKolCount ?? "—"}</td>
                    <td style={td}>{d.evidenceLevel ? <Pill text={d.evidenceLevel} tone="dim" /> : <span style={{ color: C.dim }}>—</span>}</td>
                    <td style={td}><Pill text={d.reviewStatus} tone="dim" /> <Pill text={d.visibility} tone="dim" /></td>
                    <td style={td}>{d.publicDuplicateCount > 0 ? <Pill text={`${d.publicDuplicateCount} public`} tone="danger" /> : <span style={{ color: C.dim }}>none</span>}</td>
                    <td style={td}>{d.postUrl ? <a href={d.postUrl} target="_blank" rel="noreferrer" style={{ color: C.accent }}>post ↗</a> : "—"}</td>
                    <td style={td}>
                      <DraftActions
                        draftId={d.id}
                        canApprove={!!d.canonicalMint && d.resolutionConfidence === "HIGH"}
                        blockReason={!d.canonicalMint ? "no canonical mint" : d.resolutionConfidence !== "HIGH" ? `confidence ${d.resolutionConfidence ?? "—"}` : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── NEEDS RESOLUTION ───────────────────────────────────────────── */}
      <section>
        <h2 style={{ ...label, color: C.accent, fontSize: 13, marginBottom: 10 }}>Needs Resolution ({counts.needsResolution})</h2>
        <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
            <thead>
              <tr>
                {["KOL", "Symbols", "Addresses", "Res. status", "Method", "Conf.", "Priority", "Score", "Limitation / raw text", "Post"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {needsResolution.length === 0 ? (
                <tr><td style={{ ...td, color: C.dim }} colSpan={10}>Resolution queue empty.</td></tr>
              ) : (
                needsResolution.map((r: NeedsResolutionRow) => (
                  <tr key={r.id}>
                    <td style={td}>{r.kolHandle ?? "—"}</td>
                    <td style={td}>{r.detectedSymbols?.length ? r.detectedSymbols.map((s) => `$${s}`).join(", ") : "—"}</td>
                    <td style={td}>{r.detectedAddresses?.length ? r.detectedAddresses.map((a, i) => <div key={i}><Mint value={a} /></div>) : <span style={{ color: C.dim }}>—</span>}</td>
                    <td style={td}><Pill text={r.resolutionStatus ?? "—"} tone="danger" /></td>
                    <td style={td}>{r.resolutionMethod ?? "—"}</td>
                    <td style={td}>{r.resolutionConfidence ?? "—"}</td>
                    <td style={td}>{r.campaignPriority ? <Pill text={r.campaignPriority} tone="dim" /> : "—"}</td>
                    <td style={td}>{r.signalScore ?? "—"}</td>
                    <td style={{ ...td, maxWidth: 320, color: C.dim }}>{r.rawText ? r.rawText.slice(0, 160) : "—"}</td>
                    <td style={td}>{r.postUrl ? <a href={r.postUrl} target="_blank" rel="noreferrer" style={{ color: C.accent }}>post ↗</a> : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
