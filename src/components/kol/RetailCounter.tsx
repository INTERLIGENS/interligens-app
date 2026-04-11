"use client";

import { useEffect, useState } from "react";
import { rollingProceedsLabel, lastUpdatedLabel } from "@/lib/retail/labels";

interface RollingFlow {
  rolling24hUsd?: number;
  rolling7dUsd?: number;
  rolling30dUsd?: number;
  rolling365dUsd?: number;
  lastFlowComputedAt?: string | null;
}

interface Props {
  handle: string;
  initial?: RollingFlow;
}

export default function RetailCounter({ handle, initial }: Props) {
  const [flow, setFlow] = useState<RollingFlow | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    if (initial) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/kol/${encodeURIComponent(handle)}/proceeds`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!alive) return;
        setFlow({
          rolling24hUsd:  Number(json?.summary?.rolling24hUsd  ?? 0),
          rolling7dUsd:   Number(json?.summary?.rolling7dUsd   ?? 0),
          rolling30dUsd:  Number(json?.summary?.rolling30dUsd  ?? 0),
          rolling365dUsd: Number(json?.summary?.rolling365dUsd ?? 0),
          lastFlowComputedAt: json?.summary?.lastFlowComputedAt ?? null,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [handle, initial]);

  if (loading) {
    return (
      <div className="border border-white/10 bg-black p-4 text-xs tracking-widest text-white/40 uppercase">
        Chargement du compteur retail…
      </div>
    );
  }

  if (!flow) return null;

  const rows: Array<[string, number]> = [
    [rollingProceedsLabel("24h",  flow.rolling24hUsd  ?? 0), flow.rolling24hUsd  ?? 0],
    [rollingProceedsLabel("7d",   flow.rolling7dUsd   ?? 0), flow.rolling7dUsd   ?? 0],
    [rollingProceedsLabel("30d",  flow.rolling30dUsd  ?? 0), flow.rolling30dUsd  ?? 0],
    [rollingProceedsLabel("365d", flow.rolling365dUsd ?? 0), flow.rolling365dUsd ?? 0],
  ];

  return (
    <section className="border border-[#FF6B00]/40 bg-black p-5">
      <h3 className="text-xs font-black tracking-widest text-[#FF6B00] uppercase">
        Compteur retail — cash-out vers exchanges
      </h3>
      <ul className="mt-3 space-y-1 font-mono text-sm text-white">
        {rows.map(([label]) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] tracking-widest text-white/40 uppercase">
        {lastUpdatedLabel(flow.lastFlowComputedAt)}
      </p>
    </section>
  );
}
