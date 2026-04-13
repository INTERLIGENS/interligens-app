"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import VaultGate from "@/components/vault/VaultGate";
import EntityLaunchpad from "@/components/vault/EntityLaunchpad";
import EntityAddForm from "@/components/vault/EntityAddForm";
import CaseGraph from "@/components/vault/CaseGraph";
import CaseTwin from "@/components/vault/CaseTwin";
import CaseExport from "@/components/vault/CaseExport";
import TimelineBuilder from "@/components/vault/TimelineBuilder";
import NextBestStepToast, {
  buildNextBestStep,
  type NextBestStep,
} from "@/components/vault/NextBestStepToast";
import { useVaultSession } from "@/hooks/useVaultSession";
import { useParserWorker, type ParsedEntity } from "@/hooks/useParserWorker";
import {
  decryptString,
  decryptTags,
  encryptBuffer,
  decryptBuffer,
  encryptString,
} from "@/lib/vault/crypto.client";

type Tab =
  | "entities"
  | "intelligence"
  | "files"
  | "notes"
  | "graph"
  | "timeline"
  | "export";

type CaseDetail = {
  id: string;
  titleEnc: string;
  titleIv: string;
  tagsEnc: string;
  tagsIv: string;
  status: string;
  caseTemplate: string | null;
  updatedAt: string;
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

type EntityEnrichment = {
  inWatchlist: boolean;
  isKnownBad: boolean;
  knownBadScore: number | null;
  inKolRegistry: boolean;
  kolName: string | null;
  kolScore: number | null;
  inIntelVault: boolean;
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

const TEMPLATE_LABELS: Record<string, string> = {
  "rug-pull": "Rug Pull",
  "kol-promo": "KOL Promo Scheme",
  "cex-cashout": "CEX Cashout Trail",
  infostealer: "Infostealer Compromise",
};

const TEMPLATE_HINTS: Record<string, string> = {
  "rug-pull":
    "Look for: deployer wallet, LP removal TX, promo wallets, CEX cashout addresses, token contract, social proof screenshots.",
  "kol-promo":
    "Look for: KOL handles, payment wallets, token contract, promotion dates, promised vs actual ROI, disclosure (or lack thereof).",
  "cex-cashout":
    "Look for: source wallets, relay wallets, CEX deposit addresses, withdrawal amounts, timing patterns.",
  infostealer:
    "Look for: victim wallet, compromise date, attack vector, malware family if known, destination wallets.",
};

const BADGE_BASE: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 600,
};

function CaseInner({ caseId }: { caseId: string }) {
  const { keys } = useVaultSession();
  const { parseFile } = useParserWorker();

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("entities");
  const [structurePanelDismissed, setStructurePanelDismissed] = useState(false);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [enrichment, setEnrichment] = useState<Record<string, EntityEnrichment>>(
    {}
  );
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [launchpadEntityId, setLaunchpadEntityId] = useState<string | null>(null);
  const [files, setFiles] = useState<DecryptedFile[]>([]);
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [toastStep, setToastStep] = useState<NextBestStep | null>(null);

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
    if (tab === "entities" || tab === "intelligence" || tab === "graph") {
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
    }
  }, [caseId, keys, tab]);

  // Lazy load enrichment when entities tab opens and we have entities.
  useEffect(() => {
    if (tab !== "entities" && tab !== "intelligence") return;
    if (entities.length === 0) return;
    if (enrichLoading) return;
    if (Object.keys(enrichment).length > 0) return;
    setEnrichLoading(true);
    fetch(`/api/investigators/cases/${caseId}/entities/enrich`)
      .then((r) => r.json())
      .then((d) => setEnrichment(d.enrichment ?? {}))
      .catch(() => setEnrichment({}))
      .finally(() => setEnrichLoading(false));
  }, [tab, entities, caseId, enrichment, enrichLoading]);

  async function handleUpload(file: File) {
    if (!keys || uploadBusy) return;
    setUploadBusy(true);
    try {
      const parsed = await parseFile(file);
      const plain = await file.arrayBuffer();
      const encryptedBlob = await encryptBuffer(plain, keys.fileKey);
      const { enc: filenameEnc, iv: filenameIv } = await encryptString(
        file.name,
        keys.metaKey
      );
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
      const presignRes = await fetch(
        `/api/investigators/cases/${caseId}/files/${fileId}/presign`
      );
      if (!presignRes.ok) throw new Error("presign_failed");
      const { presignedUrl } = await presignRes.json();
      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
        body: encryptedBlob,
      });
      if (!putRes.ok) throw new Error("r2_put_failed");
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
        // Suggest based on first parsed entity
        const first = parsed.entities[0];
        if (first) {
          const step = buildNextBestStep(first.type, first.value);
          if (step) setToastStep(step);
        }
      }
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

  if (!detail) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="max-w-5xl mx-auto px-6 py-10 text-white/50">
          Loading case…
        </div>
      </main>
    );
  }

  const templateHint =
    detail.caseTemplate && TEMPLATE_HINTS[detail.caseTemplate];
  const templateLabel =
    detail.caseTemplate && TEMPLATE_LABELS[detail.caseTemplate];

  const tabs: Tab[] = [
    "entities",
    "intelligence",
    "files",
    "notes",
    "graph",
    "timeline",
    "export",
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link
          href="/investigators/box"
          className="text-xs text-white/50 hover:text-white"
        >
          ← Back to cases
        </Link>
        <div className="flex items-start justify-between mt-2">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <Link
            href={`/investigators/box/redact?caseId=${caseId}`}
            className="hover:text-white"
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "8px 16px",
              textDecoration: "none",
            }}
          >
            Redact screenshot
          </Link>
        </div>
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

        {templateHint && !structurePanelDismissed && (
          <div
            style={{
              backgroundColor: "#0a0a0a",
              border: "1px solid rgba(255,107,0,0.12)",
              borderRadius: 6,
              padding: 16,
              marginBottom: 24,
              position: "relative",
            }}
          >
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "#FF6B00",
                marginBottom: 6,
              }}
            >
              Case structure · {templateLabel}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
              }}
            >
              {templateHint}
            </div>
            <button
              onClick={() => setStructurePanelDismissed(true)}
              aria-label="Dismiss"
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.3)",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        )}

        <div className="flex gap-2 border-b border-white/10 mb-6">
          {tabs.map((t) => (
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
          ))}
        </div>

        {tab === "entities" && (
          <div>
            <EntityAddForm
              caseId={caseId}
              onAdded={(added) => {
                fetch(`/api/investigators/cases/${caseId}/entities`)
                  .then((r) => r.json())
                  .then((d) => setEntities(d.entities ?? []));
                setEnrichment({});
                if (added) {
                  const step = buildNextBestStep(added.type, added.value);
                  if (step) setToastStep(step);
                }
              }}
            />
            <div className="text-white/60 text-sm mb-4">
              {entities.length} entities
              {enrichLoading ? " · loading enrichment…" : ""}
            </div>
            <div className="space-y-1">
              {entities.map((e) => {
                const enr = enrichment[e.id];
                return (
                  <div key={e.id} style={{ position: "relative" }}>
                    <div
                      className="flex items-center justify-between border border-white/10 rounded px-3 py-2 text-sm"
                      style={{ gap: 8 }}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] uppercase text-[#FF6B00] w-16">
                          {e.type}
                        </span>
                        <span className="font-mono text-white/90 break-all">
                          {e.value}
                        </span>
                        {enr?.isKnownBad && (
                          <span
                            style={{
                              ...BADGE_BASE,
                              color: "#FF3B5C",
                              border: "1px solid rgba(255,59,92,0.4)",
                              backgroundColor: "rgba(255,59,92,0.08)",
                            }}
                          >
                            Known Bad
                            {enr.knownBadScore != null
                              ? ` ${enr.knownBadScore}`
                              : ""}
                          </span>
                        )}
                        {enr?.inWatchlist && (
                          <span
                            style={{
                              ...BADGE_BASE,
                              color: "#FFB020",
                              border: "1px solid rgba(255,176,32,0.4)",
                              backgroundColor: "rgba(255,176,32,0.08)",
                            }}
                          >
                            Watchlist
                          </span>
                        )}
                        {enr?.inKolRegistry && (
                          <span
                            style={{
                              ...BADGE_BASE,
                              color: "#FF6B00",
                              border: "1px solid rgba(255,107,0,0.5)",
                              backgroundColor: "rgba(255,107,0,0.08)",
                            }}
                          >
                            KOL Registry
                            {enr.kolName ? ` · ${enr.kolName}` : ""}
                          </span>
                        )}
                        {enr?.inIntelVault && (
                          <span
                            style={{
                              ...BADGE_BASE,
                              color: "rgba(255,255,255,0.8)",
                              border: "1px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            Intel Vault
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white/40 text-xs">
                          {e.confidence != null
                            ? `${Math.round(e.confidence * 100)}%`
                            : ""}
                        </span>
                        <button
                          aria-label="Open in"
                          onClick={() =>
                            setLaunchpadEntityId(
                              launchpadEntityId === e.id ? null : e.id
                            )
                          }
                          style={{
                            fontSize: 12,
                            color: "#FF6B00",
                            background: "none",
                            border: "1px solid rgba(255,107,0,0.3)",
                            borderRadius: 4,
                            padding: "2px 8px",
                            cursor: "pointer",
                          }}
                        >
                          Open in →
                        </button>
                      </div>
                    </div>
                    {launchpadEntityId === e.id && (
                      <EntityLaunchpad
                        entity={{ type: e.type, value: e.value }}
                        onClose={() => setLaunchpadEntityId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "intelligence" && (
          <CaseTwin
            caseId={caseId}
            entities={entities}
            notes={notes.map((n) => ({ id: n.id, content: n.content }))}
            caseTemplate={detail.caseTemplate}
            updatedAt={detail.updatedAt}
            enrichment={enrichment}
          />
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

        {tab === "graph" && <CaseGraph entities={entities} />}

        {tab === "timeline" && (
          <TimelineBuilder caseId={caseId} entities={entities} />
        )}

        {tab === "export" && (
          <CaseExport
            caseId={caseId}
            title={title}
            tags={tags}
            entities={entities}
            notes={notes.map((n) => ({
              id: n.id,
              content: n.content,
              createdAt: n.createdAt,
            }))}
          />
        )}
      </div>
      <NextBestStepToast
        step={toastStep}
        onDismiss={() => setToastStep(null)}
      />
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
