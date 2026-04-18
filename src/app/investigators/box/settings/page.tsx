"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { describeResponse } from "@/lib/investigators/errorMessages";

type Settings = {
  assistanceLevel: "FULL_ASSIST" | "BALANCED" | "MANUAL_FIRST";
  autoKolRegistryMode: Mode;
  autoIntelVaultMode: Mode;
  autoObservedProceedsMode: Mode;
  autoLaundryTrailMode: Mode;
  autoWalletJourneyMode: Mode;
  autoCaseCorrelationMode: Mode;
  autoMarketMakerMode: Mode;
  autoNextStepsMode: Mode;
};

type Mode = "ON" | "QUIET" | "OFF";

const ACCENT = "#FF6B00";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

const ENGINE_ROWS: {
  key: keyof Settings;
  label: string;
  description: string;
  tier: 1 | 2;
}[] = [
  {
    key: "autoKolRegistryMode",
    label: "KOL Registry",
    description: "Cross-reference wallets & handles against known KOL actors.",
    tier: 1,
  },
  {
    key: "autoIntelVaultMode",
    label: "Intel Vault",
    description: "Check address labels and intel-feed mentions.",
    tier: 1,
  },
  {
    key: "autoObservedProceedsMode",
    label: "Observed Proceeds",
    description: "Flag documented scam proceeds attributed to this actor.",
    tier: 1,
  },
  {
    key: "autoLaundryTrailMode",
    label: "Laundry Trail",
    description: "On-chain pattern detection (mixer, bridge-hop, break-point).",
    tier: 2,
  },
  {
    key: "autoWalletJourneyMode",
    label: "Wallet Journey",
    description: "Funding-graph probe — upstream / downstream counterparties.",
    tier: 2,
  },
  {
    key: "autoCaseCorrelationMode",
    label: "Case Correlation",
    description:
      "Detect when a wallet or handle also appears in your other cases.",
    tier: 2,
  },
  {
    key: "autoMarketMakerMode",
    label: "Market Maker (Tier-3)",
    description: "Coordinated liquidity / MM detection — not yet implemented.",
    tier: 2,
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [preMigration, setPreMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/investigators/workspace/settings");
      if (!res.ok) {
        setError(describeResponse(res));
        return;
      }
      const d = await res.json();
      setSettings(d.settings);
      setPreMigration(!!d.preMigration);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(key: keyof Settings, value: string) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value as Mode });
    setSaving(key as string);
    try {
      const res = await fetch("/api/investigators/workspace/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        setError(describeResponse(res));
        await load();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(null);
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
          INTERLIGENS · WORKSPACE SETTINGS
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginTop: 8,
            letterSpacing: "-0.01em",
          }}
        >
          Intelligence engines
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
          Each engine runs automatically when you add a lead.{" "}
          <strong style={{ color: "rgba(255,255,255,0.8)" }}>ON</strong>{" "}
          surfaces events in the reaction panel.{" "}
          <strong style={{ color: "rgba(255,255,255,0.8)" }}>QUIET</strong>{" "}
          runs + persists but stays out of the toast feed.{" "}
          <strong style={{ color: "rgba(255,255,255,0.8)" }}>OFF</strong>{" "}
          disables entirely.
        </p>

        {preMigration && (
          <div
            role="alert"
            style={{
              marginTop: 24,
              border: "1px solid rgba(255,184,0,0.35)",
              background: "rgba(255,184,0,0.06)",
              borderRadius: 6,
              padding: "12px 14px",
              fontSize: 12,
              color: "#FFB800",
              lineHeight: 1.5,
            }}
          >
            Settings table hasn&apos;t been migrated yet in Neon — engines
            are running with safe defaults. Apply{" "}
            <code>prisma/migrations_case_intel/001_case_intelligence.sql</code>{" "}
            to persist per-workspace preferences.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 24,
              border: "1px solid rgba(255,59,92,0.35)",
              background: "rgba(255,59,92,0.08)",
              borderRadius: 6,
              padding: "12px 14px",
              fontSize: 12,
              color: "#FF9AAB",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: 32, fontSize: 13, color: DIM }}>
            Loading…
          </div>
        ) : settings ? (
          <div
            style={{
              marginTop: 32,
              display: "grid",
              gap: 8,
            }}
          >
            {ENGINE_ROWS.map((row) => {
              const value = settings[row.key] as Mode;
              return (
                <div
                  key={row.key as string}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    padding: "16px 18px",
                    border: `1px solid ${LINE}`,
                    borderRadius: 6,
                    background: SURFACE,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#FFFFFF",
                        }}
                      >
                        {row.label}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: row.tier === 1 ? ACCENT : DIM,
                          border: `1px solid ${
                            row.tier === 1 ? "rgba(255,107,0,0.4)" : LINE
                          }`,
                          padding: "1px 6px",
                          borderRadius: 10,
                        }}
                      >
                        TIER {row.tier}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: DIM,
                        lineHeight: 1.5,
                      }}
                    >
                      {row.description}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {(["ON", "QUIET", "OFF"] as Mode[]).map((m) => {
                      const active = value === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={active}
                          onClick={() => patch(row.key, m)}
                          disabled={saving === row.key}
                          style={{
                            fontSize: 11,
                            padding: "4px 10px",
                            borderRadius: 4,
                            border: active
                              ? `1px solid ${ACCENT}`
                              : `1px solid ${LINE}`,
                            background: active
                              ? "rgba(255,107,0,0.12)"
                              : "transparent",
                            color: active ? ACCENT : "rgba(255,255,255,0.6)",
                            cursor:
                              saving === row.key ? "wait" : "pointer",
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}
