"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import {
  decryptString,
  decryptTags,
  encryptString,
  encryptTags,
} from "@/lib/vault/crypto.client";

type CaseRow = {
  id: string;
  titleEnc: string;
  titleIv: string;
  tagsEnc: string;
  tagsIv: string;
  status: string;
  entityCount: number;
  fileCount: number;
  updatedAt: string;
};

type DecryptedCase = CaseRow & {
  title: string;
  tags: string[];
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
  color: "rgba(255,255,255,0.3)",
  marginTop: 6,
};

const PRIMARY_BTN: React.CSSProperties = {
  backgroundColor: "#FF6B00",
  color: "#FFFFFF",
  height: 44,
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 14,
  paddingLeft: 20,
  paddingRight: 20,
};

const SECONDARY_BTN: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.5)",
  height: 44,
  borderRadius: 6,
  fontSize: 14,
  paddingLeft: 20,
  paddingRight: 20,
};

function DashboardInner() {
  const router = useRouter();
  const { keys, lock } = useVaultSession();
  const [cases, setCases] = useState<DecryptedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTags, setNewTags] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!keys) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/investigators/cases");
        if (res.status === 401) {
          router.replace("/investigators/box/onboarding");
          return;
        }
        const data = await res.json();
        const rows: CaseRow[] = data.cases ?? [];
        const decrypted: DecryptedCase[] = [];
        for (const row of rows) {
          try {
            const title = await decryptString(
              row.titleEnc,
              row.titleIv,
              keys.metaKey
            );
            const tags = await decryptTags(
              row.tagsEnc,
              row.tagsIv,
              keys.metaKey
            );
            decrypted.push({ ...row, title, tags });
          } catch {
            decrypted.push({
              ...row,
              title: "[unreadable — wrong key?]",
              tags: [],
            });
          }
        }
        if (!cancelled) setCases(decrypted);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keys, router]);

  async function createCase() {
    if (!keys || !newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const titleCt = await encryptString(newTitle.trim(), keys.metaKey);
      const tagsList = newTags
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
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCases((prev) => [
          {
            id: data.id,
            titleEnc: data.titleEnc,
            titleIv: data.titleIv,
            tagsEnc: data.tagsEnc,
            tagsIv: data.tagsIv,
            status: data.status,
            entityCount: 0,
            fileCount: 0,
            updatedAt: data.createdAt,
            title: newTitle.trim(),
            tags: tagsList,
          },
          ...prev,
        ]);
        setNewTitle("");
        setNewTags("");
        setShowNew(false);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between">
          <div>
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              INVESTIGATORS
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: "#FFFFFF",
                marginTop: 8,
              }}
            >
              My Cases
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNew((v) => !v)}
              style={{ ...PRIMARY_BTN, height: 38 }}
            >
              + New case
            </button>
            <button
              onClick={lock}
              style={{ ...SECONDARY_BTN, height: 38 }}
            >
              Lock
            </button>
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.04em",
            marginTop: 20,
            marginBottom: 32,
          }}
        >
          Client-side encrypted&nbsp;&nbsp;·&nbsp;&nbsp;Your key never
          reaches our servers&nbsp;&nbsp;·&nbsp;&nbsp;Nothing is readable
          without your passphrase
        </div>

        {showNew && (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "24px 0",
              marginBottom: 32,
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Investigation title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={INPUT_STYLE}
                onFocus={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,107,0,0.6)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)")
                }
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Tags</label>
              <input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                style={INPUT_STYLE}
                onFocus={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,107,0,0.6)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.08)")
                }
              />
              <div style={HELPER_STYLE}>
                Comma-separated. Encrypted before storage.
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={createCase}
                disabled={creating || !newTitle.trim()}
                className="disabled:opacity-50"
                style={PRIMARY_BTN}
              >
                {creating ? "Encrypting…" : "Create case"}
              </button>
              <button
                onClick={() => {
                  setShowNew(false);
                  setNewTitle("");
                  setNewTags("");
                }}
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                  background: "none",
                  border: "none",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Loading cases…
          </div>
        ) : cases.length === 0 ? (
          <div
            className="mx-auto text-center"
            style={{ marginTop: 80, maxWidth: 480 }}
          >
            <div
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              No active cases.
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.25)",
                marginTop: 12,
                maxWidth: 400,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.6,
              }}
            >
              This is where your investigations live. Create your first case
              to start depositing evidence, wallets, transactions, and
              notes. Everything you add is encrypted before it reaches our
              servers.
            </div>
            <button
              onClick={() => setShowNew(true)}
              style={{ ...PRIMARY_BTN, marginTop: 24 }}
            >
              + Create your first case
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/investigators/box/cases/${c.id}`}
                className="block transition-colors"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  padding: 20,
                  backgroundColor: "#0a0a0a",
                }}
              >
                <div
                  style={{
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {c.title}
                </div>
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "rgba(255,255,255,0.5)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 4,
                          padding: "2px 8px",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.3)",
                    marginTop: 12,
                  }}
                >
                  {c.entityCount} entities · {c.fileCount} files ·{" "}
                  {c.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <VaultGate>
      <DashboardInner />
    </VaultGate>
  );
}
