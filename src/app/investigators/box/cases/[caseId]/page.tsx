"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { useParserWorker, type ParsedEntity } from "@/hooks/useParserWorker";
import {
  decryptString,
  decryptTags,
  encryptBuffer,
  decryptBuffer,
  encryptString,
} from "@/lib/vault/crypto.client";

type Tab = "entities" | "files" | "notes" | "timeline" | "export";

type CaseDetail = {
  id: string;
  titleEnc: string;
  titleIv: string;
  tagsEnc: string;
  tagsIv: string;
  status: string;
};

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  confidence: number | null;
  extractionMethod: string | null;
  sourceFileId: string | null;
  createdAt: string;
};

type FileRow = {
  id: string;
  filenameEnc: string;
  filenameIv: string;
  mimeType: string;
  sizeBytes: number;
  parseStatus: string;
  entitiesFound: number;
  uploadedAt: string;
};

type DecryptedFile = FileRow & { filename: string };

type NoteRow = {
  id: string;
  contentEnc: string;
  contentIv: string;
  createdAt: string;
  updatedAt: string;
};

type DecryptedNote = NoteRow & { content: string };

function CaseInner({ caseId }: { caseId: string }) {
  const { keys } = useVaultSession();
  const { parseFile } = useParserWorker();

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("entities");

  const [entities, setEntities] = useState<Entity[]>([]);
  const [files, setFiles] = useState<DecryptedFile[]>([]);
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [timeline, setTimeline] = useState<
    Array<{ id: string; eventType: string; createdAt: string }>
  >([]);
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    if (!keys) return;
    fetch(`/api/investigators/cases/${caseId}`)
      .then((r) => r.json())
      .then(async (d) => {
        if (!d.case) return;
        setDetail(d.case);
        try {
          setTitle(
            await decryptString(d.case.titleEnc, d.case.titleIv, keys.metaKey)
          );
          setTags(
            await decryptTags(d.case.tagsEnc, d.case.tagsIv, keys.metaKey)
          );
        } catch {
          setTitle("[unreadable]");
        }
      });
  }, [caseId, keys]);

  useEffect(() => {
    if (!keys) return;
    if (tab === "entities") {
      fetch(`/api/investigators/cases/${caseId}/entities`)
        .then((r) => r.json())
        .then((d) => setEntities(d.entities ?? []));
    } else if (tab === "files") {
      fetch(`/api/investigators/cases/${caseId}/files`)
        .then((r) => r.json())
        .then(async (d) => {
          const rows: FileRow[] = d.files ?? [];
          const dec: DecryptedFile[] = [];
          for (const f of rows) {
            try {
              const filename = await decryptString(
                f.filenameEnc,
                f.filenameIv,
                keys.metaKey
              );
              dec.push({ ...f, filename });
            } catch {
              dec.push({ ...f, filename: "[unreadable]" });
            }
          }
          setFiles(dec);
        });
    } else if (tab === "notes") {
      fetch(`/api/investigators/cases/${caseId}/notes`)
        .then((r) => r.json())
        .then(async (d) => {
          const rows: NoteRow[] = d.notes ?? [];
          const dec: DecryptedNote[] = [];
          for (const n of rows) {
            try {
              const content = await decryptString(
                n.contentEnc,
                n.contentIv,
                keys.noteKey
              );
              dec.push({ ...n, content });
            } catch {
              dec.push({ ...n, content: "[unreadable]" });
            }
          }
          setNotes(dec);
        });
    } else if (tab === "timeline") {
      fetch(`/api/investigators/cases/${caseId}/timeline`)
        .then((r) => r.json())
        .then((d) => setTimeline(d.events ?? []));
    }
  }, [caseId, keys, tab]);

  async function handleUpload(file: File) {
    if (!keys || uploadBusy) return;
    setUploadBusy(true);
    try {
      // 1. Parse on device
      const parsed = await parseFile(file);

      // 2. Encrypt file buffer
      const plain = await file.arrayBuffer();
      const encryptedBlob = await encryptBuffer(plain, keys.fileKey);

      // 3. Encrypt filename
      const { enc: filenameEnc, iv: filenameIv } = await encryptString(
        file.name,
        keys.metaKey
      );

      // 4. Register draft
      const draftRes = await fetch(
        `/api/investigators/cases/${caseId}/files/draft`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filenameEnc,
            filenameIv,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: encryptedBlob.byteLength,
          }),
        }
      );
      if (!draftRes.ok) throw new Error("draft_failed");
      const { fileId } = await draftRes.json();

      // 5. Presign
      const presignRes = await fetch(
        `/api/investigators/cases/${caseId}/files/${fileId}/presign`
      );
      if (!presignRes.ok) throw new Error("presign_failed");
      const { presignedUrl } = await presignRes.json();

      // 6. PUT to R2
      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
        body: encryptedBlob,
      });
      if (!putRes.ok) throw new Error("r2_put_failed");

      // 7. Push discovered entities (plaintext by design — derived layer)
      if (parsed.entities.length > 0) {
        await fetch(`/api/investigators/cases/${caseId}/entities`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entities: parsed.entities.map((e: ParsedEntity) => ({
              type: e.type,
              value: e.value,
              confidence: e.confidence,
              extractionMethod: e.extractionMethod,
              sourceFileId: fileId,
            })),
          }),
        });
      }

      // 8. Finalize
      await fetch(
        `/api/investigators/cases/${caseId}/files/${fileId}/finalize`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            parseStatus: parsed.parseStatus,
            entitiesFound: parsed.entitiesFound,
            parseMode: parsed.parseMode,
            parseError: parsed.error,
          }),
        }
      );

      // Refresh file list
      setFiles((prev) => [
        {
          id: fileId,
          filenameEnc,
          filenameIv,
          mimeType: file.type,
          sizeBytes: encryptedBlob.byteLength,
          parseStatus: parsed.parseStatus,
          entitiesFound: parsed.entitiesFound,
          uploadedAt: new Date().toISOString(),
          filename: file.name,
        },
        ...prev,
      ]);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function downloadFile(f: DecryptedFile) {
    if (!keys) return;
    const res = await fetch(
      `/api/investigators/cases/${caseId}/files/${f.id}/url`
    );
    if (!res.ok) return;
    const { url } = await res.json();
    const blobRes = await fetch(url);
    const enc = await blobRes.arrayBuffer();
    const plain = await decryptBuffer(enc, keys.fileKey);
    const blob = new Blob([plain], {
      type: f.mimeType || "application/octet-stream",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = f.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function saveNote() {
    if (!keys || !newNote.trim()) return;
    const { enc, iv } = await encryptString(newNote, keys.noteKey);
    const res = await fetch(`/api/investigators/cases/${caseId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentEnc: enc, contentIv: iv }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => [
        {
          id: data.id,
          contentEnc: enc,
          contentIv: iv,
          content: newNote,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
        },
        ...prev,
      ]);
      setNewNote("");
    }
  }

  function exportEntities() {
    const blob = new Blob([JSON.stringify(entities, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "case"}-entities.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportFull() {
    const full = {
      title,
      tags,
      entities,
      notes: notes.map((n) => ({
        content: n.content,
        createdAt: n.createdAt,
      })),
    };
    const blob = new Blob([JSON.stringify(full, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "case"}-full.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="max-w-5xl mx-auto px-6 py-10 text-white/50">
          Loading case…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link
          href="/investigators/box"
          className="text-xs text-white/50 hover:text-white"
        >
          ← Back to cases
        </Link>
        <h1 className="text-3xl font-semibold mt-2">{title}</h1>
        <div className="flex flex-wrap gap-1 mt-2 mb-6">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[10px] uppercase tracking-wide text-white/60 border border-white/20 rounded px-2 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="flex gap-2 border-b border-white/10 mb-6">
          {(["entities", "files", "notes", "timeline", "export"] as Tab[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm capitalize ${
                  tab === t
                    ? "text-[#FF6B00] border-b-2 border-[#FF6B00]"
                    : "text-white/60"
                }`}
              >
                {t}
              </button>
            )
          )}
        </div>

        {tab === "entities" && (
          <div>
            <div className="text-white/60 text-sm mb-4">
              {entities.length} entities — client-side tag filtering only.
            </div>
            {/*
              Tags are encrypted. All tag filtering is client-side after
              decryption. No server-side tag search exists or will be added
              while tags remain encrypted.
            */}
            <div className="space-y-1">
              {entities.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between border border-white/10 rounded px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase text-[#FF6B00] w-16">
                      {e.type}
                    </span>
                    <span className="font-mono text-white/90">{e.value}</span>
                  </div>
                  <span className="text-white/40 text-xs">
                    {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "files" && (
          <div>
            <label className="inline-block bg-[#FF6B00] text-white px-4 py-2 rounded font-medium text-sm cursor-pointer mb-4">
              {uploadBusy ? "Uploading…" : "Upload file"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="space-y-1">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between border border-white/10 rounded px-3 py-2 text-sm"
                >
                  <div>
                    <div className="text-white">{f.filename}</div>
                    <div className="text-white/40 text-xs">
                      {f.mimeType} · {(f.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                      {f.parseStatus} · {f.entitiesFound} entities
                    </div>
                  </div>
                  <button
                    onClick={() => downloadFile(f)}
                    className="text-[#FF6B00] text-xs"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
              placeholder="New note…"
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-3"
            />
            <button
              onClick={saveNote}
              disabled={!newNote.trim()}
              className="bg-[#FF6B00] text-white px-4 py-2 rounded text-sm disabled:opacity-50 mb-6"
            >
              Save note
            </button>
            <div className="space-y-3">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="border border-white/10 rounded p-3 text-sm whitespace-pre-wrap"
                >
                  <div className="text-white/40 text-xs mb-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                  <div className="text-white/90">{n.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "timeline" && (
          <div className="space-y-1">
            {timeline.map((ev) => (
              <div
                key={ev.id}
                className="border border-white/10 rounded px-3 py-2 text-sm flex justify-between"
              >
                <span className="text-white/80">{ev.eventType}</span>
                <span className="text-white/40 text-xs">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "export" && (
          <div className="space-y-3">
            <button
              onClick={exportEntities}
              className="block bg-[#FF6B00] text-white px-4 py-2 rounded text-sm"
            >
              Export entities (JSON)
            </button>
            <button
              onClick={exportFull}
              className="block border border-white/20 text-white px-4 py-2 rounded text-sm"
            >
              Export full case (JSON)
            </button>
            <button
              disabled
              title="PDF export — coming soon"
              className="block border border-white/10 text-white/40 px-4 py-2 rounded text-sm cursor-not-allowed"
            >
              Export PDF — coming soon
            </button>
            <div className="text-white/40 text-xs mt-4">
              Raw files not included. Download and decrypt them individually.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  return (
    <VaultGate>
      <CaseInner caseId={caseId} />
    </VaultGate>
  );
}
