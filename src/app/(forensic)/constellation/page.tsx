import {
  ClassificationBar,
  Masthead,
  SectionHead,
  ConstellationCanvas,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import { loadSnapshot, validateSnapshot } from "@/lib/constellation";

export const metadata = {
  title: "Constellation — INTERLIGENS",
};

export default async function ConstellationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id = "vine" } = await searchParams;
  const snapshot = await loadSnapshot(id);
  validateSnapshot(snapshot);

  return (
    <>
      <ClassificationBar ctx={snapshot.classification} statusLabel={`CONSTELLATION · ${id.toUpperCase()}`} />
      <Masthead active="/constellation" />

      <main>
        <div className="fx-container">
          <SectionHead
            kicker={`SNAPSHOT · ${snapshot.capturedAt.slice(0, 10)}`}
            title="Case constellation."
            dek="Frozen public snapshot. Same schema as the live investigator graph, with coordinates baked in so the network reads identically across sessions. Hover titles, click-through, and replay remain on the investigator side."
          />
          <ConstellationCanvas snapshot={snapshot} />

          <section style={{ padding: "48px 0", borderTop: "1px solid var(--rule)", marginTop: 48 }}>
            <h3 className="t-title-l" style={{ marginBottom: 16 }}>Signal brief</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {snapshot.signalBrief.map((s) => (
                <li key={s.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--rule)" }}>
                  <div className="t-mono-meta" style={{ color: "var(--signal)", marginBottom: 8 }}>
                    {s.priority.toUpperCase()}
                  </div>
                  <div className="t-title-m" style={{ color: "var(--bone)", marginBottom: 6 }}>{s.title}</div>
                  <div className="t-body-s" style={{ color: "var(--bone-soft)" }}>{s.detail}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
