"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const C = { accent: "#FF6B00", danger: "#FF3B5C", warning: "#FFB800", dim: "#8A8A8A", line: "#222222", panel: "#0A0A0A", text: "#FFFFFF" };

type ItemType = "submission" | "link" | "signal";

const btn: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
  padding: "7px 12px", borderRadius: 4, cursor: "pointer", background: "transparent", whiteSpace: "nowrap",
};

/**
 * ReviewActions — UI 1-clic. AUCUNE logique métier ici : chaque action POST une
 * route admin qui appelle le vrai handler (src/lib/osint/review). RESOLVE
 * re-vérifie la CA on-chain côté serveur ; l'UI ne fait que collecter la saisie.
 */
export default function ReviewActions({
  itemType,
  itemId,
  defaultChain,
  defaultCa,
}: {
  itemType: ItemType;
  itemId: string;
  defaultChain: string | null;
  defaultCa: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "resolve" | "reject" | "escalate">(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [ca, setCa] = useState(defaultCa ?? "");
  const [chain, setChain] = useState(defaultChain ?? "solana");

  async function post(path: string, body: Record<string, unknown>, kind: "resolve" | "reject" | "escalate") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: itemType, id: itemId, ...body }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.ok) {
        setMsg({ tone: "ok", text: kindMessage(kind, j) });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: j?.error ?? j?.detail ?? `error ${res.status}` });
      }
    } finally {
      setBusy(null);
    }
  }

  function kindMessage(kind: string, j: { resultingStatus?: string; mint?: { symbol?: string | null } }) {
    if (kind === "resolve") return `Resolved on-chain${j?.mint?.symbol ? ` (${j.mint.symbol})` : ""} — stays shadow`;
    if (kind === "reject") return "Rejected — evidence preserved";
    return "Escalated — out of standard queue";
  }

  async function resolve() {
    const v = ca.trim();
    if (!v) { setMsg({ tone: "err", text: "Enter a contract address to re-verify on-chain" }); return; }
    const reason = window.prompt("Resolution note (what was corrected):")?.trim() ?? "";
    await post("/api/admin/osint/review/resolve", { contractAddress: v, chain, reason }, "resolve");
  }
  async function reject() {
    const reason = window.prompt("Reject reason (required). Wording: documented limitation, not accusation:")?.trim();
    if (!reason) { setMsg({ tone: "err", text: "reason required" }); return; }
    await post("/api/admin/osint/review/reject", { reason }, "reject");
  }
  async function escalate() {
    const reason = window.prompt("Escalation reason (e.g. P0 / forensic deep-dive):")?.trim();
    if (!reason) { setMsg({ tone: "err", text: "reason required" }); return; }
    await post("/api/admin/osint/review/escalate", { reason }, "escalate");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setOpen((o) => !o)} disabled={!!busy}
          style={{ ...btn, border: `1px solid ${C.accent}`, color: C.accent, opacity: busy ? 0.5 : 1 }}>
          {busy === "resolve" ? "Verifying…" : "Resolve"}
        </button>
        <button onClick={reject} disabled={!!busy}
          style={{ ...btn, border: `1px solid ${C.danger}`, color: C.danger, opacity: busy ? 0.5 : 1 }}>
          {busy === "reject" ? "…" : "Reject"}
        </button>
        <button onClick={escalate} disabled={!!busy}
          style={{ ...btn, border: `1px solid ${C.warning}`, color: C.warning, opacity: busy ? 0.5 : 1 }}>
          {busy === "escalate" ? "…" : "Escalate"}
        </button>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, border: `1px solid ${C.line}`, borderRadius: 4, background: "#050505" }}>
          <label style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, fontWeight: 800 }}>
            Contract address (re-checked on-chain)
          </label>
          <input value={ca} onChange={(e) => setCa(e.target.value)} placeholder="paste / correct the CA"
            spellCheck={false}
            style={{ background: "#000", border: `1px solid ${C.line}`, color: C.text, padding: "6px 8px", fontFamily: "monospace", fontSize: 12, borderRadius: 3 }} />
          <select value={chain} onChange={(e) => setChain(e.target.value)}
            style={{ background: "#000", border: `1px solid ${C.line}`, color: C.text, padding: "6px 8px", fontSize: 12, borderRadius: 3 }}>
            <option value="solana">solana</option>
            <option value="ethereum">ethereum</option>
          </select>
          <button onClick={resolve} disabled={!!busy}
            style={{ ...btn, border: `1px solid ${C.accent}`, color: "#000", background: C.accent, opacity: busy ? 0.6 : 1 }}>
            Re-verify on-chain &amp; resolve (shadow)
          </button>
        </div>
      )}

      {msg && (
        <span style={{ fontSize: 11, color: msg.tone === "ok" ? C.accent : C.danger }}>{msg.text}</span>
      )}
    </div>
  );
}
