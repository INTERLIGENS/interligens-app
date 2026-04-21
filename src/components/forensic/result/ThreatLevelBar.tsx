export function ThreatLevelBar({
  percent,
  mark,
}: {
  percent: number;              // 0–100
  mark: string;                 // "87% Critical Risk"
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="fx-threat-level">
      <div className="fx-threat-level__inner">
        <div className="fx-threat-level__label">
          <span>Threat Level</span>
          <span>{mark}</span>
        </div>
        <div className="fx-threat-level__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="fx-threat-level__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
