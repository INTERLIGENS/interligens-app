"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCENT = "#FF6B00";
const DANGER = "#FF3B5C";
const DIM = "#8A8A8A";

export default function DraftActions({
  draftId,
  canApprove,
  blockReason,
}: {
  draftId: string;
  canApprove: boolean;
  blockReason?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function approve() {
    if (!canApprove || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/watcher-drafts/${draftId}/approve`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) router.refresh();
      else setMsg(j?.reason ?? j?.error ?? `error ${res.status}`);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (busy) return;
    const reason = window.prompt("Reject reason (required):")?.trim();
    if (!reason) {
      setMsg("reason required");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/watcher-drafts/${draftId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) router.refresh();
      else setMsg(j?.error ?? `error ${res.status}`);
    } finally {
      setBusy(false);
    }
  }

  const btn: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 9px",
    borderRadius: 4,
    cursor: "pointer",
    background: "transparent",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170 }}>
      <button
        onClick={approve}
        disabled={!canApprove || busy}
        title={canApprove ? "Approve public token link" : blockReason ?? "Checklist not met"}
        style={{
          ...btn,
          border: `1px solid ${canApprove ? ACCENT : DIM}`,
          color: canApprove ? ACCENT : DIM,
          opacity: canApprove && !busy ? 1 : 0.5,
          cursor: canApprove && !busy ? "pointer" : "not-allowed",
        }}
      >
        Approve public token link
      </button>
      <button
        onClick={reject}
        disabled={busy}
        style={{ ...btn, border: `1px solid ${DANGER}`, color: DANGER, opacity: busy ? 0.5 : 1 }}
      >
        Reject
      </button>
      {!canApprove && blockReason && <span style={{ color: DIM, fontSize: 10 }}>{blockReason}</span>}
      {msg && <span style={{ color: DANGER, fontSize: 10 }}>{msg}</span>}
    </div>
  );
}
