"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };

type Entity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  tigerScore?: number | null;
};

type Props = {
  caseId: string;
  caseTitle: string;
  caseTemplate: string | null;
  entities: Entity[];
  enrichment: Record<string, unknown>;
};

type IntelSummary = {
  entityCount: number;
  kolMatches: number;
  proceedsTotal: string;
  networkActors: number;
  laundryTrails: number;
  intelVaultRefs: number;
  confidenceClaims: number;
  contradictions: number;
  timelineSpan: string | null;
};

type AnalysisMode = "actor" | "network" | "publication" | null;

const MODE_PROMPTS: Record<Exclude<AnalysisMode, null>, string[]> = {
  actor: [
    "Profile this actor",
    "What are the strongest evidence points against this actor?",
    "What is this actor's role in the network?",
    "Map this actor's wallet infrastructure",
    "What can we confirm about this actor publicly?",
  ],
  network: [
    "Who is central in this network?",
    "What patterns are coordinated vs coincidental?",
    "Where are the strongest network links?",
    "What is recurring across actors?",
    "Map the financial flows in this network",
  ],
  publication: [
    "What can we state publicly right now?",
    "What is still inference — not ready for publication?",
    "Draft an Intel Vault summary",
    "Draft a retail-safe warning",
    "What evidence is still missing before publication?",
    "Separate confirmed facts from working hypotheses",
  ],
};

const MODE_HINTS: Record<Exclude<AnalysisMode, null>, string> = {
  actor: "[ACTOR ANALYSIS MODE] Focus on individual actor profiling. ",
  network:
    "[NETWORK ANALYSIS MODE] Focus on network structure and coordination. ",
  publication:
    "[PUBLICATION MODE] Focus on what is publishable, what is not, and why. ",
};

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

function getRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  const Cls = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Cls) return null;
  const r = new Cls();
  r.continuous = true;
  r.interimResults = false;
  r.lang = "en-US";
  return r;
}

const DEFAULT_QUICK_PROMPTS = [
  "Analyze this network",
  "Review cashout patterns",
  "Generate working hypotheses",
  "Find contradictions",
  "Suggest next investigation steps",
  "Draft Intel Vault summary",
  "Draft retail-safe warning",
  "What facts can we confirm publicly?",
];

// Inline markdown renderer — no external library.
function renderInline(text: string): React.ReactNode {
  // Handle **bold** spans
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong
        key={`b-${key++}`}
        style={{ color: "#FFFFFF", fontWeight: 600 }}
      >
        {match[1]}
      </strong>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 0 ? text : parts;
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  function flushList() {
    if (!listBuffer) return;
    const ordered = listBuffer.ordered;
    const items = listBuffer.items;
    blocks.push(
      <div
        key={`list-${key++}`}
        style={{
          margin: "6px 0",
          paddingLeft: 4,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.6,
            }}
          >
            <span
              style={{
                color: "#FF6B00",
                flexShrink: 0,
                marginTop: ordered ? 0 : 2,
                fontSize: ordered ? 13 : 14,
                lineHeight: 1,
                minWidth: 14,
              }}
            >
              {ordered ? `${i + 1}.` : "•"}
            </span>
            <span style={{ flex: 1 }}>{renderInline(item)}</span>
          </div>
        ))}
      </div>
    );
    listBuffer = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushList();
      blocks.push(<div key={`sp-${key++}`} style={{ height: 8 }} />);
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <div
          key={`h3-${key++}`}
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#FF6B00",
            margin: "12px 0 6px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {renderInline(line.slice(3))}
        </div>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <div
          key={`h4-${key++}`}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
            margin: "8px 0 4px",
          }}
        >
          {renderInline(line.slice(4))}
        </div>
      );
      continue;
    }

    const ulMatch = /^[-*]\s+(.*)$/.exec(line);
    if (ulMatch) {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(ulMatch[1]);
      continue;
    }

    const olMatch = /^(\d+)\.\s+(.*)$/.exec(line);
    if (olMatch) {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(olMatch[2]);
      continue;
    }

    flushList();
    blocks.push(
      <div
        key={`p-${key++}`}
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.85)",
          lineHeight: 1.6,
          margin: "4px 0",
        }}
      >
        {renderInline(line)}
      </div>
    );
  }
  flushList();
  return <Fragment>{blocks}</Fragment>;
}

