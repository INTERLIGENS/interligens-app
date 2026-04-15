"use client";

import { useState } from "react";
import { getScenario } from "@/lib/simulator/scenarios";
import { DebriefScreen } from "./_components/DebriefScreen";
import { ResultScreen } from "./_components/ResultScreen";
import { ScenarioScreen } from "./_components/ScenarioScreen";
import { SimulatorHome } from "./_components/SimulatorHome";

type Step = "home" | "scenario" | "result" | "debrief";

export default function SimulatorPage() {
  const [step, setStep] = useState<Step>("home");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [entered, setEntered] = useState<boolean>(false);

  const scenario = scenarioId ? getScenario(scenarioId) : undefined;

  const handleSelect = (id: string) => {
    setScenarioId(id);
    setEntered(false);
    setStep("scenario");
  };

  const handleDecide = (enter: boolean) => {
    setEntered(enter);
    setStep("result");
  };

  const handleRestart = () => {
    setScenarioId(null);
    setEntered(false);
    setStep("home");
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {step === "home" && <SimulatorHome onSelect={handleSelect} />}
      {step === "scenario" && scenario && (
        <ScenarioScreen
          scenario={scenario}
          onDecide={handleDecide}
          onBack={handleRestart}
        />
      )}
      {step === "result" && scenario && (
        <ResultScreen
          scenario={scenario}
          entered={entered}
          onContinue={() => setStep("debrief")}
        />
      )}
      {step === "debrief" && scenario && (
        <DebriefScreen
          scenario={scenario}
          entered={entered}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}
