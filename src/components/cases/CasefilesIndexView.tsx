// Casefile library index — card grid of published casefiles.
// Server-renderable (no hooks). Shared by /en/cases and /fr/cases.
import BetaNav from "@/components/beta/BetaNav";

export interface CasefileCard {
  codename: string;
  title: string;
  family: "platform_fraud" | "token_casefile";
  score: number | null;        // platformRiskScore (platform casefiles)
  severityTier: string | null; // severity label (token casefiles)
  chains: string[];
  date: string | null;
  href: string;
}

type Locale = "en" | "fr";

const T: Record<Locale, Record<string, string>> = {
  en: {
    kicker: "CASEFILE LIBRARY",
    title: "Casefiles",
    intro: "Documented fraud casefiles — token rug-pulls and platform-level fraud networks. Each casefile is grounded in on-chain evidence.",
    platform_fraud: "Platform Fraud",
    token_casefile: "Token Casefile",
    empty: "No casefiles published yet.",
  },
  fr: {
    kicker: "BIBLIOTHÈQUE DE DOSSIERS",
    title: "Dossiers",
    intro: "Dossiers de fraude documentés — rug-pulls de tokens et réseaux de fraude au niveau plateforme. Chaque dossier repose sur des preuves on-chain.",
    platform_fraud: "Fraude plateforme",
    token_casefile: "Dossier token",
    empty: "Aucun dossier publié pour l'instant.",
  },
};

const FAMILY_COLOR: Record<string, string> = {
  platform_fraud: "#FF6B00",
  token_casefile: "#8b5cf6",
};

function scoreColor(n: number): string {
  return n >= 70 ? "#FF3B5C" : n >= 40 ? "#FFB800" : "#00FF94";
}

function CasefileCardItem({ c, locale }: { c: CasefileCard; locale: Locale }) {
  const t = T[locale];
  const accent = FAMILY_COLOR[c.family] ?? "#6b7280";
  return (
    <a
      href={c.href}
      style={{
        display: "flex", flexDirection: "column", gap: 10,
        background: "#0f0f0f", border: "1px solid #1f2937",
        borderRadius: 10, padding: "20px 22px", textDecoration: "none",
        borderTop: `2px solid ${accent}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", color: accent, background: accent + "15", border: `1px solid ${accent}44`, padding: "3px 8px", borderRadius: 4 }}>
          {t[c.family].toUpperCase()}
        </span>
        {c.score != null ? (
          <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", color: scoreColor(c.score) }}>
            {c.score}<span style={{ fontSize: 9, color: "#4b5563" }}>/100</span>
          </span>
        ) : c.severityTier ? (
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: "#FF3B5C" }}>{c.severityTier}</span>
        ) : null}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em" }}>{c.codename}</div>
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.55, flex: 1 }}>{c.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
          {c.chains.join(" · ")}{c.date ? "  ·  " + c.date : ""}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent }}>→</span>
      </div>
    </a>
  );
}

export default function CasefilesIndexView({ items, locale }: { items: CasefileCard[]; locale: Locale }) {
  const t = T[locale];
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "56px 24px" }}>
        <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>{t.kicker}</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
          {t.title}<span style={{ color: "#FF6B00" }}>.</span>
        </h1>
        <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7, margin: "10px 0 36px", maxWidth: 620 }}>{t.intro}</p>

        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>{t.empty}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {items.map((c) => <CasefileCardItem key={c.href} c={c} locale={locale} />)}
          </div>
        )}
      </div>
    </div>
  );
}