export default function CaseAssistant({
  caseId,
  caseTitle,
  caseTemplate,
  entities,
  enrichment,
}: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState<number>(0);
  const [tokensLimit, setTokensLimit] = useState<number>(0);
  const [recording, setRecording] = useState(false);
  const [supportsVoice, setSupportsVoice] = useState(false);
  const [intelSummary, setIntelSummary] = useState<IntelSummary | null>(null);
  const [mode, setMode] = useState<AnalysisMode>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const recogRef = useRef<SR | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSupportsVoice(getRecognition() !== null);
  }, []);

  useEffect(() => {
    fetch(`/api/investigators/cases/${caseId}/intelligence-summary`)
      .then((r) => r.json())
      .then((d: IntelSummary) => setIntelSummary(d))
      .catch(() => setIntelSummary(null));
  }, [caseId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function startVoice() {
    const r = getRecognition();
    if (!r) return;
    recogRef.current = r;
    r.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript + " ";
      }
      setInput((prev) => (prev ? prev + " " : "") + transcript.trim());
    };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    r.start();
    setRecording(true);
  }

  function stopVoice() {
    recogRef.current?.stop();
    setRecording(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    // Inject mode hint into the message sent to the API but display the
    // bare user text in the chat.
    const hint = mode ? MODE_HINTS[mode] : "";
    const displayMessages: ChatMsg[] = [
      ...messages,
      { role: "user", content: text },
    ];
    const apiMessages: ChatMsg[] = [
      ...messages,
      { role: "user", content: hint + text },
    ];
    setMessages(displayMessages);
    setInput("");
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/assistant`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            // Server now builds its own intelligence pack — these are kept
            // as a hint but ignored by the route.
            caseContext: {
              title: caseTitle,
              template: caseTemplate,
              entities: entities.map((e) => ({
                type: e.type,
                value: e.value,
                label: e.label,
                tigerScore: e.tigerScore ?? null,
              })),
              enrichment,
            },
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
        if (typeof data.tokensUsed === "number") setTokensUsed(data.tokensUsed);
        if (typeof data.tokensLimit === "number") setTokensLimit(data.tokensLimit);
      } else {
        setError(data.message ?? data.error ?? "Request failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function pickPrompt(p: string) {
    setInput(p);
    inputRef.current?.focus();
  }

  const quotaPercent = tokensLimit > 0 ? (tokensUsed / tokensLimit) * 100 : 0;
  const quotaColor =
    quotaPercent < 80 ? "#4ADE80" : quotaPercent < 95 ? "#FF6B00" : "#FF3B5C";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        backgroundColor: "#0a0a0a",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* INTELLIGENCE INDICATOR */}
      {intelSummary && (
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "relative",
          }}
        >
          <span style={{ flex: 1 }}>
            Analyzing: {intelSummary.entityCount} entities ·{" "}
            {intelSummary.kolMatches} KOL matches · {intelSummary.proceedsTotal}{" "}
            in observed proceeds · {intelSummary.networkActors} network actors
            {intelSummary.laundryTrails > 0 &&
              ` · ${intelSummary.laundryTrails} laundry trails`}
            {intelSummary.confidenceClaims > 0 &&
              ` · ${intelSummary.confidenceClaims} confidence claims`}
            {intelSummary.contradictions > 0 &&
              ` · ${intelSummary.contradictions} contradictions`}
            {intelSummary.timelineSpan &&
              ` · timeline: ${intelSummary.timelineSpan}`}
          </span>
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="Pack details"
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 999,
              width: 16,
              height: 16,
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              cursor: "help",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              padding: 0,
              lineHeight: 1,
            }}
          >
            i
          </button>
          {showTooltip && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 12,
                marginTop: 6,
                backgroundColor: "#111",
                border: "1px solid rgba(255,107,0,0.2)",
                padding: 12,
                borderRadius: 6,
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
                zIndex: 50,
                width: 280,
                lineHeight: 1.6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ marginBottom: 6, color: "#FF6B00" }}>
                This assistant is analyzing:
              </div>
              <div>• {intelSummary.entityCount} case entities</div>
              <div>• {intelSummary.kolMatches} KOL Registry matches</div>
              <div>• {intelSummary.proceedsTotal} in observed proceeds</div>
              <div>• {intelSummary.laundryTrails} laundry trail signals</div>
              <div>• {intelSummary.intelVaultRefs} Intel Vault references</div>
              <div>
                • {intelSummary.confidenceClaims} confidence-weighted claims
              </div>
              <div>• {intelSummary.contradictions} detected contradictions</div>
              {intelSummary.timelineSpan && (
                <div>• Timeline span: {intelSummary.timelineSpan}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE SELECTOR */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          padding: "8px 12px",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "rgba(255,255,255,0.3)",
            marginRight: 4,
          }}
        >
          Mode
        </span>
        {(["actor", "network", "publication"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(active ? null : m)}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 12,
                border: active
                  ? "1px solid #FF6B00"
                  : "1px solid rgba(255,255,255,0.1)",
                backgroundColor: active
                  ? "rgba(255,107,0,0.2)"
                  : "transparent",
                color: active ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 13,
              textAlign: "center",
              padding: 40,
            }}
          >
            Ask the co-pilot anything about this case. It works from a
            structured intelligence pack — KOL matches, laundry trails, network
            actors — never from notes or raw files.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: m.role === "user" ? "75%" : "92%",
                padding: "10px 14px",
                borderRadius: 12,
                backgroundColor:
                  m.role === "user" ? "rgba(255,107,0,0.15)" : "#0d0d0d",
                border:
                  m.role === "user"
                    ? "1px solid rgba(255,107,0,0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
                color: "#FFFFFF",
                fontSize: 13,
                lineHeight: 1.6,
                wordBreak: "break-word",
              }}
            >
              {m.role === "user" ? (
                <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
              ) : (
                renderMarkdown(m.content)
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            Thinking…
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "8px 16px",
            color: "#FF3B5C",
            fontSize: 12,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* QUICK PROMPTS */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "8px 12px",
          display: "flex",
          gap: 8,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {(mode ? MODE_PROMPTS[mode] : DEFAULT_QUICK_PROMPTS).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => pickPrompt(p)}
            style={{
              backgroundColor: "rgba(255,107,0,0.1)",
              border: "1px solid rgba(255,107,0,0.2)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* INPUT BAR */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: 12,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          flexShrink: 0,
          backgroundColor: "#0a0a0a",
          pointerEvents: "auto",
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about this case…"
          rows={2}
          autoComplete="off"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            backgroundColor: "#0d0d0d",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: "10px 12px",
            color: "#FFFFFF",
            fontSize: 13,
            outline: "none",
            resize: "none",
            maxHeight: 120,
            fontFamily: "inherit",
            pointerEvents: "auto",
            cursor: "text",
          }}
        />
        {supportsVoice && (
          <button
            onClick={recording ? stopVoice : startVoice}
            aria-label={recording ? "Stop dictation" : "Start dictation"}
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "10px 12px",
              color: recording ? "#FF6B00" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
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
          </button>
        )}
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="disabled:opacity-50"
          style={{
            backgroundColor: "#FF6B00",
            border: "none",
            borderRadius: 6,
            padding: "10px 14px",
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      {tokensLimit > 0 && (
        <div
          style={{
            padding: "6px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 10,
            color: quotaColor,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          AI quota: {tokensUsed.toLocaleString()} /{" "}
          {tokensLimit.toLocaleString()} tokens this month
        </div>
      )}
    </div>
  );
}
