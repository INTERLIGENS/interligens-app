import type { Scenario } from "@/lib/simulator/scenarios";
import { STARTING_CAPITAL } from "@/lib/simulator/scenarios";
import { ScenarioChart } from "./ScenarioChart";

type Props = {
  scenario: Scenario;
  entered: boolean;
  onContinue: () => void;
};

export function ResultScreen({ scenario, entered, onContinue }: Props) {
  const outcome = entered ? scenario.onEnter : scenario.onSkip;
  const finalCapital = STARTING_CAPITAL + outcome.capitalDelta;
  const deltaPositive = outcome.capitalDelta > 0;
  const deltaNegative = outcome.capitalDelta < 0;
  const deltaColor = deltaPositive
    ? "#00C853"
    : deltaNegative
      ? "#FF3B5C"
      : "#FFFFFF";

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-14">
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
        Résultat — {scenario.token}
      </div>
      <h1 className="mt-1 font-black text-2xl uppercase leading-tight tracking-tight sm:text-3xl">
        {entered ? "Tu es entré" : "Tu n'es pas entré"}
      </h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-[1.3fr_1fr]">
        <div>
          <ScenarioChart
            data={scenario.chart}
            entryIndex={scenario.entryIndex}
            dangerZone={scenario.dangerZone}
            showEntry={entered}
          />
          <p className="mt-5 text-sm leading-relaxed text-white/80">
            {outcome.narrative}
          </p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            Capital fictif — ce scénario
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-black text-4xl">{finalCapital}</span>
            <span
              className="text-[11px] font-black uppercase tracking-[0.15em]"
              style={{ color: deltaColor }}
            >
              {outcome.capitalDelta > 0 ? "+" : ""}
              {outcome.capitalDelta}
            </span>
          </div>
          <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/40">
            Départ : {STARTING_CAPITAL}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <button
          onClick={onContinue}
          className="border border-[#FF6B00] bg-[#FF6B00] px-8 py-4 font-black text-sm uppercase tracking-[0.18em] text-black transition hover:bg-[#FF8A3D]"
        >
          Débrief →
        </button>
      </div>
    </div>
  );
}
