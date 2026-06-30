/**
 * src/app/admin/osint/review/page.tsx
 *
 * SPRINT B — Page admin de REVUE du backlog OSINT (/admin/osint/review).
 * Gardée server-side (même gate que les autres pages admin sensibles).
 *
 * Liste les items PENDING des 3 sources (OsintSubmission PENDING_REVIEW,
 * KolTokenLink pending_review, SignalIntake needs_resolution). Pour chaque item :
 * la capture (ou un placeholder + métadonnées), ce que la vision a lu (passes +
 * claim), la RAISON lisible du pending, le trustTier + claimStatus, et un badge
 * « possible coordinated reporting » le cas échéant. Les actions 1-clic passent
 * par de VRAIS handlers via les routes API (aucune logique métier ici).
 *
 * DOCTRINE : tout reste shadow. La review ne publie rien. Wording « documented
 * critical risk », jamais « scammer ».
 */
import { redirect } from "next/navigation";
import { isAdminSessionFromCookies } from "@/lib/security/adminAuth";
import { loadReviewQueue, type ReviewQueueItem } from "@/lib/osint/review/loadReviewQueue";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const C = {
  bg: "#000000", accent: "#FF6B00", text: "#FFFFFF",
  danger: "#FF3B5C", warning: "#FFB800", dim: "#8A8A8A",
  line: "#222222", panel: "#0A0A0A",
};

const label: React.CSSProperties = { textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 900, fontSize: 11, color: C.dim };
const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

/** PendingReason → libellé humain (FR). Source de vérité d'affichage. */
const PENDING_LABEL: Record<string, string> = {
  LOW_CONFIDENCE: "Confiance vision basse",
  NEEDS_SOURCE: "Assertion sans source liable",
  CA_ABSENT: "CA absente / non résolue",
  CA_PARTIAL: "CA partielle (tail clippée)",
  TICKER_MISMATCH: "Ticker ≠ symbole on-chain",
  MINT_NOT_FOUND: "Mint introuvable on-chain",
  CHAIN_AMBIGUOUS: "Chain indéterminable",
  ATTRIBUTION: "Attribution KOL↔token incertaine",
  SUSPECT_IMAGE: "Image suspecte (montage probable)",
};

const TYPE_LABEL: Record<string, string> = {
  submission: "Vision submission",
  link: "KOL↔token assertion",
  signal: "Bridge signal",
};

function Pill({ text, tone = "dim" }: { text: string; tone?: "accent" | "danger" | "warning" | "dim" }) {
  const color = tone === "danger" ? C.danger : tone === "warning" ? C.warning : tone === "accent" ? C.accent : C.dim;
  return <span style={{ border: `1px solid ${color}`, color, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{text}</span>;
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ ...label, fontSize: 9 }}>{k}</span>
      <span style={{ fontSize: 13, color: C.text }}>{children}</span>
    </div>
  );
}

function ageHours(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const h = ms / 3_600_000;
  return h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
}

function Capture({ item }: { item: ReviewQueueItem }) {
  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="capture" style={{ width: "100%", borderRadius: 4, border: `1px solid ${C.line}`, display: "block" }} />;
  }
  return (
    <div style={{ border: `1px dashed ${C.line}`, borderRadius: 4, padding: 14, background: "#050505", display: "flex", flexDirection: "column", gap: 8, minHeight: 120 }}>
      <span style={{ ...label, fontSize: 9, color: C.warning }}>No servable image — metadata only</span>
      <Field k="sha256">{item.imageSha256 ? <span style={mono}>{item.imageSha256.slice(0, 12)}…{item.imageSha256.slice(-8)}</span> : "—"}</Field>
      <Field k="pHash">{item.perceptualHash ? <span style={mono}>{item.perceptualHash}</span> : "—"}</Field>
      <Field k="local path">{item.localFilePath ? <span style={{ ...mono, color: C.dim, wordBreak: "break-all" }}>{item.localFilePath}</span> : "—"}</Field>
    </div>
  );
}

