"use client";

import { useState, useEffect, useRef } from "react";
import { useVaultSession } from "@/hooks/useVaultSession";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Props = { children: React.ReactNode };

export default function VaultGate({ children }: Props) {
  const { keys, isLoading, unlock } = useVaultSession();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [salt, setSalt] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (keys || isLoading) return;
    // Admin founder bypass — never fetch the salt, never redirect to the
    // investigator onboarding flow. Children render without keys; any
    // encrypted content shows a "locked" placeholder instead of being
    // decrypted (the admin doesn't own the per-investigator keys).
    if (adminLoading || isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/investigators/workspace/salt");
        if (res.status === 401) {
          // No VaultWorkspace yet — send the user to the onboarding flow
          // so they can mint their passphrase and KDF salt. Stays in-session.
          if (typeof window !== "undefined") {
            window.location.replace("/investigators/box/onboarding");
          }
          return;
        }
        if (!res.ok) {
          setError("salt_fetch_failed");
          return;
        }
        const d = await res.json();
        setSalt(d.kdfSalt ?? null);
        if (!d.kdfSalt) setError("salt_fetch_failed");
      } catch {
        setError("salt_fetch_failed");
      }
    })();
  }, [keys, isLoading, isAdmin, adminLoading]);

  useEffect(() => {
    if (!keys && !isLoading && !isAdmin && !adminLoading) {
      inputRef.current?.focus();
    }
  }, [keys, isLoading, isAdmin, adminLoading]);

  if (isLoading || adminLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-white/40 text-sm">Loading…</div>
      </div>
    );
  }

  // Admin founder — render the workspace chrome without requiring keys.
  // Encrypted content downstream must render a locked placeholder.
  if (isAdmin) return <>{children}</>;

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
          {busy ? "Deriving passphrase…" : "Unlock"}
        </button>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            marginTop: 32,
            lineHeight: 1.6,
          }}
        >
          No recovery exists. This is the proof that we do not hold your passphrase.
        </div>
      </div>
    </div>
  );
}
