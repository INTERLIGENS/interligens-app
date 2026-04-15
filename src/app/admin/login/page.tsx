// src/app/admin/login/page.tsx
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.55)";
const LINE = "rgba(255,255,255,0.1)";
const SURFACE = "#0a0a0a";

function AdminLoginInner() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/admin/intel-vault";

  async function handleSubmit() {
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password: password.trim() }),
      });
      if (!res.ok) {
        setError("Password invalide.");
        return;
      }
      router.push(redirect);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${LINE}`,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.25em",
            fontFamily: "monospace",
            color: ACCENT,
            marginBottom: 10,
          }}
        >
          INTERLIGENS · ADMIN
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            marginBottom: 8,
          }}
        >
          Admin Access
        </h1>
        <p
          style={{
            fontSize: 12,
            color: DIM,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          Enter the admin password to unlock this zone. Your session stays
          active for 8 hours.
        </p>

        <label
          style={{
            display: "block",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
            fontFamily: "monospace",
            marginBottom: 8,
          }}
        >
          Password
        </label>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="••••••••"
          style={{
            width: "100%",
            background: "#0d0d0d",
            border: `1px solid ${LINE}`,
            color: TEXT,
            padding: "12px 14px",
            fontSize: 14,
            fontFamily: "monospace",
            outline: "none",
            borderRadius: 2,
            marginBottom: 16,
          }}
        />
        {error && (
          <div
            style={{
              color: "#FF3B5C",
              fontSize: 12,
              fontFamily: "monospace",
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !password.trim()}
          style={{
            width: "100%",
            padding: "14px 0",
            background: ACCENT,
            color: BG,
            border: "none",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.18em",
            fontFamily: "monospace",
            textTransform: "uppercase",
            cursor: loading || !password.trim() ? "not-allowed" : "pointer",
            opacity: loading || !password.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "Verifying…" : "Sign In"}
        </button>
      </div>
    </main>
  );
}

export default function AdminLogin() {
  return (
    <Suspense>
      <AdminLoginInner />
    </Suspense>
  );
}
