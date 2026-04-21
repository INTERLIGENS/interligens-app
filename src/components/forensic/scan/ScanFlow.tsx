import type { FlowStep } from "@/lib/mocks/scan";

export function ScanFlow({ steps }: { steps: FlowStep[] }) {
  return (
    <section className="fx-scan-flow" aria-labelledby="fx-scan-flow-title">
      <header className="fx-scan-flow__head">
        <div className="fx-scan-flow__kicker">WHAT HAPPENS NEXT · 04 STEPS</div>
        <h2 id="fx-scan-flow-title" className="fx-scan-flow__title">
          From intake to evidence.
        </h2>
      </header>
      <ol className="fx-scan-flow__grid">
        {steps.map((s) => (
          <li key={s.idx} className="fx-scan-flow__step">
            <div className="fx-scan-flow__idx">{s.idx}</div>
            <div className="fx-scan-flow__label">{s.label}</div>
            <p className="fx-scan-flow__body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
