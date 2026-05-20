// Presentational view for a Token Fraud casefile (token_casefiles row).
// Server-renderable (no hooks). Shared by /en/cases/<slug> and /fr/cases/<slug>.
// Token-flavored counterpart to PlatformCasefileView: same shell, TigerScore
// instead of PlatformRisk, ticker / asset-overview / founders / sources blocks.
import BetaNav from "@/components/beta/BetaNav";
import renderMarkdown from "@/components/cases/renderMarkdown";

export interface TokenCasefileSource {
  investigator: string;
  date: string;
  url: string | null;
  note?: string | null;
}
export interface TokenCasefileFounder {
  name: string;
  handle: string;
  location: string | null;
  priorProject: string | null;
}
export interface TokenCasefileKeyWallet {
  role: string;
  address: string;
  holdingLab?: string | null;
}
export interface TokenCasefileData {
  ref: string;
  codename: string;
  ticker: string;
  title: string;
  family: string;
  subtype: string;
  tigerScore: number;
  verdict: string;
  status: string;
  statusNote: string | null;
  primaryChain: string;
  secondaryChains: string[];
  contractAddresses: Record<string, string | null>;
  tokenName: string | null;
  decimals: number | null;
  totalSupply: string | null;
  circulatingSupply: string | null;
  ath: number | null;
  atl: number | null;
  fdvPeakUsd: number | null;
  marketCapMinUsd: number | null;
  marketCapMaxUsd: number | null;
  tgeDate: string | null;
  claimedRaiseUsd: number | null;
  backers: string[];
  founders: TokenCasefileFounder[];
  exchanges: string[];
  exitExchanges: string[];
  keyWallets: TokenCasefileKeyWallet[];
  linkedTokens: string[];
  estimatedRetailHarmUsd: number | null;
  currency: string;
  sources: TokenCasefileSource[];
  specterCollab: boolean;
  publishedDate: string | null;
  summary: string | null;
  summaryFr: string | null;
  bodyMarkdown: string | null;
}

type Locale = "en" | "fr";

const T: Record<Locale, Record<string, string>> = {
  en: {
    kicker: "TOKEN FRAUD CASEFILE",
    tigerScore: "TigerScore",
    status: "Status",
    family: "Family", subtype: "Sub-type",
    primaryChain: "Primary chain", secondaryChains: "Secondary chains",
    contract: "Contract", tokenName: "Token name",
    decimals: "Decimals", totalSupply: "Total supply",
    circulating: "Circulating supply",
    ath: "All-time high", atl: "All-time low",
    fdvPeak: "FDV peak", marketCap: "Market cap range",
    tge: "TGE", claimedRaise: "Claimed raise",
    backers: "Stated backers", exchanges: "Trading venues",
    exitExchanges: "Insider cash-out exchanges", linkedTokens: "Same-playbook tokens",
    estimatedHarm: "Estimated retail harm", currency: "Currency",
    founders: "Founders", keyWallets: "Key wallets",
    sources: "Investigation sources",
    published: "Published",
    bodyPending: "Full dossier body pending.",
    disclaimer: "Documented critical risk. Architecture, not recipe. This dossier is an analytical instrument built from publicly available blockchain data and documented third-party investigations. It is not legal advice and not a judicial finding.",
    handle: "Handle", location: "Location", priorProject: "Prior project",
    role: "Role", address: "Address",
    open: "open",
  },
  fr: {
    kicker: "DOSSIER FRAUDE TOKEN",
    tigerScore: "TigerScore",
    status: "Statut",
    family: "Famille", subtype: "Sous-type",
    primaryChain: "Chaîne principale", secondaryChains: "Chaînes secondaires",
    contract: "Contrat", tokenName: "Nom du token",
    decimals: "Décimales", totalSupply: "Supply total",
    circulating: "Supply circulant",
    ath: "Plus haut historique", atl: "Plus bas historique",
    fdvPeak: "FDV au pic", marketCap: "Fourchette market cap",
    tge: "TGE", claimedRaise: "Levée déclarée",
    backers: "Investisseurs annoncés", exchanges: "Lieux de trading",
    exitExchanges: "Exchanges de cash-out", linkedTokens: "Tokens du même schéma",
    estimatedHarm: "Préjudice retail estimé", currency: "Devise",
    founders: "Fondateurs", keyWallets: "Wallets clés",
    sources: "Sources de l'investigation",
    published: "Publié",
    bodyPending: "Corps du dossier en attente.",
    disclaimer: "Risque critique documenté. Architecture, pas recette. Ce dossier est un instrument analytique construit à partir de données blockchain publiques et d'investigations tierces documentées. Il ne constitue pas un conseil juridique ni une décision judiciaire.",
    handle: "Compte", location: "Localisation", priorProject: "Projet précédent",
    role: "Rôle", address: "Adresse",
    open: "ouvrir",
  },
};

