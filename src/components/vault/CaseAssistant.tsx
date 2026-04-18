"use client";

import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/vault/renderMarkdown";

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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function copyMessage(content: string, idx: number) {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
      })
      .catch(() => {});
  }

  async function regenerateLast() {
    if (sending) return;
    // Find last user message
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const truncated = messages.slice(0, actualIdx + 1);
    setMessages(truncated);
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/investigators/cases/${caseId}/assistant`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: truncated,
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
      // Parse body defensively — 429 / 503 can return non-JSON or
      // empty bodies and a blind res.json() would throw.
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const errCode = (data as { error?: string }).error;
        const errMsg = (data as { message?: string }).message;
        setError(
          errCode === "quota_exceeded"
            ? errMsg ?? "Monthly AI quota reached. Contact INTERLIGENS to increase."
            : errCode === "no_api_key"
              ? errMsg ?? "Assistant is not configured for this deployment."
              : errMsg ?? errCode ?? `Request failed (${res.status})`
        );
        return;
      }
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response as string },
        ]);
        if (typeof data.tokensUsed === "number") setTokensUsed(data.tokensUsed);
        if (typeof data.tokensLimit === "number") setTokensLimit(data.tokensLimit);
      } else {
        setError("Empty response from assistant. Please retry.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? `Network error: ${err.message}` : "Network error"
      );
    } finally {
      setSending(false);
    }
  }
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
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const errCode = (data as { error?: string }).error;
        const errMsg = (data as { message?: string }).message;
        setError(
          errCode === "quota_exceeded"
            ? errMsg ?? "Monthly AI quota reached. Contact INTERLIGENS to increase."
            : errCode === "no_api_key"
              ? errMsg ?? "Assistant is not configured for this deployment."
              : errMsg ?? errCode ?? `Request failed (${res.status})`
        );
        return;
      }
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response as string },
        ]);
        if (typeof data.tokensUsed === "number") setTokensUsed(data.tokensUsed);
        if (typeof data.tokensLimit === "number") setTokensLimit(data.tokensLimit);
      } else {
        setError("Empty response from assistant. Please retry.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? `Network error: ${err.message}` : "Network error"
      );
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
          <a
            href="/en/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="case-assistant-scan-link"
            style={{
              fontSize: 11,
              color: "rgba(255,107,0,0.5)",
              textDecoration: "none",
              flexShrink: 0,
              transition: "color 150ms",
            }}
          >
            Open Scan &rarr;
          </a>
          <style>{`.case-assistant-scan-link:hover{color:#FF6B00 !important;}`}</style>
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
        {messages.map((m, i) => {
          const isLastAssistant =
            m.role === "assistant" &&
            i === messages.length - 1 &&
            !sending;
          return (
            <div
              key={i}
              className="group"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems:
                  m.role === "user" ? "flex-end" : "flex-start",
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
              {m.role === "assistant" && (
                <div
                  className="flex items-center gap-3"
                  style={{ marginTop: 4, paddingLeft: 4 }}
                >
                  <button
                    type="button"
                    onClick={() => copyMessage(m.content, i)}
                    className="hover:text-white"
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    {copiedIdx === i ? "Copied!" : "Copy"}
                  </button>
                  {isLastAssistant && (
                    <button
                      type="button"
                      onClick={regenerateLast}
                      className="hover:text-[#FF6B00]"
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.25)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      ↺ Regenerate
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.25)",
            marginRight: 8,
            flexShrink: 0,
          }}
        >
          Quick analysis:
        </span>
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

      <div
        style={{
          padding: "6px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <a
          href="/investigators/box/trust"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "rgba(255,255,255,0.3)",
            textDecoration: "none",
          }}
          className="hover:text-[#FF6B00]"
        >
          Privacy policy →
        </a>
        {tokensLimit > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
              minWidth: 180,
            }}
          >
            <span style={{ color: quotaColor }}>
              {tokensUsed.toLocaleString()} / {tokensLimit.toLocaleString()}{" "}
              tokens · {Math.round(quotaPercent)}% used this month
            </span>
            <div
              style={{
                width: 180,
                height: 3,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, quotaPercent)}%`,
                  height: "100%",
                  backgroundColor:
                    quotaPercent < 50
                      ? "rgba(0,200,83,0.6)"
                      : quotaPercent < 80
                        ? "rgba(255,107,0,0.6)"
                        : "rgba(255,59,92,0.6)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
