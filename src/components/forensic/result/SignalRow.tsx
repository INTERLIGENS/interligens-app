import type { ScanSignal, Verdict } from "@/lib/contracts/website";

const TONE: Record<Verdict, "risk" | "signal" | "caution" | "cleared"> = {
  critical: "risk",
  high: "risk",
  elevated: "signal",
  monitoring: "caution",
  cleared: "cleared",
};

/** Single signal card rendered inside a grid. */
export function SignalRow({ signal, index }: { signal: ScanSignal; index: number }) {
  const tone = TONE[signal.verdict];
  const n = String(index + 1).padStart(2, "0");
  return (
    <article className="fx-signal-card">
      <div className="fx-signal-indicator" data-tone={tone} aria-hidden />
      <div className="fx-signal-label">SIGNAL · {n}</div>
      <h3 className="fx-signal-title">{signal.label}</h3>
      <div className="fx-signal-value" data-tone={tone}>{signal.value}</div>
      {signal.detail && <p className="fx-signal-detail">{signal.detail}</p>}
    </article>
  );
}

/** 3-column signal grid (V2 shell). Auto-reflows on narrow screens. */
export function SignalGrid({ signals }: { signals: ScanSignal[] }) {
  return (
    <section className="fx-signal-grid" aria-label="Signals">
      {signals.map((s, i) => <SignalRow key={s.id} signal={s} index={i} />)}
    </section>
  );
}
