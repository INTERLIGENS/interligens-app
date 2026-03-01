"use client";
import { useState } from "react";
import { buildCaseFileUrl, buildCaseFileFilename } from "@/lib/report/casefileUrl";

interface CaseFileCTAProps {
  id: string | null;
  lang: "en" | "fr";
}

const LABELS = {
  en: {
    open: "Open CaseFile (PDF)",
    download: "Download",
    generating: "Generating…",
    error: "PDF generation failed — please retry",
    detective: "Detective Referenced",
  },
  fr: {
    open: "Ouvrir le dossier (PDF)",
    download: "Télécharger",
    generating: "Génération…",
    error: "Échec de génération PDF — veuillez réessayer",
    detective: "Référencé détective",
  },
};

export default function CaseFileCTA({ id, lang }: CaseFileCTAProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = LABELS[lang];

  const handleDownload = async () => {
    if (!id) return;
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
    if (!id) return;
    const url = buildCaseFileUrl({ id, lang });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const disabled = !id || loading;

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
      <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest text-center">{t.detective}</p>
      {error && (
        <p className="text-[10px] text-red-400 font-bold text-center mt-1">{error}</p>
      )}
    </div>
  );
}
