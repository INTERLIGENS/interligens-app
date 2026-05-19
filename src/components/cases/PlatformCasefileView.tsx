// Presentational view for a Platform Fraud casefile (platform_casefiles row).
// Server-renderable (no hooks). Shared by /en/cases/cbex and /fr/cases/cbex.
import BetaNav from "@/components/beta/BetaNav";

export interface PlatformCasefileData {
  ref: string;
  codename: string;
  title: string;
  family: string;
  subtype: string;
  platformRiskScore: number;
  status: string;
  chains: string[];
  geography: string[];
  confirmedLossUsd: number | null;
  currency: string;
  publishedDate: string | null;
  sourceInvestigator: string | null;
  sourceThreadUrl: string | null;
  specterCollab: boolean;
  keyWallets: string[];
  linkedEntities: string[];
  exitExchanges: string[];
  activeSuccessor: boolean;
  successorWallet: string | null;
  summary: string | null;
  summaryFr: string | null;
  bodyMarkdown: string | null;
}

type Locale = "en" | "fr";

const T: Record<Locale, Record<string, string>> = {
  en: {
    kicker: "PLATFORM FRAUD CASEFILE", family: "Family", subtype: "Sub-type",
    score: "PlatformRisk Score", status: "Status", loss: "Confirmed loss",
    chains: "Chains", geography: "Geography", keyWallets: "Key wallets",
    linkedEntities: "Linked entities", exitExchanges: "Cash-out exchanges",
    successor: "Active successor infrastructure", successorWallet: "Successor wallet",
    source: "Investigation source", published: "Published",
    bodyPending: "Full dossier body pending — drop IL-PON-CBEX-001_v2.0_FINAL.md into investigations/ and re-run the seed.",
    disclaimer: "Documented critical risk. Architecture, not recipe. Not legal advice, not a judicial finding.",
    yes: "YES",
  },
  fr: {
    kicker: "DOSSIER FRAUDE PLATEFORME", family: "Famille", subtype: "Sous-type",
    score: "Score PlatformRisk", status: "Statut", loss: "Perte confirmée",
    chains: "Chaînes", geography: "Géographie", keyWallets: "Wallets clés",
    linkedEntities: "Entités liées", exitExchanges: "Exchanges de cash-out",
    successor: "Infrastructure successeur active", successorWallet: "Wallet successeur",
    source: "Source de l'investigation", published: "Publié",
    bodyPending: "Corps du dossier en attente — déposez IL-PON-CBEX-001_v2.0_FINAL.md dans investigations/ et relancez le seed.",
    disclaimer: "Risque critique documenté. Architecture, pas recette. Ne constitue pas un conseil juridique ni une décision judiciaire.",
    yes: "OUI",
  },
};

const FAMILY_LABEL: Record<string, { en: string; fr: string }> = {
  platform_fraud: { en: "Platform Fraud", fr: "Fraude plateforme" },
};
const SUBTYPE_LABEL: Record<string, { en: string; fr: string }> = {
  ponzi_network: { en: "Ponzi Network", fr: "Réseau Ponzi" },
};

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("en-US");
}

// Minimal markdown renderer — headings, bold, bullets, hr, fenced code,
// paragraphs. Table/other lines fall through as plain text. No deps.
function renderMarkdown(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = md.split(/\r?\n/);
  let para: string[] = [];
  let bullets: string[] = [];
  let code: string[] | null = null;
  let key = 0;

  const inline = (s: string): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: "#f9fafb" }}>{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>,
    );
  };
  const flushPara = () => {
    if (para.length) {
      out.push(<p key={key++} style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75, margin: "0 0 12px" }}>{inline(para.join(" "))}</p>);
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={key++} style={{ margin: "0 0 12px", paddingLeft: 20 }}>
          {bullets.map((b, i) => <li key={i} style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7 }}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().startsWith("```")) {
      if (code === null) { flushPara(); flushBullets(); code = []; }
      else {
        out.push(<pre key={key++} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "14px 16px", fontSize: 11, color: "#d1d5db", overflowX: "auto", margin: "0 0 12px" }}>{code.join("\n")}</pre>);
        code = null;
      }
      continue;
    }
    if (code !== null) { code.push(raw); continue; }

    if (/^#{1,3}\s/.test(line)) {
      flushPara(); flushBullets();
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s/, "");
      const size = level === 1 ? 22 : level === 2 ? 17 : 14;
      out.push(<div key={key++} style={{ fontSize: size, fontWeight: 900, color: "#f9fafb", letterSpacing: "-0.01em", margin: level === 1 ? "8px 0 12px" : "20px 0 8px" }}>{text}</div>);
    } else if (/^[-*]\s/.test(line)) {
      flushPara();
      bullets.push(line.replace(/^[-*]\s/, ""));
    } else if (/^(-{3,}|_{3,})$/.test(line.trim())) {
      flushPara(); flushBullets();
      out.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid #1a1a1a", margin: "20px 0" }} />);
    } else if (line.trim() === "") {
      flushPara(); flushBullets();
    } else {
      flushBullets();
      para.push(line);
    }
  }
  flushPara(); flushBullets();
  if (code) out.push(<pre key={key++} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "14px 16px", fontSize: 11, color: "#d1d5db", overflowX: "auto" }}>{code.join("\n")}</pre>);
  return out;
}

