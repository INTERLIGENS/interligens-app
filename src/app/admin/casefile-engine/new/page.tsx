import SyntheticBanner from "@/components/admin/casefile-engine/SyntheticBanner";
import { assertCasefileEngineEnabled } from "@/lib/casefile-engine/gate";

export const dynamic = "force-dynamic";

const WIZARD_STEPS: { id: number; title: string; purpose: string }[] = [
  { id: 1, title: "Reporter context", purpose: "country + language + acknowledgements" },
  { id: 2, title: "Controlled wallets", purpose: "wallets the reporter controls + proof" },
  { id: 3, title: "Funds source", purpose: "origin of the funds + pricing method" },
  { id: 4, title: "Incident pattern", purpose: "pattern type + structured timeline" },
  { id: 5, title: "On-chain trace", purpose: "txids + addresses-in-flow + obfuscation flag" },
  { id: 6, title: "Touchpoints", purpose: "CEX touchpoints + jurisdictions" },
  { id: 7, title: "Off-chain context", purpose: "domains, platform, public handles" },
  { id: 8, title: "Exhibits register", purpose: "9 minimum fields per exhibit" },
  { id: 9, title: "Triage preview", purpose: "auto A/B/E + civil-review/cluster flags" },
  { id: 10, title: "Integrity gate", purpose: "evidence package completeness + counsel review" },
];

export default function CasefileEngineNewPage() {
  assertCasefileEngineEnabled();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <SyntheticBanner />
      <div style={{ padding: "32px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#FF6B00",
            fontWeight: 700,
          }}
        >
          CASEFILE ENGINE — NEW DRAFT (V1 SCAFFOLD)
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
          Wizard outline
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          10 steps. The structured form per step ships after the Neon migration
          is applied — V1 scaffold renders the outline only.
        </p>

        <ol
          style={{
            marginTop: 24,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 8,
          }}
        >
          {WIZARD_STEPS.map((s) => (
            <li
              key={s.id}
              style={{
                padding: 16,
                background: "#0D0D0D",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#FF6B00",
                    letterSpacing: "0.08em",
                    minWidth: 28,
                  }}
                >
                  {String(s.id).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.55)",
                  marginTop: 4,
                  marginLeft: 40,
                }}
              >
                {s.purpose}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
