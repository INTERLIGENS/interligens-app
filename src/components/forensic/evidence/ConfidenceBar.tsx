import type { Confidence } from "@/lib/contracts/website";

const WIDTH: Record<Confidence, number> = {
  low: 25,
  medium: 55,
  high: 80,
  certified: 100,
};

export function ConfidenceBar({ level }: { level: Confidence }) {
  return (
    <div className="fx-confidence-bar" role="meter" aria-label={`Confidence: ${level}`} aria-valuenow={WIDTH[level]} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="fx-confidence-bar__fill"
        data-level={level}
        style={{ width: `${WIDTH[level]}%` }}
      />
    </div>
  );
}
