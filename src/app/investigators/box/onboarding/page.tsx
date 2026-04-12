"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  deriveKeys,
  hashNdaDocument,
  randomSaltHex,
} from "@/lib/vault/crypto.client";
import { setVaultSession } from "@/lib/vault/session.client";

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1 — NDA
  const [ndaText, setNdaText] = useState<string>("");
  const [signerName, setSignerName] = useState("");
  const [ndaAccepted, setNdaAccepted] = useState(false);

  // Step 2 — Profile
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "SEMI_PUBLIC" | "PUBLIC">("PRIVATE");
  const [specialtiesInput, setSpecialtiesInput] = useState("");

  // Step 3 — Key
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understoodLoss, setUnderstoodLoss] = useState(false);

  useEffect(() => {
    // Check whether a workspace already exists → short-circuit
    fetch("/api/investigators/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d?.profile) router.replace("/investigators/box");
      })
      .catch(() => {});
    fetch("/legal/investigator-nda-v1.md")
      .then((r) => r.text())
      .then(setNdaText)
      .catch(() => setNdaText("NDA text unavailable. Refresh to retry."));
  }, [router]);

  async function submitNda() {
    setError(null);
    if (!ndaAccepted) return setError("must_accept_nda");
    if (!signerName.trim()) return setError("signer_required");
    if (!ndaText) return setError("nda_not_loaded");
    setLoading(true);
    try {
      const ndaDocHash = await hashNdaDocument(ndaText);
      const res = await fetch("/api/investigators/onboarding/nda", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signerName,
          ndaVersion: "v1.0",
          ndaDocHash,
          accepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "nda_failed");
        return;
      }
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function submitProfile() {
    setError(null);
    if (!/^[a-z0-9-]{2,30}$/.test(handle)) return setError("bad_handle");
    setStep(3);
  }

  async function submitKey() {
    setError(null);
    if (passphrase.length < 12) return setError("passphrase_too_short");
    if (passphrase !== confirm) return setError("passphrase_mismatch");
    if (!understoodLoss) return setError("must_acknowledge");
    setLoading(true);
    try {
      const kdfSalt = randomSaltHex();
      const keys = await deriveKeys(passphrase, kdfSalt);
      await setVaultSession(keys);

      const specialties = specialtiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/investigators/onboarding/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle,
          displayName,
          bio,
          specialties,
          visibility,
          kdfSalt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "workspace_failed");
        return;
      }
      setStep(4);
    } catch {
      setError("key_derivation_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-xs tracking-[0.3em] text-white/50 mb-2">
          INTERLIGENS INVESTIGATORS
        </div>
        <h1 className="text-3xl font-semibold mb-1">Workspace onboarding</h1>
        <div className="text-white/50 text-sm mb-8">Step {step} of 4</div>

        {error && (
          <div className="mb-4 text-red-500 text-sm">Error: {error}</div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">
              Mutual Non-Disclosure Agreement
            </h2>
            <pre className="whitespace-pre-wrap bg-black border border-white/10 rounded p-4 text-xs text-white/80 max-h-96 overflow-y-auto">
              {ndaText || "Loading…"}
            </pre>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Full legal name"
              className="mt-4 w-full bg-black border border-white/20 rounded px-3 py-2 focus:outline-none focus:border-[#FF6B00]"
            />
            <label className="flex items-start gap-2 mt-4 text-sm text-white/80">
              <input
                type="checkbox"
                checked={ndaAccepted}
                onChange={(e) => setNdaAccepted(e.target.checked)}
                className="mt-1"
              />
              <span>
                I have read and accept the Mutual Non-Disclosure Agreement
              </span>
            </label>
            <button
              onClick={submitNda}
              disabled={loading}
              className="mt-6 bg-[#FF6B00] text-white px-5 py-2 rounded font-medium disabled:opacity-50"
            >
              {loading ? "Signing…" : "Accept and continue"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Your profile</h2>
            <label className="block text-sm text-white/60 mb-1">Handle</label>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              placeholder="e.g. gordon-gekko"
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-4"
            />
            <label className="block text-sm text-white/60 mb-1">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-4"
            />
            <label className="block text-sm text-white/60 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-4"
            />
            <label className="block text-sm text-white/60 mb-1">
              Specialties (comma-separated)
            </label>
            <input
              value={specialtiesInput}
              onChange={(e) => setSpecialtiesInput(e.target.value)}
              placeholder="rug pull, sanctions, launder"
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-4"
            />
            <label className="block text-sm text-white/60 mb-1">Visibility</label>
            <div className="flex gap-2 mb-6">
              {(["PRIVATE", "SEMI_PUBLIC", "PUBLIC"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`px-3 py-1 rounded border text-xs ${
                    visibility === v
                      ? "border-[#FF6B00] text-[#FF6B00]"
                      : "border-white/20 text-white/70"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              onClick={submitProfile}
              className="bg-[#FF6B00] text-white px-5 py-2 rounded font-medium"
            >
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Create your key</h2>
            <div className="border border-[#FF6B00] rounded p-4 mb-6 text-sm text-white/80 leading-relaxed">
              Titles, filenames, tags, notes, and raw contents are encrypted
              before they reach our servers. We receive only opaque encrypted
              data. We cannot read your work. If you lose your passphrase,
              your data is permanently inaccessible. We cannot recover it — we
              do not hold your key.
            </div>
            <label className="block text-sm text-white/60 mb-1">
              Passphrase (min 12 characters)
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-4"
            />
            <label className="block text-sm text-white/60 mb-1">
              Confirm passphrase
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-black border border-white/20 rounded px-3 py-2 mb-4"
            />
            <label className="flex items-start gap-2 text-sm text-white/80 mb-6">
              <input
                type="checkbox"
                checked={understoodLoss}
                onChange={(e) => setUnderstoodLoss(e.target.checked)}
                className="mt-1"
              />
              <span>
                I understand that passphrase loss means permanent data loss
              </span>
            </label>
            <button
              onClick={submitKey}
              disabled={loading}
              className="bg-[#FF6B00] text-white px-5 py-2 rounded font-medium disabled:opacity-50"
            >
              {loading ? "Generating your key…" : "Generate my key"}
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">
              Your Investigator Box is ready
            </h2>
            <p className="text-white/60 mb-8">
              Your workspace is sealed with a key only you hold. Create your
              first case to get started.
            </p>
            <button
              onClick={() => router.push("/investigators/box")}
              className="bg-[#FF6B00] text-white px-5 py-2 rounded font-medium"
            >
              Enter my workspace
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
