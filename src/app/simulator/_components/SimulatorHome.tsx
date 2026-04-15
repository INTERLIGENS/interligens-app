import { SCENARIOS } from "@/lib/simulator/scenarios";

type Props = {
  onSelect: (scenarioId: string) => void;
};

export function SimulatorHome({ onSelect }: Props) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:py-20">
      <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-[#FF6B00]">
        Interligens Simulator
      </div>
      <h1 className="font-black text-3xl uppercase leading-[1.05] tracking-tight sm:text-5xl">
        Entraîne ton process.
        <br />
        Pas ton portefeuille.
      </h1>
      <p className="mt-5 max-w-xl text-sm text-white/60 sm:text-base">
        Trois scénarios. Une seule décision à chaque fois. Aucun argent, aucun
        wallet, aucun enjeu réel. Juste ton jugement face aux signaux.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="group border border-white/10 bg-white/[0.02] p-5 text-left transition hover:border-[#FF6B00] hover:bg-white/[0.04]"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              Scénario {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-4 font-black text-lg uppercase leading-tight tracking-tight">
              {s.title}
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-wider text-white/50">
              {s.token}
            </div>
            <div className="mt-6 text-[11px] uppercase tracking-[0.2em] text-[#FF6B00] opacity-0 transition group-hover:opacity-100">
              Commencer →
            </div>
          </button>
        ))}
      </div>

      <div className="mt-14 border-t border-white/10 pt-6 text-[10px] uppercase tracking-[0.2em] text-white/40">
        Éducatif. Aucune valeur financière. Aucun conseil en investissement.
      </div>
    </div>
  );
}
