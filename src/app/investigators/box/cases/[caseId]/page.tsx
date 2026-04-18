"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import VaultGate from "@/components/vault/VaultGate";
import EntityLaunchpad from "@/components/vault/EntityLaunchpad";
import EntityAddForm from "@/components/vault/EntityAddForm";
import EntitySuggestionPanel, {
  type Suggestion,
} from "@/components/vault/EntitySuggestionPanel";
import CaseGraph from "@/components/vault/CaseGraph";
import CaseTwin from "@/components/vault/CaseTwin";
import CaseExport from "@/components/vault/CaseExport";
import CaseAssistant from "@/components/vault/CaseAssistant";
import ErrorBoundary from "@/components/vault/ErrorBoundary";
import IntelligenceReactionPanel, {
  type ReactionData,
  type ReactionSuggestion,
} from "@/components/vault/IntelligenceReactionPanel";
import NotesToolbar from "@/components/vault/NotesToolbar";
import { renderMarkdown } from "@/lib/vault/renderMarkdown";
import { useVaultToast } from "@/components/vault/VaultToast";
import TimelineBuilder from "@/components/vault/TimelineBuilder";
import WalletJourney from "@/components/vault/WalletJourney";
import ShareCaseModal from "@/components/vault/ShareCaseModal";
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
import { UNREADABLE_LABEL, UNREADABLE_LABEL_SHORT } from "@/lib/vault/display";

// Internal tab identifier (unchanged — many existing blocks already key on
// these values). New top-level navigation adds "overview" and groups the
// others under Leads / Evidence / Analysis / Assistant / Output.
type Tab =
  | "overview"
  | "entities"
  | "intelligence"
  | "files"
  | "notes"
  | "graph"
  | "timeline"
  | "export"
  | "assistant";

type TopTab = "overview" | "leads" | "evidence" | "analysis" | "assistant" | "output";

const TOP_TABS: { id: TopTab; label: string; defaultInner: Tab }[] = [
  { id: "overview",  label: "Overview",  defaultInner: "overview"  },
  { id: "leads",     label: "Leads",     defaultInner: "entities"  },
  { id: "evidence",  label: "Evidence",  defaultInner: "files"     },
  { id: "analysis",  label: "Analysis",  defaultInner: "graph"     },
  { id: "assistant", label: "Assistant", defaultInner: "assistant" },
  { id: "output",    label: "Output",    defaultInner: "export"    },
];

const EVIDENCE_SUB: { id: Tab; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "notes", label: "Notes" },
];

const ANALYSIS_SUB: { id: Tab; label: string }[] = [
  { id: "graph",    label: "Graph"    },
  { id: "timeline", label: "Timeline" },
];

function innerTabToTopTab(t: Tab): TopTab {
  if (t === "overview" || t === "intelligence") return "overview";
  if (t === "entities") return "leads";
  if (t === "files" || t === "notes") return "evidence";
  if (t === "graph" || t === "timeline") return "analysis";
  if (t === "assistant") return "assistant";
  return "output"; // export
}

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
  proceedsTotalUSD: number | null;
};

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

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

