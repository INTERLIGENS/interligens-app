import SyntheticBanner from "@/components/admin/casefile-engine/SyntheticBanner";
import { assertCasefileEngineEnabled } from "@/lib/casefile-engine/gate";

export const dynamic = "force-dynamic";

// Next.js 16: params is a Promise and must be awaited.
type Props = { params: Promise<{ id: string }> };

export default async function CasefileEngineEditPage({ params }: Props) {
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
          CASEFILE ENGINE — EDIT DRAFT (V1 SCAFFOLD)
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
          Draft <code style={{ fontFamily: "Menlo, monospace" }}>{id}</code>
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          V1 scaffold — full editor ships after Neon migration is applied.
        </p>
      </div>
    </div>
  );
}
