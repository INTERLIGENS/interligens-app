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
        <div className="text-white/60 text-sm">Loading…</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="w-full max-w-sm px-6">
        <div className="text-white text-xs tracking-[0.3em] mb-6 text-center">
          INTERLIGENS
        </div>
        <h2 className="text-white text-xl font-semibold mb-1">
          Your workspace is locked
        </h2>
        <p className="text-white/60 text-sm mb-6">
          Enter your passphrase to continue
        </p>
        <input
          ref={inputRef}
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy || !salt}
          className="w-full bg-black border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-[#FF6B00]"
          placeholder="Passphrase"
          autoComplete="current-password"
        />
        {error === "incorrect" && (
          <div className="text-red-500 text-xs mt-2">Incorrect passphrase</div>
        )}
        {error === "salt_fetch_failed" && (
          <div className="text-red-500 text-xs mt-2">
            Unable to reach workspace. Try refreshing.
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy || !salt || !passphrase}
          className="w-full mt-4 bg-[#FF6B00] text-white rounded py-2 font-medium disabled:opacity-50"
        >
          {busy ? "Unlocking your workspace…" : "Unlock workspace"}
        </button>
        <div className="text-xs text-gray-500 mt-6 leading-relaxed">
          No recovery option exists. This is the proof that we do not hold
          your key.
        </div>
      </div>
    </div>
  );
}