type IntelEvent = {
  id: string;
  entityId: string | null;
  eventType: string;
  sourceModule: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  summary: string;
  confidence: number | null;
  createdAt: string;
};

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
  const toast = useVaultToast();
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [structurePanelDismissed, setStructurePanelDismissed] = useState(false);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [intelEvents, setIntelEvents] = useState<IntelEvent[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState(false);
  const [intelStatus, setIntelStatus] = useState<string>("IDLE");
  const [intelLastRun, setIntelLastRun] = useState<string | null>(null);
  const [reaction, setReaction] = useState<ReactionData | null>(null);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [enrichment, setEnrichment] = useState<Record<string, EntityEnrichment>>(
    {}
  );
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [launchpadEntityId, setLaunchpadEntityId] = useState<string | null>(null);
  const [files, setFiles] = useState<DecryptedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [toastStep, setToastStep] = useState<NextBestStep | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [hypothesesForExport, setHypothesesForExport] = useState<
    { status: string }[]
  >([]);
  const [hasBlockingConflicts, setHasBlockingConflicts] = useState(false);
  const [walletJourneyId, setWalletJourneyId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("ALL");
  const [filterHasIntel, setFilterHasIntel] = useState(false);
  const [filterHasScore, setFilterHasScore] = useState(false);
  const [noteRecording, setNoteRecording] = useState(false);
  const [noteSpeechSupported, setNoteSpeechSupported] = useState(false);
  const noteRecogRef = useRef<{ stop(): void } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    if (w.SpeechRecognition || w.webkitSpeechRecognition) {
      setNoteSpeechSupported(true);
    }
  }, []);

  function startNoteDictation() {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const Cls = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Cls) return;
    type SR = {
      start(): void;
      stop(): void;
      onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      continuous: boolean;
      interimResults: boolean;
      lang: string;
    };
    const r = new (Cls as new () => SR)();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript + " ";
      }
      setNewNote((prev) => (prev ? prev + " " : "") + transcript.trim());
    };
    r.onend = () => setNoteRecording(false);
    r.onerror = () => setNoteRecording(false);
    r.start();
    noteRecogRef.current = r;
    setNoteRecording(true);
  }

  function stopNoteDictation() {
    noteRecogRef.current?.stop();
    setNoteRecording(false);
  }

  function refreshEntities() {
    fetch(`/api/investigators/cases/${caseId}/entities`)
      .then((r) => r.json())
      .then((d) => setEntities(d.entities ?? []));
    setEnrichment({});
  }

  async function fetchIntelligence() {
    setIntelLoading(true);
    setIntelError(false);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/intelligence`
      );
      if (!res.ok) {
        setIntelError(true);
        return;
      }
      const data = await res.json();
      setIntelEvents(data.events ?? []);
      setIntelStatus(data.summary?.orchestrationStatus ?? "IDLE");
      setIntelLastRun(data.summary?.lastOrchestratedAt ?? null);
    } catch {
      setIntelError(true);
    } finally {
      setIntelLoading(false);
    }
  }

  async function triggerOrchestrator(
    triggerType: "LEAD_ADDED" | "CASE_OPENED" | "MANUAL_ENGINE_RUN",
    entityId?: string,
    opts?: { showReaction?: boolean }
  ): Promise<void> {
    const showReaction = opts?.showReaction ?? triggerType === "LEAD_ADDED";
    if (showReaction) {
      setReactionLoading(true);
      setReaction(null);
    }
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/orchestrate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ triggerType, entityId }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (showReaction && data?.uiReaction) {
          setReaction(data.uiReaction as ReactionData);
        }
        if (!data?.success && data?.error) {
          console.warn("[orchestrator] error:", data.error, "failed:", data.failedModules);
        }
      } else {
        console.warn("[orchestrator] HTTP", res.status);
      }
    } catch (err) {
      console.warn("[orchestrator] network error", err);
    } finally {
      if (showReaction) setReactionLoading(false);
    }
    fetchIntelligence();
  }

  async function addSuggestionEntity(s: ReactionSuggestion): Promise<void> {
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/entities`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: s.type,
            value: s.value,
            label: s.label ?? null,
          }),
        }
      );
      if (res.ok) {
        toast.showSuccess(`Added ${s.type.toLowerCase()}`);
        refreshEntities();
      } else {
        toast.showError("Couldn't add suggestion — try manually.");
      }
    } catch {
      toast.showError("Network error — try manually.");
    }
  }

  async function deleteEntity(entityId: string) {
    if (!confirm("Delete this entity? This cannot be undone.")) return;
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/entities/${entityId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        refreshEntities();
        toast.showSuccess("Entity deleted");
      } else {
        toast.showError("Delete failed. Try again.");
      }
    } catch {
      toast.showError("Connection error. Try again.");
    }
  }

  async function fetchSuggestions(type: string, value: string) {
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/entities/suggest`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, value }),
        }
      );
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.suggestions) && d.suggestions.length > 0) {
          setSuggestions(d.suggestions);
        }
      }
    } catch {}
  }

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
          setTitle(UNREADABLE_LABEL);
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
      setFilesLoading(true);
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
              dec.push({ ...f, filename: UNREADABLE_LABEL_SHORT });
            }
          }
          setFiles(dec);
        })
        .finally(() => setFilesLoading(false));
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
              dec.push({ ...n, content: UNREADABLE_LABEL });
            }
          }
          setNotes(dec);
        });
    }
  }, [caseId, keys, tab]);

  // Load hypothesis + contradiction summary (for publication checklist).
  useEffect(() => {
    if (!keys) return;
    // Load current intelligence and fire a light CASE_OPENED refresh.
    // Both calls are non-blocking; the feed just re-renders when they land.
    fetchIntelligence();
    fetch(`/api/investigators/cases/${caseId}/orchestrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ triggerType: "CASE_OPENED" }),
    })
      .then(() => fetchIntelligence())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, keys]);

  useEffect(() => {
    if (!keys) return;
    fetch(`/api/investigators/cases/${caseId}/hypotheses`)
      .then((r) => r.json())
      .then((d) => setHypothesesForExport(d.hypotheses ?? []))
      .catch(() => {});
    fetch(`/api/investigators/cases/${caseId}/intelligence-summary`)
      .then((r) => r.json())
      .then((d) => {
        const contradictions = Array.isArray(d.contradictions)
          ? d.contradictions
          : [];
        setHasBlockingConflicts(
          contradictions.some(
            (c: { severity?: string }) => c.severity === "BLOCKING"
          )
        );
      })
      .catch(() => {});
  }, [caseId, keys, tab]);

  // Pre-load enrichment as soon as entities are available, regardless of
  // which tab is active. The graph tab needs enrichment to render cross-intel
  // edges — if the fetch fires only on tab change, the D3 simulation
  // initializes with empty enrichment and edges never appear.
  useEffect(() => {
    if (entities.length === 0) return;
    if (enrichLoading) return;
    if (Object.keys(enrichment).length > 0) return;
    setEnrichLoading(true);
    fetch(`/api/investigators/cases/${caseId}/entities/enrich`)
      .then((r) => r.json())
      .then((d) => setEnrichment(d.enrichment ?? {}))
      .catch(() => setEnrichment({}))
      .finally(() => setEnrichLoading(false));
  }, [entities, caseId, enrichment, enrichLoading]);

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
    "assistant",
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareOpen(true)}
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                padding: "8px 16px",
                background: "none",
                cursor: "pointer",
              }}
              className="hover:text-white"
            >
              Share
            </button>
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
                color: "rgba(255,255,255,0.5)",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        )}

        <style>{`
          @keyframes vaultTabFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes vaultDetailSlide {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .vault-tab-row { scrollbar-width: none; -ms-overflow-style: none; }
          .vault-tab-row::-webkit-scrollbar { display: none; }
          .entity-scan-link:hover { color: #FF6B00 !important; }
        `}</style>
        <div
          className="flex gap-2 mb-6 vault-tab-row"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            backgroundColor: "rgba(0,0,0,0.95)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginLeft: -24,
            marginRight: -24,
            paddingLeft: 24,
            paddingRight: 24,
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          {TOP_TABS.map((tt) => {
            const activeTop = innerTabToTopTab(tab);
            const active = activeTop === tt.id;
            const count =
              tt.id === "leads"
                ? entities.length
                : tt.id === "evidence"
                  ? files.length + notes.length
                  : null;
            return (
              <button
                key={tt.id}
                onClick={() => setTab(tt.defaultInner)}
                aria-pressed={active}
                className={`px-3 py-2 text-sm ${
                  active
                    ? "text-[#FF6B00] border-b-2 border-[#FF6B00]"
                    : "text-white/60"
                }`}
              >
                {tt.label}
                {count != null && count > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 11,
                      color: active
                        ? "rgba(255,107,0,0.6)"
                        : "rgba(255,255,255,0.5)",
                    }}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-navigation for Evidence and Analysis */}
        {(innerTabToTopTab(tab) === "evidence" ||
          innerTabToTopTab(tab) === "analysis") && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 0 16px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              marginBottom: 16,
            }}
          >
            {(innerTabToTopTab(tab) === "evidence"
              ? EVIDENCE_SUB
              : ANALYSIS_SUB
            ).map((sub) => {
              const active = tab === sub.id;
              const badge =
                sub.id === "files"
                  ? files.length
                  : sub.id === "notes"
                    ? notes.length
                    : null;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setTab(sub.id)}
                  aria-pressed={active}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 16,
                    border: active
                      ? "1px solid #FF6B00"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: active
                      ? "rgba(255,107,0,0.12)"
                      : "transparent",
                    color: active ? "#FF6B00" : "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                  }}
                >
                  {sub.label}
                  {badge != null && badge > 0 && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>
                      ({badge})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div
          key={tab}
          style={{ animation: "vaultTabFadeIn 120ms ease" }}
        >
        {tab === "overview" && (
          <div style={{ display: "grid", gap: 24 }}>
            {/* Case meta strip */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 24,
                padding: "20px 0",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <OverviewStat label="Leads" value={entities.length} />
              <OverviewStat label="Files" value={files.length} />
              <OverviewStat label="Notes" value={notes.length} />
              <OverviewStat
                label="Status"
                value={detail?.status?.replace("_", " ") ?? "—"}
                textual
              />
            </div>

            {/* What we know / recent activity */}
            <section>
              <h2 style={OVERVIEW_H2}>Recent activity</h2>
              {entities.length === 0 && files.length === 0 && notes.length === 0 ? (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                  No activity yet. Start by adding your first lead.
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {entities
                    .slice(-3)
                    .reverse()
                    .map((e) => (
                      <li
                        key={`ent-${e.id}`}
                        style={OVERVIEW_ROW}
                      >
                        <span style={OVERVIEW_KIND}>LEAD</span>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                          {e.value.length > 36 ? e.value.slice(0, 36) + "…" : e.value}
                        </span>
                        <span style={OVERVIEW_WHEN}>
                          {new Date(e.createdAt).toLocaleDateString("en-US")}
                        </span>
                      </li>
                    ))}
                  {notes
                    .slice(-2)
                    .reverse()
                    .map((n) => (
                      <li key={`note-${n.id}`} style={OVERVIEW_ROW}>
                        <span style={OVERVIEW_KIND}>NOTE</span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                          {n.content.length > 60 ? n.content.slice(0, 60) + "…" : n.content}
                        </span>
                        <span style={OVERVIEW_WHEN}>
                          {new Date(n.createdAt).toLocaleDateString("en-US")}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            {/* Orchestrator-driven intelligence feed */}
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <h2 style={OVERVIEW_H2}>Intelligence feed</h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  {intelStatus === "RUNNING" && <span>Running…</span>}
                  {intelStatus === "PARTIAL" && (
                    <span style={{ color: "#FFB800" }}>Partial</span>
                  )}
                  <button
                    type="button"
                    onClick={() => triggerOrchestrator("MANUAL_ENGINE_RUN")}
                    disabled={intelLoading}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 4,
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 11,
                      padding: "3px 10px",
                      cursor: intelLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    Run checks
                  </button>
                </div>
              </div>
              {intelError && (
                <div
                  role="alert"
                  style={{
                    border: "1px solid rgba(255,59,92,0.35)",
                    background: "rgba(255,59,92,0.08)",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#FF9AAB",
                    marginBottom: 12,
                  }}
                >
                  Couldn&apos;t load intelligence. Retry with the button
                  above.
                </div>
              )}
              {intelEvents.length === 0 && !intelLoading && !intelError ? (
                <div
                  style={{
                    border: "1px dashed rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: 20,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: 1.6,
                  }}
                >
                  {intelLastRun ? (
                    <>
                      <strong style={{ color: "rgba(255,255,255,0.75)" }}>
                        No intelligence matches yet.
                      </strong>{" "}
                      Last check {relativeTime(intelLastRun)} — KOL Registry,
                      Intel Vault and Observed Proceeds found no references.
                      Either the leads in this case aren&apos;t in our
                      datasets, or the addresses need broader curation.
                    </>
                  ) : entities.length === 0 ? (
                    <>
                      No leads yet. Add a wallet or handle to kick off
                      automatic cross-referencing against KOL Registry, Intel
                      Vault and Observed Proceeds.
                    </>
                  ) : (
                    <>
                      Intelligence hasn&apos;t run yet for this case. Hit{" "}
                      <em>Run checks</em> above to fire the orchestrator.
                    </>
                  )}
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {intelEvents.slice(0, 5).map((e) => (
                    <li
                      key={e.id}
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        padding: "12px 14px",
                        background: "#0a0a0a",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color:
                              e.severity === "HIGH" || e.severity === "CRITICAL"
                                ? "#FF3B5C"
                                : e.severity === "MEDIUM"
                                  ? "#FFB800"
                                  : "rgba(255,255,255,0.5)",
                          }}
                        >
                          {e.severity}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "#FF6B00",
                          }}
                        >
                          {e.sourceModule.replace("_", " ")}
                        </span>
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 11,
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          {new Date(e.createdAt).toLocaleDateString("en-US")}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#FFFFFF",
                          marginBottom: 4,
                        }}
                      >
                        {e.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.6)",
                          lineHeight: 1.5,
                        }}
                      >
                        {e.summary}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Quick jumps */}
            <section
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setTab("entities")}
                style={OVERVIEW_CTA_PRIMARY}
              >
                Add a lead →
              </button>
              <button
                type="button"
                onClick={() => setTab("files")}
                style={OVERVIEW_CTA}
              >
                Deposit evidence
              </button>
              <button
                type="button"
                onClick={() => setTab("graph")}
                style={OVERVIEW_CTA}
              >
                Open graph
              </button>
              <button
                type="button"
                onClick={() => setTab("assistant")}
                style={OVERVIEW_CTA}
              >
                Ask assistant
              </button>
            </section>
          </div>
        )}

        {tab === "entities" && (
          <div>
            <IntelligenceReactionPanel
              reaction={reaction}
              loading={reactionLoading}
              onDismiss={() => setReaction(null)}
              onRunAgain={() =>
                triggerOrchestrator("MANUAL_ENGINE_RUN", undefined, {
                  showReaction: true,
                })
              }
              onAddSuggestion={addSuggestionEntity}
              onOpenOverview={() => setTab("overview")}
            />
            <EntityAddForm
              caseId={caseId}
              onAdded={(added) => {
                refreshEntities();
                if (added) {
                  const step = buildNextBestStep(added.type, added.value);
                  if (step) setToastStep(step);
                  fetchSuggestions(added.type, added.value);
                  // Fire the orchestrator — non-blocking. The feed on the
                  // Overview tab updates on its own a moment later. We
                  // don't have the new entity id on this callback, but the
                  // orchestrator falls back to the case's most recent lead.
                  triggerOrchestrator("LEAD_ADDED");
                }
              }}
            />
            {/* FILTER BAR */}
            <div
              className="flex flex-wrap gap-2 mb-3"
              style={{ alignItems: "center" }}
            >
              {["ALL", "WALLET", "TX_HASH", "HANDLE", "URL", "DOMAIN", "OTHER"].map(
                (t) => {
                  const active = entityTypeFilter === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Filter entities by ${t}`}
                      onClick={() => setEntityTypeFilter(t)}
                      style={{
                        fontSize: 11,
                        padding: "4px 10px",
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
                      }}
                    >
                      {t}
                    </button>
                  );
                }
              )}
              <span
                style={{
                  color: "rgba(255,255,255,0.2)",
                  fontSize: 10,
                  margin: "0 4px",
                }}
              >
                |
              </span>
              <button
                type="button"
                onClick={() => setFilterHasIntel((v) => !v)}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: filterHasIntel
                    ? "1px solid #FF6B00"
                    : "1px solid rgba(255,255,255,0.12)",
                  backgroundColor: filterHasIntel
                    ? "rgba(255,107,0,0.15)"
                    : "transparent",
                  color: filterHasIntel ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                }}
              >
                Has intelligence
              </button>
              <button
                type="button"
                onClick={() => setFilterHasScore((v) => !v)}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: filterHasScore
                    ? "1px solid #FF6B00"
                    : "1px solid rgba(255,255,255,0.12)",
                  backgroundColor: filterHasScore
                    ? "rgba(255,107,0,0.15)"
                    : "transparent",
                  color: filterHasScore ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                }}
              >
                Has score
              </button>
            </div>
            {(() => {
              const filtered = entities.filter((e) => {
                if (entityTypeFilter !== "ALL" && e.type !== entityTypeFilter)
                  return false;
                if (filterHasIntel) {
                  const en = enrichment[e.id];
                  if (
                    !en ||
                    !(
                      en.inKolRegistry ||
                      en.isKnownBad ||
                      en.inWatchlist ||
                      en.inIntelVault
                    )
                  )
                    return false;
                }
                if (filterHasScore) {
                  if (e.confidence == null) return false;
                }
                return true;
              });
              const isFiltered =
                entityTypeFilter !== "ALL" || filterHasIntel || filterHasScore;
              return (
                <>
                  <div className="text-white/60 text-sm mb-4">
                    {entities.length} entities
                    {isFiltered && ` (showing ${filtered.length})`}
                    {enrichLoading ? " · loading enrichment…" : ""}
                  </div>
                  {entities.length === 0 && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.4)",
                        padding: "40px 0",
                        textAlign: "center",
                        lineHeight: 1.7,
                      }}
                    >
                      <div>No entities yet.</div>
                      <div style={{ marginTop: 8 }}>
                        Add a wallet, handle, or transaction above — or upload a
                        file in the Files tab to extract them automatically.
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    {filtered.map((e) => {
                      const enr = enrichment[e.id];
                return (
                  <div key={e.id} style={{ position: "relative" }}>
                    <div
                      className="flex items-center justify-between border border-white/10 rounded px-3 py-2 text-sm hover:bg-white/[0.02]"
                      style={{ gap: 8, transition: "background-color 100ms" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "nowrap",
                          overflow: "hidden",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span className="text-[10px] uppercase text-[#FF6B00] w-16" style={{ flexShrink: 0 }}>
                          {e.type}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDetailEntityId(
                              detailEntityId === e.id ? null : e.id
                            )
                          }
                          className="font-mono text-white/90 hover:text-[#FF6B00]"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: "inherit",
                            fontFamily: "ui-monospace, monospace",
                            transition: "color 100ms",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                            flexShrink: 1,
                          }}
                        >
                          {e.value}
                        </button>
                        {(() => {
                          type Badge = {
                            key: string;
                            label: string;
                            style: React.CSSProperties;
                          };
                          const badges: Badge[] = [];
                          if (enr?.isKnownBad) {
                            badges.push({
                              key: "bad",
                              label:
                                "Known Bad" +
                                (enr.knownBadScore != null ? ` ${enr.knownBadScore}` : ""),
                              style: {
                                ...BADGE_BASE,
                                color: "#FF3B5C",
                                border: "1px solid rgba(255,59,92,0.4)",
                                backgroundColor: "rgba(255,59,92,0.08)",
                              },
                            });
                          }
                          if (enr?.inWatchlist) {
                            badges.push({
                              key: "watch",
                              label: "Watchlist",
                              style: {
                                ...BADGE_BASE,
                                color: "#FFB020",
                                border: "1px solid rgba(255,176,32,0.4)",
                                backgroundColor: "rgba(255,176,32,0.08)",
                              },
                            });
                          }
                          if (enr?.inKolRegistry) {
                            badges.push({
                              key: "kol",
                              label:
                                "KOL Registry" +
                                (enr.kolName ? ` · ${enr.kolName}` : ""),
                              style: {
                                ...BADGE_BASE,
                                color: "#FF6B00",
                                border: "1px solid rgba(255,107,0,0.5)",
                                backgroundColor: "rgba(255,107,0,0.08)",
                              },
                            });
                          }
                          if (enr?.inIntelVault) {
                            badges.push({
                              key: "vault",
                              label: "Intel Vault",
                              style: {
                                ...BADGE_BASE,
                                color: "rgba(255,255,255,0.8)",
                                border: "1px solid rgba(255,255,255,0.5)",
                              },
                            });
                          }
                          const visible = badges.slice(0, 2);
                          const hidden = badges.slice(2);
                          return (
                            <>
                              {visible.map((b) => (
                                <span
                                  key={b.key}
                                  style={{ ...b.style, flexShrink: 0, whiteSpace: "nowrap" }}
                                >
                                  {b.label}
                                </span>
                              ))}
                              {hidden.length > 0 && (
                                <span
                                  title={hidden.map((b) => b.label).join(" · ")}
                                  style={{
                                    backgroundColor: "rgba(255,255,255,0.06)",
                                    color: "rgba(255,255,255,0.4)",
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    flexShrink: 0,
                                    whiteSpace: "nowrap",
                                    cursor: "help",
                                  }}
                                >
                                  +{hidden.length} more
                                </span>
                              )}
                              {enr?.proceedsTotalUSD != null &&
                                enr.proceedsTotalUSD > 0 && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "rgba(255,107,0,0.8)",
                                      fontWeight: 600,
                                      flexShrink: 0,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    · {formatUSD(enr.proceedsTotalUSD)} observed
                                  </span>
                                )}
                              {(e.type === "WALLET" || e.type === "CONTRACT") && (
                                <a
                                  href={`/en/demo?addr=${encodeURIComponent(e.value)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="entity-scan-link"
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,107,0,0.6)",
                                    textDecoration: "none",
                                    flexShrink: 0,
                                    whiteSpace: "nowrap",
                                    transition: "color 150ms",
                                  }}
                                >
                                  Scan
                                </a>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white/40 text-xs">
                          {e.confidence != null
                            ? `${Math.round(e.confidence * 100)}%`
                            : ""}
                        </span>
                        {e.type === "WALLET" && (
                          <button
                            aria-label="Wallet journey"
                            onClick={() => setWalletJourneyId(e.id)}
                            style={{
                              fontSize: 12,
                              color: "rgba(255,255,255,0.6)",
                              background: "none",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 4,
                              padding: "2px 8px",
                              cursor: "pointer",
                            }}
                          >
                            Journey
                          </button>
                        )}
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
                        <button
                          aria-label="Delete entity"
                          onClick={() => deleteEntity(e.id)}
                          className="hover:text-[#FF3B5C]"
                          style={{
                            fontSize: 14,
                            color: "rgba(255,255,255,0.2)",
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {launchpadEntityId === e.id && (
                      <EntityLaunchpad
                        entity={{ type: e.type, value: e.value }}
                        onClose={() => setLaunchpadEntityId(null)}
                      />
                    )}
                    {detailEntityId === e.id && (
                      <div
                        style={{
                          backgroundColor: "#0a0a0a",
                          borderTop: "1px solid rgba(255,107,0,0.15)",
                          borderBottom: "1px solid rgba(255,107,0,0.15)",
                          padding: 16,
                          marginTop: 4,
                          marginBottom: 4,
                          animation: "vaultDetailSlide 150ms ease",
                        }}
                      >
                        <div
                          style={{
                            textTransform: "uppercase",
                            fontSize: 10,
                            letterSpacing: "0.08em",
                            color: "#FF6B00",
                            marginBottom: 10,
                          }}
                        >
                          Entity intelligence
                        </div>
                        <div
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 12,
                            color: "#FFFFFF",
                            wordBreak: "break-all",
                            marginBottom: 10,
                          }}
                        >
                          {e.value}
                        </div>
                        <div
                          className="flex flex-col gap-1"
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.6)",
                            marginBottom: 12,
                          }}
                        >
                          <div>Type: {e.type}</div>
                          <div>
                            Added:{" "}
                            {new Date(e.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div>
                            Source: {e.extractionMethod ?? "Manual entry"}
                          </div>
                          {e.confidence != null && (
                            <div>
                              Confidence: {Math.round(e.confidence * 100)}%
                            </div>
                          )}
                        </div>
                        {enr?.inKolRegistry && (
                          <div
                            style={{
                              paddingTop: 10,
                              marginTop: 10,
                              borderTop: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <div
                              style={{
                                textTransform: "uppercase",
                                fontSize: 10,
                                letterSpacing: "0.06em",
                                color: "rgba(255,107,0,0.7)",
                                marginBottom: 6,
                              }}
                            >
                              KOL Registry
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "rgba(255,255,255,0.7)",
                                lineHeight: 1.7,
                              }}
                            >
                              {enr.kolName && <div>Handle: {enr.kolName}</div>}
                              {enr.proceedsTotalUSD != null &&
                                enr.proceedsTotalUSD > 0 && (
                                  <div>
                                    Observed proceeds:{" "}
                                    {formatUSD(enr.proceedsTotalUSD)}
                                  </div>
                                )}
                              {enr.kolScore != null && (
                                <div>Rug count: {enr.kolScore}</div>
                              )}
                              {enr.inIntelVault && (
                                <div>Intel Vault: referenced</div>
                              )}
                            </div>
                          </div>
                        )}
                        {(enr?.isKnownBad || enr?.inWatchlist) && (
                          <div
                            style={{
                              paddingTop: 10,
                              marginTop: 10,
                              borderTop: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <div
                              style={{
                                textTransform: "uppercase",
                                fontSize: 10,
                                letterSpacing: "0.06em",
                                color: "#FF3B5C",
                                marginBottom: 6,
                              }}
                            >
                              Risk flags
                            </div>
                            {enr?.isKnownBad && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "rgba(255,255,255,0.7)",
                                }}
                              >
                                Known bad — high risk entity
                              </div>
                            )}
                            {enr?.inWatchlist && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "rgba(255,255,255,0.7)",
                                }}
                              >
                                Watchlisted — under surveillance
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className="flex flex-wrap gap-2"
                          style={{
                            marginTop: 14,
                            paddingTop: 10,
                            borderTop: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <button
                            onClick={() => setLaunchpadEntityId(e.id)}
                            style={{
                              fontSize: 11,
                              color: "#FF6B00",
                              background: "none",
                              border: "1px solid rgba(255,107,0,0.3)",
                              borderRadius: 4,
                              padding: "4px 10px",
                              cursor: "pointer",
                            }}
                          >
                            Open in →
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard
                                .writeText(e.value)
                                .then(() => toast.showSuccess("Copied"))
                                .catch(() => toast.showError("Copy failed"));
                            }}
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.7)",
                              background: "none",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 4,
                              padding: "4px 10px",
                              cursor: "pointer",
                            }}
                          >
                            Copy value
                          </button>
                          {(e.type === "WALLET" || e.type === "CONTRACT") && (
                            <a
                              href={`/en/demo?addr=${encodeURIComponent(e.value)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 12,
                                color: "#FF6B00",
                                textDecoration: "none",
                                padding: "4px 10px",
                                alignSelf: "center",
                              }}
                            >
                              TigerScore scan &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
                  </div>
                </>
              );
            })()}
            {suggestions.length > 0 && (
              <EntitySuggestionPanel
                caseId={caseId}
                suggestions={suggestions}
                onAdded={() => refreshEntities()}
                onDismiss={() => setSuggestions([])}
              />
            )}
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
            onSwitchTab={(t) => setTab(t as Tab)}
            onInsertNote={(text) => {
              setNewNote((prev) => (prev ? prev + "\n\n" + text : text));
            }}
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
            {filesLoading && (
              <div style={{ display: "grid", gap: 8 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    aria-hidden="true"
                    style={{
                      height: 52,
                      borderRadius: 6,
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                      backgroundSize: "200% 100%",
                      animation: "vault-skeleton 1.2s linear infinite",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  />
                ))}
                <style>{`@keyframes vault-skeleton { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
              </div>
            )}
            {!filesLoading && files.length === 0 && (
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                  padding: "40px 0",
                  textAlign: "center",
                  lineHeight: 1.7,
                }}
              >
                <div>No files yet.</div>
                <div style={{ marginTop: 8 }}>
                  Upload evidence files — PDFs, CSVs, screenshots, JSON exports.
                </div>
                <div style={{ marginTop: 4 }}>
                  Everything is encrypted before it reaches our servers.
                </div>
              </div>
            )}
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
            <NotesToolbar
              textareaRef={noteTextareaRef}
              value={newNote}
              onChange={setNewNote}
            />
            <textarea
              ref={noteTextareaRef}
              aria-label="New case note"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
              placeholder="New note…"
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-1"
            />
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                textAlign: "right",
                marginBottom: 10,
              }}
            >
              {newNote.length} chars · Encrypted before storage
            </div>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={saveNote}
                disabled={!newNote.trim()}
                className="bg-[#FF6B00] text-white px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                Save & encrypt
              </button>
              {noteSpeechSupported && (
                <button
                  onClick={
                    noteRecording ? stopNoteDictation : startNoteDictation
                  }
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "8px 14px",
                    color: noteRecording ? "#FF6B00" : "rgba(255,255,255,0.7)",
                    fontSize: 13,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  {noteRecording ? "Stop dictation" : "Dictate note"}
                </button>
              )}
            </div>
            {notes.length === 0 && (
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                  padding: "20px 0",
                  textAlign: "center",
                  lineHeight: 1.7,
                }}
              >
                <div>No notes yet.</div>
                <div style={{ marginTop: 8 }}>
                  Write your analysis here. Notes are encrypted before storage.
                </div>
              </div>
            )}
            <div className="space-y-3">
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.35)",
                      marginBottom: 6,
                    }}
                  >
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                  <div>{renderMarkdown(n.content)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "graph" && (
          <CaseGraph entities={entities} enrichment={enrichment} />
        )}

        {tab === "timeline" && (
          <ErrorBoundary label="Timeline">
            <TimelineBuilder caseId={caseId} entities={entities} />
          </ErrorBoundary>
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
            hasConfirmedHypothesis={hypothesesForExport.some(
              (h) => h.status === "CONFIRMED"
            )}
            hasBlockingConflicts={hasBlockingConflicts}
            noteCount={notes.length}
            onSaveToNotes={async (content) => {
              if (!keys) return;
              const { enc, iv } = await encryptString(content, keys.noteKey);
              const res = await fetch(
                `/api/investigators/cases/${caseId}/notes`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ contentEnc: enc, contentIv: iv }),
                }
              );
              if (res.ok) {
                const data = await res.json();
                setNotes((prev) => [
                  {
                    id: data.id,
                    contentEnc: enc,
                    contentIv: iv,
                    content,
                    createdAt: data.createdAt,
                    updatedAt: data.createdAt,
                  },
                  ...prev,
                ]);
              }
            }}
          />
        )}

        {tab === "assistant" && (
          <div
            style={{
              height: "calc(100vh - 300px)",
              minHeight: 480,
            }}
          >
            <ErrorBoundary label="Assistant">
              <CaseAssistant
                caseId={caseId}
                caseTitle={title}
                caseTemplate={detail.caseTemplate}
                entities={entities}
                enrichment={enrichment}
              />
            </ErrorBoundary>
          </div>
        )}
        </div>
      </div>
      {walletJourneyId && (
        <ErrorBoundary label="Wallet journey">
          <WalletJourney
            rootEntityId={walletJourneyId}
            entities={entities}
            onClose={() => setWalletJourneyId(null)}
            onOpenGraph={() => {
              setWalletJourneyId(null);
              setTab("graph");
            }}
          />
        </ErrorBoundary>
      )}
      {shareOpen && (
        <ShareCaseModal
          caseId={caseId}
          title={title}
          entities={entities}
          onClose={() => setShareOpen(false)}
        />
      )}
      <NextBestStepToast
        step={toastStep}
        onDismiss={() => setToastStep(null)}
      />
    </main>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 45_000) return "just now";
  const m = Math.round(delta / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const OVERVIEW_H2: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#FF6B00",
  marginBottom: 12,
  fontWeight: 700,
};

const OVERVIEW_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6,
  background: "#0a0a0a",
};

const OVERVIEW_KIND: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.1em",
  color: "#FF6B00",
  textTransform: "uppercase",
  width: 52,
  flexShrink: 0,
};

const OVERVIEW_WHEN: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 11,
  color: "rgba(255,255,255,0.5)",
  flexShrink: 0,
};

const OVERVIEW_CTA: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.75)",
  fontSize: 13,
  padding: "10px 14px",
  borderRadius: 6,
  cursor: "pointer",
};

const OVERVIEW_CTA_PRIMARY: React.CSSProperties = {
  background: "#FF6B00",
  border: "none",
  color: "#FFFFFF",
  fontSize: 13,
  padding: "10px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 500,
};

function OverviewStat({
  label,
  value,
  textual = false,
}: {
  label: string;
  value: number | string;
  textual?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: textual ? 16 : 24,
          fontWeight: 700,
          color: "#FFFFFF",
          lineHeight: 1.1,
          textTransform: textual ? "uppercase" : "none",
          letterSpacing: textual ? "0.04em" : undefined,
        }}
      >
        {value}
      </div>
      <div
        style={{
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.5)",
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
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