function VisionRead({ item }: { item: ReviewQueueItem }) {
  if (!item.vision) {
    return <span style={{ color: C.dim, fontSize: 12 }}>No vision pass (source: {TYPE_LABEL[item.type]}).</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Pill text={item.vision.twoPass ? "2-pass consensus" : "single read"} tone={item.vision.twoPass ? "accent" : "warning"} />
        {!item.vision.twoPass && <span style={{ fontSize: 11, color: C.warning }}>no second pass — CA forced cautious</span>}
      </div>
      <details>
        <summary style={{ ...label, fontSize: 9, cursor: "pointer" }}>raw vision passes</summary>
        <pre style={{ ...mono, color: C.dim, background: "#050505", border: `1px solid ${C.line}`, borderRadius: 4, padding: 8, overflowX: "auto", maxHeight: 220, marginTop: 6 }}>
{JSON.stringify({ pass1: item.vision.rawPass1, pass2: item.vision.rawPass2 }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default async function OsintReviewPage() {
  if (!(await isAdminSessionFromCookies())) redirect("/admin/login");

  const { items, counts, submissionSourceLive } = await loadReviewQueue();

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "28px 32px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
        <h1 style={{ ...label, fontSize: 18, color: C.accent, margin: 0 }}>OSINT Review</h1>
        <span style={{ color: C.dim, fontSize: 12 }}>shadow only · resolving never publishes · publication stays behind the triple-gate</span>
      </div>
      <p style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>
        {counts.total} pending · {counts.submissions} vision · {counts.links} assertions · {counts.signals} signals
      </p>
      {!submissionSourceLive && (
        <p style={{ color: C.warning, fontSize: 11, marginBottom: 20 }}>
          OsintSubmission table not applied — vision-pipeline items show 0 (en attente de données réelles). Bridge sources below are live.
        </p>
      )}

      {items.length === 0 ? (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 40, color: C.dim, textAlign: "center" }}>
          Review queue empty. Nothing pending.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 18 }}>
          {items.map((item) => (
            <article key={`${item.type}:${item.id}`} style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 8, padding: 18, display: "grid", gridTemplateColumns: "minmax(220px, 300px) 1fr minmax(190px, 230px)", gap: 20 }}>
              {/* ── Capture ─────────────────────────────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill text={TYPE_LABEL[item.type]} tone="accent" />
                  {item.poisoningFlag && <Pill text="possible coordinated reporting" tone="danger" />}
                </div>
                <Capture item={item} />
              </div>

              {/* ── Lecture vision + claim + raison ──────────────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                  <Field k="ticker">{item.tokenSymbol ? `$${item.tokenSymbol}` : <span style={{ color: C.dim }}>—</span>}</Field>
                  <Field k="contract">{item.contractAddress ? <span style={mono} title={item.contractAddress}>{item.contractAddress.slice(0, 6)}…{item.contractAddress.slice(-4)}</span> : <span style={{ color: C.dim }}>—</span>}</Field>
                  <Field k="chain">{item.chain ?? <span style={{ color: C.dim }}>—</span>}</Field>
                  <Field k="KOL">{item.kolHandle ? `@${item.kolHandle}` : <span style={{ color: C.dim }}>—</span>}</Field>
                  <Field k="perf">{item.perf ?? <span style={{ color: C.dim }}>—</span>}</Field>
                  <Field k="age">{ageHours(item.createdAt)}</Field>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ ...label, fontSize: 9 }}>pending reason</span>
                  <Pill text={PENDING_LABEL[item.pendingReason ?? ""] ?? item.pendingReason ?? "unspecified"} tone="warning" />
                  {item.claimStatus && <Pill text={item.claimStatus} tone="dim" />}
                  {item.trustTier && <Pill text={`trust: ${item.trustTier}`} tone="dim" />}
                </div>

                <VisionRead item={item} />

                {item.decisionReasons.length > 0 && (
                  <details>
                    <summary style={{ ...label, fontSize: 9, cursor: "pointer" }}>decision trace ({item.decisionReasons.length})</summary>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16, color: C.dim, fontSize: 11, lineHeight: 1.5 }}>
                      {item.decisionReasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </details>
                )}
              </div>

              {/* ── Actions ──────────────────────────────────────────── */}
              <div style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 18 }}>
                <ReviewActions itemType={item.type} itemId={item.id} defaultChain={item.chain} defaultCa={item.contractAddress} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
