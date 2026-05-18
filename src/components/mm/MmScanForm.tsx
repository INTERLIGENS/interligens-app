"use client";

import { useState } from "react";
import type { MmChain, MmSubjectType } from "@/lib/mm/types";

const CHAINS: MmChain[] = [
  "SOLANA",
  "ETHEREUM",
  "BASE",
  "ARBITRUM",
  "OPTIMISM",
  "BNB",
  "POLYGON",
];

const SUBJECT_TYPES: MmSubjectType[] = ["WALLET", "TOKEN"];

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "accepted"; message: string }
  | { kind: "error"; message: string };

export function MmScanForm() {
  const [subjectType, setSubjectType] = useState<MmSubjectType>("WALLET");
  const [subjectId, setSubjectId] = useState("");
  const [chain, setChain] = useState<MmChain>("SOLANA");
  const [accessCode, setAccessCode] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId.trim()) {
      setStatus({ kind: "error", message: "Adresse ou mint requis." });
      return;
    }
    if (!accessCode.trim()) {
      setStatus({ kind: "error", message: "Code d'accès beta requis." });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/v1/mm/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { "X-Api-Token": apiToken } : {}),
        },
        body: JSON.stringify({
          subjectType,
          subjectId: subjectId.trim(),
          chain,
          accessCode: accessCode.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (res.status === 501) {
        setStatus({
          kind: "accepted",
          message:
            body.message ??
            "Le scanner on-demand sera disponible prochainement. Votre demande a été enregistrée.",
        });
        return;
      }
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: body.error ?? `Erreur ${res.status}`,
        });
        return;
      }
      setStatus({
        kind: "accepted",
        message: body.message ?? "Demande prise en compte.",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: 16,
        padding: 24,
        background: "#0A0A0A",
        border: "1px solid #222",
        borderRadius: 2,
      }}
    >
      <Field label="Sujet">
        <div style={{ display: "flex", gap: 8 }}>
          {SUBJECT_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setSubjectType(t)}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: subjectType === t ? "#FF6B00" : "#000000",
                color: subjectType === t ? "#000000" : "#FFFFFF",
                border: `1px solid ${subjectType === t ? "#FF6B00" : "#333"}`,
                cursor: "pointer",
                fontSize: 11,
                letterSpacing: 2,
                fontWeight: 900,
                textTransform: "uppercase",
                borderRadius: 2,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Adresse ou mint">
        <input
          type="text"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder="0xabc… / DezX…mint"
          style={inputStyle}
        />
      </Field>

      <Field label="Chaîne">
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value as MmChain)}
          style={inputStyle}
        >
          {CHAINS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Code d'accès beta">
        <input
          type="text"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          placeholder="beta-xxxx"
          style={inputStyle}
        />
      </Field>

      <Field label="Token API (optionnel)">
        <input
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="X-Api-Token"
          style={inputStyle}
          autoComplete="off"
        />
      </Field>

      <button
        type="submit"
        disabled={status.kind === "submitting"}
        style={{
          padding: "14px 18px",
          background: "#FF6B00",
          color: "#000000",
          border: "none",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 3,
          textTransform: "uppercase",
          cursor: status.kind === "submitting" ? "progress" : "pointer",
          opacity: status.kind === "submitting" ? 0.6 : 1,
          borderRadius: 2,
        }}
      >
        {status.kind === "submitting" ? "Envoi…" : "Scanner"}
      </button>

      {status.kind === "accepted" ? (
        <div
          role="status"
          style={{
            padding: 14,
            border: "1px solid #14532D",
            background: "rgba(34,197,94,0.08)",
            color: "#D1FAE5",
            fontSize: 13,
            lineHeight: 1.6,
            borderRadius: 2,
          }}
        >
          {status.message}
        </div>
      ) : null}
      {status.kind === "error" ? (
        <div
          role="alert"
          style={{
            padding: 14,
            border: "1px solid #7F1D1D",
            background: "rgba(239,68,68,0.08)",
            color: "#FCA5A5",
            fontSize: 13,
            lineHeight: 1.6,
            borderRadius: 2,
          }}
        >
          {status.message}
        </div>
      ) : null}
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  background: "#000000",
  color: "#FFFFFF",
  border: "1px solid #333",
  fontSize: 14,
  borderRadius: 2,
  width: "100%",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          color: "#999",
          letterSpacing: 2,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
