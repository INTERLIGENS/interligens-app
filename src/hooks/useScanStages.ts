"use client";
import { useEffect, useRef, useState } from "react";

const STAGES_EN = [
  "Scanning on-chain…",
  "Verifying sources…",
  "Building evidence…",
];
const STAGES_FR = [
  "Analyse on-chain…",
  "Vérification des sources…",
  "Construction des preuves…",
];

export function useScanStages(isLoading: boolean, lang: "en" | "fr") {
  const [stageIndex, setStageIndex] = useState(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stages = lang === "fr" ? STAGES_FR : STAGES_EN;

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStageIndex(-1);
    if (!isLoading) return;

    timers.current.push(setTimeout(() => setStageIndex(0), 300));
    timers.current.push(setTimeout(() => setStageIndex(1), 950));
    timers.current.push(setTimeout(() => setStageIndex(2), 1550));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [isLoading, lang]);

  return { stageIndex, stageLabel: stageIndex >= 0 ? stages[stageIndex] : null };
}