const FAMILY_LABEL: Record<string, { en: string; fr: string }> = {
  pump_and_dump: { en: "Pump'n'Dump", fr: "Pump'n'Dump" },
  token_manipulation: { en: "Token Manipulation", fr: "Manipulation de token" },
};
const SUBTYPE_LABEL: Record<string, { en: string; fr: string }> = {
  insider_supply_control: { en: "Insider Supply Control", fr: "Contrôle insider du supply" },
  coordinated_exit: { en: "Coordinated Exit", fr: "Sortie coordonnée" },
};
const VERDICT_COLOR: Record<string, string> = {
  AVOID: "#FF3B5C",
  WARNING: "#FFB800",
  SAFE: "#00FF94",
};

function explorerLink(chain: string, address: string): string | null {
  const c = chain.toLowerCase();
  if (c.includes("bnb") || c === "bsc") return `https://bscscan.com/address/${address}`;
  if (c.includes("ethereum") || c === "eth") return `https://etherscan.io/address/${address}`;
  if (c.includes("base")) return `https://basescan.org/address/${address}`;
  if (c.includes("arbitrum")) return `https://arbiscan.io/address/${address}`;
  return null;
}

function fmtUsd(n: number | null, compact = true): string {
  if (n == null) return "—";
  if (!compact) return "$" + n.toLocaleString("en-US");
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("en-US");
}
function fmtSupply(s: string | null): string {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  return n.toLocaleString("en-US");
}
function fmtPrice(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toPrecision(3);
}
function fmtRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return fmtUsd(min) + " – " + fmtUsd(max);
  return fmtUsd((min ?? max) as number);
}
function shortAddr(a: string): string {
  return a.length > 14 ? a.slice(0, 8) + "…" + a.slice(-6) : a;
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
    <div>
      <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 5 }}>{label.toUpperCase()}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>
    </div>
  );
}

