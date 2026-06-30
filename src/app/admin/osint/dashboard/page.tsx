/**
 * src/app/admin/osint/dashboard/page.tsx
 *
 * SPRINT B — Observabilité OSINT (/admin/osint/dashboard). Lecture seule, gardée
 * server-side. Métriques du plan v2 : volume, taux (auto-commit/pending/rejected/
 * duplicate), top pending reasons, coût vision estimé, erreurs Helius, backlog de
 * revue, temps moyen de traitement. Des chiffres lisibles d'abord, pas de graphe
 * inutile. Si le pipeline n'écrit pas encore (table absente), on affiche
 * honnêtement « en attente de données réelles » — aucun chiffre inventé.
 */
import { redirect } from "next/navigation";
import { isAdminSessionFromCookies } from "@/lib/security/adminAuth";
import { loadDashboard } from "@/lib/osint/observability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const C = { bg: "#000000", accent: "#FF6B00", text: "#FFFFFF", danger: "#FF3B5C", warning: "#FFB800", safe: "#00FF94", dim: "#8A8A8A", line: "#222222", panel: "#0A0A0A" };
const label: React.CSSProperties = { textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 900, fontSize: 11, color: C.dim };

function Stat({ k, value, sub, tone }: { k: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 8, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ ...label, fontSize: 9 }}>{k}</span>
      <span style={{ fontSize: 30, fontWeight: 900, color: tone ?? C.text, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: C.dim }}>{sub}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ ...label, color: C.accent, fontSize: 13, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

export default async function OsintDashboardPage() {
  if (!(await isAdminSessionFromCookies())) redirect("/admin/login");

  const { metrics: m, submissionSourceLive, legacyBacklog, generatedAt } = await loadDashboard();
  const waiting = <span style={{ color: C.warning, fontSize: 12 }}>0 / en attente de données réelles</span>;

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "28px 32px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
        <h1 style={{ ...label, fontSize: 18, color: C.accent, margin: 0 }}>OSINT Observability</h1>
        <span style={{ color: C.dim, fontSize: 12 }}>read-only · shadow pipeline</span>
      </div>
      <p style={{ color: C.dim, fontSize: 11, marginBottom: 4 }}>generated {generatedAt}</p>
      {!submissionSourceLive && (
        <p style={{ color: C.warning, fontSize: 11, marginBottom: 22 }}>
          OsintSubmission table not applied — submission metrics are 0 (en attente de données réelles). Review backlog below is measured live from bridge sources.
        </p>
      )}

      {/* ── Volume + taux ───────────────────────────────────────────────── */}
      <Section title="Volume & issues">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Stat k="total submissions" value={m.hasData ? m.totalSubmissions : 0} sub={m.hasData ? undefined : "no data yet"} />
          <Stat k="auto-commit (shadow)" value={m.hasData ? `${m.rates.autoCommit.pct}%` : "—"} sub={`${m.rates.autoCommit.count} items`} tone={C.safe} />
          <Stat k="pending review" value={m.hasData ? `${m.rates.pending.pct}%` : "—"} sub={`${m.rates.pending.count} items`} tone={C.warning} />
          <Stat k="rejected" value={m.hasData ? `${m.rates.rejected.pct}%` : "—"} sub={`${m.rates.rejected.count} items`} tone={C.danger} />
          <Stat k="duplicate" value={m.hasData ? `${m.rates.duplicate.pct}%` : "—"} sub={`${m.rates.duplicate.count} items`} />
          <Stat k="error" value={m.hasData ? `${m.rates.error.pct}%` : "—"} sub={`${m.rates.error.count} items`} tone={C.danger} />
        </div>
      </Section>

      {/* ── Volume par jour ─────────────────────────────────────────────── */}
      <Section title="Volume per day (UTC)">
        {m.perDay.length === 0 ? waiting : (
          <div style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 8, overflow: "hidden" }}>
            {m.perDay.map((d) => (
              <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: C.dim, width: 100 }}>{d.day}</span>
                <div style={{ flex: 1, background: "#050505", borderRadius: 3, height: 10 }}>
                  <div style={{ width: `${Math.min(100, (d.count / Math.max(...m.perDay.map((x) => x.count))) * 100)}%`, background: C.accent, height: "100%", borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, width: 40, textAlign: "right" }}>{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Top pending reasons ─────────────────────────────────────────── */}
      <Section title="Top pending reasons">
        {m.topPendingReasons.length === 0 ? waiting : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {m.topPendingReasons.map((r) => (
              <div key={r.reason} style={{ display: "flex", justifyContent: "space-between", border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: "8px 14px" }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{r.reason}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: C.warning }}>{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Coût vision + Helius ────────────────────────────────────────── */}
      <Section title="Vision cost & on-chain checks">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Stat k="vision passes" value={m.hasData ? m.vision.totalPasses : 0} sub={`$${m.vision.costPerPassUsd}/pass (est.)`} />
          <Stat k="est. vision cost" value={m.hasData ? `$${m.vision.estimatedCostUsd}` : "$0"} sub={m.hasData ? undefined : "en attente de données réelles"} tone={C.accent} />
          <Stat k="helius unavailable" value={m.helius.unavailable} sub="check could not run" tone={C.warning} />
          <Stat k="mint not found" value={m.helius.notFound} sub="fake CA" tone={C.danger} />
          <Stat k="error retryable" value={m.helius.retryable} tone={C.warning} />
          <Stat k="error final" value={m.helius.finalErrors} tone={C.danger} />
        </div>
      </Section>

      {/* ── Backlog de revue ────────────────────────────────────────────── */}
      <Section title="Review backlog">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Stat k="submission backlog" value={m.backlog.pending} sub={m.backlog.oldestAgeHours !== null ? `oldest ${m.backlog.oldestAgeHours}h` : "none waiting"} tone={m.backlog.pending > 0 ? C.warning : C.text} />
          <Stat k="assertion backlog" value={legacyBacklog.links} sub="KolTokenLink pending_review" tone={legacyBacklog.links > 0 ? C.warning : C.text} />
          <Stat k="signal backlog" value={legacyBacklog.signals} sub="SignalIntake needs_resolution" tone={legacyBacklog.signals > 0 ? C.warning : C.text} />
          <Stat k="avg processing" value={m.avgProcessingHours !== null ? `${m.avgProcessingHours}h` : "—"} sub={m.avgProcessingHours !== null ? "ingest → processed" : "en attente de données réelles"} />
        </div>
      </Section>
    </div>
  );
}
