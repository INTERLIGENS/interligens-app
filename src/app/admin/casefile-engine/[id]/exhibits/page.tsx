import SyntheticBanner from "@/components/admin/casefile-engine/SyntheticBanner";
import {
  MINIMUM_EXHIBIT_FIELDS,
  ESCALATION_PACK_FIELDS,
} from "@/lib/casefile-engine/integrity-gate";
import { assertCasefileEngineEnabled } from "@/lib/casefile-engine/gate";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CasefileEngineExhibitsPage({ params }: Props) {
  assertCasefileEngineEnabled();
  const { id } = await params;

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
          CASEFILE ENGINE — EXHIBITS REGISTER (V1 SCAFFOLD)
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
          Exhibits for <code style={{ fontFamily: "Menlo, monospace" }}>{id}</code>
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          V1 scaffold — CRUD ships after Neon migration is applied. Below: the
          fields the Integrity Gate enforces.
        </p>

        <section style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Minimum (9 fields, blocking)
          </div>
          <ul
            style={{
              marginTop: 8,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {MINIMUM_EXHIBIT_FIELDS.map((f) => (
              <li
                key={f}
                style={{
                  padding: "8px 12px",
                  background: "#0D0D0D",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  fontFamily: "Menlo, monospace",
                  fontSize: 11,
                }}
              >
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Escalation pack (7 additional fields, blocking when escalating)
          </div>
          <ul
            style={{
              marginTop: 8,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {ESCALATION_PACK_FIELDS.map((f) => (
              <li
                key={f}
                style={{
                  padding: "8px 12px",
                  background: "#0D0D0D",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  fontFamily: "Menlo, monospace",
                  fontSize: 11,
                }}
              >
                {f}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
