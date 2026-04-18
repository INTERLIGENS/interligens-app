"use client";

import { useMemo, useState } from "react";
import { useVaultToast } from "@/components/vault/VaultToast";
import { describeResponse } from "@/lib/investigators/errorMessages";

const TYPES = [
  "WALLET",
  "TX_HASH",
  "HANDLE",
  "URL",
  "DOMAIN",
  "ALIAS",
  "EMAIL",
  "CONTRACT",
  "OTHER",
] as const;

type EntityType = (typeof TYPES)[number];

type ParsedItem = { type: EntityType; value: string };

type Props = {
  onAdded: (lastAdded: ParsedItem | null) => void;
  caseId: string;
};

const LABEL_STYLE: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)",
  display: "block",
  marginBottom: 8,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6,
  padding: "12px 14px",
  color: "#FFFFFF",
  fontSize: 14,
  outline: "none",
};

const PRIMARY_BTN: React.CSSProperties = {
  backgroundColor: "#FF6B00",
  color: "#FFFFFF",
  height: 44,
  borderRadius: 6,
  fontSize: 14,
  padding: "0 20px",
  border: "none",
  cursor: "pointer",
};

function parseBulk(text: string): ParsedItem[] {
  const found: ParsedItem[] = [];
  const seen = new Set<string>();

  function push(type: EntityType, value: string) {
    const key = `${type}|${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ type, value });
  }

  const evmAddrRe = /0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g;
  const evmTxRe = /0x[a-fA-F0-9]{64}/g;
  const tgRe = /t\.me\/([a-zA-Z0-9_]{3,})/g;
  const twRe = /@([a-zA-Z0-9_]{1,30})/g;
  const urlRe = /\bhttps?:\/\/[^\s,]+/g;
  const solRe = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

  for (const m of text.matchAll(evmTxRe)) push("TX_HASH", m[0]);
  const txSet = new Set(found.filter((f) => f.type === "TX_HASH").map((f) => f.value));

  for (const m of text.matchAll(evmAddrRe)) {
    if (!Array.from(txSet).some((t) => t.startsWith(m[0]))) {
      push("WALLET", m[0]);
    }
  }
  for (const m of text.matchAll(urlRe)) push("URL", m[0]);
  for (const m of text.matchAll(tgRe)) push("HANDLE", m[1]);
  for (const m of text.matchAll(twRe)) push("HANDLE", m[1]);

  const walletSet = new Set(found.filter((f) => f.type === "WALLET").map((f) => f.value));
  for (const m of text.matchAll(solRe)) {
    if (m[0].startsWith("0x")) continue;
    if (walletSet.has(m[0])) continue;
    if (m[0].length < 32) continue;
    push("WALLET", m[0]);
  }

  return found;
}

export default function EntityAddForm({ onAdded, caseId }: Props) {
  const toast = useVaultToast();
  const [showBulk, setShowBulk] = useState(false);
  const [type, setType] = useState<EntityType>("WALLET");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkParsed = useMemo(() => parseBulk(bulkText), [bulkText]);

  const bulkSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of bulkParsed) {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    }
    return counts;
  }, [bulkParsed]);

  async function submitSingle() {
    if (!value.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigators/cases/${caseId}/entities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entities: [
            {
              type,
              value: value.trim(),
              label: label.trim() || undefined,
              extractionMethod: "manual",
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = describeResponse(res, body);
        setError(msg);
        toast.showError(msg);
        return;
      }
      const added: ParsedItem = { type, value: value.trim() };
      setValue("");
      setLabel("");
      toast.showSuccess(`Added ${type.toLowerCase()}`);
      onAdded(added);
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Network error — ${err.message}`
          : "Network error — check your connection";
      setError(msg);
      toast.showError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function submitBulk() {
    if (bulkParsed.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigators/cases/${caseId}/entities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entities: bulkParsed.map((p) => ({
            type: p.type,
            value: p.value,
            extractionMethod: "manual_bulk",
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = describeResponse(res, body);
        setError(msg);
        toast.showError(msg);
        return;
      }
      const last = bulkParsed[bulkParsed.length - 1] ?? null;
      setBulkText("");
      toast.showSuccess(`Added ${bulkParsed.length} entit${bulkParsed.length === 1 ? "y" : "ies"}`);
      onAdded(last);
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Network error — ${err.message}`
          : "Network error — check your connection";
      setError(msg);
      toast.showError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        paddingBottom: 24,
        marginBottom: 24,
      }}
    >
      <label style={LABEL_STYLE}>Add entity</label>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
        {TYPES.map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              style={{
                fontSize: 11,
                padding: "5px 10px",
                borderRadius: 20,
                border: active
                  ? "1px solid #FF6B00"
                  : "1px solid rgba(255,255,255,0.12)",
                backgroundColor: active
                  ? "rgba(255,107,0,0.15)"
                  : "transparent",
                color: active ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 500,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div style={{ marginBottom: 10 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Address, handle, URL, hash..."
          style={INPUT_STYLE}
          onFocus={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(255,107,0,0.6)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)")
          }
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Optional label"
          style={INPUT_STYLE}
          onFocus={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(255,107,0,0.6)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)")
          }
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={submitSingle}
          disabled={saving || !value.trim()}
          className="disabled:opacity-50"
          style={PRIMARY_BTN}
        >
          {saving ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setShowBulk((v) => !v)}
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            background: "none",
            border: "none",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            cursor: "pointer",
          }}
        >
          {showBulk ? "Hide bulk paste" : "Bulk paste"}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "#FF9AAB",
            border: "1px solid rgba(255,59,92,0.35)",
            background: "rgba(255,59,92,0.08)",
            padding: "8px 12px",
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}

      {showBulk && (
        <div style={{ marginTop: 18 }}>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Paste wallets, handles, URLs, hashes — one per line or comma-separated"
            style={{
              ...INPUT_STYLE,
              height: 120,
              fontFamily: "ui-monospace, monospace",
              resize: "vertical",
            }}
          />
          {bulkParsed.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                backgroundColor: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 6,
                }}
              >
                Detected:{" "}
                {Object.entries(bulkSummary)
                  .map(([k, v]) => `${v} ${k.toLowerCase()}${v > 1 ? "s" : ""}`)
                  .join(", ")}
              </div>
              <div
                className="flex flex-col gap-1"
                style={{ maxHeight: 160, overflowY: "auto" }}
              >
                {bulkParsed.map((p, i) => (
                  <div
                    key={`${p.type}-${p.value}-${i}`}
                    className="flex items-center gap-3"
                    style={{ fontSize: 12 }}
                  >
                    <span
                      style={{
                        color: "#FF6B00",
                        fontSize: 10,
                        width: 60,
                        textTransform: "uppercase",
                      }}
                    >
                      {p.type}
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontFamily: "ui-monospace, monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={submitBulk}
                disabled={saving}
                style={{
                  ...PRIMARY_BTN,
                  height: 38,
                  marginTop: 12,
                }}
                className="disabled:opacity-50"
              >
                {saving ? "Adding…" : `Add ${bulkParsed.length} entities`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
