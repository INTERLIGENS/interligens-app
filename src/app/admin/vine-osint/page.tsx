"use client";

import vineData from "@/data/vine-osint.json";
import networkData from "@/data/vine-insider-network.json";

const ACCENT = "#FF6B00";
const BG = "#000000";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

type Shiller = {
  handle: string;
  real_name?: string;
  followers: number;
  timing: string;
  tweet_url: string;
  role: string;
  severity: Severity;
  hotspot?: boolean;
  quote?: string;
};

type Wallet = {
  label: string;
  address: string;
  role: string;
  chain: string;
  balance_vine?: number;
  solscan_url: string;
  severity: Severity;
};

type TimelineEvent = {
  date: string;
  title: string;
  description: string;
  category: string;
  actor: string;
};

type Hotspot = {
  id: string;
  title: string;
  context: string;
  implications: string[];
  action: string;
};

type Claim = {
  claim_id: string;
  title: string;
  severity: Severity;
  status: string;
  description: string;
  category: string;
  actors: string[];
  date: string;
  evidence_refs: string[];
  thread_url: string;
  description_fr: string;
};

const SECTION: React.CSSProperties = {
  marginTop: 40,
};

const CARD: React.CSSProperties = {
  background: "#0D0D0D",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  padding: 20,
};

const TABLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.55)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.85)",
  verticalAlign: "top",
};

function severityBadge(sev: Severity) {
  const map: Record<Severity, { color: string; bg: string; border: string }> = {
    CRITICAL: {
      color: "#FF6B6B",
      bg: "rgba(165,28,28,0.18)",
      border: "1px solid rgba(255,107,107,0.35)",
    },
    HIGH: {
      color: ACCENT,
      bg: "rgba(255,107,0,0.12)",
      border: "1px solid rgba(255,107,0,0.35)",
    },
    MEDIUM: {
      color: "#F5B041",
      bg: "rgba(245,176,65,0.1)",
      border: "1px solid rgba(245,176,65,0.3)",
    },
    LOW: {
      color: "rgba(255,255,255,0.55)",
      bg: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
  };
  const m = map[sev];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: m.color,
        background: m.bg,
        border: m.border,
        borderRadius: 4,
      }}
    >
      {sev}
    </span>
  );
}

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function categoryDot(category: string): string {
  const map: Record<string, string> = {
    catalyst: "#F5B041",
    launch: ACCENT,
    shill: "#E74C3C",
    peak: "#9B59B6",
    hotspot: "#FF6B6B",
    onchain: "#3498DB",
    collapse: "#888",
  };
  return map[category] ?? "#666";
}

