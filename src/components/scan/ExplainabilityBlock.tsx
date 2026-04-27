// Renders TigerScore driver badges — which signals contributed to the risk score.
"use client";

interface ExplainabilityBlockProps {
  drivers: Array<string | unknown>;
  lang: "en" | "fr";
}

const DRIVER_LABELS: Record<string, { en: string; fr: string }> = {
  pump_fun:         { en: "PumpFun deploy", fr: "Déploiement PumpFun" },
  rug_history:      { en: "Rug history", fr: "Historique de rug" },
  bundled_launch:   { en: "Bundled launch", fr: "Lancement bundlé" },
  insider_wallets:  { en: "Insider wallets", fr: "Wallets insiders" },
  cex_deposit:      { en: "CEX deposit detected", fr: "Dépôt CEX détecté" },
  ofac_match:       { en: "OFAC match", fr: "Match OFAC" },
  shill_to_exit:    { en: "Shill-to-exit", fr: "Shill-to-exit" },
  low_liquidity:    { en: "Low liquidity", fr: "Liquidité faible" },
  honeypot:         { en: "Honeypot", fr: "Honeypot" },
  high_tax:         { en: "High tax", fr: "Taxe élevée" },
  mint_authority:   { en: "Mint authority live", fr: "Mint authority active" },
  freeze_authority: { en: "Freeze authority live", fr: "Freeze authority active" },
};

export default function ExplainabilityBlock({ drivers, lang }: ExplainabilityBlockProps) {
  if (!drivers || drivers.length === 0) return null;

  const label = lang === "fr" ? "Signaux détectés" : "Risk drivers";

  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-widest font-black text-[#FF6B00] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {drivers.map((d, i) => {
          const key = typeof d === "string" ? d : "";
          const display = DRIVER_LABELS[key]?.[lang] ?? key.replace(/_/g, " ").toUpperCase();
          return (
            <span
              key={i}
              className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-[#FF6B00]/40 text-[#FF6B00] bg-[#FF6B00]/5"
            >
              {display}
            </span>
          );
        })}

function Disclaimer({ locale }: { locale: "fr" | "en" }) {
  const txt =
    locale === "fr"
      ? "Analyse éditoriale et algorithmique. Ne constitue pas un conseil juridique, financier ou fiscal. Le statut gouverné est appliqué séparément du score numérique."
      : "Editorial and algorithmic analysis. Not legal, financial or tax advice. A governed status is applied separately from the numeric score.";
  return (
    <div
      data-testid="explain-disclaimer"
      style={{
        marginTop: 14,
        padding: "10px 14px",
        color: "#666",
        fontSize: 11,
        lineHeight: 1.6,
        letterSpacing: 0.3,
      }}
    >
      {txt}
    </div>
  );
}

const LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  fontWeight: 900,
  textTransform: "uppercase",
  color: "#FF6B00",
  marginBottom: 6,
};

const TEXT: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#CCCCCC",
};
