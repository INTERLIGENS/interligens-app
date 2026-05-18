"use client";

import { useState } from "react";
import { ADMIN_COPY } from "@/lib/reflex/admin-copy";

const COLOR = {
  fg: "#FFFFFF", muted: "#888", border: "#1E2028",
  accent: "#FF6B00", danger: "#FF3B5C",
};

export default function FlagFpButton({
  id, initialFlag,
}: { id: string; initialFlag: boolean }) {
  const [flag, setFlag] = useState(initialFlag);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const method = flag ? "DELETE" : "POST";
      const res = await fetch(`/api/admin/reflex/${id}/flag-fp`, { method });
      if (res.ok) setFlag(!flag);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      style={{
        background: "transparent",
        border: `1px solid ${flag ? COLOR.danger : COLOR.border}`,
        color: flag ? COLOR.danger : COLOR.muted,
        padding: "2px 8px", fontSize: 11, fontFamily: "monospace",
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.5 : 1,
      }}
    >
      {flag ? ADMIN_COPY.labels.flaggedFp : ADMIN_COPY.labels.flagAsFp}
    </button>
  );
}
