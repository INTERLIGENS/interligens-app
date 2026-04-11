"use client";

import { useEffect, useState } from "react";

interface AlertKol {
  handle: string;
  displayName: string;
  tigerScore: number;
  tier: "RED" | "ORANGE" | "YELLOW" | "GREEN";
  retailLabel: string;
  proceedsUsd: number;
  proceedsLabel: string;
  avgDumpDelayMinutes: number;
  avgDumpDelayLabel: string;
  isPromoted: boolean;
  isFundedByProject: boolean;
  fundedByLabel: string;
}

interface AlertResponse {
  hasAlert: boolean;
  kols?: AlertKol[];
  summary?: string;
  chain: string;
  tokenAddress: string;
}

interface Props {
  chain: string;
  address: string;
}

export default function KolAlert({ chain, address }: Props) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [data, setData] = useState<AlertResponse | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/token/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/kol-alert`,
          { headers: { accept: "application/json" } }
        );
        if (!res.ok) {
          if (alive) setState("error");
          return;
        }
        const json = (await res.json()) as AlertResponse;
        if (!alive) return;
        setData(json);
        setState("ok");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [chain, address]);

  if (state !== "ok" || !data || !data.hasAlert || !data.kols?.length) return null;

  return (
    <section className="border-2 border-red-500 bg-black p-5">
      <h3 className="text-xs font-black tracking-widest text-red-500 uppercase">
        ⚠ Alerte KOL — ce token est surveillé
      </h3>
      <p className="mt-2 text-sm text-white">{data.summary}</p>
      <ul className="mt-4 space-y-3">
        {data.kols.map((k) => (
          <li key={k.handle} className="border border-white/10 bg-black/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black tracking-widest text-white uppercase">
                {k.displayName}
              </span>
              <span
                className={
                  "text-[10px] tracking-widest uppercase " +
                  (k.tier === "RED"
                    ? "text-red-500"
                    : k.tier === "ORANGE"
                    ? "text-orange-500"
                    : k.tier === "YELLOW"
                    ? "text-yellow-400"
                    : "text-green-500")
                }
              >
                {k.retailLabel}
              </span>
            </div>
            <ul className="mt-2 space-y-1 font-mono text-xs text-white/80">
              <li>• {k.proceedsLabel}</li>
              <li>• {k.avgDumpDelayLabel}</li>
              {k.isFundedByProject && <li>• ⚠ {k.fundedByLabel}</li>}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