export default function VineOsintPage() {
  const meta = vineData.case_meta;
  const timeline = vineData.timeline as TimelineEvent[];
  const shillers = vineData.shillers as Shiller[];
  const wallets = vineData.wallets_onchain as Wallet[];
  const hotspots = vineData.hotspots as Hotspot[];
  const claims = vineData.new_claims as Claim[];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#FFFFFF",
        padding: "32px 40px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          OSINT INVESTIGATION — {meta.case_id}
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "8px 0 4px",
            letterSpacing: "0.02em",
          }}
        >
          $VINE — {meta.deployer}
        </h1>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          Token lancé le {meta.launched_at} · ATH ${(meta.ath_market_cap_usd / 1_000_000).toFixed(0)}M → $
          {(meta.current_market_cap_usd / 1_000_000).toFixed(0)}M ({meta.drawdown_pct}%)
        </div>

        {/* META STRIP */}
        <div
          style={{
            ...CARD,
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          <MetaCell label="Mint address" value={meta.mint} mono />
          <MetaCell label="Chain" value={meta.chain.toUpperCase()} />
          <MetaCell label="Severity" value={meta.severity} accent />
          <MetaCell label="Status" value={meta.status} />
        </div>

        <div style={{ ...CARD, marginTop: 12 }}>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Résumé
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
            {meta.summary_fr}
          </div>
        </div>

        {/* TIMELINE */}
        <SectionTitle>Timeline — Elon tweets → launch → pompes → walkback</SectionTitle>
        <div style={{ ...CARD, marginTop: 16 }}>
          {timeline.map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 14,
                padding: "12px 0",
                borderBottom:
                  i < timeline.length - 1
                    ? "1px solid rgba(255,255,255,0.04)"
                    : "none",
              }}
            >
              <div
                style={{
                  minWidth: 90,
                  fontSize: 11,
                  color: ACCENT,
                  fontWeight: 600,
                }}
              >
                {e.date}
              </div>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: categoryDot(e.category),
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>
                  {e.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.55)",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {e.description}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {e.category} · {e.actor}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SHILLERS TABLE */}
        <SectionTitle>Shillers identifiés ({shillers.length})</SectionTitle>
        <div style={{ ...CARD, marginTop: 16, padding: 0, overflow: "hidden" }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={TH}>Handle</th>
                <th style={TH}>Followers</th>
                <th style={TH}>Timing</th>
                <th style={TH}>Rôle</th>
                <th style={TH}>Sév.</th>
                <th style={TH}>X</th>
              </tr>
            </thead>
            <tbody>
              {shillers.map((s) => (
                <tr key={s.handle}>
                  <td style={TD}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: s.hotspot ? ACCENT : "#FFFFFF",
                      }}
                    >
                      {s.handle}
                    </div>
                    {s.real_name && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.4)",
                          marginTop: 2,
                        }}
                      >
                        {s.real_name}
                      </div>
                    )}
                    {s.quote && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#FF6B6B",
                          fontStyle: "italic",
                          marginTop: 4,
                        }}
                      >
                        “{s.quote}”
                      </div>
                    )}
                  </td>
                  <td style={TD}>{s.followers.toLocaleString()}</td>
                  <td style={TD}>{s.timing}</td>
                  <td style={TD}>{s.role}</td>
                  <td style={TD}>{severityBadge(s.severity)}</td>
                  <td style={TD}>
                    <a
                      href={s.tweet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: ACCENT,
                        textDecoration: "none",
                        fontSize: 11,
                      }}
                    >
                      → profil
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* WALLETS TABLE */}
        <SectionTitle>Wallets on-chain ({wallets.length})</SectionTitle>
        <div style={{ ...CARD, marginTop: 16, padding: 0, overflow: "hidden" }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={TH}>Label</th>
                <th style={TH}>Adresse complète</th>
                <th style={TH}>Rôle</th>
                <th style={TH}>Balance</th>
                <th style={TH}>Sév.</th>
                <th style={TH}>Solscan</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.address}>
                  <td style={{ ...TD, fontWeight: 600 }}>{w.label}</td>
                  <td
                    style={{
                      ...TD,
                      fontFamily: "Menlo, Consolas, monospace",
                      fontSize: 10,
                      wordBreak: "break-all",
                      maxWidth: 280,
                    }}
                  >
                    {w.address}
                  </td>
                  <td
                    style={{ ...TD, fontSize: 11, color: "rgba(255,255,255,0.6)" }}
                  >
                    {w.role}
                  </td>
                  <td style={TD}>
                    {w.balance_vine ? `${w.balance_vine.toLocaleString()} VINE` : "—"}
                  </td>
                  <td style={TD}>{severityBadge(w.severity)}</td>
                  <td style={TD}>
                    <a
                      href={w.solscan_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: ACCENT, textDecoration: "none", fontSize: 11 }}
                      title={shortAddr(w.address)}
                    >
                      → Solscan
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* INSIDER NETWORK */}
        <SectionTitle>
          Insider Network — score de coordination {networkData.coordination_score}/100
        </SectionTitle>
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {/* Coordination breakdown */}
          <div style={CARD}>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Breakdown score coordination
            </div>
            {(networkData.coordination_breakdown || []).map((b, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "6px 0",
                  borderBottom:
                    i < (networkData.coordination_breakdown || []).length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : "none",
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    minWidth: 44,
                    color: ACCENT,
                    fontWeight: 700,
                  }}
                >
                  +{b.points}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#FFFFFF", fontWeight: 600 }}>{b.factor}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>
                    {b.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Rus link */}
          <div
            style={{
              ...CARD,
              borderLeft: `3px solid ${
                (networkData.rus_link as { direct?: boolean })?.direct ? "#FF6B6B" : "rgba(255,255,255,0.2)"
              }`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Lien deployer Rus Yusupov
            </div>
            <div style={{ fontSize: 13, color: "#FFFFFF" }}>
              {(networkData.rus_link as { note?: string })?.note ??
                "Inspection non effectuée."}
            </div>
          </div>

          {/* Cross-buyer common parents */}
          <div style={CARD}>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Parents de funding communs (cross-buyers pre-launch)
            </div>
            {Object.entries(
              (networkData.parent_search as { cross_buyer_common?: Record<string, string[]> })
                ?.cross_buyer_common ?? {}
            ).length === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                Aucun parent commun identifié dans les TX inspectées.
              </div>
            ) : (
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Adresse parent</th>
                    <th style={TH}>Buyers financés</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    (networkData.parent_search as {
                      cross_buyer_common?: Record<string, string[]>;
                    })?.cross_buyer_common ?? {}
                  ).map(([src, labels]) => {
                    const isSelf = src === "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ";
                    return (
                      <tr key={src}>
                        <td
                          style={{
                            ...TD,
                            fontFamily: "Menlo, monospace",
                            fontSize: 10,
                            wordBreak: "break-all",
                            maxWidth: 340,
                            color: isSelf ? "#FF6B6B" : "rgba(255,255,255,0.85)",
                            fontWeight: isSelf ? 700 : 400,
                          }}
                        >
                          {src}
                          {isSelf && (
                            <div
                              style={{
                                fontSize: 9,
                                color: "#FF6B6B",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                marginTop: 2,
                              }}
                            >
                              🔴 Wi11em itself — parent direct des autres buyers
                            </div>
                          )}
                        </td>
                        <td style={TD}>
                          {labels.map((l, i) => (
                            <span
                              key={l}
                              style={{
                                display: "inline-block",
                                padding: "2px 7px",
                                marginRight: 4,
                                marginBottom: 2,
                                fontSize: 10,
                                background: "rgba(255,107,0,0.1)",
                                color: ACCENT,
                                borderRadius: 3,
                                border: "1px solid rgba(255,107,0,0.25)",
                              }}
                            >
                              {l}
                            </span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Consolidators */}
          <div style={CARD}>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Consolidateurs post-dump (2025-01-26+) — {networkData.consolidators.length} résolus
            </div>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Consolidateur</th>
                  <th style={TH}>Source buyer</th>
                  <th style={TH}>USD claim</th>
                  <th style={TH}>Outflows</th>
                </tr>
              </thead>
              <tbody>
                {(networkData.consolidators as Array<{
                  prefix: string;
                  full_address: string | null;
                  from_buyer: string;
                  usd_received_claim: number;
                  outflows_aggregate?: Array<{
                    address: string;
                    label: string | null;
                    tx_count: number;
                    total_sol: number;
                  }>;
                  resolution_status: string;
                }>).map((c) => (
                  <tr key={c.prefix}>
                    <td
                      style={{
                        ...TD,
                        fontFamily: "Menlo, monospace",
                        fontSize: 9,
                        wordBreak: "break-all",
                        maxWidth: 260,
                      }}
                    >
                      {c.full_address ?? (
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>
                          {c.prefix}… (unresolved)
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        ...TD,
                        fontFamily: "Menlo, monospace",
                        fontSize: 9,
                      }}
                    >
                      {c.from_buyer.slice(0, 8)}…{c.from_buyer.slice(-4)}
                    </td>
                    <td style={{ ...TD, fontWeight: 600, color: ACCENT }}>
                      ${(c.usd_received_claim / 1_000_000).toFixed(2)}M
                    </td>
                    <td style={TD}>
                      {c.outflows_aggregate && c.outflows_aggregate.length > 0 ? (
                        c.outflows_aggregate.slice(0, 3).map((o) => (
                          <div
                            key={o.address}
                            style={{ fontSize: 10, marginBottom: 3 }}
                          >
                            <span
                              style={{
                                fontFamily: "Menlo, monospace",
                                color: o.label ? ACCENT : "rgba(255,255,255,0.65)",
                                fontWeight: o.label ? 700 : 400,
                              }}
                            >
                              {o.label ?? `${o.address.slice(0, 8)}…${o.address.slice(-4)}`}
                            </span>
                            <span
                              style={{ color: "rgba(255,255,255,0.4)", marginLeft: 6 }}
                            >
                              {o.total_sol.toFixed(2)} SOL · {o.tx_count} TX
                            </span>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                          no outflow TX parsed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {networkData.exchanges_identified.length > 0 ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "rgba(255,107,0,0.08)",
                  border: "1px solid rgba(255,107,0,0.25)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: ACCENT,
                }}
              >
                <strong>Exchanges identifiés :</strong>{" "}
                {networkData.exchanges_identified.join(" · ")}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                Aucun exchange connu détecté dans les outflows (label table limitée).
                Destinations réelles : cf. colonne outflows ci-dessus — à croiser avec
                Arkham Intelligence pour labellisation.
              </div>
            )}
          </div>
        </div>

        {/* POINTS CHAUDS */}
        <SectionTitle>🔥 Points chauds — coordination possible</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
            marginTop: 16,
          }}
        >
          {hotspots.map((h) => (
            <div
              key={h.id}
              style={{
                ...CARD,
                borderLeft: `3px solid ${ACCENT}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: ACCENT,
                  }}
                >
                  {h.id} — {h.title}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.6,
                  marginBottom: 12,
                }}
              >
                {h.context}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                  fontWeight: 700,
                }}
              >
                Implications
              </div>
              <ul
                style={{
                  margin: "0 0 12px 20px",
                  padding: 0,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.7,
                }}
              >
                {h.implications.map((imp, i) => (
                  <li key={i}>{imp}</li>
                ))}
              </ul>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  fontStyle: "italic",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  paddingTop: 10,
                }}
              >
                → {h.action}
              </div>
            </div>
          ))}
        </div>

        {/* NEW CLAIMS C9 C10 */}
        <SectionTitle>Nouveaux claims ajoutés au CaseFile VINE</SectionTitle>
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {claims.map((c) => (
            <div key={c.claim_id} style={CARD}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#FFFFFF",
                  }}
                >
                  <span style={{ color: ACCENT }}>{c.claim_id}</span> — {c.title}
                </div>
                {severityBadge(c.severity)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                {c.description_fr}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <span>Date : {c.date}</span>
                <span>Acteurs : {c.actors.join(", ")}</span>
                <span>Catégorie : {c.category}</span>
                {c.thread_url && (
                  <a
                    href={c.thread_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: ACCENT, textDecoration: "none" }}
                  >
                    → source
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            textAlign: "center",
          }}
        >
          INTERLIGENS OSINT · {meta.investigator} · updated {meta.updated_at.slice(0, 10)}
        </div>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...SECTION,
        fontSize: 13,
        fontWeight: 700,
        color: "#FFFFFF",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: mono ? 11 : 13,
          fontFamily: mono ? "Menlo, Consolas, monospace" : "inherit",
          fontWeight: accent ? 700 : 600,
          color: accent ? ACCENT : "#FFFFFF",
          wordBreak: mono ? "break-all" : "normal",
        }}
      >
        {value}
      </div>
    </div>
  );
}
