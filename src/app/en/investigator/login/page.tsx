"use client";
import { useState } from "react";

const BG = "#0A0C10";
const AMBER = "#FFB800";

export default function InvestigatorLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/investigator/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Authentication failed");
        return;
      }
      window.location.href = "/en/investigator";
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 380,
          background: "#111318",
          border: "1px solid #1E2028",
          borderRadius: 8,
          padding: 32,
        }}
      >
        <div
          style={{
            color: AMBER,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.2em",
            fontFamily: "monospace",
            marginBottom: 8,
          }}
        >
          INTERLIGENS
        </div>
        <h1
          style={{
            color: "#F9FAFB",
            fontSize: 20,
            fontWeight: 700,
            margin: "0 0 24px",
          }}
        >
          Investigator Access
        </h1>

        <label
          style={{
            display: "block",
            color: "#6B7280",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            marginBottom: 6,
            fontFamily: "monospace",
          }}
        >
          TOKEN
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "#0A0C10",
            border: "1px solid #2A2D36",
            borderRadius: 4,
            color: "#F9FAFB",
            fontSize: 14,
            fontFamily: "monospace",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !token}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "10px 0",
            background: AMBER,
            color: "#0A0C10",
            border: "none",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.1em",
            cursor: loading ? "wait" : "pointer",
            opacity: loading || !token ? 0.5 : 1,
          }}
        >
          {loading ? "AUTHENTICATING..." : "ENTER DASHBOARD"}
        </button>
      </form>
    </div>
  );
}
