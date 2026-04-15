"use client";

import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "@/lib/simulator/scenarios";

type Props = {
  data: PricePoint[];
  entryIndex: number;
  dangerZone: { from: number; to: number };
  showEntry?: boolean;
};

export function ScenarioChart({
  data,
  entryIndex,
  dangerZone,
  showEntry = true,
}: Props) {
  const entryPoint = data[entryIndex];
  const yMin = Math.min(...data.map((d) => d.p)) * 0.9;
  const yMax = Math.max(...data.map((d) => d.p)) * 1.05;

  return (
    <div className="h-[220px] w-full border border-white/10 bg-white/[0.02] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="simArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B00" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#FF6B00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={[yMin, yMax]} hide />
          <ReferenceArea
            x1={dangerZone.from}
            x2={dangerZone.to}
            fill="#FF3B5C"
            fillOpacity={0.08}
            stroke="#FF3B5C"
            strokeOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="p"
            stroke="#FF6B00"
            strokeWidth={2}
            fill="url(#simArea)"
          />
          <Line
            type="monotone"
            dataKey="p"
            stroke="#FF6B00"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {showEntry && entryPoint && (
            <ReferenceDot
              x={entryPoint.t}
              y={entryPoint.p}
              r={5}
              fill="#FFFFFF"
              stroke="#FF6B00"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
