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
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs tracking-[0.3em] text-white/50">
              INTERLIGENS INVESTIGATORS
            </div>
            <h1 className="text-3xl font-semibold mt-1">My Cases</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNew((v) => !v)}
              className="bg-[#FF6B00] text-white px-4 py-2 rounded font-medium text-sm"
            >
              + New case
            </button>
            <button
              onClick={lock}
              className="border border-white/20 px-4 py-2 rounded text-sm text-white/70"
            >
              Lock
            </button>
          </div>
        </div>

        <div className="border border-white/10 rounded p-3 mb-6 text-xs text-white/60">
          Client-side encrypted · Titles, filenames, tags, notes, and files
          never reach our servers in readable form.
        </div>

        {showNew && (
          <div className="border border-white/10 rounded p-4 mb-6">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Case title"
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-3"
            />
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-3"
            />
            <button
              onClick={createCase}
              disabled={creating || !newTitle.trim()}
              className="bg-[#FF6B00] text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {creating ? "Encrypting…" : "Create case"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-white/50 text-sm">Loading cases…</div>
        ) : cases.length === 0 ? (
          <div className="text-white/50 text-sm">
            No cases yet. Click “+ New case” to create your first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/investigators/box/cases/${c.id}`}
                className="block border border-white/10 rounded p-4 hover:border-[#FF6B00]/60 transition-colors"
              >
                <div className="text-white font-semibold">{c.title}</div>
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wide text-white/60 border border-white/20 rounded px-2 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-white/40 mt-3">
                  {c.entityCount} entities · {c.fileCount} files · {c.status}
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