export default function TokenCasefileView({ data, locale }: { data: TokenCasefileData; locale: Locale }) {
  const t = T[locale];
  const family = FAMILY_LABEL[data.family]?.[locale] ?? data.family;
  const subtype = SUBTYPE_LABEL[data.subtype]?.[locale] ?? data.subtype;
  const verdictColor = VERDICT_COLOR[data.verdict] ?? "#6b7280";
  const summary = locale === "fr" ? (data.summaryFr ?? data.summary) : data.summary;
  const primaryContract = data.contractAddresses[data.primaryChain] ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>

        {/* HEADER */}
        <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 900, letterSpacing: "0.2em", marginBottom: 12 }}>{t.kicker}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>{data.codename}</h1>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#FF6B00", letterSpacing: "0.02em" }}>{data.ticker}</span>
          <span style={{ fontSize: 12, color: "#4b5563", fontFamily: "monospace" }}>{data.ref}</span>
        </div>
        <div style={{ fontSize: 16, color: "#d1d5db", marginTop: 6, fontWeight: 600 }}>{data.title}</div>

        {/* SCORE + STATUS */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "24px 0 8px" }}>
          <div style={{ background: "#0f0f0f", border: `1px solid ${verdictColor}55`, borderRadius: 10, padding: "16px 22px", minWidth: 200 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 6 }}>{t.tigerScore.toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: verdictColor, fontFamily: "monospace" }}>{data.tigerScore}<span style={{ fontSize: 14, color: "#4b5563" }}>/100</span></div>
              <span style={{ background: verdictColor + "18", border: `1px solid ${verdictColor}`, color: verdictColor, fontSize: 10, fontWeight: 900, padding: "3px 10px", borderRadius: 4, letterSpacing: "0.12em" }}>
                {data.verdict}
              </span>
            </div>
          </div>
          <div style={{ background: "#0f0f0f", border: `1px solid ${verdictColor}55`, borderRadius: 10, padding: "16px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.15em", marginBottom: 8 }}>{t.status.toUpperCase()}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ background: `${verdictColor}18`, border: `1px solid ${verdictColor}`, color: verdictColor, fontSize: 11, fontWeight: 900, padding: "6px 12px", borderRadius: 6, letterSpacing: "0.08em" }}>
                {data.status.replace(/_/g, " ")}
              </span>
              {data.statusNote && (
                <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>{data.statusNote}</span>
              )}
            </div>
          </div>
        </div>

        {summary && (
          <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.75, margin: "20px 0 28px", maxWidth: 760 }}>{summary}</p>
        )}

        {/* ASSET OVERVIEW — two independent flex columns */}
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 24 }}>
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
              <Field label={t.family}><Pill color="#FF6B00">{family}</Pill></Field>
              <Field label={t.primaryChain}><Pill color="#3b82f6">{data.primaryChain}</Pill></Field>
              <Field label={t.contract}>
                {primaryContract ? (
                  <a href={explorerLink(data.primaryChain, primaryContract) ?? "#"}
                     target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 12, color: "#FF6B00", fontFamily: "monospace", textDecoration: "none" }}>
                    {shortAddr(primaryContract)} ↗
                  </a>
                ) : <span style={{ fontSize: 13, color: "#6b7280" }}>—</span>}
              </Field>
              <Field label={t.totalSupply}>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#d1d5db", fontFamily: "monospace" }}>{fmtSupply(data.totalSupply)}</span>
              </Field>
              <Field label={t.tge}>
                <span style={{ fontSize: 13, color: "#d1d5db" }}>{data.tgeDate ?? "—"}</span>
              </Field>
              <Field label={t.fdvPeak}>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#FF3B5C", fontFamily: "monospace" }}>{fmtUsd(data.fdvPeakUsd)}</span>
              </Field>
              <Field label={t.estimatedHarm}>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#FF3B5C", fontFamily: "monospace" }}>{fmtUsd(data.estimatedRetailHarmUsd)}</span>
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
              <Field label={t.subtype}><Pill color="#8b5cf6">{subtype}</Pill></Field>
              <Field label={t.secondaryChains}>
                {data.secondaryChains.length > 0
                  ? data.secondaryChains.map((c) => <Pill key={c} color="#3b82f6">{c}</Pill>)
                  : <span style={{ fontSize: 13, color: "#6b7280" }}>—</span>}
              </Field>
              <Field label={t.decimals}>
                <span style={{ fontSize: 13, color: "#d1d5db", fontFamily: "monospace" }}>{data.decimals ?? "—"}</span>
              </Field>
              <Field label={t.circulating}>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#d1d5db", fontFamily: "monospace" }}>{fmtSupply(data.circulatingSupply)}</span>
              </Field>
              <Field label={t.ath + " / " + t.atl}>
                <span style={{ fontSize: 14, color: "#00FF94", fontFamily: "monospace" }}>{fmtPrice(data.ath)}</span>
                <span style={{ fontSize: 11, color: "#4b5563" }}>—</span>
                <span style={{ fontSize: 14, color: "#9ca3af", fontFamily: "monospace" }}>{fmtPrice(data.atl)}</span>
              </Field>
              <Field label={t.marketCap}>
                <span style={{ fontSize: 14, color: "#d1d5db", fontFamily: "monospace" }}>{fmtRange(data.marketCapMinUsd, data.marketCapMaxUsd)}</span>
              </Field>
              <Field label={t.claimedRaise}>
                <span style={{ fontSize: 14, color: "#d1d5db", fontFamily: "monospace" }}>{fmtUsd(data.claimedRaiseUsd, false)}</span>
              </Field>
            </div>
          </div>

          {/* Pills sections — full width below the 2-col block */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 24 }}>
            <Field label={t.backers}>
              {data.backers.length > 0
                ? data.backers.map((b) => <Pill key={b} color="#FFB800">{b}</Pill>)
                : <span style={{ fontSize: 13, color: "#6b7280" }}>—</span>}
            </Field>
            <Field label={t.exchanges}>
              {data.exchanges.length > 0
                ? data.exchanges.map((e) => <Pill key={e} color="#3b82f6">{e}</Pill>)
                : <span style={{ fontSize: 13, color: "#6b7280" }}>—</span>}
            </Field>
            <Field label={t.exitExchanges}>
              {data.exitExchanges.length > 0
                ? data.exitExchanges.map((e) => <Pill key={e} color="#FF3B5C">{e}</Pill>)
                : <span style={{ fontSize: 13, color: "#6b7280" }}>—</span>}
            </Field>
            <Field label={t.linkedTokens}>
              {data.linkedTokens.length > 0
                ? data.linkedTokens.map((tk) => <Pill key={tk} color="#8b5cf6">{tk}</Pill>)
                : <span style={{ fontSize: 13, color: "#6b7280" }}>—</span>}
            </Field>

            {/* Founders */}
            {data.founders.length > 0 && (
              <Field label={t.founders}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                  {data.founders.map((f) => (
                    <div key={f.name} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline", padding: "8px 0", borderTop: "1px solid #161616" }}>
                      <span style={{ fontSize: 13, color: "#f9fafb", fontWeight: 700 }}>{f.name}</span>
                      <span style={{ fontSize: 12, color: "#FF6B00", fontFamily: "monospace" }}>{f.handle}</span>
                      {f.location && <span style={{ fontSize: 11, color: "#9ca3af" }}>· {f.location}</span>}
                      {f.priorProject && <span style={{ fontSize: 11, color: "#6b7280" }}>· {f.priorProject}</span>}
                    </div>
                  ))}
                </div>
              </Field>
            )}

            {/* Key wallets */}
            {data.keyWallets.length > 0 && (
              <Field label={t.keyWallets}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  {data.keyWallets.map((w) => {
                    const link = explorerLink(data.primaryChain, w.address);
                    return (
                      <div key={w.address} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline", padding: "6px 0", borderTop: "1px solid #161616" }}>
                        <span style={{ fontSize: 12, color: "#d1d5db", fontWeight: 600, flex: "1 1 260px" }}>{w.role}</span>
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer"
                             style={{ fontSize: 11, color: "#FF6B00", fontFamily: "monospace", textDecoration: "none" }}>
                            {w.address} ↗
                          </a>
                        ) : (
                          <code style={{ fontSize: 11, color: "#d1d5db", fontFamily: "monospace" }}>{w.address}</code>
                        )}
                        {w.holdingLab && w.holdingLab !== "0" && (
                          <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{w.holdingLab} LAB</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* Sources */}
            {data.sources.length > 0 && (
              <Field label={t.sources}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  {data.sources.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline", padding: "6px 0", borderTop: "1px solid #161616" }}>
                      <span style={{ fontSize: 12, color: "#FF6B00", fontFamily: "monospace", fontWeight: 700 }}>{s.investigator}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>· {s.date}</span>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                           style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>
                          {t.open} ↗
                        </a>
                      ) : null}
                      {s.note && <span style={{ fontSize: 11, color: "#6b7280" }}>· {s.note}</span>}
                    </div>
                  ))}
                </div>
                {data.specterCollab && <Pill color="#FF6B00">Specter × INTERLIGENS</Pill>}
              </Field>
            )}

            <Field label={t.published}>
              <span style={{ fontSize: 13, color: "#d1d5db" }}>{data.publishedDate ?? "—"}</span>
            </Field>
          </div>
        </div>

        {/* BODY — capped at a comfortable reading width */}
        <div style={{ borderTop: "1px solid #1a1a1a", marginTop: 16, paddingTop: 28 }}>
          <div style={{ maxWidth: 760 }}>
            {data.bodyMarkdown
              ? renderMarkdown(data.bodyMarkdown)
              : <p style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", lineHeight: 1.7 }}>{t.bodyPending}</p>}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid #111827", marginTop: 32, paddingTop: 20, fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
          {t.disclaimer}
        </div>
      </div>
    </div>
  );
}
