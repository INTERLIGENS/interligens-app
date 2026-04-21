import type { ScanSignal } from "@/lib/contracts/website";
import { SignalRow } from "../result/SignalRow";

export function BehaviouralRail({ signals }: { signals: ScanSignal[] }) {
  return (
    <section className="fx-behavioural-rail" aria-label="Behavioural signals">
      {signals.map((s, i) => <SignalRow key={s.id} signal={s} index={i} />)}
    </section>
  );
}
