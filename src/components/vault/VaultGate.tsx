"use client";

import { useState, useEffect, useRef } from "react";
import { useVaultSession } from "@/hooks/useVaultSession";

type Props = { children: React.ReactNode };

export default function VaultGate({ children }: Props) {
  const { keys, isLoading, unlock } = useVaultSession();
  const [salt, setSalt] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (keys || isLoading) return;
    fetch("/api/investigators/workspace/salt")
      .then((r) => r.json())
      .then((d) => setSalt(d.kdfSalt ?? null))
      .catch(() => setError("salt_fetch_failed"));
  }, [keys, isLoading]);

  useEffect(() => {
    if (!keys && !isLoading) inputRef.current?.focus();
  }, [keys, isLoading]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-white/40 text-sm">Loading…</div>
      </div>
    );
  }

  if (keys) return <>{children}</>;

  async function submit() {
    if (!salt || !passphrase || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(passphrase, salt);
    } catch {
      setError("incorrect");
      setPassphrase("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full px-6" style={{ maxWidth: 360 }}>
        <div
          className="text-white text-center"
          style={{
            fontSize: 11,
            letterSpacing: "0.3em",
          }}
        >
          INTERLIGENS
        </div>
        <div
          style={{
            height: 1,
            backgroundColor: "#FF6B00",
            opacity: 0.4,
            marginTop: 16,
            marginBottom: 24,
            width: "100%",
          }}
        />
        <h2 className="text-white font-semibold" style={{ fontSize: 24 }}>
          Your workspace is sealed.
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 14,
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          Enter your passphrase to unlock.
        </p>
        <input
          ref={inputRef}
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy || !salt}
          placeholder="Passphrase"
          autoComplete="current-password"
          className="w-full text-white focus:outline-none"
          style={{
            backgroundColor: "#0d0d0d",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: "12px 14px",
            fontSize: 14,
          }}
          onFocus={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(255,107,0,0.6)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)")
          }
        />
        {error === "incorrect" && (
          <div
            style={{
              color: "#ff6b6b",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Passphrase incorrect. Try again.
          </div>
        )}
        {error === "salt_fetch_failed" && (
          <div
            style={{
              color: "#ff6b6b",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Unable to reach workspace. Try refreshing.
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy || !salt || !passphrase}
          className="w-full text-white font-medium disabled:opacity-50"
          style={{
            backgroundColor: "#FF6B00",
            height: 44,
            borderRadius: 6,
            marginTop: 16,
            fontSize: 14,
          }}
        >
          {busy ? "Deriving your key…" : "Unlock"}
        </button>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            marginTop: 32,
            lineHeight: 1.6,
          }}
        >
          No recovery exists. This is the proof that we do not hold your key.
        </div>
      </div>
    </div>
  );
}
