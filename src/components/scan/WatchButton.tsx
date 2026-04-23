"use client";
// src/components/scan/WatchButton.tsx

import React, { useState } from "react";

interface Props {
  mint: string;
  chain: string;
  symbol?: string;
  lang: "en" | "fr";
}

type Phase = "idle" | "open" | "submitting" | "done" | "error";

export default function WatchButton({ mint, chain, symbol, lang }: Props) {
  const [phase, setPhase]   = useState<Phase>("idle");
  const [email, setEmail]   = useState("");
  const [errMsg, setErrMsg] = useState("");

  const isFr = lang === "fr";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setErrMsg(isFr ? "Email invalide" : "Invalid email"); return; }
    setPhase("submitting");
    try {
      const res = await fetch("/api/v1/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mint, chain, symbol }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPhase("done");
    } catch {
      setPhase("error");
      setErrMsg(isFr ? "Erreur réseau. Réessaie." : "Network error. Try again.");
    }
  }

  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 py-2" style={{ fontSize: 10, color: "#34d399", fontFamily: "monospace" }}>
        <span>■</span>
        <span className="uppercase tracking-widest font-black">
          {isFr ? "SURVEILLANCE ACTIVE ✓" : "WATCHING ✓"}
        </span>
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <button
        onClick={() => setPhase("open")}
        className="mt-2 border px-3 py-1 uppercase tracking-widest text-[10px] font-black"
        style={{ borderColor: "#FF6B00", color: "#FF6B00", background: "transparent", cursor: "pointer" }}
      >
        {isFr ? "SURVEILLER CE TOKEN" : "WATCH THIS TOKEN"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-2" style={{ maxWidth: 320 }}>
      <input
        type="email"
        autoFocus
        value={email}
        onChange={(e) => { setEmail(e.target.value); setErrMsg(""); }}
        placeholder={isFr ? "ton@email.com" : "your@email.com"}
        disabled={phase === "submitting"}
        className="bg-transparent border px-2 py-1 text-[11px] text-white"
        style={{ borderColor: "#FF6B00", fontFamily: "monospace", outline: "none" }}
      />
      {errMsg && <span style={{ fontSize: 10, color: "#FF3B5C", fontFamily: "monospace" }}>{errMsg}</span>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={phase === "submitting"}
          className="border px-3 py-1 uppercase tracking-widest text-[10px] font-black"
          style={{ borderColor: "#FF6B00", color: "#FF6B00", background: "transparent", cursor: "pointer" }}
        >
          {phase === "submitting" ? "…" : (isFr ? "CONFIRMER" : "CONFIRM")}
        </button>
        <button
          type="button"
          onClick={() => { setPhase("idle"); setEmail(""); setErrMsg(""); }}
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "#6b7280", background: "transparent", border: "none", cursor: "pointer" }}
        >
          {isFr ? "ANNULER" : "CANCEL"}
        </button>
      </div>
    </form>
  );
}
