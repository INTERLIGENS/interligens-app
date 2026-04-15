import type { Scenario } from "@/lib/simulator/scenarios";
import { STARTING_CAPITAL } from "@/lib/simulator/scenarios";
import { ScenarioChart } from "./ScenarioChart";
import { TigerScoreMock } from "./TigerScoreMock";

type Props = {
  scenario: Scenario;
  onDecide: (enter: boolean) => void;
  onBack: () => void;
};

export function ScenarioScreen({ scenario, onDecide, onBack }: Props) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-14">
      <button
        onClick={onBack}
        className="text-[10px] uppercase tracking-[0.25em] text-white/40 hover:text-[#FF6B00]"
      >
        ← Retour
      </button>

      <div className="mt-6 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#FF6B00]">
            {scenario.token}
          </div>
          <h1 className="mt-1 font-black text-2xl uppercase leading-tight tracking-tight sm:text-3xl">
            {scenario.title}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            Capital fictif
          </div>
          <div className="font-black text-xl">{STARTING_CAPITAL}</div>
        </div>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-white/80 sm:text-base">
        {scenario.context}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-white/40">
            Prix simulé — point d'entrée marqué
          </div>
          <ScenarioChart
            data={scenario.chart}
            entryIndex={scenario.entryIndex}
            dangerZone={scenario.dangerZone}
          />
          <div className="mt-3 space-y-1">
            {scenario.stats.map((s) => (
              <div key={s} className="text-[11px] uppercase tracking-wider text-white/60">
                — {s}
              </div>
            ))}
          </div>
        </div>

        <TigerScoreMock
          score={scenario.tigerScore}
          tier={scenario.tier}
          signals={scenario.signals}
          verdict={scenario.verdict}
        />
      </div>

      <div className="mt-10">
        <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-white/40">
          Ta décision
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onDecide(true)}
            className="border border-white/20 bg-transparent px-6 py-4 font-black text-sm uppercase tracking-[0.18em] transition hover:border-[#FF6B00] hover:text-[#FF6B00]"
          >
            Entrer
          </button>
          <button
            onClick={() => onDecide(false)}
            className="border border-[#FF6B00] bg-[#FF6B00] px-6 py-4 font-black text-sm uppercase tracking-[0.18em] text-black transition hover:bg-[#FF8A3D]"
          >
            Ne pas entrer
          </button>
        </div>
      </div>
    </div>
  );
}
