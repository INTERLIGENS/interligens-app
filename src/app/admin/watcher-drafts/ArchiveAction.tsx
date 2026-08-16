"use client";

/**
 * P0-2 / Phase 1 — DÉPUBLICATION d'un lien publié, depuis l'UI admin.
 *
 * La route POST .../archive existait déjà ; elle n'était atteignable qu'en
 * curl. Un chemin de dépublication utilisable seulement en ligne de commande
 * n'est pas une procédure de contestation.
 *
 * Ce composant n'est PAS la sécurité. Toutes les règles ci-dessous sont
 * re-vérifiées côté serveur (archiveLinkPublication.ts) et testées comme telles
 * dans __tests__/security/archive-route-guards.test.ts : un opérateur qui
 * contourne l'UI se fait refuser exactement pareil. Ce que le composant ajoute,
 * c'est de rendre l'erreur impossible par inadvertance.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCENT = "#FF6B00";
const DANGER = "#FF3B5C";
const DIM = "#8A8A8A";
const LINE = "#222222";

/**
 * Les 6 motifs de DÉPUBLICATION. `approved` et `rejected` existent dans le
 * journal mais sont des codes de MISE EN LIGNE : les proposer ici permettrait
 * de consigner « approuvé » sur un retrait, ce qui rendrait le registre
 * illisible. Le serveur les refuse aussi (ARCHIVE_REASON_CODES).
 */
const REASON_CODES: Array<{ code: string; label: string }> = [
  { code: "contested", label: "contested — contestation reçue et honorée" },
  { code: "erratum", label: "erratum — erreur factuelle constatée en interne" },
  { code: "evidence_withdrawn", label: "evidence_withdrawn — la preuve ne tient plus" },
  { code: "legal", label: "legal — demande légale / mise en demeure" },
  { code: "duplicate", label: "duplicate — doublon d'un autre lien publié" },
  { code: "other", label: "other — autre (motif libre obligatoire)" },
];

const btn: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 9px",
  borderRadius: 4,
  cursor: "pointer",
  background: "transparent",
  whiteSpace: "nowrap",
};

const field: React.CSSProperties = {
  width: "100%",
  background: "#000",
  color: "#FFF",
  border: `1px solid ${LINE}`,
  borderRadius: 4,
  fontSize: 12,
  padding: "5px 7px",
  fontFamily: "inherit",
};

export default function ArchiveAction({
  linkId,
  visibility,
  kolHandle,
  tokenSymbol,
}: {
  linkId: string;
  visibility: string;
  kolHandle: string;
  tokenSymbol: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");
  const [contestationRef, setContestationRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Le bouton n'existe QUE sur un lien public. `archived` est terminal, un
  // draft se rejette, un rejected l'est déjà.
  if (visibility !== "public") return null;

  const reasonTrimmed = reason.trim();
  const codeValid = REASON_CODES.some((r) => r.code === reasonCode);
  const ready = codeValid && reasonTrimmed.length > 0;

  function reset() {
    setOpen(false);
    setConfirming(false);
    setReasonCode("");
    setReason("");
    setContestationRef("");
    setMsg(null);
  }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/watcher-drafts/${linkId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reasonTrimmed,
          reasonCode,
          // Chaîne vide → on n'envoie rien plutôt qu'une référence creuse.
          contestationRef: contestationRef.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        reset();
        router.refresh();
      } else {
        setMsg(j?.reason ?? j?.action ?? j?.error ?? `error ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...btn, border: `1px solid ${DANGER}`, color: DANGER }}
        title="Dépublier ce lien — motif obligatoire, décision consignée"
      >
        Archive (unpublish)
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 300, border: `1px solid ${DANGER}`, borderRadius: 5, padding: 9 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: DANGER, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Dépublier {kolHandle}
        {tokenSymbol ? ` · $${tokenSymbol}` : ""}
      </div>

      <label style={{ fontSize: 10, color: DIM }}>Motif codé (obligatoire)</label>
      <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} style={field}>
        <option value="">— choisir un motif —</option>
        {REASON_CODES.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>

      <label style={{ fontSize: 10, color: DIM }}>Motif libre (obligatoire, non vide)</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Ce texte est consigné au registre et restera lisible après la disparition du lien."
        style={{ ...field, resize: "vertical" }}
      />

      <label style={{ fontSize: 10, color: DIM }}>Référence de contestation (optionnel)</label>
      <input
        value={contestationRef}
        onChange={(e) => setContestationRef(e.target.value)}
        placeholder="CONTEST-2026-001"
        style={field}
      />

      {!confirming ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setConfirming(true)}
            disabled={!ready}
            style={{ ...btn, border: `1px solid ${ready ? DANGER : DIM}`, color: ready ? DANGER : DIM, cursor: ready ? "pointer" : "not-allowed", opacity: ready ? 1 : 0.5 }}
          >
            Continuer
          </button>
          <button onClick={reset} style={{ ...btn, border: `1px solid ${DIM}`, color: DIM }}>
            Annuler
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: DANGER, lineHeight: 1.45 }}>
            Action <strong>définitive dans l&apos;autre sens</strong> : il n&apos;existe aucun chemin
            <code style={{ margin: "0 4px" }}>archived → public</code>. Le lien disparaîtra de
            l&apos;Explorer, du cluster, de la watchlist, du leaderboard et de PRE-BUY GUARD.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={submit}
              disabled={busy}
              style={{ ...btn, border: `1px solid ${DANGER}`, background: DANGER, color: "#000", opacity: busy ? 0.5 : 1 }}
            >
              {busy ? "Archivage…" : "Confirmer la dépublication"}
            </button>
            <button onClick={() => setConfirming(false)} style={{ ...btn, border: `1px solid ${DIM}`, color: DIM }}>
              Retour
            </button>
          </div>
        </>
      )}

      {msg && <span style={{ color: DANGER, fontSize: 10 }}>refus serveur : {msg}</span>}
      <span style={{ color: DIM, fontSize: 9.5, lineHeight: 1.4 }}>
        Le serveur revérifie motif, code et état du lien. Cet écran ne fait que rendre l&apos;erreur
        moins probable — <span style={{ color: ACCENT }}>il ne l&apos;empêche pas</span>.
      </span>
    </div>
  );
}
