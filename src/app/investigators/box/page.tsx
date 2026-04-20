"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  decryptString,
  decryptTags,
  encryptString,
  encryptTags,
} from "@/lib/vault/crypto.client";

const ENCRYPTED_PLACEHOLDER =
  "Contenu chiffré — accessible uniquement par l'investigator propriétaire.";

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

type SearchResult = {
  entityId: string;
  type: string;
  value: string;
  label: string | null;
  tigerScore: number | null;
  caseId: string;
  caseTitleEnc: string;
  caseTitleIv: string;
};

type DecryptedSearchResult = SearchResult & { caseTitle: string };

function DashboardInner() {
  const router = useRouter();
  const { keys, lock } = useVaultSession();
  const { isAdmin } = useIsAdmin();
  const [cases, setCases] = useState<DecryptedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newTemplate, setNewTemplate] = useState<string>("blank");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DecryptedSearchResult[]>(
    []
  );
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [metrics, setMetrics] = useState<{
    activeCases: number | null;
    trackedEntities: number | null;
    openHypotheses: number | null;
    publishReadyCases: number | null;
  }>({
    activeCases: null,
    trackedEntities: null,
    openHypotheses: null,
    publishReadyCases: null,
  });
  const [sortBy, setSortBy] = useState<"recent" | "entities" | "status">(
    "recent"
  );

  // Case-card action menu + rename/delete modal state.
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DecryptedCase | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DecryptedCase | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function openRename(c: DecryptedCase) {
    setRenameTarget(c);
    setRenameInput(c.title);
    setMenuOpenForId(null);
  }

  function openDelete(c: DecryptedCase) {
    setDeleteTarget(c);
    setMenuOpenForId(null);
  }

  async function submitRename() {
    if (!keys || !renameTarget || renameBusy) return;
    const next = renameInput.trim();
    if (!next || next === renameTarget.title) {
      setRenameTarget(null);
      return;
    }
    setRenameBusy(true);
    try {
      const ct = await encryptString(next, keys.metaKey);
      const res = await fetch(
        `/api/investigators/cases/${renameTarget.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ titleEnc: ct.enc, titleIv: ct.iv }),
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      setCases((prev) =>
        prev.map((c) =>
          c.id === renameTarget.id
            ? { ...c, titleEnc: data.titleEnc, titleIv: data.titleIv, title: next }
            : c,
        ),
      );
      setRenameTarget(null);
    } finally {
      setRenameBusy(false);
    }
  }

  async function submitDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/investigators/cases/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) return;
      setCases((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  // Close the kebab menu on any outside click.
  useEffect(() => {
    if (!menuOpenForId) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-case-menu]")) {
        setMenuOpenForId(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpenForId]);

  useEffect(() => {
    if (!keys) return;
    fetch("/api/investigators/workspace/metrics")
      .then((r) => r.json())
      .then((d) => setMetrics(d))
      .catch(() => {});
  }, [keys]);

  useEffect(() => {
    if (!keys) return;
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/investigators/entities/search?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const raw: SearchResult[] = data.results ?? [];
        const decrypted: DecryptedSearchResult[] = [];
        for (const r of raw) {
          let caseTitle = "[unreadable]";
          try {
            caseTitle = await decryptString(
              r.caseTitleEnc,
              r.caseTitleIv,
              keys.metaKey
            );
          } catch {}
          decrypted.push({ ...r, caseTitle });
        }
        setSearchResults(decrypted);
        setShowSearchResults(true);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, keys]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest?.("[data-global-search]")) {
        setShowSearchResults(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowSearchResults(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    // Normal path requires vault keys. Admin bypass path runs without keys
    // and renders the cases list in read-only mode with an encrypted-
    // content placeholder — the admin doesn't own the per-investigator
    // decryption key.
    if (!keys && !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/investigators/cases");
        if (res.status === 401) {
          // Admin founder: a 401 here means the server still treats the
          // session as non-investigator. Do NOT push into the NDA flow —
          // just render an empty, read-only workspace.
          if (isAdmin) {
            if (!cancelled) setCases([]);
            return;
          }
          router.replace("/investigators/box/onboarding");
          return;
        }
        const data = await res.json();
        const rows: CaseRow[] = data.cases ?? [];
        const decrypted: DecryptedCase[] = [];
        for (const row of rows) {
          if (!keys) {
            // Admin view — no key, render placeholder without attempting
            // to decrypt.
            decrypted.push({
              ...row,
              title: ENCRYPTED_PLACEHOLDER,
              tags: [],
            });
            continue;
          }
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
  }, [keys, router, isAdmin]);

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
          caseTemplate: newTemplate,
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
        setNewTemplate("blank");
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
            marginBottom: 24,
          }}
        >
          Client-side encrypted&nbsp;&nbsp;·&nbsp;&nbsp;Your key never
          reaches our servers&nbsp;&nbsp;·&nbsp;&nbsp;Nothing is readable
          without your passphrase&nbsp;&nbsp;·&nbsp;&nbsp;
          <Link
            href="/investigators/box/trust"
            style={{ color: "#FF6B00", textDecoration: "none" }}
          >
            How this works →
          </Link>
        </div>

        {/* METRICS STRIP */}
        <div
          style={{
            display: "flex",
            gap: 40,
            paddingBottom: 24,
            marginBottom: 24,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexWrap: "wrap",
          }}
        >
          {[
            { key: "activeCases", label: "Active cases" },
            { key: "trackedEntities", label: "Tracked entities" },
            { key: "openHypotheses", label: "Open hypotheses" },
            { key: "publishReadyCases", label: "Publish ready" },
          ].map((m) => {
            const val = (metrics as Record<string, number | null>)[m.key];
            return (
              <div key={m.key}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    lineHeight: 1.1,
                  }}
                >
                  {val ?? "—"}
                </div>
                <div
                  style={{
                    textTransform: "uppercase",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.3)",
                    marginTop: 6,
                  }}
                >
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>

        <div
          data-global-search
          style={{ position: "relative", marginBottom: 32 }}
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowSearchResults(true);
            }}
            placeholder="Search wallets, handles, domains across all cases"
            style={{
              width: "100%",
              backgroundColor: "#0d0d0d",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              padding: "12px 14px",
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
            }}
          />
          {showSearchResults && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: 6,
                backgroundColor: "#0a0a0a",
                border: "1px solid rgba(255,107,0,0.2)",
                borderRadius: 6,
                maxHeight: 400,
                overflowY: "auto",
                zIndex: 50,
                boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              }}
            >
              {searchLoading && (
                <div
                  style={{
                    padding: 14,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  Searching…
                </div>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <div
                  style={{
                    padding: 14,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  No entities found matching &apos;{searchQuery}&apos;
                </div>
              )}
              {!searchLoading &&
                searchResults.map((r) => (
                  <button
                    key={r.entityId}
                    onClick={() => {
                      router.push(`/investigators/box/cases/${r.caseId}`);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "#FFFFFF",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "#FF6B00",
                        textTransform: "uppercase",
                        width: 60,
                        flexShrink: 0,
                      }}
                    >
                      {r.type}
                    </span>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.9)",
                        flex: 1,
                        wordBreak: "break-all",
                      }}
                    >
                      {r.value.length > 28
                        ? r.value.slice(0, 28) + "…"
                        : r.value}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.4)",
                        flexShrink: 0,
                      }}
                    >
                      {r.caseTitle}
                    </span>
                    {r.tigerScore != null && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 4,
                          color: "#FF6B00",
                          border: "1px solid rgba(255,107,0,0.4)",
                          flexShrink: 0,
                        }}
                      >
                        {r.tigerScore}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}
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
              <label style={LABEL_STYLE}>Template</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "blank", label: "Blank", tags: [] },
                  {
                    id: "rug-pull",
                    label: "Rug Pull",
                    tags: ["rug-pull", "defi", "deployer"],
                  },
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
                ].map((tpl) => {
                  const active = newTemplate === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setNewTemplate(tpl.id);
                        setNewTags(tpl.tags.join(", "));
                      }}
                      style={{
                        fontSize: 12,
                        padding: "6px 12px",
                        borderRadius: 20,
                        border: active
                          ? "1px solid #FF6B00"
                          : "1px solid rgba(255,255,255,0.12)",
                        backgroundColor: active
                          ? "rgba(255,107,0,0.1)"
                          : "transparent",
                        color: active ? "#FF6B00" : "rgba(255,255,255,0.6)",
                        cursor: "pointer",
                      }}
                    >
                      {tpl.label}
                    </button>
                  );
                })}
              </div>
            </div>
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
        ) : loading || cases.length === 0 ? null : (
          <div
            className="flex items-center justify-end gap-3"
            style={{ marginBottom: 12, fontSize: 11 }}
          >
            <span
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Sort by
            </span>
            {(["recent", "entities", "status"] as const).map((s, i, arr) => (
              <span key={s} style={{ display: "inline-flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setSortBy(s)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11,
                    color: sortBy === s ? "#FF6B00" : "rgba(255,255,255,0.5)",
                    textTransform: "capitalize",
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
                {i < arr.length - 1 && (
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                )}
              </span>
            ))}
          </div>
        )}
        {loading ? null : cases.length === 0 ? (
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
            {[...cases]
              .sort((a, b) => {
                if (sortBy === "entities") return b.entityCount - a.entityCount;
                if (sortBy === "status") return a.status.localeCompare(b.status);
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
              })
              .map((c) => {
                const statusColors: Record<string, { bg: string; fg: string }> = {
                  PRIVATE: {
                    bg: "rgba(255,255,255,0.06)",
                    fg: "rgba(255,255,255,0.4)",
                  },
                  SHARED_INTERNAL: {
                    bg: "rgba(255,107,0,0.12)",
                    fg: "#FF6B00",
                  },
                  SUBMITTED: { bg: "rgba(255,184,0,0.12)", fg: "#FFB800" },
                  ARCHIVED: {
                    bg: "rgba(255,255,255,0.03)",
                    fg: "rgba(255,255,255,0.2)",
                  },
                };
                const col = statusColors[c.status] ?? statusColors.PRIVATE;
                const canManage = Boolean(keys);
                const menuOpen = menuOpenForId === c.id;
                return (
                  <div
                    key={c.id}
                    style={{ position: "relative" }}
                  >
                  <Link
                    href={`/investigators/box/cases/${c.id}`}
                    className="block transition-colors hover:border-[rgba(255,107,0,0.2)]"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 6,
                      padding: 20,
                      backgroundColor: "#0a0a0a",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: 16,
                        marginBottom: 10,
                        wordBreak: "break-word",
                        paddingRight: canManage ? 32 : 0,
                      }}
                    >
                      {c.title}
                    </div>
                    <div
                      className="flex items-center justify-between gap-2"
                      style={{ flexWrap: "wrap" }}
                    >
                      <div className="flex flex-wrap gap-1">
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
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "3px 8px",
                          borderRadius: 4,
                          backgroundColor: col.bg,
                          color: col.fg,
                        }}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.3)",
                        marginTop: 12,
                      }}
                    >
                      {c.entityCount} entities · {c.fileCount} files ·{" "}
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </div>
                  </Link>
                  {canManage && (
                    <div
                      data-case-menu
                      style={{ position: "absolute", top: 14, right: 12 }}
                    >
                      <button
                        type="button"
                        aria-label="Case actions"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenForId(menuOpen ? null : c.id);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          border: "1px solid transparent",
                          borderRadius: 4,
                          color: "rgba(255,255,255,0.5)",
                          cursor: "pointer",
                          fontSize: 18,
                          lineHeight: 1,
                          transition:
                            "background 150ms, border-color 150ms, color 150ms",
                        }}
                        className="case-kebab"
                      >
                        &#x22EE;
                      </button>
                      {menuOpen && (
                        <div
                          role="menu"
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 32,
                            minWidth: 150,
                            background: "#0d0d0d",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 6,
                            boxShadow:
                              "0 10px 30px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                            padding: 4,
                            zIndex: 20,
                          }}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openRename(c);
                            }}
                            className="case-menu-item"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openDelete(c);
                            }}
                            className="case-menu-item case-menu-item--danger"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Rename modal — reuses the PATCH endpoint; title is re-encrypted
          client-side with the investigator's metaKey before sending. */}
      {renameTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !renameBusy && setRenameTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#0a0a0a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <div style={LABEL_STYLE}>Rename case</div>
            <input
              autoFocus
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape" && !renameBusy) setRenameTarget(null);
              }}
              placeholder="New case title"
              style={{ ...INPUT_STYLE, marginTop: 8 }}
            />
            <div style={HELPER_STYLE}>
              Title is encrypted client-side before leaving your browser.
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                disabled={renameBusy}
                onClick={() => setRenameTarget(null)}
                style={SECONDARY_BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={renameBusy || !renameInput.trim()}
                onClick={submitRename}
                style={{
                  ...PRIMARY_BTN,
                  opacity: renameBusy || !renameInput.trim() ? 0.6 : 1,
                }}
              >
                {renameBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal — destructive wording, server derives
          ownership from session so a non-owner can never delete a case
          they don't own. */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !deleteBusy && setDeleteTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#0a0a0a",
              border: "1px solid rgba(255,64,64,0.35)",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "#ff4040",
                marginBottom: 8,
              }}
            >
              Delete case
            </div>
            <div
              style={{
                fontSize: 16,
                color: "#FFFFFF",
                fontWeight: 600,
                marginBottom: 6,
                wordBreak: "break-word",
              }}
            >
              {(() => {
                const readable =
                  deleteTarget.title &&
                  !deleteTarget.title.startsWith("[unreadable") &&
                  deleteTarget.title !== ENCRYPTED_PLACEHOLDER;
                if (readable) return deleteTarget.title;
                return (
                  <>
                    Case <span style={{ fontFamily: "ui-monospace, monospace" }}>
                      {deleteTarget.id.slice(0, 8)}
                    </span>{" "}
                    <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>
                      (title unreadable)
                    </span>
                  </>
                );
              })()}
            </div>
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 13,
                lineHeight: 1.5,
                marginTop: 12,
              }}
            >
              This permanently deletes the case and every entity, file, note,
              timeline event, and hypothesis inside it. This cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                style={SECONDARY_BTN}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={submitDelete}
                style={{
                  ...PRIMARY_BTN,
                  backgroundColor: "#ff4040",
                  opacity: deleteBusy ? 0.6 : 1,
                }}
              >
                {deleteBusy ? "Deleting…" : "Delete case"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .case-kebab:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
          color: #FFFFFF;
        }
        .case-menu-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          background: transparent;
          border: 0;
          color: rgba(255,255,255,0.8);
          font-size: 13px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 120ms ease, color 120ms ease;
        }
        .case-menu-item:hover { background: rgba(255,255,255,0.06); color: #FFFFFF; }
        .case-menu-item--danger { color: #ff7070; }
        .case-menu-item--danger:hover { background: rgba(255,64,64,0.1); color: #ff4040; }
      `}</style>
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