function Pill({ children, color = "#6b7280" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ background: color + "15", border: "1px solid " + color + "44", color, fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 5, letterSpacing: "0.04em", display: "inline-block" }}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>
    </div>
  );
}

export default function PlatformCasefileView({ data, locale }: { data: PlatformCasefileData; locale: Locale }) {
  const t = T[locale];
  const fam = FAMILY_LABEL[data.family]?.[locale] ?? data.family;
  const sub = SUBTYPE_LABEL[data.subtype]?.[locale] ?? data.subtype;
  const summary = locale === "fr" ? (data.summaryFr ?? data.summary) : data.summary;
  const scoreColor = data.platformRiskScore >= 70 ? "#FF3B5C" : data.platformRiskScore >= 40 ? "#FFB800" : "#00FF94";

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>

        {/* HEADER */}
        <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>{t.kicker}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>{data.codename}</h1>
          <span style={{ fontSize: 12, color: "#4b5563", fontFamily: "monospace" }}>{data.ref}</span>
        </div>
        <div style={{ fontSize: 16, color: "#d1d5db", marginTop: 6, fontWeight: 600 }}>{data.title}</div>

        {/* SCORE + STATUS */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "24px 0 8px" }}>
          <div style={{ background: "#0f0f0f", border: `1px solid ${scoreColor}55`, borderRadius: 10, padding: "16px 22px", minWidth: 160 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 6 }}>{t.score.toUpperCase()}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: scoreColor, fontFamily: "monospace" }}>{data.platformRiskScore}<span style={{ fontSize: 14, color: "#4b5563" }}>/100</span></div>
          </div>
          <div style={{ background: "#0f0f0f", border: "1px solid #FF3B5C55", borderRadius: 10, padding: "16px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 8 }}>{t.status.toUpperCase()}</div>
            <span style={{ background: "#FF3B5C18", border: "1px solid #FF3B5C", color: "#FF3B5C", fontSize: 11, fontWeight: 900, padding: "6px 12px", borderRadius: 6, letterSpacing: "0.08em" }}>
              {data.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {summary && (
          <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.75, margin: "20px 0 28px" }}>{summary}</p>
        )}

        {/* STRUCTURED FIELDS */}
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            <Field label={t.family}><Pill color="#FF6B00">{fam}</Pill></Field>
            <Field label={t.subtype}><Pill color="#8b5cf6">{sub}</Pill></Field>
            <Field label={t.loss}><span style={{ fontSize: 18, fontWeight: 900, color: "#FF3B5C", fontFamily: "monospace" }}>{fmtUsd(data.confirmedLossUsd)}</span></Field>
            <Field label={t.published}><span style={{ fontSize: 13, color: "#d1d5db" }}>{data.publishedDate ?? "—"}</span></Field>
          </div>
          <Field label={t.chains}>{data.chains.map((c) => <Pill key={c} color="#3b82f6">{c}</Pill>)}</Field>
          <Field label={t.geography}>{data.geography.map((g) => <Pill key={g}>{g}</Pill>)}</Field>
          <Field label={t.linkedEntities}>{data.linkedEntities.map((e) => <Pill key={e} color="#FFB800">{e}</Pill>)}</Field>
          <Field label={t.exitExchanges}>{data.exitExchanges.map((e) => <Pill key={e} color="#FF3B5C">{e}</Pill>)}</Field>
          <Field label={t.keyWallets}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {data.keyWallets.map((w) => <code key={w} style={{ fontSize: 11, color: "#d1d5db", fontFamily: "monospace" }}>{w}</code>)}
            </div>
          </Field>
          {data.activeSuccessor && (
            <Field label={t.successor}>
              <Pill color="#FF3B5C">{t.yes}</Pill>
              {data.successorWallet && <code style={{ fontSize: 11, color: "#d1d5db", fontFamily: "monospace" }}>{data.successorWallet}</code>}
            </Field>
          )}
          <Field label={t.source}>
            {data.sourceThreadUrl ? (
              <a href={data.sourceThreadUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#FF6B00", fontWeight: 700, textDecoration: "none" }}>
                {data.sourceInvestigator ?? "source"} ↗
              </a>
            ) : <span style={{ fontSize: 13, color: "#d1d5db" }}>{data.sourceInvestigator ?? "—"}</span>}
            {data.specterCollab && <Pill color="#FF6B00">Specter × INTERLIGENS</Pill>}
          </Field>
        </div>

        {/* BODY */}
        <div style={{ borderTop: "1px solid #1a1a1a", marginTop: 16, paddingTop: 28 }}>
          {data.bodyMarkdown
            ? renderMarkdown(data.bodyMarkdown)
            : <p style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", lineHeight: 1.7 }}>{t.bodyPending}</p>}
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid #111827", marginTop: 32, paddingTop: 20, fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
          {t.disclaimer}
        </div>
      </div>
    </div>
  );
}
