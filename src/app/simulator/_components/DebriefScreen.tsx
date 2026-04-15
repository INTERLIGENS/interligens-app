import type { Scenario } from "@/lib/simulator/scenarios";
import { STARTING_CAPITAL } from "@/lib/simulator/scenarios";

type Props = {
  scenario: Scenario;
  entered: boolean;
  onRestart: () => void;
};

type DebriefLine = { label: string; value: string };

function buildDebrief(scenario: Scenario, entered: boolean): DebriefLine[] {
  if (scenario.id === "kol-push") {
    return entered
      ? [
          { label: "Process", value: "Mauvais" },
          { label: "Résultat", value: "Perte évitable" },
          { label: "Signal ignoré", value: "Narratif promotionnel, concentration anormale" },
          { label: "Ce qu'il fallait voir", value: "Le pic n'était pas un entry, c'était une sortie organisée" },
        ]
      : [
          { label: "Process", value: "Bon" },
          { label: "Résultat", value: "Perte évitée" },
          { label: "Signal lu", value: "TigerScore RED à 89" },
          { label: "Ce que tu as fait de bien", value: "Lu le score avant la narration" },
        ];
  }

  if (scenario.id === "clean-facade") {
    return entered
      ? [
          { label: "Process", value: "Mauvais" },
          { label: "Résultat", value: "Perte évitable" },
          { label: "Signal ignoré", value: "Concentration wallet fondateur, liquidité non vérifiable" },
          { label: "Ce qu'il fallait voir", value: "Le design ne remplace jamais la vérification on-chain" },
        ]
      : [
          { label: "Process", value: "Bon" },
          { label: "Résultat", value: "Perte évitée" },
          { label: "Signal lu", value: "Liquidité non vérifiable, concentration 78%" },
          { label: "Ce que tu as fait de bien", value: "Regardé la structure, pas l'apparence" },
        ];
  }

  return entered
    ? [
        { label: "Process", value: "Mauvais — mais chance" },
        { label: "Résultat", value: "Gain chanceux" },
        { label: "Signal ignoré", value: "Sorties early wallets, fenêtre courte" },
        { label: "Ce qu'il fallait voir", value: "Le gain ne valide pas la méthode" },
      ]
    : [
        { label: "Process", value: "Bon" },
        { label: "Résultat", value: "Gain manqué, risque évité" },
        { label: "Signal lu", value: "TigerScore ORANGE, profil fragile" },
        { label: "Ce que tu as fait de bien", value: "Accepté qu'éviter un bon trade n'est pas une erreur" },
      ];
}

export function DebriefScreen({ scenario, entered, onRestart }: Props) {
  const outcome = entered ? scenario.onEnter : scenario.onSkip;
  const finalCapital = STARTING_CAPITAL + outcome.capitalDelta;
  const lines = buildDebrief(scenario, entered);
  const cooldown = finalCapital <= 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <div className="text-[10px] uppercase tracking-[0.3em] text-[#FF6B00]">
        Débrief — {scenario.token}
      </div>
      <h1 className="mt-1 font-black text-2xl uppercase leading-tight tracking-tight sm:text-3xl">
        Ce qui s'est vraiment passé
      </h1>

      <p className="mt-6 text-sm leading-relaxed text-white/80 sm:text-base">
        {outcome.debrief}
      </p>

      <div className="mt-8 border border-white/10">
        {lines.map((line, i) => (
          <div
            key={line.label}
            className={`grid grid-cols-[110px_1fr] gap-4 px-4 py-3 ${
              i > 0 ? "border-t border-white/10" : ""
            }`}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              {line.label}
            </div>
            <div className="text-[12px] uppercase tracking-wide text-white/90">
              {line.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border border-white/10 bg-white/[0.02] p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          Ce que le TigerScore signalait
        </div>
        <div className="mt-3 space-y-1.5">
          {scenario.signals.map((s) => (
            <div key={s} className="text-[12px] text-white/85">
              — {s}
            </div>
          ))}
        </div>
      </div>

      {cooldown && (
        <div className="mt-6 border border-[#FF3B5C]/40 bg-[#FF3B5C]/5 p-5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#FF3B5C]">
            Cooldown simulé — 48:00:00
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/80">
            Ton capital fictif est à zéro. Dans la vraie vie, c'est le moment où
            on arrête — pas où on rejoue. Ce timer n'est pas exécuté. Il te
            rappelle juste que la discipline inclut aussi le repos.
          </p>
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          onClick={onRestart}
          className="border border-[#FF6B00] bg-[#FF6B00] px-8 py-4 font-black text-sm uppercase tracking-[0.18em] text-black transition hover:bg-[#FF8A3D]"
        >
          Retour aux scénarios
        </button>
      </div>
    </div>
  );
}
