"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { encryptString, encryptTags } from "@/lib/vault/crypto.client";

const ACCENT = "#FF6B00";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";
const DIM = "rgba(255,255,255,0.5)";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: `1px solid ${LINE}`,
  borderRadius: 6,
  padding: "12px 14px",
  color: "#FFFFFF",
  fontSize: 14,
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)",
  display: "block",
  marginBottom: 8,
};

const HELPER_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.5)",
  marginTop: 6,
};

const PRIMARY_BTN: React.CSSProperties = {
  backgroundColor: ACCENT,
  color: "#FFFFFF",
  height: 44,
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 14,
  paddingLeft: 20,
  paddingRight: 20,
  border: "none",
  cursor: "pointer",
};

const TEMPLATES = [
  { id: "blank", label: "Blank", tags: [] as string[] },
  { id: "rug-pull", label: "Rug Pull", tags: ["rug-pull", "defi", "deployer"] },
  {
    id: "kol-promo",
    label: "KOL Promo Scheme",
    tags: ["kol", "promo", "paid-promotion"],
  },
  {
    id: "cex-cashout",
    label: "CEX Cashout Trail",
    tags: ["cex", "cashout", "withdrawal"],
  },
  {
    id: "infostealer",
    label: "Infostealer Compromise",
    tags: ["infostealer", "malware", "compromise"],
  },
];

function NewCaseInner() {
  const router = useRouter();
  const { keys } = useVaultSession();
  const [template, setTemplate] = useState("blank");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!keys) return;
    const clean = title.trim();
    if (!clean) {
      setError("Please enter a case title.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const titleCt = await encryptString(clean, keys.metaKey);
      const tagsList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const tagsCt = await encryptTags(tagsList, keys.metaKey);
      const res = await fetch("/api/investigators/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titleEnc: titleCt.enc,
          titleIv: titleCt.iv,
          tagsEnc: tagsCt.enc,
          tagsIv: tagsCt.iv,
          caseTemplate: template,
        }),
      });
      if (!res.ok) {
        // Surface the real server reason so the investigator can actually
        // diagnose (e.g. missing_ciphertext, unauthorized, rate_limited).
        const body = (await res
          .json()
          .catch(() => ({}))) as { error?: string; message?: string };
        setError(
          body.message ??
            body.error ??
            `Could not create case (${res.status}) — please retry.`
        );
        setCreating(false);
        return;
      }
      const data = await res.json();
      // Send the investigator straight into the new case workspace.
      router.push(`/investigators/box/cases/${data.id}`);
    } catch {
      setError("Encryption failed — please retry.");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div style={{ marginBottom: 8 }}>
          <Link
            href="/investigators/dashboard"
            style={{ fontSize: 11, color: DIM, textDecoration: "none" }}
          >
            ← Dashboard
          </Link>
        </div>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: DIM,
            marginTop: 12,
          }}
        >
          INTERLIGENS · NEW CASE
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginTop: 8,
            letterSpacing: "-0.01em",
          }}
        >
          Start a new investigation
        </h1>
        <p
          style={{
            fontSize: 13,
            color: DIM,
            marginTop: 10,
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          Everything you add to this case — title, tags, wallets, notes, files —
          is encrypted in your browser before it leaves your device. We never
          see the plaintext.
        </p>

        <form onSubmit={submit} style={{ marginTop: 32 }}>
          <div style={{ marginBottom: 24 }}>
            <label style={LABEL_STYLE}>Template</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TEMPLATES.map((tpl) => {
                const active = template === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setTemplate(tpl.id);
                      setTags(tpl.tags.join(", "));
                    }}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: active
                        ? `1px solid ${ACCENT}`
                        : `1px solid ${LINE}`,
                      backgroundColor: active
                        ? "rgba(255,107,0,0.12)"
                        : SURFACE,
                      color: active ? ACCENT : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                    }}
                  >
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={LABEL_STYLE}>Investigation title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dione Protocol rug — deployer cluster"
              style={INPUT_STYLE}
              maxLength={200}
            />
            <div style={HELPER_STYLE}>
              Encrypted before it touches our servers.
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={LABEL_STYLE}>Tags</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="rug-pull, defi, deployer"
              style={INPUT_STYLE}
            />
            <div style={HELPER_STYLE}>Comma-separated. Also encrypted.</div>
          </div>

          {error && (
            <div
              style={{
                color: "#FF3B5C",
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              disabled={creating || !title.trim()}
              style={{
                ...PRIMARY_BTN,
                opacity: creating || !title.trim() ? 0.5 : 1,
                cursor: creating || !title.trim() ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Encrypting…" : "Create and open"}
            </button>
            <Link
              href="/investigators/dashboard"
              style={{
                fontSize: 13,
                color: DIM,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function NewCasePage() {
  return (
    <VaultGate>
      <NewCaseInner />
    </VaultGate>
  );
}
