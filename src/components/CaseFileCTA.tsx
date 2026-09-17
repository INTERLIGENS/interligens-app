"use client";
import { useState } from "react";
import { buildCaseFileUrl, buildCaseFileFilename } from "@/lib/report/casefileUrl";

interface CaseFileCTAProps {
  id: string | null;
  lang: "en" | "fr";
  /**
   * L'artefact est-il RÉELLEMENT délivrable à CE visiteur, selon l'autorité
   * courante ?
   *
   * ⛔ AUCUN DÉFAUT PERMISSIF. Un composant qui supposerait « disponible »
   *    promettrait une livraison que personne n'a vérifiée — c'est exactement
   *    le défaut que CC-OFFLINE-280 ferme. L'appelant DOIT se prononcer.
   */
  available: boolean;
}

const LABELS = {
  en: {
    open: "Open CaseFile (PDF)",
    download: "Download",
    generating: "Generating…",
    error: "PDF generation failed — please retry",
    unavailable: "No public case file is available for this address.",
  },
  fr: {
    open: "Ouvrir le dossier (PDF)",
    download: "Télécharger",
    generating: "Génération…",
    error: "Échec de génération PDF — veuillez réessayer",
    unavailable: "Aucun dossier public n'est disponible pour cette adresse.",
  },
};

export default function CaseFileCTA({ id, lang, available }: CaseFileCTAProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = LABELS[lang];

  const handleDownload = async () => {
    if (!id || !available) return;
    setLoading(true);
    setError(null);
    try {
      const url = buildCaseFileUrl({ id, lang });
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = buildCaseFileFilename(id);
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (e: any) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!id || !available) return;
    const url = buildCaseFileUrl({ id, lang });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ── CC-OFFLINE-280 — UN CONTRÔLE ACTIF EST UNE PROMESSE DE LIVRAISON ──
  //
  // Mesuré en anonyme sur le runtime servi : `/api/casefile/public` rend 401
  // NOMINATIVE_ACCESS_REQUIRED. `handleOpen` ouvrait donc un onglet sur une
  // erreur JSON, et `handleDownload` affichait « PDF generation failed » — un
  // DIAGNOSTIC FAUX : rien n'avait échoué à se générer, le visiteur n'avait
  // jamais été autorisé.
  //
  // Sous l'autorité courante, `no_public_casefile` est un REFUS ATTENDU. Le
  // contrôle DIT ce refus au lieu de le déguiser en panne — et il reste
  // VISIBLE, désactivé, plutôt que de disparaître en silence.
  const disabled = !id || loading || !available;

  return (
    <div className="w-full mt-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={handleOpen}
          disabled={disabled}
          className="flex-1 py-4 rounded-xl border border-dashed border-[#EF4444]/40 text-[10px] font-black uppercase tracking-[0.2em] text-[#EF4444] hover:text-white hover:border-[#EF4444] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? t.generating : t.open}
        </button>
        <button
          onClick={handleDownload}
          disabled={disabled}
          className="px-4 py-4 rounded-xl border border-dashed border-[#EF4444]/20 text-[10px] font-black uppercase tracking-[0.2em] text-[#EF4444]/60 hover:text-white hover:border-[#EF4444] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t.download}
        </button>
      </div>
      {/* ── L'ASSERTION INCONDITIONNELLE A DISPARU ────────────────────────
          « DETECTIVE REFERENCED » s'affichait sous TOUS les dossiers, quelle
          que soit l'autorité — une affirmation statique que rien ne soutenait.
          Ce qui la remplace n'est pas une autre affirmation : c'est l'état de
          délivrance, RENDU seulement quand il est vrai, et dérivé de
          l'autorité que l'appelant a mesurée.
          ⛔ Le renderer n'invente aucune raison : il n'en connaît qu'une, et
          elle lui est DONNÉE. */}
      {!available && (
        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center">
          {t.unavailable}
        </p>
      )}
      {error && (
        <p className="text-[10px] text-red-400 font-bold text-center mt-1">{error}</p>
      )}
    </div>
  );
}
